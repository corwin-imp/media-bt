import TelegramBot from 'node-telegram-bot-api';
import { settings } from './config/settings.js';
import { setupLogging } from './utils/logger.js';
import { SQLiteStorage } from './storage/sqlite-storage.js';
import { processTask } from './services/pipeline.js';
import { resolveSourceWithQuality } from './services/video-downloader.js';
import { fetchTrendingHashtags } from './services/trends.js';
import { parseAccountInput, fetchAccount, formatAccountReport } from './services/account-viewer.js';
import { ru } from './i18n/ru.js';
import { promises as fs } from 'fs';
import path from 'path';
import { createWriteStream, createReadStream, statSync } from 'fs';

setupLogging(settings.DEBUG);
const bot = new TelegramBot(settings.TELEGRAM_TOKEN, { polling: true });
const storage = await SQLiteStorage.create(settings.DB_PATH);
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
  trimMode?: 'top_moments' | 'custom_segment' | null;
  audioOnly?: boolean;
}

enum State {
  SOURCE = 1,
  QUALITY_SELECTION = 2,
  MAIN_MENU = 3,
  CLIP_COUNT_INPUT = 4,
  SEGMENT_INPUT = 5,
  MUSIC_INPUT = 6,
  AUDIO_SEGMENT = 7,
  PROCESSING = 8,
  ACCOUNT_INPUT = 9
}

const userStates = new Map<number, State>();
const menuMessages = new Map<number, number>();

function getTrimButtonText(session: SessionData): string {
  if (!session.trimMode) return '✂️ Обрезка';
  if (session.trimMode === 'top_moments') {
    return `✂️ Обрезка: Топ моменты (${session.clipCount || 3} клипов) ✓`;
  }
  if (session.trimMode === 'custom_segment') {
    const start = session.startTime ? formatSecondsToTime(session.startTime) : '?';
    const end = session.endTime ? formatSecondsToTime(session.endTime) : '?';
    return `✂️ Обрезка: Интервал ${start}-${end} ✓`;
  }
  return '✂️ Обрезка';
}

function getAudioButtonText(session: SessionData): string {
  return session.audioOnly ? '🎵 Только звук в MP3 ✓' : '🎵 Только звук в MP3';
}

function getMusicButtonText(session: SessionData): string {
  return session.mp3Path ? '🎵 Аудиозапись: Заменена ✓' : '🎵 Поменять аудиозапись';
}

function formatSecondsToTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function showMainMenu(chatId: number, session: SessionData, editMessageId?: number): Promise<void> {
  const text = '🎬 *Настройки обработки видео*\n\nВыберите параметры:';
  const keyboard: TelegramBot.InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: getTrimButtonText(session), callback_data: 'trim_menu' }],
      [{ text: getAudioButtonText(session), callback_data: 'toggle_audio' }],
      [{ text: '🏷️ Посмотреть теги', callback_data: 'view_tags' }],
      [{ text: getMusicButtonText(session), callback_data: 'change_music' }],
      [{ text: '🚀 Загрузить', callback_data: 'start_upload' }]
    ]
  };
  if (editMessageId) {
    try {
      await bot.editMessageText(text, { chat_id: chatId, message_id: editMessageId, parse_mode: 'Markdown', reply_markup: keyboard });
    } catch {
      const msg = await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
      menuMessages.set(chatId, msg.message_id);
    }
  } else {
    const msg = await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
    menuMessages.set(chatId, msg.message_id);
  }
  sessions.set(chatId, session);
}

async function showTrimMenu(chatId: number, session: SessionData): Promise<void> {
  const messageId = menuMessages.get(chatId);
  const text = '✂️ *Выберите тип обрезки:*';
  let topMomentsText = session.trimMode === 'top_moments' ? '🎯 Топ моменты ✓' : '🎯 Топ моменты';
  let customSegmentText = session.trimMode === 'custom_segment' ? '✂️ Определенный кусок ✓' : '✂️ Определенный кусок';
  const keyboard: TelegramBot.InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: topMomentsText, callback_data: 'trim_top_moments' }],
      [{ text: customSegmentText, callback_data: 'trim_custom_segment' }],
      [{ text: '◀️ Назад', callback_data: 'back_to_main' }]
    ]
  };
  if (messageId) {
    try {
      await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard });
    } catch {
      const msg = await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
      menuMessages.set(chatId, msg.message_id);
    }
  }
  sessions.set(chatId, session);
}

async function showTagsMenu(chatId: number, session: SessionData): Promise<void> {
  const messageId = menuMessages.get(chatId);
  const text = '🏷️ *Хотите подсмотреть тренды для хэштегов?*';
  const keyboard: TelegramBot.InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: '✅ Да, показать тренды', callback_data: 'tags_yes' }],
      [{ text: '❌ Нет, пропустить', callback_data: 'tags_no' }]
    ]
  };
  if (messageId) {
    try {
      await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: keyboard });
    } catch {
      const msg = await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
      menuMessages.set(chatId, msg.message_id);
    }
  }
  sessions.set(chatId, session);
}

async function startUpload(chatId: number, session: SessionData): Promise<void> {
  if (!session.trimMode && !session.audioOnly) {
    await bot.sendMessage(chatId, '⚠️ Пожалуйста, выберите режим обрезки или включите "Только звук в MP3".');
    await showMainMenu(chatId, session, menuMessages.get(chatId));
    return;
  }
  
  // Debug: log session data before processing
  console.log('DEBUG startUpload session:', {
    sourcePath: session.sourcePath,
    sourcePathType: typeof session.sourcePath,
    sourceUrl: session.sourceUrl,
    trimMode: session.trimMode,
    audioOnly: session.audioOnly,
    startTime: session.startTime,
    endTime: session.endTime
  });
  
  // Validate sourcePath exists for audio_from_segment mode
  if (session.audioOnly && session.trimMode === 'custom_segment') {
    if (!session.sourcePath || typeof session.sourcePath !== 'string' || session.sourcePath.trim() === '') {
      console.error('ERROR: sourcePath is invalid for audio_from_segment mode:', session.sourcePath);
      await bot.sendMessage(chatId, '❌ Ошибка: видео не было загружено. Пожалуйста, сначала отправьте видео или ссылку, выберите качество, а затем настройте параметры.');
      userStates.set(chatId, State.MAIN_MENU);
      return;
    }
  }
  
  await bot.sendMessage(chatId, ru.PROCESSING_START);
  userStates.set(chatId, State.PROCESSING);
  
  // Determine mode based on combination of settings
  let mode = 'top_moments';
  if (session.audioOnly && session.trimMode === 'custom_segment') {
    mode = 'audio_from_segment'; // Audio from specific segment
  } else if (session.audioOnly) {
    mode = 'audio_only';
  } else if (session.trimMode) {
    mode = session.trimMode;
  }
  
  const taskId = await storage.createTask({
    userId: chatId,
    sourcePath: session.sourcePath || '',
    sourceUrl: session.sourceUrl || null,
    mode: mode,
    clipCount: session.clipCount || 3,
    startTime: session.startTime || null,
    endTime: session.endTime || null,
    trendChoice: session.trendChoice || null,
    mp3Path: session.mp3Path || null,
    audioStartTime: session.audioStartTime || null,
    audioEndTime: session.audioEndTime || null,
    quality: session.quality || null
  });
  
  const botWrapper = new TelegramBotWrapper(bot);
  processTask(taskId, chatId, botWrapper, storage).catch(error => console.error('Processing error:', error));
  setTimeout(() => showMainMenu(chatId, session, menuMessages.get(chatId)), 2000);
}

// Handle callback queries - параметры сохраняются независимо друг от друга
bot.on('callback_query', async (query) => {
  const chatId = query.message?.chat.id;
  if (!chatId) return;
  const data = query.data;
  const session = sessions.get(chatId) || {};
  
  try {
    switch (data) {
      case 'trim_menu':
        await showTrimMenu(chatId, session);
        break;
      case 'trim_top_moments':
        session.trimMode = 'top_moments';
        // НЕ сбрасываем audioOnly - сохраняем оба состояния независимо
        await bot.sendMessage(chatId, ru.ASK_CLIP_COUNT);
        userStates.set(chatId, State.CLIP_COUNT_INPUT);
        sessions.set(chatId, session);
        break;
      case 'trim_custom_segment':
        session.trimMode = 'custom_segment';
        // НЕ сбрасываем audioOnly - сохраняем оба состояния независимо
        await bot.sendMessage(chatId, ru.ASK_CUSTOM_SEGMENT);
        userStates.set(chatId, State.SEGMENT_INPUT);
        sessions.set(chatId, session);
        break;
      case 'toggle_audio':
        session.audioOnly = !session.audioOnly;
        // НЕ сбрасываем trimMode - сохраняем оба состояния независимо
        await showMainMenu(chatId, session, menuMessages.get(chatId));
        break;
      case 'view_tags':
        await showTagsMenu(chatId, session);
        break;
      case 'change_music':
        await bot.sendMessage(chatId, ru.ASK_MUSIC);
        userStates.set(chatId, State.MUSIC_INPUT);
        sessions.set(chatId, session);
        break;
      case 'start_upload':
        await startUpload(chatId, session);
        break;
      case 'accounts':
        await bot.sendMessage(chatId, ru.ACCOUNTS_PROMPT, { parse_mode: 'Markdown' });
        userStates.set(chatId, State.ACCOUNT_INPUT);
        break;
      case 'back_to_main':
        await showMainMenu(chatId, session, menuMessages.get(chatId));
        break;
      case 'tags_yes':
        const trends = await fetchTrendingHashtags(5);
        session.trendChoice = trends[0];
        const formatted = trends.map((t, i) => `${i + 1}) ${t}`).join('\n');
        await bot.sendMessage(chatId, `🏷️ *Топ трендов:*\n${formatted}`, { parse_mode: 'Markdown' });
        await showMainMenu(chatId, session, menuMessages.get(chatId));
        break;
      case 'tags_no':
        session.trendChoice = null;
        await showMainMenu(chatId, session, menuMessages.get(chatId));
        break;
    }
    await bot.answerCallbackQuery(query.id);
  } catch (error) {
    console.error('Callback query error:', error);
    await bot.answerCallbackQuery(query.id, { text: 'Произошла ошибка' });
  }
});

function resetSession(chatId: number): void {
  const existingSession = sessions.get(chatId) || {};
  sessions.set(chatId, { sourcePath: existingSession.sourcePath, sourceUrl: existingSession.sourceUrl, quality: existingSession.quality });
  menuMessages.delete(chatId);
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const keyboard = {
    keyboard: [[{ text: ru.ACCOUNTS_BUTTON }]],
    resize_keyboard: true
  };
  await bot.sendMessage(chatId, ru.START, { reply_markup: keyboard as any });
  userStates.set(chatId, State.SOURCE);
});

bot.onText(/\/accounts/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, ru.ACCOUNTS_PROMPT, { parse_mode: 'Markdown' });
  userStates.set(chatId, State.ACCOUNT_INPUT);
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
  menuMessages.delete(chatId);
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  // Handle the persistent keyboard "Accounts" button from any state
  if (text === ru.ACCOUNTS_BUTTON) {
    await bot.sendMessage(chatId, ru.ACCOUNTS_PROMPT, { parse_mode: 'Markdown' });
    userStates.set(chatId, State.ACCOUNT_INPUT);
    return;
  }
  const state = userStates.get(chatId);
  if (!state || msg.text?.startsWith('/')) return;
  const session = sessions.get(chatId) || {};
  try {
    switch (state) {
      case State.SOURCE: await handleSource(msg, chatId, session); break;
      case State.QUALITY_SELECTION: await handleQualitySelection(msg, chatId, session); break;
      case State.CLIP_COUNT_INPUT: await handleClipCountInput(msg, chatId, session); break;
      case State.SEGMENT_INPUT: await handleSegmentInput(msg, chatId, session); break;
      case State.MUSIC_INPUT: await handleMusicInput(msg, chatId, session); break;
      case State.AUDIO_SEGMENT: await handleAudioSegment(msg, chatId, session); break;
      case State.ACCOUNT_INPUT: await handleAccountInput(msg, chatId); break;
    }
  } catch (error) {
    await bot.sendMessage(chatId, `${ru.ERROR_GENERIC}: ${error}`);
  }
});

bot.on('video', async (msg) => {
  const chatId = msg.chat.id;
  const state = userStates.get(chatId);
  if (state === State.PROCESSING) {
    await bot.sendMessage(chatId, '⏳ Уже обрабатываю другое видео. Пожалуйста, подождите.');
    return;
  }
  resetSession(chatId);
  const session = sessions.get(chatId) || {};
  const video = msg.video;
  if (!video) return;
  if (video.file_size && video.file_size > settings.MAX_SOURCE_MB * 1024 * 1024) {
    await bot.sendMessage(chatId, ru.TOO_LARGE.replace('{max_mb}', settings.MAX_SOURCE_MB.toString()));
    return;
  }
  await bot.sendMessage(chatId, '📁 Видео получено. Скачиваю...');
  try {
    const fileLink = await bot.getFileLink(video.file_id);
    const fileName = `source_${chatId}_${Date.now()}.mp4`;
    const filePath = path.join(settings.TMP_DIR, fileName);
    const response = await fetch(fileLink);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    session.sourcePath = filePath;
    sessions.set(chatId, session);
    await bot.sendMessage(chatId, ru.SOURCE_RECEIVED);
    await showMainMenu(chatId, session);
    userStates.set(chatId, State.MAIN_MENU);
    sessions.set(chatId, session);
  } catch (error) {
    await bot.sendMessage(chatId, `${ru.ERROR_GENERIC}: ${error}`);
  }
});

bot.on('audio', async (msg) => {
  const chatId = msg.chat.id;
  const state = userStates.get(chatId);
  const session = sessions.get(chatId) || {};
  if (state !== State.MUSIC_INPUT) return;
  const audio = msg.audio;
  if (!audio) return;
  try {
    const fileLink = await bot.getFileLink(audio.file_id);
    const fileName = `music_${chatId}_${Date.now()}.mp3`;
    const filePath = path.join(settings.TMP_DIR, fileName);
    const response = await fetch(fileLink);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    session.mp3Path = filePath;
    sessions.set(chatId, session);
    await bot.sendMessage(chatId, ru.MUSIC_RECEIVED);
    await bot.sendMessage(chatId, ru.ASK_AUDIO_SEGMENT);
    userStates.set(chatId, State.AUDIO_SEGMENT);
    sessions.set(chatId, session);
  } catch (error) {
    await bot.sendMessage(chatId, `${ru.ERROR_GENERIC}: ${error}`);
  }
});

async function handleSource(msg: any, chatId: number, session: SessionData): Promise<void> {
  const text = msg.text?.trim();
  if (!text) return;
  if (!isValidUrl(text)) {
    await bot.sendMessage(chatId, 'Пожалуйста, отправьте корректную ссылку или видеофайл.');
    return;
  }
  resetSession(chatId);
  const freshSession = sessions.get(chatId) || {};
  freshSession.sourceUrl = text;
  await bot.sendMessage(chatId, ru.SOURCE_RECEIVED);
  await bot.sendMessage(chatId, ru.ASK_QUALITY);
  userStates.set(chatId, State.QUALITY_SELECTION);
  sessions.set(chatId, freshSession);
}

async function handleQualitySelection(msg: any, chatId: number, session: SessionData): Promise<void> {
  const text = msg.text?.trim();
  const qualityMap: Record<string, number> = { '1080': 1080, '720': 720, '480': 480, '360': 360 };
  const quality = qualityMap[text || ''];
  if (!quality) { await bot.sendMessage(chatId, ru.INVALID_QUALITY); return; }
  session.quality = quality;
  try {
    await bot.sendMessage(chatId, ru.QUALITY_SELECTED.replace('{quality}', quality.toString()));
    if (session.sourceUrl) {
      session.sourcePath = await resolveSourceWithQuality(session.sourceUrl, quality);
      await bot.sendMessage(chatId, ru.SOURCE_RECEIVED);
    }
    await showMainMenu(chatId, session);
    userStates.set(chatId, State.MAIN_MENU);
    sessions.set(chatId, session);
  } catch (error) {
    await bot.sendMessage(chatId, `${ru.ERROR_GENERIC}: ${error}`);
  }
}

async function handleClipCountInput(msg: any, chatId: number, session: SessionData): Promise<void> {
  const text = msg.text?.trim();
  const count = parseInt(text || '0', 10);
  if (isNaN(count) || count < 1 || count > 10) { await bot.sendMessage(chatId, 'Введите число клипов от 1 до 10.'); return; }
  session.clipCount = count;
  sessions.set(chatId, session);
  await showMainMenu(chatId, session, menuMessages.get(chatId));
  userStates.set(chatId, State.MAIN_MENU);
}

async function handleSegmentInput(msg: any, chatId: number, session: SessionData): Promise<void> {
  const text = msg.text?.trim();
  const parts = text?.split(' ');
  if (!parts || parts.length !== 2) { await bot.sendMessage(chatId, ru.INVALID_SEGMENT_FORMAT); return; }
  const startTime = parseTimeToSeconds(parts[0]);
  const endTime = parseTimeToSeconds(parts[1]);
  if (startTime === null || endTime === null) { await bot.sendMessage(chatId, ru.INVALID_SEGMENT_FORMAT); return; }
  if (startTime >= endTime) { await bot.sendMessage(chatId, ru.INVALID_SEGMENT_RANGE); return; }
  if (endTime - startTime < 5) { await bot.sendMessage(chatId, 'Минимальная длительность — 5 секунд.'); return; }
  if (endTime - startTime > 60) { await bot.sendMessage(chatId, 'Максимальная длительность — 60 секунд.'); return; }
  session.startTime = startTime;
  session.endTime = endTime;
  sessions.set(chatId, session);
  await showMainMenu(chatId, session, menuMessages.get(chatId));
  userStates.set(chatId, State.MAIN_MENU);
}

async function handleMusicInput(msg: any, chatId: number, session: SessionData): Promise<void> {
  const text = msg.text?.trim().toLowerCase();
  if (text === 'нет' || text === 'no' || text === 'n') {
    session.mp3Path = undefined;
    sessions.set(chatId, session);
    await bot.sendMessage(chatId, ru.NO_MUSIC);
    await showMainMenu(chatId, session, menuMessages.get(chatId));
    userStates.set(chatId, State.MAIN_MENU);
    return;
  }
  await bot.sendMessage(chatId, 'Пожалуйста, отправьте MP3 файл или напишите "нет" чтобы пропустить.');
}

async function handleAccountInput(msg: any, chatId: number): Promise<void> {
  const text = msg.text?.trim();
  if (!text) {
    await bot.sendMessage(chatId, ru.ACCOUNTS_INVALID);
    return;
  }
  const parsed = parseAccountInput(text);
  if (!parsed) {
    await bot.sendMessage(chatId, ru.ACCOUNTS_INVALID);
    return;
  }
  await bot.sendMessage(chatId, ru.ACCOUNTS_FETCHING);
  try {
    const info = await fetchAccount(parsed, 5);
    const report = formatAccountReport(info);
    await bot.sendMessage(chatId, report);
    await bot.sendMessage(chatId, ru.ACCOUNTS_DONE);
  } catch (error: any) {
    await bot.sendMessage(chatId, `❌ ${error?.message || ru.ERROR_GENERIC}`);
  }
}

async function handleAudioSegment(msg: any, chatId: number, session: SessionData): Promise<void> {
  const text = msg.text?.trim().toLowerCase();
  if (text === 'всё' || text === 'все' || text === 'all') {
    await bot.sendMessage(chatId, ru.AUDIO_SEGMENT_ALL);
    await showMainMenu(chatId, session, menuMessages.get(chatId));
    userStates.set(chatId, State.MAIN_MENU);
    sessions.set(chatId, session);
    return;
  }
  const parts = text?.split(' ');
  if (!parts || parts.length !== 2) { await bot.sendMessage(chatId, ru.INVALID_SEGMENT_FORMAT); return; }
  const startTime = parseTimeToSeconds(parts[0]);
  const endTime = parseTimeToSeconds(parts[1]);
  if (startTime === null || endTime === null) { await bot.sendMessage(chatId, ru.INVALID_SEGMENT_FORMAT); return; }
  session.audioStartTime = startTime;
  session.audioEndTime = endTime;
  sessions.set(chatId, session);
  await bot.sendMessage(chatId, ru.AUDIO_SEGMENT_SELECTED.replace('{start}', formatSecondsToTime(startTime)).replace('{end}', formatSecondsToTime(endTime)));
  await showMainMenu(chatId, session, menuMessages.get(chatId));
  userStates.set(chatId, State.MAIN_MENU);
}

class TelegramBotWrapper {
  private bot: TelegramBot;
  constructor(bot: TelegramBot) { this.bot = bot; }
  async sendMessage(chatId: number, text: string): Promise<void> { await this.bot.sendMessage(chatId, text); }
  async sendVideo(chatId: number, video: string | any, caption?: string): Promise<void> {
    const options: any = {};
    if (caption) options.caption = caption;
    if (typeof video === 'string') {
      await this.bot.sendVideo(chatId, createReadStream(video), options);
    } else {
      if (video && typeof video === 'object' && video.path) options.filename = 'clip.mp4';
      await this.bot.sendVideo(chatId, video, options);
    }
  }
  async sendAudio(chatId: number, audio: string | any, caption?: string): Promise<void> {
    const options: any = {};
    if (caption) options.caption = caption;
    if (typeof audio === 'string') {
      await this.bot.sendAudio(chatId, createReadStream(audio), options);
    } else {
      if (audio && typeof audio === 'object' && audio.path) options.filename = 'audio.mp3';
      await this.bot.sendAudio(chatId, audio, options);
    }
  }
}

function isValidUrl(text: string): boolean {
  try { new URL(text); return text.includes('.') || text.includes('youtube.com') || text.includes('tiktok.com'); } catch { return false; }
}

function parseTimeToSeconds(timeStr: string): number | null {
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10), secs = parseInt(parts[1], 10);
    if (!isNaN(mins) && !isNaN(secs)) return mins * 60 + secs;
  } else if (parts.length === 3) {
    const hours = parseInt(parts[0], 10), mins = parseInt(parts[1], 10), secs = parseInt(parts[2], 10);
    if (!isNaN(hours) && !isNaN(mins) && !isNaN(secs)) return hours * 3600 + mins * 60 + secs;
  }
  return null;
}

bot.on('polling_error', (error) => console.error('Polling error:', error));
process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));
process.on('uncaughtException', (error) => console.error('Uncaught exception:', error));
console.log('Bot started successfully');