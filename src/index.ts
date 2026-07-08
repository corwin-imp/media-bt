import TelegramBot from 'node-telegram-bot-api';
import { settings } from './config/settings.js';
import { setupLogging } from './utils/logger.js';
import { SQLiteStorage } from './storage/sqlite-storage.js';
import { processTask } from './services/pipeline.js';
import { resolveSourceWithQuality } from './services/video-downloader.js';
import { fetchTrendingHashtags } from './services/trends.js';
import { ru } from './i18n/ru.js';
import { promises as fs } from 'fs';
import path from 'path';
import { createWriteStream, createReadStream, statSync } from 'fs';

// Setup logging
setupLogging(settings.DEBUG);

// Create bot
const bot = new TelegramBot(settings.TELEGRAM_TOKEN, { polling: true });

// Initialize storage
const storage = await SQLiteStorage.create(settings.DB_PATH);

// Session storage (in-memory for simplicity)
const sessions = new Map<number, SessionData>();

interface SessionData {
  sourcePath?: string;
  sourceUrl?: string;
  quality?: number;
  mode?: string;
  clipCount?: number;
  startTime?: number;
  endTime?: number;
  trendChoice?: string | null;
  mp3Path?: string;
  audioStartTime?: number;
  audioEndTime?: number;
}

// States
enum State {
  SOURCE = 1,
  QUALITY_SELECTION = 2,
  MODE_SELECTION = 3,
  CLIP_COUNT = 4,
  CUSTOM_SEGMENT = 5,
  TRENDS = 6,
  MUSIC_SELECTION = 7,
  AUDIO_SEGMENT = 8,
  PROCESSING = 9
}

const userStates = new Map<number, State>();

// Bot commands
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, ru.START);
  userStates.set(chatId, State.SOURCE);
});

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, ru.HELP.replace('{max_mb}', settings.MAX_SOURCE_MB.toString()));
});

bot.onText(/\/cancel/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, ru.CANCELLED);
  userStates.delete(chatId);
  sessions.delete(chatId);
});

// Handle text messages
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const state = userStates.get(chatId);

  // Skip if no state or command
  if (!state || msg.text?.startsWith('/')) return;

  const session = sessions.get(chatId) || {};

  try {
    switch (state) {
      case State.SOURCE:
        await handleSource(msg, chatId, session);
        break;
      case State.QUALITY_SELECTION:
        await handleQualitySelection(msg, chatId, session);
        break;
      case State.MODE_SELECTION:
        await handleModeSelection(msg, chatId, session);
        break;
      case State.CLIP_COUNT:
        await handleClipCount(msg, chatId, session);
        break;
      case State.CUSTOM_SEGMENT:
        await handleCustomSegment(msg, chatId, session);
        break;
      case State.TRENDS:
        await handleTrends(msg, chatId, session);
        break;
      case State.MUSIC_SELECTION:
        await handleMusicSelection(msg, chatId, session);
        break;
      case State.AUDIO_SEGMENT:
        await handleAudioSegment(msg, chatId, session);
        break;
    }
  } catch (error) {
    await bot.sendMessage(chatId, `${ru.ERROR_GENERIC}: ${error}`);
  }
});

// Handle video files
bot.on('video', async (msg) => {
  const chatId = msg.chat.id;
  const state = userStates.get(chatId);

  if (state === State.SOURCE || state === State.MUSIC_SELECTION) {
    await handleVideo(msg, chatId, state);
  }
});

// Handle audio files
bot.on('audio', async (msg) => {
  const chatId = msg.chat.id;
  const state = userStates.get(chatId);

  if (state === State.MUSIC_SELECTION) {
    await handleAudio(msg, chatId);
  }
});

async function handleSource(msg: any, chatId: number, session: SessionData): Promise<void> {
  const text = msg.text;
  
  if (isValidUrl(text)) {
    session.sourceUrl = text;
    await bot.sendMessage(chatId, ru.SOURCE_RECEIVED);
    await bot.sendMessage(chatId, ru.ASK_QUALITY);
    userStates.set(chatId, State.QUALITY_SELECTION);
  } else {
    await bot.sendMessage(chatId, ru.INVALID_INPUT);
  }
  
  sessions.set(chatId, session);
}

async function handleQualitySelection(msg: any, chatId: number, session: SessionData): Promise<void> {
  const text = msg.text?.trim();
  const qualityMap: Record<string, number> = {
    '1080': 1080,
    '720': 720,
    '480': 480,
    '360': 360
  };

  const quality = qualityMap[text || ''];
  if (!quality) {
    await bot.sendMessage(chatId, ru.INVALID_QUALITY);
    return;
  }

  session.quality = quality;
  
  try {
    await bot.sendMessage(chatId, ru.QUALITY_SELECTED.replace('{quality}', quality.toString()));
    
    if (session.sourceUrl) {
      session.sourcePath = await resolveSourceWithQuality(session.sourceUrl, quality);
      await bot.sendMessage(chatId, ru.SOURCE_RECEIVED);
    }
    
    await bot.sendMessage(chatId, ru.ASK_MODE);
    userStates.set(chatId, State.MODE_SELECTION);
    sessions.set(chatId, session);
  } catch (error) {
    await bot.sendMessage(chatId, `${ru.ERROR_GENERIC}: ${error}`);
  }
}

async function handleModeSelection(msg: any, chatId: number, session: SessionData): Promise<void> {
  const text = msg.text?.trim().toLowerCase();
  
  if (text?.includes('1') || text?.includes('top') || text?.includes('моменты')) {
    session.mode = 'top_moments';
    await bot.sendMessage(chatId, ru.ASK_CLIP_COUNT);
    userStates.set(chatId, State.CLIP_COUNT);
  } else if (text?.includes('2') || text?.includes('segment') || text?.includes('кусок')) {
    session.mode = 'custom_segment';
    await bot.sendMessage(chatId, ru.ASK_CUSTOM_SEGMENT);
    userStates.set(chatId, State.CUSTOM_SEGMENT);
  } else if (text?.includes('3') || text?.includes('entire') || text?.includes('весь')) {
    session.mode = 'entire_material';
    await bot.sendMessage(chatId, ru.ASK_TRENDS);
    userStates.set(chatId, State.TRENDS);
  } else if (text?.includes('4') || text?.includes('download') || text?.includes('скачать')) {
    session.mode = 'download_only';
    await startProcessing(chatId, session);
  } else if (text?.includes('5') || text?.includes('audio') || text?.includes('звук')) {
    session.mode = 'audio_only';
    await startProcessing(chatId, session);
  } else {
    await bot.sendMessage(chatId, ru.INVALID_MODE);
  }
  
  sessions.set(chatId, session);
}

async function handleClipCount(msg: any, chatId: number, session: SessionData): Promise<void> {
  const text = msg.text?.trim();
  const count = parseInt(text || '0', 10);

  if (isNaN(count) || count < 1 || count > 10) {
    await bot.sendMessage(chatId, 'Введите число клипов от 1 до 10.');
    return;
  }

  session.clipCount = count;
  await bot.sendMessage(chatId, ru.ASK_TRENDS);
  userStates.set(chatId, State.TRENDS);
  sessions.set(chatId, session);
}

async function handleCustomSegment(msg: any, chatId: number, session: SessionData): Promise<void> {
  const text = msg.text?.trim();
  const parts = text?.split(' ');

  if (!parts || parts.length !== 2) {
    await bot.sendMessage(chatId, ru.INVALID_SEGMENT_FORMAT);
    return;
  }

  const startTime = parseTimeToSeconds(parts[0]);
  const endTime = parseTimeToSeconds(parts[1]);

  if (startTime === null || endTime === null) {
    await bot.sendMessage(chatId, ru.INVALID_SEGMENT_FORMAT);
    return;
  }

  if (startTime >= endTime) {
    await bot.sendMessage(chatId, ru.INVALID_SEGMENT_RANGE);
    return;
  }

  if (endTime - startTime < 5) {
    await bot.sendMessage(chatId, 'Минимальная длительность клипа — 5 секунд.');
    return;
  }

  if (endTime - startTime > 60) {
    await bot.sendMessage(chatId, 'Максимальная длительность клипа — 60 секунд.');
    return;
  }

  session.startTime = startTime;
  session.endTime = endTime;
  await bot.sendMessage(chatId, ru.ASK_TRENDS);
  userStates.set(chatId, State.TRENDS);
  sessions.set(chatId, session);
}

async function handleTrends(msg: any, chatId: number, session: SessionData): Promise<void> {
  const text = msg.text?.trim().toLowerCase();

  if (text === 'да' || text === 'yes' || text === 'y') {
    const trends = await fetchTrendingHashtags(5);
    const formatted = trends.map((t, i) => `${i + 1}) ${t}`).join('\n');
    await bot.sendMessage(chatId, ru.TREND_OPTIONS.replace('{items}', formatted));
    // Wait for user to select or provide custom tags
    sessions.set(chatId, session);
  } else if (text === 'нет' || text === 'no' || text === 'n') {
    session.trendChoice = undefined;
    await bot.sendMessage(chatId, ru.ASK_MUSIC);
    userStates.set(chatId, State.MUSIC_SELECTION);
    sessions.set(chatId, session);
  } else if (/^\d+$/.test(text)) {
    const index = parseInt(text, 10) - 1;
    const trends = await fetchTrendingHashtags(5);
    if (index >= 0 && index < trends.length) {
      session.trendChoice = trends[index];
      await bot.sendMessage(chatId, ru.ASK_MUSIC);
      userStates.set(chatId, State.MUSIC_SELECTION);
      sessions.set(chatId, session);
    } else {
      session.trendChoice = text;
      await bot.sendMessage(chatId, ru.ASK_MUSIC);
      userStates.set(chatId, State.MUSIC_SELECTION);
      sessions.set(chatId, session);
    }
  } else {
    session.trendChoice = text;
    await bot.sendMessage(chatId, ru.ASK_MUSIC);
    userStates.set(chatId, State.MUSIC_SELECTION);
    sessions.set(chatId, session);
  }
}

// Proper TelegramBot wrapper to match our interface
class TelegramBotWrapper {
  constructor(private bot: TelegramBot) {}
  
  sendMessage(chatId: number, text: string) {
    return this.bot.sendMessage(chatId, text);
  }
  
  sendVideo(chatId: number, video: Buffer | string | any, caption?: string) {
    const options: any = {};
    if (caption) {
      options.caption = caption;
    }
    
    if (Buffer.isBuffer(video)) {
      options.filename = 'video.mp4';
    } else if (typeof video === 'string') {
      // File path - node-telegram-bot-api handles this natively
    } else if (video && typeof video === 'object' && video.path) {
      // ReadStream - need to set filename for Telegram
      options.filename = 'clip.mp4';
    }
    
    return this.bot.sendVideo(chatId, video, options);
  }
  
  sendAudio(chatId: number, audio: Buffer | string | any, caption?: string) {
    const options: any = {};
    if (caption) {
      options.caption = caption;
    }
    
    if (Buffer.isBuffer(audio)) {
      options.filename = 'audio.mp3';
    } else if (typeof audio === 'string') {
      // File path - node-telegram-bot-api handles this natively
    } else if (audio && typeof audio === 'object' && audio.path) {
      // ReadStream - need to set filename for Telegram
      options.filename = 'audio.mp3';
    }
    
    return this.bot.sendAudio(chatId, audio, options);
  }
}

async function handleMusicSelection(msg: any, chatId: number, session: SessionData): Promise<void> {
  const text = msg.text?.trim().toLowerCase();

  if (text === 'нет' || text === 'no' || text === 'n') {
    session.mp3Path = undefined;
    await bot.sendMessage(chatId, ru.NO_MUSIC);
    await startProcessing(chatId, session);
  } else {
    await bot.sendMessage(chatId, ru.INVALID_INPUT);
  }
}

async function handleAudio(msg: any, chatId: number): Promise<void> {
  const session = sessions.get(chatId) || {};
  
  try {
    const fileId = msg.audio.file_id;
    const fileInfo = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${settings.TELEGRAM_TOKEN}/${fileInfo.file_path}`;
    
    const fileName = `${fileId}.mp3`;
    const filePath = path.join(settings.TMP_DIR, fileName);
    
    await fs.mkdir(settings.TMP_DIR, { recursive: true });
    
    // Download using streams to avoid memory issues
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }
    
    const fileStream = createWriteStream(filePath);
    const reader = response.body?.getReader();
    
    if (!reader) {
      throw new Error('Failed to get response stream');
    }
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fileStream.write(value);
    }
    fileStream.close();
    
    // Check file size
    const stats = await fs.stat(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    if (fileSizeMB > 50) {
      await fs.unlink(filePath);
      throw new Error(`Audio file too large: ${fileSizeMB.toFixed(1)}MB (max 50MB)`);
    }
    
    session.mp3Path = filePath;
    await bot.sendMessage(chatId, ru.MUSIC_RECEIVED);
    await bot.sendMessage(chatId, ru.ASK_AUDIO_SEGMENT);
    
    userStates.set(chatId, State.AUDIO_SEGMENT);
    sessions.set(chatId, session);
  } catch (error) {
    console.error('Error handling audio:', error);
    await bot.sendMessage(chatId, `${ru.ERROR_GENERIC}: ${error}`);
  }
}

async function handleAudioSegment(msg: any, chatId: number, session: SessionData): Promise<void> {
  const text = msg.text?.trim();

  if (text?.toLowerCase() === 'всё' || text?.toLowerCase() === 'все' || text?.toLowerCase() === 'all') {
    session.audioStartTime = undefined;
    session.audioEndTime = undefined;
    await bot.sendMessage(chatId, ru.AUDIO_SEGMENT_ALL);
    await startProcessing(chatId, session);
    return;
  }

  const parts = text?.split(' ');
  if (!parts || parts.length !== 2) {
    await bot.sendMessage(chatId, ru.INVALID_SEGMENT_FORMAT);
    return;
  }

  const startTime = parseTimeToSeconds(parts[0]);
  const endTime = parseTimeToSeconds(parts[1]);

  if (startTime === null || endTime === null) {
    await bot.sendMessage(chatId, ru.INVALID_SEGMENT_FORMAT);
    return;
  }

  if (startTime >= endTime) {
    await bot.sendMessage(chatId, ru.INVALID_SEGMENT_RANGE);
    return;
  }

  session.audioStartTime = startTime;
  session.audioEndTime = endTime;
  await bot.sendMessage(chatId, ru.AUDIO_SEGMENT_SELECTED.replace('{start}', parts[0]).replace('{end}', parts[1]));
  await startProcessing(chatId, session);
}

async function handleVideo(msg: any, chatId: number, state: State): Promise<void> {
  if (state !== State.SOURCE) return;
  
  const session = sessions.get(chatId) || {};
  
  try {
    const fileId = msg.video.file_id;
    const fileInfo = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${settings.TELEGRAM_TOKEN}/${fileInfo.file_path}`;
    
    const fileName = `${fileId}.mp4`;
    const filePath = path.join(settings.TMP_DIR, fileName);
    
    await fs.mkdir(settings.TMP_DIR, { recursive: true });
    
    // Download using streams to avoid memory issues
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.statusText}`);
    }
    
    const fileStream = createWriteStream(filePath);
    const reader = response.body?.getReader();
    
    if (!reader) {
      throw new Error('Failed to get response stream');
    }
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fileStream.write(value);
    }
    fileStream.close();
    
    // Check file size
    const stats = await fs.stat(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    if (fileSizeMB > settings.MAX_SOURCE_MB) {
      await fs.unlink(filePath);
      throw new Error(`Video file too large: ${fileSizeMB.toFixed(1)}MB (max ${settings.MAX_SOURCE_MB}MB)`);
    }
    
    session.sourcePath = filePath;
    await bot.sendMessage(chatId, ru.SOURCE_RECEIVED);
    await bot.sendMessage(chatId, ru.ASK_MODE);
    
    userStates.set(chatId, State.MODE_SELECTION);
    sessions.set(chatId, session);
  } catch (error) {
    console.error('Error handling video:', error);
    await bot.sendMessage(chatId, `${ru.ERROR_GENERIC}: ${error}`);
  }
}

async function startProcessing(chatId: number, session: SessionData): Promise<void> {
  await bot.sendMessage(chatId, ru.PROCESSING_START);
  userStates.set(chatId, State.PROCESSING);
  
  // Create task and start processing
  const taskId = await storage.createTask({
    userId: chatId,
    sourcePath: session.sourcePath || '',
    sourceUrl: session.sourceUrl || null,
    mode: session.mode || 'top_moments',
    clipCount: session.clipCount || 3,
    startTime: session.startTime || null,
    endTime: session.endTime || null,
    trendChoice: session.trendChoice || null,
    mp3Path: session.mp3Path || null,
    audioStartTime: session.audioStartTime || null,
    audioEndTime: session.audioEndTime || null,
    quality: session.quality || null
  });

  // Start processing in background
  const botWrapper = new TelegramBotWrapper(bot);
  processTask(taskId, chatId, botWrapper, storage).catch(error => {
    console.error('Processing error:', error);
  });
}

// Utility functions
function isValidUrl(text: string): boolean {
  try {
    new URL(text);
    return text.includes('.') || text.includes('youtube.com') || text.includes('tiktok.com');
  } catch {
    return false;
  }
}

function parseTimeToSeconds(timeStr: string): number | null {
  const parts = timeStr.split(':');
  
  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    if (!isNaN(minutes) && !isNaN(seconds)) {
      return minutes * 60 + seconds;
    }
  } else if (parts.length === 3) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    if (!isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
      return hours * 3600 + minutes * 60 + seconds;
    }
  }
  
  return null;
}

// Error handling
bot.on('polling_error', (error) => {
  console.error(`Polling error:`, error);
});

// Global unhandled rejection handler - IMPROVED
process.on('unhandledRejection', (reason, promise) => {
  const timestamp = new Date().toISOString();
  console.error('╔═══════════════════════════════════════════════════════════════╗');
  console.error('║         UNHANDLED REJECTION DETECTED                        ║');
  console.error('╚═══════════════════════════════════════════════════════════════╝');
  console.error(`Time: ${timestamp}`);
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  if (reason instanceof Error) {
    console.error('Error name:', reason.name);
    console.error('Error message:', reason.message);
    console.error('Error stack:', reason.stack);
  }
  // Don't crash the bot
});

// Global uncaught exception handler - IMPROVED
process.on('uncaughtException', (error) => {
  const timestamp = new Date().toISOString();
  console.error('╔═══════════════════════════════════════════════════════════════╗');
  console.error('║         UNCAUGHT EXCEPTION DETECTED                        ║');
  console.error('╚═══════════════════════════════════════════════════════════════╝');
  console.error(`Time: ${timestamp}`);
  console.error('Error name:', error.name);
  console.error('Error message:', error.message);
  console.error('Error stack:', error.stack);
  // Don't crash the bot, but log it
});

console.log('Bot started successfully');
console.log('Memory usage monitoring enabled');
console.log('Stream-based file handling enabled');
console.log('Error handling enhanced');
