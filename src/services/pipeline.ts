import { promises as fs } from 'fs';
import path from 'path';
import { renderClipLocal } from './renderer-ffmpeg.js';
import { generateScript } from './openai-llm.js';
import { synthesizeTTS } from './elevenlabs-tts.js';
import { probeDuration, proposeSegments } from './clipper.js';
import { resolveAudioOnly } from './video-downloader.js';
import { Storage } from '../storage/storage.js';
import { writeSimpleSRT } from '../utils/subtitles.js';
import { settings } from '../config/settings.js';

// Type for Telegram bot - will be defined in bot handlers
interface TelegramBot {
  sendMessage: (chatId: number, text: string) => Promise<any>;
  sendVideo: (chatId: number, video: Buffer | string, caption?: string) => Promise<any>;
  sendAudio: (chatId: number, audio: Buffer | string, caption?: string) => Promise<any>;
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
        const fileBuffer = await fs.readFile(source);
        await bot.sendVideo(chatId, fileBuffer, 'Видео скачано без обработки');
      } catch (error) {
        await bot.sendMessage(chatId, `Видео готово: ${source}`);
      }
      await storage.updateTaskStatus(taskId, 'done', {});
      await bot.sendMessage(chatId, '✅ Обработка завершена! Напишите /start, чтобы создать новое видео.');
      return;
    }

    // Audio only mode
    if (mode === 'audio_only') {
      await bot.sendMessage(chatId, 'Извлекаю аудио...');
      try {
        const audioPath = await resolveAudioOnly(task.sourceUrl, source);
        const fileBuffer = await fs.readFile(audioPath);
        await bot.sendAudio(chatId, fileBuffer, 'Аудио извлечено в MP3');
      } catch (error) {
        await bot.sendMessage(chatId, `Аудио готово: ${source}`);
      }
      await storage.updateTaskStatus(taskId, 'done', {});
      await bot.sendMessage(chatId, '✅ Обработка завершена! Напишите /start, чтобы создать новое видео.');
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
    if (mode === 'custom_segment' && startTime !== null && endTime !== null) {
      const duration = endTime - startTime;
      segments = [[startTime, duration]];
    } else if (mode === 'entire_material') {
      const totalDuration = probeDuration(source);
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
    
    for (const result of results) {
      try {
        const fileBuffer = await fs.readFile(result.clipPath);
        await bot.sendVideo(chatId, fileBuffer, result.caption);
      } catch (error) {
        await bot.sendMessage(chatId, `Клип готов: ${result.clipPath}\n${result.caption}`);
      }
    }
    
    await bot.sendMessage(chatId, '✅ Обработка завершена! Напишите /start, чтобы создать новое видео.');
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
  return parts.length > 0 ? parts.join('\n\n') : ' ';
}