import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { renderClipLocal } from './renderer-ffmpeg.js';
import { generateScript } from './openai-llm.js';
import { synthesizeTTS } from './elevenlabs-tts.js';
import { probeDuration, proposeSegments } from './clipper.js';
import { getActiveBackend } from './moment-detector.js';
import { resolveAudioOnly, extractAudioSegment } from './video-downloader.js';
import { Storage } from '../storage/storage.js';
import { writeSimpleSRT } from '../utils/subtitles.js';
import { settings } from '../config/settings.js';

/**
 * Platform presets for "auto mode".
 * Each preset defines the recommended clip duration range (seconds) and the
 * default number of clips to extract when the user has not set them manually.
 * All three platforms use vertical 9:16 (handled by the renderer's
 * getQualityParams → 1080x1920 default), so the main difference is duration.
 */
const PLATFORM_PRESETS: Record<string, { minDuration: number; maxDuration: number; defaultClipCount: number; label: string }> = {
  tiktok: { minDuration: 15, maxDuration: 25, defaultClipCount: 3, label: 'TikTok' },
  shorts: { minDuration: 15, maxDuration: 60, defaultClipCount: 3, label: 'YouTube Shorts' },
  reels: { minDuration: 15, maxDuration: 30, defaultClipCount: 3, label: 'Instagram Reels' }
};

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
async function cleanupFiles(filePaths: (string | null | undefined)[]): Promise<void> {
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

// Helper function to recursively clean up a directory (and its contents)
async function cleanupDirectory(dirPath: string): Promise<void> {
  try {
    if (dirPath) {
      await fs.rm(dirPath, { recursive: true, force: true });
      console.log(`Cleaned up directory: ${dirPath}`);
    }
  } catch (error) {
    console.error(`Failed to cleanup directory ${dirPath}:`, error);
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
        } else {
          // Validate video before sending
          await validateVideo(source);
          
          // Send file path directly - node-telegram-bot-api handles file paths properly
          await bot.sendVideo(chatId, source, 'Видео скачано без обработки');
          await bot.sendMessage(chatId, '✅ Обработка завершена! Напишите /start, чтобы создать новое видео.');
        }
      } catch (error) {
        console.error('Error sending video:', error);
        await bot.sendMessage(chatId, `❌ Ошибка отправки видео: ${error}`);
      } finally {
        // Clean up source video from tmp after sending (regardless of outcome)
        await cleanupFiles([source]);
      }
      await storage.updateTaskStatus(taskId, 'done', {});
      return;
    }

    // Audio only mode
    if (mode === 'audio_only') {
      await bot.sendMessage(chatId, 'Извлекаю аудио...');
      let audioPath: string | null = null;
      try {
        audioPath = await resolveAudioOnly(task.sourceUrl || null, source || null);
        
        // Check file size before sending
        const stats = await fs.stat(audioPath);
        const fileSizeMB = stats.size / (1024 * 1024);
        
        if (fileSizeMB > 50) {
          await bot.sendMessage(chatId, `❌ Аудио слишком большое для отправки (${fileSizeMB.toFixed(1)}MB)`);
        } else {
          // Use stream instead of buffer to avoid memory issues
          const audioStream = createReadStream(audioPath);
          await bot.sendAudio(chatId, audioStream, 'Аудио извлечено в MP3');
          await bot.sendMessage(chatId, '✅ Обработка завершена! Напишите /start, чтобы создать новое видео.');
        }
      } catch (error) {
        console.error('Error sending audio:', error);
        await bot.sendMessage(chatId, `❌ Ошибка отправки аудио: ${error}`);
      } finally {
        // Clean up extracted audio and source video from tmp after sending
        await cleanupFiles([audioPath, source]);
      }
      await storage.updateTaskStatus(taskId, 'done', {});
      return;
    }

    
    // Audio from segment mode - extract audio from specific time range
    if (mode === 'audio_from_segment') {
      const segStartTime = task.startTime;
      const segEndTime = task.endTime;
      
      // Debug: log task data
      console.log('DEBUG audio_from_segment task:', {
        taskId: task.id,
        sourcePath: task.sourcePath,
        sourcePathType: typeof task.sourcePath,
        sourceUrl: task.sourceUrl,
        startTime: segStartTime,
        endTime: segEndTime
      });
      
      if (segStartTime === null || segStartTime === undefined || segEndTime === null || segEndTime === undefined) {
        await bot.sendMessage(chatId, '❌ Ошибка: не указан временной интервал для извлечения аудио.');
        await storage.updateTaskStatus(taskId, 'failed', {});
        return;
      }
      
      // Validate source path exists and is a proper string
      if (!source || typeof source !== 'string' || source.trim() === '') {
        console.error('Invalid source path for audio extraction:', { source, type: typeof source, constructor: source?.constructor?.name });
        await bot.sendMessage(chatId, '❌ Ошибка: исходный файл не найден. Возможно, видео не было загружено. Попробуйте отправить видео заново.');
        await storage.updateTaskStatus(taskId, 'failed', {});
        return;
      }
      
      // Verify the source file exists
      try {
        await fs.access(source);
      } catch {
        console.error('Source file not found:', source);
        await bot.sendMessage(chatId, '❌ Ошибка: файл видео не найден. Возможно, он был удален. Попробуйте отправить видео заново.');
        await storage.updateTaskStatus(taskId, 'failed', {});
        return;
      }
      
      const formatTime = (s: number): string => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return mins + ':' + secs.toString().padStart(2, '0');
      };
      
      await bot.sendMessage(chatId, '🎵 Извлекаю аудио из интервала ' + formatTime(segStartTime) + ' - ' + formatTime(segEndTime) + '...');
      let audioPath: string | null = null;
      try {
        audioPath = await extractAudioSegment(source, segStartTime, segEndTime, settings.TMP_DIR);
        
        const stats = await fs.stat(audioPath);
        const fileSizeMB = stats.size / (1024 * 1024);
        
        if (fileSizeMB > 50) {
          await bot.sendMessage(chatId, '❌ Аудио слишком большое (' + fileSizeMB.toFixed(1) + 'MB)');
        } else {
          const audioStream = createReadStream(audioPath);
          await bot.sendAudio(chatId, audioStream, 'Аудио извлечено из интервала ' + formatTime(segStartTime) + '-' + formatTime(segEndTime));
          await bot.sendMessage(chatId, '✅ Обработка завершена! Напишите /start, чтобы создать новое видео.');
        }
      } catch (error) {
        console.error('Error extracting audio segment:', error);
        await bot.sendMessage(chatId, '❌ Ошибка извлечения аудио: ' + error);
      } finally {
        await cleanupFiles([audioPath, source]);
      }
      await storage.updateTaskStatus(taskId, 'done', {});
      return;
    }

    const platform = task.platform || null;
    const preset = platform ? PLATFORM_PRESETS[platform] : null;
    const clipCount = preset && !task.clipCount ? preset.defaultClipCount : task.clipCount;
    const startTime = task.startTime;
    const endTime = task.endTime;
    const trend = task.trendChoice || null;
    const musicPath = task.mp3Path;
    const audioStartTime = task.audioStartTime;
    const audioEndTime = task.audioEndTime;
    const quality = task.quality;
    const playbackSpeed = task.playbackSpeed;

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
      // top_moments mode — smart detection always works:
      // OpenCV native binding if available, otherwise ffmpeg signalstats.
      const backendLabel = getActiveBackend() === 'ffmpeg'
        ? 'ffmpeg'
        : 'OpenCV';
      await bot.sendMessage(
        chatId,
        `🎬 Анализирую видео для поиска лучших моментов (${backendLabel}). Это займёт немного времени...`
      );
      const minDur = preset ? preset.minDuration : 15;
      const maxDur = preset ? preset.maxDuration : 25;
      segments = await proposeSegments(source, clipCount, minDur, maxDur);
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
        quality: quality || null,
        playbackSpeed: playbackSpeed || null
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
    // Clean up source video and user-provided music from tmp after sending
    await cleanupFiles([source, musicPath || null]);
    // Remove the entire output directory (TTS audio, SRT subtitles, and any leftovers)
    await cleanupDirectory(outDir);
    
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
