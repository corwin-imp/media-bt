import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { renderClipLocal } from './renderer-ffmpeg.js';
import { generateScript } from './openai-llm.js';
import { synthesizeTTS } from './elevenlabs-tts.js';
import { probeDuration, proposeSegments } from './clipper.js';
import { resolveAudioOnly } from './video-downloader.js';
import { Storage } from '../storage/storage.js';
import { writeSimpleSRT } from '../utils/subtitles.js';
import { settings } from '../config/settings.js';

/**
 * Validates that a video file is playable and has proper codec/container.
 * Uses ffprobe to verify the file has valid video and audio streams.
 */
async function validateVideo(videoPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name,width,height,pix_fmt',
      '-of', 'default=noprint_wrappers=1',
      videoPath
    ]);

    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (data: Buffer) => {
      stdout += data;
    });

    ffprobe.stderr.on('data', (data: Buffer) => {
      stderr += data;
    });

    ffprobe.on('close', (code: number) => {
      if (code !== 0) {
        reject(new Error(`Invalid video file (ffprobe failed): ${stderr}`));
        return;
      }
      
      if (!stdout.trim()) {
        reject(new Error('Invalid video file: no video stream found'));
        return;
      }
      
      // Verify codec is h264 (Telegram recommended)
      if (!stdout.includes('codec_name=h264')) {
        console.warn(`Video codec is not h264: ${stdout.trim()}`);
      }
      
      // Verify pixel format is yuv420p (required for broad compatibility)
      if (!stdout.includes('pix_fmt=yuv420p')) {
        console.warn(`Video pixel format is not yuv420p: ${stdout.trim()}`);
      }
      
      resolve();
    });

    ffprobe.on('error', (err: Error) => {
      reject(new Error(`ffprobe not found: ${err.message}`));
    });
  });
}

// Type for Telegram bot - will be defined in bot handlers
interface TelegramBot {
  sendMessage: (chatId: number, text: string) => Promise<any>;
  sendVideo: (chatId: number, video: Buffer | string | any, caption?: string) => Promise<any>;
  sendAudio: (chatId: number, audio: Buffer | string | any, caption?: string) => Promise<any>;
}

// Helper function to clean up files
async function cleanupFiles(filePaths: string[]): Promise<void> {
  for (const filePath of filePaths) {
    try {
      if (filePath) {
        await fs.unlink(filePath);
        console.log(`Cleaned up file: ${filePath}`);
      }
    } catch (error) {
      console.error(`Failed to cleanup file ${filePath}:`, error);
    }
  }
}

export async function processTask(
  taskId: string,
  chatId: number,
  bot: TelegramBot,
  storage: Storage
): Promise<void> {
  try {
    await storage.updateTaskStatus(taskId, 'processing', {});
    const task = await storage.getTask(taskId);
    const source = task.sourcePath;
    const mode = task.mode;

    // Download only mode
    if (mode === 'download_only') {
      await bot.sendMessage(chatId, 'Готово! Отправляю видео...');
      try {
        // Telegram Bot API hard limit: 50MB for sending files
        const TELEGRAM_MAX_MB = 50;
        
        // Check file size before sending
        const stats = await fs.stat(source);
        const fileSizeMB = stats.size / (1024 * 1024);
        
        if (fileSizeMB > TELEGRAM_MAX_MB) {
          await bot.sendMessage(chatId, `❌ Видео слишком большое для Telegram (${fileSizeMB.toFixed(1)}MB, лимит 50MB)`);
          await bot.sendMessage(chatId, `Видео доступно по пути: ${source}`);
        } else {
          // Validate video before sending
          await validateVideo(source);
          
          // Send file path directly - node-telegram-bot-api handles it properly
          await bot.sendVideo(chatId, source, 'Видео скачано без обработки');
          await bot.sendMessage(chatId, '✅ Обработка завершена! Напишите /start, чтобы создать новое видео.');
        }
      } catch (error) {
        console.error('Error sending video:', error);
        await bot.sendMessage(chatId, `❌ Ошибка отправки видео: ${error}`);
        await bot.sendMessage(chatId, `Видео доступно по пути: ${source}`);
      }
      await storage.updateTaskStatus(taskId, 'done', {});
      return;
    }

    // Audio only mode
    if (mode === 'audio_only') {
      await bot.sendMessage(chatId, 'Извлекаю аудио...');
      try {
        const audioPath = await resolveAudioOnly(task.sourceUrl || null, source || null);
        
        // Check file size before sending
        const stats = await fs.stat(audioPath);
        const fileSizeMB = stats.size / (1024 * 1024);
        
        if (fileSizeMB > 50) {
          await bot.sendMessage(chatId, `❌ Аудио слишком большое для отправки (${fileSizeMB.toFixed(1)}MB)`);
          await bot.sendMessage(chatId, `Аудио доступно по пути: ${audioPath}`);
        } else {
          // Use stream instead of buffer to avoid memory issues
          const audioStream = createReadStream(audioPath);
          await bot.sendAudio(chatId, audioStream, 'Аудио извлечено в MP3');
          await bot.sendMessage(chatId, '✅ Обработка завершена! Напишите /start, чтобы создать новое видео.');
        }
      } catch (error) {
        console.error('Error sending audio:', error);
        await bot.sendMessage(chatId, `❌ Ошибка отправки аудио: ${error}`);
        await bot.sendMessage(chatId, `Аудио доступно по пути: ${source}`);
      }
      await storage.updateTaskStatus(taskId, 'done', {});
      return;
    }

    const clipCount = task.clipCount;
    const startTime = task.startTime;
    const endTime = task.endTime;
    const trend = task.trendChoice || null;
    const musicPath = task.mp3Path;
    const audioStartTime = task.audioStartTime;
    const audioEndTime = task.audioEndTime;
    const quality = task.quality;

    const useLLM = !!settings.OPENAI_API_KEY;
    const useTTS = !!(settings.ELEVENLABS_API_KEY && settings.ELEVENLABS_VOICE_ID && !musicPath);

    // Determine segments based on mode
    let segments: Array<[number, number]>;
    if (mode === 'custom_segment' && startTime !== null && startTime !== undefined && endTime !== null && endTime !== undefined) {
      const duration = endTime - startTime;
      segments = [[startTime, duration]];
    } else if (mode === 'entire_material') {
      const totalDuration = await probeDuration(source);
      segments = [[0, totalDuration]];
    } else {
      segments = await proposeSegments(source, clipCount, 15, 25);
    }

    const outDir = path.join(settings.DATA_DIR, 'out', taskId);
    await fs.mkdir(outDir, { recursive: true });

    for (let idx = 0; idx < segments.length; idx++) {
      const [start, dur] = segments[idx];
      const segmentNum = idx + 1;

      let script: string | null = null;
      if (useLLM) {
        script = await generateScript(trend, Math.round(dur));
      }

      let ttsPath: string | null = null;
      if (useTTS && script) {
        ttsPath = await synthesizeTTS(script, outDir);
      }

      let srtPath: string | null = null;
      if (script) {
        srtPath = path.join(outDir, `sub_${segmentNum}.srt`);
        await writeSimpleSRT(script, dur, srtPath);
      }

      const clipPath = await renderClipLocal({
        sourceVideo: source,
        startS: start,
        durationS: dur,
        ttsAudio: ttsPath,
        subtitlesSrt: srtPath,
        outDir: outDir,
        musicAudio: musicPath || null,
        audioStartTime: audioStartTime || null,
        audioEndTime: audioEndTime || null,
        quality: quality || null
      });

      const caption = makeCaption(trend, script);
      await storage.addResultClip(taskId, clipPath, caption);
    }

    await storage.updateTaskStatus(taskId, 'done', {});
    const results = await storage.getResults(taskId);
    await bot.sendMessage(chatId, 'Готово! Отправляю клипы...');
    
    let successCount = 0;
    const clipsToCleanup: string[] = [];
    
    // Telegram Bot API hard limit: 50MB for sending files
    const TELEGRAM_MAX_MB = 50;
    
    for (const result of results) {
      try {
        // Check if file exists first
        await fs.access(result.clipPath);
        
        // Check file size
        const stats = await fs.stat(result.clipPath);
        const fileSizeMB = stats.size / (1024 * 1024);
        
        if (fileSizeMB > TELEGRAM_MAX_MB) {
          await bot.sendMessage(chatId, `⚠️ Клип слишком большой для Telegram (${fileSizeMB.toFixed(1)}MB, лимит 50MB): ${result.caption}`);
          console.warn(`Clip too large for Telegram: ${result.clipPath} (${fileSizeMB.toFixed(1)}MB)`);
          clipsToCleanup.push(result.clipPath);
          continue;
        }
        
        // Validate video is playable using ffprobe before sending
        await validateVideo(result.clipPath);
        
        // Send file path directly - node-telegram-bot-api handles file paths
        // and properly sets the filename/mimetype for Telegram
        await bot.sendVideo(chatId, result.clipPath, result.caption || ' ');
        successCount++;
        clipsToCleanup.push(result.clipPath);
      } catch (error) {
        console.error('Error processing clip:', error);
        await bot.sendMessage(chatId, `❌ Ошибка отправки клипа: ${error}`).catch(sendErr => {
          console.error('Failed to send error message:', sendErr);
        });
      }
    }
    
    // Cleanup processed clips after sending
    await cleanupFiles(clipsToCleanup);
    
    if (successCount === 0 && results.length > 0) {
      await bot.sendMessage(chatId, '❌ Не удалось отправить ни один клип. Проверьте логи для деталей.');
    } else if (successCount < results.length) {
      await bot.sendMessage(chatId, `✅ Отправлено ${successCount} из ${results.length} клипов. Напишите /start, чтобы создать новое видео.`);
    } else {
      await bot.sendMessage(chatId, '✅ Обработка завершена! Напишите /start, чтобы создать новое видео.');
    }
  } catch (error) {
    await storage.updateTaskStatus(taskId, 'failed', { error: String(error) });
    await bot.sendMessage(chatId, `Ошибка при обработке задачи: ${error}`);
  }
}

function makeCaption(trend: string | null, script: string | null): string {
  const parts: string[] = [];
  if (trend) {
    parts.push(trend);
  }
  if (script) {
    parts.push(`Voiceover:\n${script.substring(0, 500)}`);
  }
  return parts.length > 0 ? parts.join('\n\n') : '';
}
