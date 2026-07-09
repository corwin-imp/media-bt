import TelegramBot from 'node-telegram-bot-api';
import { settings } from './config/settings.js';
import { setupLogging } from './utils/logger.js';
import { SQLiteStorage } from './storage/sqlite-storage.js';
import { processTask } from './services/pipeline.js';
import { resolveSourceWithQuality } from './services/video-downloader.js';
import { fetchTrendingHashtags } from './services/trends.js';
import { parseMultipleAccounts, fetchAccount, formatAccountReport, MAX_ACCOUNTS } from './services/account-viewer.js';
import { getT, translations, DEFAULT_LOCALE, type Locale } from './i18n/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import { createWriteStream, createReadStream, statSync } from 'fs';

setupLogging(settings.DEBUG);
const bot = new TelegramBot(settings.TELEGRAM_TOKEN, { polling: true });
const storage = await SQLiteStorage.create(settings.DB_PATH);
const sessions = new Map<number, SessionData>();
const userLocales = new Map<number, Locale>();

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
  playbackSpeed?: number | null;
  platform?: string | null;
}

/**
 * Platform presets for "auto mode" (UI side). Mirrors pipeline.ts presets so
 * that selecting a platform here applies the right defaults immediately.
 */
function getPlatformPresets(t: typeof translations[Locale]) {
  return {
    tiktok: { label: t.PLATFORM_TIKTOK, clipCount: 3 },
    shorts: { label: t.PLATFORM_SHORTS, clipCount: 3 },
    reels: { label: t.PLATFORM_REELS, clipCount: 3 }
  } as const;
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
  ACCOUNT_INPUT = 9,
  SPEED_INPUT = 10
}

const userStates = new Map<number, State>();
const menuMessages = new Map<number, number>();

/** Get the user's locale, falling back to the default. */
function getLocale(chatId: number): Locale {
  return userLocales.get(chatId) || DEFAULT_LOCALE;
}

/** Get translations for a chat. */
function getChatT(chatId: number) {
  return getT(getLocale(chatId));
}

function getTrimButtonText(t: ReturnType<typeof getT>, session: SessionData): string {
  if (!session.trimMode) return t.TRIM_BUTTON;
  if (session.trimMode === 'top_moments') {
    return t.TRIM_TOP_MOMENTS_BTN(session.clipCount || 3);
  }
  if (session.trimMode === 'custom_segment') {
    const start = session.startTime ? formatSecondsToTime(session.startTime) : '?';
    const end = session.endTime ? formatSecondsToTime(session.endTime) : '?';
    return t.TRIM_CUSTOM_SEGMENT_BTN(start, end);
  }
  return t.TRIM_BUTTON;
}

function getAudioButtonText(t: ReturnType<typeof getT>, session: SessionData): string {
  return session.audioOnly ? t.AUDIO_ONLY_ENABLED : t.AUDIO_ONLY_DISABLED;
}

function getMusicButtonText(t: ReturnType<typeof getT>, session: SessionData): string {
  return session.mp3Path ? t.MUSIC_REPLACED : t.MUSIC_CHANGE;
}

function getAudioMenuButtonText(t: ReturnType<typeof getT>, session: SessionData): string {
  // When "Only sound in MP3" (audioOnly) is selected, show headphones icon
  // to indicate there will be no video in the output.
  if (session.audioOnly) return t.AUDIO_MENU_HEADPHONES;
  if (session.mp3Path) return t.AUDIO_MENU_MUSIC;
  return t.AUDIO_MENU_DEFAULT;
}

function getSpeedButtonText(t: ReturnType<typeof getT>, session: SessionData): string {
  const speed = session.playbackSpeed && Math.abs(session.playbackSpeed - 1) >= 0.001
    ? session.playbackSpeed
    : 1;
  return t.SPEED_BUTTON(speed);
}

function getAutoModeButtonText(t: ReturnType<typeof getT>, session: SessionData): string {
  if (session.platform) {
    const presets = getPlatformPresets(t);
    const preset = (presets as any)[session.platform];
    if (preset) return t.AUTO_MODE_SELECTED_PLATFORM(preset.label);
  }
  return t.AUTO_MODE_DEFAULT;
}

function formatSecondsToTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function showMainMenu(chatId: number, session: SessionData, editMessageId?: number): Promise<void> {
  const t = getChatT(chatId);
  const text = t.MAIN_MENU_TITLE;
  const keyboard: TelegramBot.InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: getAutoModeButtonText(t, session), callback_data: 'auto_mode' }],
      [{ text: getTrimButtonText(t, session), callback_data: 'trim_menu' }],
      [{ text: getAudioMenuButtonText(t, session), callback_data: 'audio_menu' }],
      [{ text: getSpeedButtonText(t, session), callback_data: 'speed_menu' }],
      [{ text: t.UPLOAD_BUTTON, callback_data: 'start_upload' }]
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
  const t = getChatT(chatId);
  const messageId = menuMessages.get(chatId);
  const text = t.TRIM_MENU_TITLE;
  const topMomentsText = session.trimMode === 'top_moments' ? t.TRIM_TOP_MOMENTS_CHECKED : t.TRIM_TOP_MOMENTS;
  const customSegmentText = session.trimMode === 'custom_segment' ? t.TRIM_CUSTOM_SEGMENT_CHECKED : t.TRIM_CUSTOM_SEGMENT;
  const keyboard: TelegramBot.InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: topMomentsText, callback_data: 'trim_top_moments' }],
      [{ text: customSegmentText, callback_data: 'trim_custom_segment' }],
      [{ text: t.BACK_BUTTON, callback_data: 'back_to_main' }]
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

async function showAudioMenu(chatId: number, session: SessionData): Promise<void> {
  const t = getChatT(chatId);
  const messageId = menuMessages.get(chatId);
  const text = t.AUDIO_MENU_TITLE;
  const keyboard: TelegramBot.InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: getMusicButtonText(t, session), callback_data: 'change_music' }],
      [{ text: getAudioButtonText(t, session), callback_data: 'toggle_audio' }],
      [{ text: t.BACK_BUTTON, callback_data: 'back_to_main' }]
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
  const t = getChatT(chatId);
  const text = t.TAGS_MENU_TITLE;
  const keyboard: TelegramBot.InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: t.TAGS_YES, callback_data: 'tags_yes' }],
      [{ text: t.TAGS_NO, callback_data: 'tags_no' }]
    ]
  };
  const msg = await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
  sessions.set(chatId, session);
}

async function showLanguageMenu(chatId: number): Promise<void> {
  const t = getChatT(chatId);
  const current = getLocale(chatId);
  const keyboard: TelegramBot.InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: current === 'ru' ? `${t.LANG_RUSSIAN} ✓` : t.LANG_RUSSIAN, callback_data: 'lang_ru' }],
      [{ text: current === 'en' ? `${t.LANG_ENGLISH} ✓` : t.LANG_ENGLISH, callback_data: 'lang_en' }],
      [{ text: current === 'uk' ? `${t.LANG_UKRAINIAN} ✓` : t.LANG_UKRAINIAN, callback_data: 'lang_uk' }],
      [{ text: current === 'pt' ? `${t.LANG_PORTUGUESE} ✓` : t.LANG_PORTUGUESE, callback_data: 'lang_pt' }]
    ]
  };
  await bot.sendMessage(chatId, t.LANG_TITLE, { parse_mode: 'Markdown', reply_markup: keyboard });
}

async function showAutoModeMenu(chatId: number, session: SessionData): Promise<void> {
  const t = getChatT(chatId);
  const messageId = menuMessages.get(chatId);
  const text = t.AUTO_MODE_TITLE;
  const presets = getPlatformPresets(t);
  const tiktokText = session.platform === 'tiktok' ? `${presets.tiktok.label} ✓` : presets.tiktok.label;
  const shortsText = session.platform === 'shorts' ? `${presets.shorts.label} ✓` : presets.shorts.label;
  const reelsText = session.platform === 'reels' ? `${presets.reels.label} ✓` : presets.reels.label;
  const keyboard: TelegramBot.InlineKeyboardMarkup = {
    inline_keyboard: [
      [{ text: `🎵 ${tiktokText}`, callback_data: 'auto_tiktok' }],
      [{ text: `▶️ ${shortsText}`, callback_data: 'auto_shorts' }],
      [{ text: `📸 ${reelsText}`, callback_data: 'auto_reels' }],
      [{ text: t.AUTO_MODE_OFF, callback_data: 'auto_off' }],
      [{ text: t.BACK_BUTTON, callback_data: 'back_to_main' }]
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
  const t = getChatT(chatId);
  if (!session.trimMode && !session.audioOnly) {
    await bot.sendMessage(chatId, t.TRIM_REQUIRED);
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
      await bot.sendMessage(chatId, t.SOURCE_INVALID);
      userStates.set(chatId, State.MAIN_MENU);
      return;
    }
  }
  
  await bot.sendMessage(chatId, t.PROCESSING_START);
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
    quality: session.quality || null,
    playbackSpeed: session.playbackSpeed || null,
    platform: session.platform || null
  });
  
  const botWrapper = new TelegramBotWrapper(bot);
  processTask(taskId, chatId, botWrapper, storage, getLocale(chatId)).catch(error => console.error('Processing error:', error));
  setTimeout(() => showMainMenu(chatId, session, menuMessages.get(chatId)), 2000);
}

// Handle callback queries - параметры сохраняются независимо друг от друга
bot.on('callback_query', async (query) => {
  const chatId = query.message?.chat.id;
  if (!chatId) return;
  const data = query.data;
  const session = sessions.get(chatId) || {};
  const t = getChatT(chatId);

  try {
    if (!data) {
      await bot.answerCallbackQuery(query.id);
      return;
    }
    switch (data) {
      case 'auto_mode':
        await showAutoModeMenu(chatId, session);
        break;
      case 'auto_tiktok': {
        const presets = getPlatformPresets(t);
        session.platform = 'tiktok';
        // Auto mode selects top_moments + sensible clip count for the platform
        session.trimMode = 'top_moments';
        session.audioOnly = false;
        if (!session.clipCount) session.clipCount = presets.tiktok.clipCount;
        await bot.sendMessage(chatId, t.AUTO_MODE_SELECTED(presets.tiktok.label));
        await showMainMenu(chatId, session, menuMessages.get(chatId));
        break;
      }
      case 'auto_shorts': {
        const presets = getPlatformPresets(t);
        session.platform = 'shorts';
        session.trimMode = 'top_moments';
        session.audioOnly = false;
        if (!session.clipCount) session.clipCount = presets.shorts.clipCount;
        await bot.sendMessage(chatId, t.AUTO_MODE_SELECTED(presets.shorts.label));
        await showMainMenu(chatId, session, menuMessages.get(chatId));
        break;
      }
      case 'auto_reels': {
        const presets = getPlatformPresets(t);
        session.platform = 'reels';
        session.trimMode = 'top_moments';
        session.audioOnly = false;
        if (!session.clipCount) session.clipCount = presets.reels.clipCount;
        await bot.sendMessage(chatId, t.AUTO_MODE_SELECTED(presets.reels.label));
        await showMainMenu(chatId, session, menuMessages.get(chatId));
        break;
      }
      case 'auto_off':
        session.platform = null;
        await bot.sendMessage(chatId, t.AUTO_MODE_CLEARED);
        await showMainMenu(chatId, session, menuMessages.get(chatId));
        break;
      case 'trim_menu':
        await showTrimMenu(chatId, session);
        break;
      case 'audio_menu':
        await showAudioMenu(chatId, session);
        break;
      case 'trim_top_moments':
        session.trimMode = 'top_moments';
        // НЕ сбрасываем audioOnly - сохраняем оба состояния независимо
        await bot.sendMessage(chatId, t.ASK_CLIP_COUNT);
        userStates.set(chatId, State.CLIP_COUNT_INPUT);
        sessions.set(chatId, session);
        break;
      case 'trim_custom_segment':
        session.trimMode = 'custom_segment';
        // НЕ сбрасываем audioOnly - сохраняем оба состояния независимо
        await bot.sendMessage(chatId, t.ASK_CUSTOM_SEGMENT);
        userStates.set(chatId, State.SEGMENT_INPUT);
        sessions.set(chatId, session);
        break;
      case 'toggle_audio':
        session.audioOnly = !session.audioOnly;
        // НЕ сбрасываем trimMode - сохраняем оба состояния независимо
        await showAudioMenu(chatId, session);
        break;
      case 'speed_menu': {
        const current = session.playbackSpeed && Math.abs(session.playbackSpeed - 1) >= 0.001
          ? session.playbackSpeed
          : 1;
        await bot.sendMessage(chatId, t.ASK_PLAYBACK_SPEED.replace('{current}', `${current}x`), { parse_mode: 'Markdown' });
        userStates.set(chatId, State.SPEED_INPUT);
        sessions.set(chatId, session);
        break;
      }
      case 'view_tags':
        await showTagsMenu(chatId, session);
        break;
      case 'change_music':
        await bot.sendMessage(chatId, t.ASK_MUSIC);
        userStates.set(chatId, State.MUSIC_INPUT);
        sessions.set(chatId, session);
        break;
      case 'start_upload':
        await startUpload(chatId, session);
        break;
      case 'accounts':
        await bot.sendMessage(chatId, t.ACCOUNTS_PROMPT, { parse_mode: 'Markdown' });
        userStates.set(chatId, State.ACCOUNT_INPUT);
        break;
      case 'lang_ru':
        userLocales.set(chatId, 'ru');
        await bot.answerCallbackQuery(query.id, { text: translations.ru.LANG_SELECTED(translations.ru.LANG_RUSSIAN) });
        await showLanguageMenu(chatId);
        return;
      case 'lang_en':
        userLocales.set(chatId, 'en');
        await bot.answerCallbackQuery(query.id, { text: translations.en.LANG_SELECTED(translations.en.LANG_ENGLISH) });
        await showLanguageMenu(chatId);
        return;
      case 'lang_uk':
        userLocales.set(chatId, 'uk');
        await bot.answerCallbackQuery(query.id, { text: translations.uk.LANG_SELECTED(translations.uk.LANG_UKRAINIAN) });
        await showLanguageMenu(chatId);
        return;
      case 'lang_pt':
        userLocales.set(chatId, 'pt');
        await bot.answerCallbackQuery(query.id, { text: translations.pt.LANG_SELECTED(translations.pt.LANG_PORTUGUESE) });
        await showLanguageMenu(chatId);
        return;
      case 'back_to_main':
        await showMainMenu(chatId, session, menuMessages.get(chatId));
        break;
      case 'tags_yes': {
        const trends = await fetchTrendingHashtags(5);
        session.trendChoice = trends[0];
        const formatted = trends.map((tr, i) => `${i + 1}) ${tr}`).join('\n');
        await bot.sendMessage(chatId, t.TAGS_TOP_TRENDS(formatted), { parse_mode: 'Markdown' });
        await showMainMenu(chatId, session, menuMessages.get(chatId));
        break;
      }
      case 'tags_no':
        session.trendChoice = null;
        await showMainMenu(chatId, session, menuMessages.get(chatId));
        break;
    }
    await bot.answerCallbackQuery(query.id);
  } catch (error) {
    console.error('Callback query error:', error);
    await bot.answerCallbackQuery(query.id, { text: t.CALLBACK_ERROR });
  }
});

function resetSession(chatId: number): void {
  const existingSession = sessions.get(chatId) || {};
  sessions.set(chatId, { sourcePath: existingSession.sourcePath, sourceUrl: existingSession.sourceUrl, quality: existingSession.quality });
  menuMessages.delete(chatId);
}

/**
 * Show the welcome/start message and reset the session.
 * Triggered by /start command or the "🏠 Начало" persistent button.
 */
async function doStart(chatId: number): Promise<void> {
  const t = getChatT(chatId);
  const keyboard = {
    keyboard: [
      [{ text: t.START_BUTTON }, { text: t.ACCOUNTS_BUTTON }, { text: t.TAGS_BUTTON }],
      [{ text: t.LANG_BUTTON }]
    ],
    resize_keyboard: true
  };
  userStates.delete(chatId);
  sessions.delete(chatId);
  menuMessages.delete(chatId);
  await bot.sendMessage(chatId, t.START, { reply_markup: keyboard as any });
  userStates.set(chatId, State.SOURCE);
}

bot.onText(/\/start/, async (msg) => {
  await doStart(msg.chat.id);
});

bot.onText(/\/accounts/, async (msg) => {
  const chatId = msg.chat.id;
  const t = getChatT(chatId);
  await bot.sendMessage(chatId, t.ACCOUNTS_PROMPT, { parse_mode: 'Markdown' });
  userStates.set(chatId, State.ACCOUNT_INPUT);
});

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const t = getChatT(chatId);
  await bot.sendMessage(chatId, t.HELP.replace('{max_mb}', settings.MAX_SOURCE_MB.toString()));
});

bot.onText(/\/cancel/, async (msg) => {
  const chatId = msg.chat.id;
  const t = getChatT(chatId);
  await bot.sendMessage(chatId, t.CANCELLED);
  userStates.delete(chatId);
  sessions.delete(chatId);
  menuMessages.delete(chatId);
});

bot.onText(/\/lang/, async (msg) => {
  await showLanguageMenu(msg.chat.id);
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  const t = getChatT(chatId);
  // Handle the persistent keyboard buttons from any state
  if (text === t.START_BUTTON) {
    await doStart(chatId);
    return;
  }
  if (text === t.ACCOUNTS_BUTTON) {
    await bot.sendMessage(chatId, t.ACCOUNTS_PROMPT, { parse_mode: 'Markdown' });
    userStates.set(chatId, State.ACCOUNT_INPUT);
    return;
  }
  if (text === t.TAGS_BUTTON) {
    await showTagsMenu(chatId, sessions.get(chatId) || {});
    return;
  }
  if (text === t.LANG_BUTTON) {
    await showLanguageMenu(chatId);
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
      case State.SPEED_INPUT: await handleSpeedInput(msg, chatId, session); break;
      case State.AUDIO_SEGMENT: await handleAudioSegment(msg, chatId, session); break;
      case State.ACCOUNT_INPUT: await handleAccountInput(msg, chatId); break;
    }
  } catch (error) {
    await bot.sendMessage(chatId, `${t.ERROR_GENERIC}: ${error}`);
  }
});

bot.on('video', async (msg) => {
  const chatId = msg.chat.id;
  const t = getChatT(chatId);
  const state = userStates.get(chatId);
  if (state === State.PROCESSING) {
    await bot.sendMessage(chatId, t.ALREADY_PROCESSING);
    return;
  }
  resetSession(chatId);
  const session = sessions.get(chatId) || {};
  const video = msg.video;
  if (!video) return;
  if (video.file_size && video.file_size > settings.MAX_SOURCE_MB * 1024 * 1024) {
    await bot.sendMessage(chatId, t.TOO_LARGE.replace('{max_mb}', settings.MAX_SOURCE_MB.toString()));
    return;
  }
  await bot.sendMessage(chatId, t.VIDEO_RECEIVED_DOWNLOADING);
  try {
    const fileLink = await bot.getFileLink(video.file_id);
    const fileName = `source_${chatId}_${Date.now()}.mp4`;
    const filePath = path.join(settings.TMP_DIR, fileName);
    const response = await fetch(fileLink);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    session.sourcePath = filePath;
    sessions.set(chatId, session);
    await bot.sendMessage(chatId, t.SOURCE_RECEIVED);
    await showMainMenu(chatId, session);
    userStates.set(chatId, State.MAIN_MENU);
    sessions.set(chatId, session);
  } catch (error) {
    await bot.sendMessage(chatId, `${t.ERROR_GENERIC}: ${error}`);
  }
});

bot.on('audio', async (msg) => {
  const chatId = msg.chat.id;
  const t = getChatT(chatId);
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
    await bot.sendMessage(chatId, t.MUSIC_RECEIVED);
    await bot.sendMessage(chatId, t.ASK_AUDIO_SEGMENT);
    userStates.set(chatId, State.AUDIO_SEGMENT);
    sessions.set(chatId, session);
  } catch (error) {
    await bot.sendMessage(chatId, `${t.ERROR_GENERIC}: ${error}`);
  }
});

async function handleSource(msg: any, chatId: number, session: SessionData): Promise<void> {
  const t = getChatT(chatId);
  const text = msg.text?.trim();
  if (!text) return;
  if (!isValidUrl(text)) {
    await bot.sendMessage(chatId, t.INVALID_URL);
    return;
  }
  resetSession(chatId);
  const freshSession = sessions.get(chatId) || {};
  freshSession.sourceUrl = text;
  await bot.sendMessage(chatId, t.SOURCE_RECEIVED);
  await bot.sendMessage(chatId, t.ASK_QUALITY);
  userStates.set(chatId, State.QUALITY_SELECTION);
  sessions.set(chatId, freshSession);
}

async function handleQualitySelection(msg: any, chatId: number, session: SessionData): Promise<void> {
  const t = getChatT(chatId);
  const text = msg.text?.trim();
  const qualityMap: Record<string, number> = { '1080': 1080, '720': 720, '480': 480, '360': 360 };
  const quality = qualityMap[text || ''];
  if (!quality) { await bot.sendMessage(chatId, t.INVALID_QUALITY); return; }
  session.quality = quality;
  try {
    await bot.sendMessage(chatId, t.QUALITY_SELECTED.replace('{quality}', quality.toString()));
    if (session.sourceUrl) {
      session.sourcePath = await resolveSourceWithQuality(session.sourceUrl, quality);
      await bot.sendMessage(chatId, t.SOURCE_RECEIVED);
    }
    await showMainMenu(chatId, session);
    userStates.set(chatId, State.MAIN_MENU);
    sessions.set(chatId, session);
  } catch (error) {
    await bot.sendMessage(chatId, `${t.ERROR_GENERIC}: ${error}`);
  }
}

async function handleClipCountInput(msg: any, chatId: number, session: SessionData): Promise<void> {
  const t = getChatT(chatId);
  const text = msg.text?.trim();
  const count = parseInt(text || '0', 10);
  if (isNaN(count) || count < 1 || count > 10) { await bot.sendMessage(chatId, t.INVALID_CLIP_COUNT); return; }
  session.clipCount = count;
  sessions.set(chatId, session);
  await showMainMenu(chatId, session, menuMessages.get(chatId));
  userStates.set(chatId, State.MAIN_MENU);
}

async function handleSegmentInput(msg: any, chatId: number, session: SessionData): Promise<void> {
  const t = getChatT(chatId);
  const text = msg.text?.trim();
  const parts = text?.split(' ');
  if (!parts || parts.length !== 2) { await bot.sendMessage(chatId, t.INVALID_SEGMENT_FORMAT); return; }
  const startTime = parseTimeToSeconds(parts[0]);
  const endTime = parseTimeToSeconds(parts[1]);
  if (startTime === null || endTime === null) { await bot.sendMessage(chatId, t.INVALID_SEGMENT_FORMAT); return; }
  if (startTime >= endTime) { await bot.sendMessage(chatId, t.INVALID_SEGMENT_RANGE); return; }
  if (endTime - startTime < 5) { await bot.sendMessage(chatId, t.SEGMENT_TOO_SHORT); return; }
  if (endTime - startTime > 60) { await bot.sendMessage(chatId, t.SEGMENT_TOO_LONG); return; }
  session.startTime = startTime;
  session.endTime = endTime;
  sessions.set(chatId, session);
  await showMainMenu(chatId, session, menuMessages.get(chatId));
  userStates.set(chatId, State.MAIN_MENU);
}

async function handleSpeedInput(msg: any, chatId: number, session: SessionData): Promise<void> {
  const t = getChatT(chatId);
  const text = msg.text?.trim().replace(',', '.');
  if (!text) {
    await bot.sendMessage(chatId, t.INVALID_PLAYBACK_SPEED);
    return;
  }
  const speed = parseFloat(text);
  if (isNaN(speed) || speed < 0.5 || speed > 3) {
    await bot.sendMessage(chatId, t.INVALID_PLAYBACK_SPEED);
    return;
  }
  // Round to 2 decimals to keep values clean (e.g. 1.50 -> 1.5)
  const rounded = Math.round(speed * 100) / 100;
  session.playbackSpeed = rounded;
  sessions.set(chatId, session);
  if (Math.abs(rounded - 1) < 0.001) {
    await bot.sendMessage(chatId, t.PLAYBACK_SPEED_RESET);
  } else {
    await bot.sendMessage(chatId, t.PLAYBACK_SPEED_SELECTED(`${rounded}x`));
  }
  await showMainMenu(chatId, session, menuMessages.get(chatId));
  userStates.set(chatId, State.MAIN_MENU);
}

async function handleMusicInput(msg: any, chatId: number, session: SessionData): Promise<void> {
  const t = getChatT(chatId);
  const text = msg.text?.trim().toLowerCase();
  if (text === 'нет' || text === 'no' || text === 'n' || text === 'ні' || text === 'нi' || text === 'não' || text === 'nao') {
    session.mp3Path = undefined;
    sessions.set(chatId, session);
    await bot.sendMessage(chatId, t.NO_MUSIC);
    await showMainMenu(chatId, session, menuMessages.get(chatId));
    userStates.set(chatId, State.MAIN_MENU);
    return;
  }
  await bot.sendMessage(chatId, t.MUSIC_PROMPT_OR_SKIP);
}

async function handleAccountInput(msg: any, chatId: number): Promise<void> {
  const t = getChatT(chatId);
  const text = msg.text?.trim();
  if (!text) {
    await bot.sendMessage(chatId, t.ACCOUNTS_INVALID);
    return;
  }

  // Parse possibly multiple accounts (separated by comma and/or whitespace)
  const { valid, invalid } = parseMultipleAccounts(text);

  if (valid.length === 0) {
    await bot.sendMessage(chatId, t.ACCOUNTS_INVALID);
    return;
  }

  // Enforce a hard limit so users (and the bot) are not overwhelmed
  let limited = false;
  let toProcess = valid;
  if (valid.length > MAX_ACCOUNTS) {
    limited = true;
    toProcess = valid.slice(0, MAX_ACCOUNTS);
  }

  const total = toProcess.length;
  const isMultiple = total > 1;

  // Initial status message
  if (isMultiple) {
    let status = t.ACCOUNTS_FETCHING_MULTIPLE(total);
    if (invalid.length > 0) status += '\n' + t.ACCOUNTS_SKIPPED(invalid.length);
    if (limited) status += '\n' + t.ACCOUNTS_LIMIT(MAX_ACCOUNTS);
    await bot.sendMessage(chatId, status);
  } else {
    // Single account — keep the original short message for backward compat
    if (invalid.length > 0) {
      await bot.sendMessage(chatId, t.ACCOUNTS_SKIPPED(invalid.length));
    }
    await bot.sendMessage(chatId, t.ACCOUNTS_FETCHING);
  }

  let success = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const parsed = toProcess[i];
    const handle = parsed.username.startsWith('@') || parsed.platform !== 'tiktok'
      ? parsed.username
      : `@${parsed.username}`;

    // Per-account progress indicator for multi-account requests
    if (isMultiple) {
      await bot.sendMessage(chatId, t.ACCOUNTS_PROGRESS(i + 1, total, handle));
    }

    try {
      const info = await fetchAccount(parsed, 5);
      const report = formatAccountReport(info, t);
      await bot.sendMessage(chatId, report);
      success++;
    } catch (error: any) {
      // Report failure for this particular account, but continue with the rest
      await bot.sendMessage(chatId, `❌ ${handle}: ${error?.message || t.ERROR_GENERIC}`);
    }
  }

  // Final summary
  if (isMultiple) {
    await bot.sendMessage(chatId, t.ACCOUNTS_DONE_MULTIPLE(success, total));
  } else if (success > 0) {
    await bot.sendMessage(chatId, t.ACCOUNTS_DONE);
  }
}

async function handleAudioSegment(msg: any, chatId: number, session: SessionData): Promise<void> {
  const t = getChatT(chatId);
  const text = msg.text?.trim().toLowerCase();
  if (text === 'всё' || text === 'все' || text === 'усе' || text === 'усє' || text === 'all' || text === 'tudo' || text === 'todo') {
    await bot.sendMessage(chatId, t.AUDIO_SEGMENT_ALL);
    await showMainMenu(chatId, session, menuMessages.get(chatId));
    userStates.set(chatId, State.MAIN_MENU);
    sessions.set(chatId, session);
    return;
  }
  const parts = text?.split(' ');
  if (!parts || parts.length !== 2) { await bot.sendMessage(chatId, t.INVALID_SEGMENT_FORMAT); return; }
  const startTime = parseTimeToSeconds(parts[0]);
  const endTime = parseTimeToSeconds(parts[1]);
  if (startTime === null || endTime === null) { await bot.sendMessage(chatId, t.INVALID_SEGMENT_FORMAT); return; }
  session.audioStartTime = startTime;
  session.audioEndTime = endTime;
  sessions.set(chatId, session);
  await bot.sendMessage(chatId, t.AUDIO_SEGMENT_SELECTED.replace('{start}', formatSecondsToTime(startTime)).replace('{end}', formatSecondsToTime(endTime)));
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