import type { Translations } from './types.js';

export const ru: Translations = {
  // Start
  START_BUTTON: '🏠 Начало',

  // Language
  LANG_BUTTON: '🌐 Язык',
  LANG_TITLE: '🌐 *Выберите язык*',
  LANG_SELECTED: (langName: string) => `✅ Язык изменён на: ${langName}.`,
  LANG_RUSSIAN: '🇷🇺 Русский',
  LANG_ENGLISH: '🇬🇧 English',

  // Commands / Start
  START: (
    'Привет! Я помогу нарезать клипы из длинного видео под TikTok (15–25 сек), '
    + 'сгенерировать английский сценарий, озвучку, субтитры и (по желанию) опубликовать.\n\n'
    + 'Пришлите ссылку на видео (YouTube/TikTok/файл) или загрузите файл прямо сюда.\n'
    + 'Команды: /help, /cancel'
  ),
  HELP: (
    'Как это работает:\n'
    + '1) Отправьте ссылку или загрузите видео (до {max_mb} МБ).\n'
    + '2) Выберите параметры через кнопки меню.\n'
    + '3) Я соберу клипы с озвучкой (англ.), сабами и верну вам.\n\n'
    + 'Советы: первые 2–3 секунды — хук! Не злоупотребляйте автопостингом (политики TikTok).'
  ),
  CANCELLED: 'Окей, отменено. Если что — /start',

  // Source
  ASK_SOURCE: 'Пришлите ссылку (YouTube/TikTok) или загрузите видеофайл.',
  SOURCE_RECEIVED: 'Источник получен.',
  INVALID_URL: 'Пожалуйста, отправьте корректную ссылку или видеофайл.',
  VIDEO_RECEIVED_DOWNLOADING: '📁 Видео получено. Скачиваю...',

  // Quality
  ASK_QUALITY: (
    'Выберите качество видео для скачивания:\n'
    + '1080 - Full HD (лучшее качество, больший размер)\n'
    + '720 - HD\n'
    + '480 - SD\n'
    + '360 - Низкое качество (меньший размер)\n\n'
    + 'Напишите: 1080, 720, 480 или 360'
  ),
  INVALID_QUALITY: 'Пожалуйста, выберите качество: 1080, 720, 480 или 360.',
  QUALITY_SELECTED: 'Качество {quality}p выбрано. Скачиваю видео...',

  // Trim
  ASK_CLIP_COUNT: 'Сколько клипов сделать? (например: 3, от 1 до 10)',
  ASK_CUSTOM_SEGMENT: (
    'Укажите начало и конец отрезка в формате MM:SS через пробел.\n'
    + 'Примеры:\n'
    + '- 0:40 1:00 (от 40 секунд до 1 минуты)\n'
    + '- 1:20 1:40 (от 1 минуты 20 секунд до 1 минуты 40 секунд)'
  ),
  INVALID_SEGMENT_FORMAT: (
    'Неверный формат. Укажите два времени в формате MM:SS через пробел.\n'
    + 'Пример: 0:40 1:00'
  ),
  INVALID_SEGMENT_RANGE: 'Начало должно быть меньше конца. Попробуйте еще раз.',
  SEGMENT_TOO_SHORT: 'Минимальная длительность — 5 секунд.',
  SEGMENT_TOO_LONG: 'Максимальная длительность — 60 секунд.',
  INVALID_CLIP_COUNT: 'Введите число клипов от 1 до 10.',

  // Main menu
  MAIN_MENU_TITLE: '🎬 *Настройки обработки видео*\n\nВыберите параметры:',
  UPLOAD_BUTTON: '🚀 Загрузить',

  // Button texts (dynamic)
  TRIM_BUTTON: '✂️ Обрезка',
  TRIM_TOP_MOMENTS_BTN: (count: number) => `✂️ Обрезка: Топ моменты (${count} клипов) ✓`,
  TRIM_CUSTOM_SEGMENT_BTN: (start: string, end: string) => `✂️ Обрезка: Интервал ${start}-${end} ✓`,
  AUDIO_ONLY_ENABLED: '🎵 Только звук в MP3 ✓',
  AUDIO_ONLY_DISABLED: '🎵 Только звук в MP3',
  MUSIC_REPLACED: '🎵 Аудиозапись: Заменена ✓',
  MUSIC_CHANGE: '🎵 Поменять аудиозапись',
  AUDIO_MENU_HEADPHONES: '🎧 Аудио ✓',
  AUDIO_MENU_MUSIC: '🎵 Аудио ✓',
  AUDIO_MENU_DEFAULT: '🎵 Аудио',
  SPEED_BUTTON: (speed: number) => `⚡️ Скорость: ${speed}x`,
  AUTO_MODE_SELECTED_PLATFORM: (label: string) => `🎯 Авто режим: ${label} ✓`,
  AUTO_MODE_DEFAULT: '🎯 Авто режим',

  // Trim menu
  TRIM_MENU_TITLE: '✂️ *Выберите тип обрезки:*',
  TRIM_TOP_MOMENTS: '🎯 Топ моменты',
  TRIM_TOP_MOMENTS_CHECKED: '🎯 Топ моменты ✓',
  TRIM_CUSTOM_SEGMENT: '✂️ Определенный кусок',
  TRIM_CUSTOM_SEGMENT_CHECKED: '✂️ Определенный кусок ✓',

  // Audio menu
  AUDIO_MENU_TITLE: '🎵 *Настройки звука:*',

  // Tags
  TAGS_BUTTON: '🏷️ Теги',
  TAGS_MENU_TITLE: '🏷️ *Хотите подсмотреть тренды для хэштегов?*',
  TAGS_YES: '✅ Да, показать тренды',
  TAGS_NO: '❌ Нет, пропустить',
  TAGS_TOP_TRENDS: (formatted: string) => `🏷️ *Топ трендов:*\n${formatted}`,

  // Auto mode
  AUTO_MODE_TITLE: '🎯 *Авто режим*\n\nВыберите платформу — я автоматически настрою обрезку, длительность и количество клипов под формат:',
  AUTO_MODE_OFF: '❌ Выключить авто режим',
  AUTO_MODE_SELECTED: (platformLabel: string) => `✅ Авто режим включён: ${platformLabel}.`,
  AUTO_MODE_CLEARED: 'Авто режим отключён. Настройки сброшены к ручным.',

  // Music
  ASK_MUSIC: 'Хочешь заменить аудио на песню? Пришли mp3 файл или напиши \'нет\' чтобы пропустить.',
  MUSIC_RECEIVED: 'Музыка получена.',
  NO_MUSIC: 'Без замены аудио.',
  MUSIC_PROMPT_OR_SKIP: 'Пожалуйста, отправьте MP3 файл или напишите "нет" чтобы пропустить.',
  ASK_AUDIO_SEGMENT: (
    'Укажи начало и конец отрезка аудио в формате MM:SS через пробел.\n'
    + 'Примеры:\n'
    + '- 0:20 1:30 (от 20 секунд до 1 минуты 30 секунд)\n'
    + '- Напиши \'всё\' чтобы использовать всё аудио целиком'
  ),
  AUDIO_SEGMENT_SELECTED: 'Отрезок аудио выбран: с {start} по {end}.',
  AUDIO_SEGMENT_ALL: 'Буду использовать всё аудио целиком.',

  // Speed
  ASK_PLAYBACK_SPEED: (
    '⚡️ *Скорость воспроизведения*\n\n'
    + 'Текущая скорость: {current}\n\n'
    + 'Введите новое значение от 0.5 до 3.\n'
    + '• 1 — обычная скорость\n'
    + '• меньше 1 — замедление (например 0.5)\n'
    + '• больше 1 — ускорение (например 1.5, 2, максимум 3)\n\n'
    + 'Десятичным разделителем может быть точка или запятая.'
  ),
  INVALID_PLAYBACK_SPEED: 'Неверное значение. Введите число от 0.5 до 3 (например: 0.5, 1, 1.5, 2, 3).',
  PLAYBACK_SPEED_SELECTED: (speedLabel: string) => `Скорость воспроизведения установлена: ${speedLabel}.`,
  PLAYBACK_SPEED_RESET: 'Скорость воспроизведения сброшена до обычной (1x).',

  // Processing
  PROCESSING_START: 'Начинаю обработку. Это может занять время. Я пришлю прогресс и результат.',
  TRIM_REQUIRED: '⚠️ Пожалуйста, выберите режим обрезки или включите "Только звук в MP3".',
  SOURCE_INVALID: '❌ Ошибка: видео не было загружено. Пожалуйста, сначала отправьте видео или ссылку, выберите качество, а затем настройте параметры.',

  // Common
  BACK_BUTTON: '◀️ Назад',
  ERROR_GENERIC: 'Упс, что-то пошло не так. Попробуйте ещё раз позже.',
  RATE_LIMIT: 'Слишком часто. Попробуйте чуть позже.',
  INVALID_INPUT: 'Неверный ввод. Повторите, пожалуйста.',
  TOO_LARGE: 'Файл слишком большой. Максимум {max_mb} МБ.',
  DONE: 'Готово! Отправляю клипы и подписи.',
  CALLBACK_ERROR: 'Произошла ошибка',
  ALREADY_PROCESSING: '⏳ Уже обрабатываю другое видео. Пожалуйста, подождите.',

  // Accounts
  ACCOUNTS_BUTTON: '📊 Аккаунты',
  ACCOUNTS_PROMPT: (
    '📊 *Просмотр аккаунтов*\n\n'
    + 'Отправьте ссылку или @username аккаунта TikTok, Instagram или YouTube.\n'
    + 'Примеры:\n'
    + '• @coinbase\n'
    + '• https://www.tiktok.com/@coinbase\n'
    + '• https://www.instagram.com/coinbase/\n'
    + '• https://www.youtube.com/@MrBeast\n\n'
    + 'Бот покажет 5 последних видео и общую статистику.'
  ),
  ACCOUNTS_INVALID: 'Не удалось распознать аккаунт. Пришлите ссылку или @username (TikTok/Instagram/YouTube).',
  ACCOUNTS_FETCHING: '⏳ Собираю данные аккаунта... (может занять до 30 секунд)',
  ACCOUNTS_DONE: '✅ Готово.',

  // Platforms
  PLATFORM_TIKTOK: 'TikTok',
  PLATFORM_SHORTS: 'YouTube Shorts',
  PLATFORM_REELS: 'Instagram Reels',

  // Pipeline messages
  PIPELINE_SENDING_VIDEO: 'Готово! Отправляю видео...',
  PIPELINE_VIDEO_TOO_LARGE: (sizeMB: string) => `❌ Видео слишком большое для Telegram (${sizeMB}MB, лимит 50MB)`,
  PIPELINE_VIDEO_NO_PROCESSING: 'Видео скачано без обработки',
  PIPELINE_DONE: '✅ Обработка завершена! Напишите /start, чтобы создать новое видео.',
  PIPELINE_VIDEO_SEND_ERROR: (error: string) => `❌ Ошибка отправки видео: ${error}`,
  PIPELINE_EXTRACTING_AUDIO: 'Извлекаю аудио...',
  PIPELINE_AUDIO_TOO_LARGE: (sizeMB: string) => `❌ Аудио слишком большое для отправки (${sizeMB}MB)`,
  PIPELINE_AUDIO_EXTRACTED: 'Аудио извлечено в MP3',
  PIPELINE_AUDIO_SEND_ERROR: (error: string) => `❌ Ошибка отправки аудио: ${error}`,
  PIPELINE_SEGMENT_NO_TIME: '❌ Ошибка: не указан временной интервал для извлечения аудио.',
  PIPELINE_SOURCE_NOT_FOUND: '❌ Ошибка: исходный файл не найден. Возможно, видео не было загружено. Попробуйте отправить видео заново.',
  PIPELINE_FILE_NOT_FOUND: '❌ Ошибка: файл видео не найден. Возможно, он был удален. Попробуйте отправить видео заново.',
  PIPELINE_EXTRACTING_SEGMENT: (start: string, end: string) => `🎵 Извлекаю аудио из интервала ${start} - ${end}...`,
  PIPELINE_SEGMENT_TOO_LARGE: (sizeMB: string) => `❌ Аудио слишком большое (${sizeMB}MB)`,
  PIPELINE_SEGMENT_EXTRACTED: (start: string, end: string) => `Аудио извлечено из интервала ${start}-${end}`,
  PIPELINE_SEGMENT_ERROR: (error: string) => `❌ Ошибка извлечения аудио: ${error}`,
  PIPELINE_ANALYZING: (backend: string) => `🎬 Анализирую видео для поиска лучших моментов (${backend}). Это займёт немного времени...`,
  PIPELINE_SENDING_CLIPS: 'Готово! Отправляю клипы...',
  PIPELINE_CLIP_TOO_LARGE: (sizeMB: string, caption: string) => `⚠️ Клип слишком большой для Telegram (${sizeMB}MB, лимит 50MB): ${caption}`,
  PIPELINE_CLIP_SEND_ERROR: (error: string) => `❌ Ошибка отправки клипа: ${error}`,
  PIPELINE_NO_CLIPS_SENT: '❌ Не удалось отправить ни один клип. Проверьте логи для деталей.',
  PIPELINE_PARTIAL_SUCCESS: (sent: number, total: number) => `✅ Отправлено ${sent} из ${total} клипов. Напишите /start, чтобы создать новое видео.`,
  PIPELINE_TASK_ERROR: (error: string) => `Ошибка при обработке задачи: ${error}`,

  // Account report labels
  REPORT_VIDEO: 'Відео',
  REPORT_UPLOADED: 'Завантажено о',
  REPORT_PLATFORM: 'Платформа',
  REPORT_SHADOWBAN: 'Тіньовий бан',
  REPORT_TOTAL_STATS: 'Загальна статистика акаунту',
  REPORT_FOLLOWERS: 'підписників',
  REPORT_VIDEOS: 'відео',
  REPORT_NA: 'Н/Д',

  // Publishing (cross-posting to TikTok/Instagram/YouTube)
  PUBLISH_BUTTON: '📤 Опубликовать',
  PUBLISH_MENU_TITLE: '📤 *Публикация в соцсети*\n\nВыберите платформу, куда отправить готовый клип:',
  PUBLISH_NO_ACCOUNTS: (platformLabel: string) => `Нет сохранённых аккаунтов для ${platformLabel}. Сначала добавьте через «Мои аккаунты».`,
  PUBLISH_SELECT_ACCOUNT: (platformLabel: string) => `Выберите аккаунт для публикации в ${platformLabel}:`,
  PUBLISH_SELECT_PLATFORM: 'Выберите платформу:',
  PUBLISH_MENU_ADD_CRED: '➕ Добавить аккаунт',
  PUBLISH_MENU_MY_ACCOUNTS: '📋 Мои аккаунты',
  PUBLISH_ADD_TITLE: (platformLabel: string) => `➕ *Добавить аккаунт ${platformLabel}*\n\nПонадобятся API-ключи/токены.`,
  PUBLISH_ADD_PROMPT: (fields: string) => `Пришлите значения в виде JSON или key:value на отдельных строках.\nОбязательные поля:\n${fields}`,
  PUBLISH_ADD_SUCCESS: (label: string) => `✅ Аккаунт «${label}» сохранён.`,
  PUBLISH_ADD_INVALID: 'Неверный формат. Пришлите поля как JSON или key:value на отдельных строках.',
  PUBLISH_ASK_LABEL: 'Какое название показать для этого аккаунта? (например, «Основной TikTok»)',
  PUBLISH_CRED_DELETED: '🗑 Аккаунт удалён.',
  PUBLISH_NO_CREDS: 'У вас пока нет сохранённых аккаунтов.',
  PUBLISH_LIST_TITLE: '📋 *Ваши аккаунты*',
  PUBLISH_LABEL_LABEL: 'Название',
  PUBLISH_STARTED: '🚀 Начинаю публикацию...',
  PUBLISH_PROGRESS: (message: string) => `⏳ ${message}`,
  PUBLISH_SUCCESS: (message: string) => `✅ ${message}`,
  PUBLISH_FAILED: (message: string) => `❌ Ошибка публикации: ${message}`,
  PUBLISH_DONE: 'Публикация завершена.',
  PUBLISH_AFTER_CLIP_PROMPT: 'Хотите опубликовать этот клип в соцсеть?',
  PUBLISH_CLIP_PROMPT: (platformLabel: string) => `📤 Опубликовать этот клип в ${platformLabel}?`,
};

export default ru;