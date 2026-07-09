import type { Translations } from './types.js';

export const uk: Translations = {
  // Start
  START_BUTTON: '🏠 Головна',

  // Language
  LANG_BUTTON: '🌐 Мова',
  LANG_TITLE: '🌐 *Оберіть мову*',
  LANG_SELECTED: (langName: string) => `✅ Мову змінено на: ${langName}.`,
  LANG_RUSSIAN: '🇷🇺 Російська',
  LANG_ENGLISH: '🇬🇧 Англійська',
  LANG_UKRAINIAN: '🇺🇦 Українська',
  LANG_PORTUGUESE: '🇵🇹 Португальська',

  // Commands / Start
  START: (
    'Привіт! Я допоможу нарізати кліпи з довгого відео під TikTok (15–25 сек), '
    + 'згенерувати англійський сценарій, озвучку, субтитри та (за бажанням) опублікувати.\n\n'
    + 'Надішліть посилання на відео (YouTube/TikTok/файл) або завантажте файл сюди.\n'
    + 'Команди: /help, /cancel'
  ),
  HELP: (
    'Як це працює:\n'
    + '1) Надішліть посилання або завантажте відео (до {max_mb} МБ).\n'
    + '2) Оберіть параметри через кнопки меню.\n'
    + '3) Я зберу кліпи з озвучкою (англ.), субтитрами та надішлю вам.\n\n'
    + 'Поради: перші 2–3 секунди — гак! Не зловживайте автопублікацією (політики TikTok).'
  ),
  CANCELLED: 'Окей, скасовано. Якщо що — /start',

  // Source
  ASK_SOURCE: 'Надішліть посилання (YouTube/TikTok) або завантажте відеофайл.',
  SOURCE_RECEIVED: 'Джерело отримано.',
  INVALID_URL: 'Будь ласка, надішліть коректне посилання або відеофайл.',
  VIDEO_RECEIVED_DOWNLOADING: '📁 Відео отримано. Завантажую...',

  // Quality
  ASK_QUALITY: (
    'Оберіть якість відео для завантаження:\n'
    + '1080 - Full HD (найкраща якість, більший розмір)\n'
    + '720 - HD\n'
    + '480 - SD\n'
    + '360 - Низька якість (менший розмір)\n\n'
    + 'Напишіть: 1080, 720, 480 або 360'
  ),
  INVALID_QUALITY: 'Будь ласка, оберіть якість: 1080, 720, 480 або 360.',
  QUALITY_SELECTED: 'Якість {quality}p обрано. Завантажую відео...',

  // Trim
  ASK_CLIP_COUNT: 'Скільки кліпів зробити? (наприклад: 3, від 1 до 10)',
  ASK_CUSTOM_SEGMENT: (
    'Вкажіть початок і кінець відрізка у форматі MM:SS через пробіл.\n'
    + 'Приклади:\n'
    + '- 0:40 1:00 (від 40 секунд до 1 хвилини)\n'
    + '- 1:20 1:40 (від 1 хвилини 20 секунд до 1 хвилини 40 секунд)'
  ),
  INVALID_SEGMENT_FORMAT: (
    'Невірний формат. Вкажіть два значення часу у форматі MM:SS через пробіл.\n'
    + 'Приклад: 0:40 1:00'
  ),
  INVALID_SEGMENT_RANGE: 'Початок має бути меншим за кінець. Спробуйте ще раз.',
  SEGMENT_TOO_SHORT: 'Мінімальна тривалість — 5 секунд.',
  SEGMENT_TOO_LONG: 'Максимальна тривалість — 60 секунд.',
  INVALID_CLIP_COUNT: 'Введіть кількість кліпів від 1 до 10.',

  // Main menu
  MAIN_MENU_TITLE: '🎬 *Налаштування обробки відео*\n\nОберіть параметри:',
  UPLOAD_BUTTON: '🚀 Завантажити',

  // Button texts (dynamic)
  TRIM_BUTTON: '✂️ Обрізка',
  TRIM_TOP_MOMENTS_BTN: (count: number) => `✂️ Обрізка: Топ моменти (${count} кліпів) ✓`,
  TRIM_CUSTOM_SEGMENT_BTN: (start: string, end: string) => `✂️ Обрізка: Інтервал ${start}-${end} ✓`,
  AUDIO_ONLY_ENABLED: '🎵 Лише звук в MP3 ✓',
  AUDIO_ONLY_DISABLED: '🎵 Лише звук в MP3',
  MUSIC_REPLACED: '🎵 Аудіозапис: Замінено ✓',
  MUSIC_CHANGE: '🎵 Змінити аудіозапис',
  AUDIO_MENU_HEADPHONES: '🎧 Аудіо ✓',
  AUDIO_MENU_MUSIC: '🎵 Аудіо ✓',
  AUDIO_MENU_DEFAULT: '🎵 Аудіо',
  SPEED_BUTTON: (speed: number) => `⚡️ Швидкість: ${speed}x`,
  AUTO_MODE_SELECTED_PLATFORM: (label: string) => `🎯 Авто режим: ${label} ✓`,
  AUTO_MODE_DEFAULT: '🎯 Авто режим',

  // Trim menu
  TRIM_MENU_TITLE: '✂️ *Оберіть тип обрізки:*',
  TRIM_TOP_MOMENTS: '🎯 Топ моменти',
  TRIM_TOP_MOMENTS_CHECKED: '🎯 Топ моменти ✓',
  TRIM_CUSTOM_SEGMENT: '✂️ Власний відрізок',
  TRIM_CUSTOM_SEGMENT_CHECKED: '✂️ Власний відрізок ✓',

  // Audio menu
  AUDIO_MENU_TITLE: '🎵 *Налаштування звуку:*',

  // Tags
  TAGS_BUTTON: '🏷️ Теги',
  TAGS_MENU_TITLE: '🏷️ *Хочете підглянути тренди для хештегів?*',
  TAGS_YES: '✅ Так, показати тренди',
  TAGS_NO: '❌ Ні, пропустити',
  TAGS_TOP_TRENDS: (formatted: string) => `🏷️ *Топ трендів:*\n${formatted}`,

  // Auto mode
  AUTO_MODE_TITLE: '🎯 *Авто режим*\n\nОберіть платформу — я автоматично налаштую обрізку, тривалість і кількість кліпів під формат:',
  AUTO_MODE_OFF: '❌ Вимкнути авто режим',
  AUTO_MODE_SELECTED: (platformLabel: string) => `✅ Авто режим увімкнено: ${platformLabel}.`,
  AUTO_MODE_CLEARED: 'Авто режим вимкнено. Налаштування скинуто до ручних.',

  // Music
  ASK_MUSIC: 'Хочеш замінити аудіо на пісню? Надішли mp3 файл або напиши "ні" щоб пропустити.',
  MUSIC_RECEIVED: 'Музику отримано.',
  NO_MUSIC: 'Без заміни аудіо.',
  MUSIC_PROMPT_OR_SKIP: 'Будь ласка, надішліть MP3 файл або напишіть "ні" щоб пропустити.',
  ASK_AUDIO_SEGMENT: (
    'Вкажи початок і кінець відрізка аудіо у форматі MM:SS через пробіл.\n'
    + 'Приклади:\n'
    + '- 0:20 1:30 (від 20 секунд до 1 хвилини 30 секунд)\n'
    + '- Напиши "все" щоб використати все аудіо повністю'
  ),
  AUDIO_SEGMENT_SELECTED: 'Відрізок аудіо обрано: з {start} по {end}.',
  AUDIO_SEGMENT_ALL: 'Використаю все аудіо повністю.',

  // Speed
  ASK_PLAYBACK_SPEED: (
    '⚡️ *Швидкість відтворення*\n\n'
    + 'Поточна швидкість: {current}\n\n'
    + 'Введіть нове значення від 0.5 до 3.\n'
    + '• 1 — звичайна швидкість\n'
    + '• менше 1 — уповільнення (наприклад 0.5)\n'
    + '• більше 1 — прискорення (наприклад 1.5, 2, максимум 3)\n\n'
    + 'Десятковим роздільником може бути крапка або кома.'
  ),
  INVALID_PLAYBACK_SPEED: 'Невірне значення. Введіть число від 0.5 до 3 (наприклад: 0.5, 1, 1.5, 2, 3).',
  PLAYBACK_SPEED_SELECTED: (speedLabel: string) => `Швидкість відтворення встановлено: ${speedLabel}.`,
  PLAYBACK_SPEED_RESET: 'Швидкість відтворення скинуто до звичайної (1x).',

  // Processing
  PROCESSING_START: 'Починаю обробку. Це може зайняти час. Я надішлю прогрес і результат.',
  TRIM_REQUIRED: '⚠️ Будь ласка, оберіть режим обрізки або увімкніть "Лише звук в MP3".',
  SOURCE_INVALID: '❌ Помилка: відео не було завантажено. Будь ласка, спочатку надішліть відео або посилання, оберіть якість, а потім налаштуйте параметри.',

  // Common
  BACK_BUTTON: '◀️ Назад',
  ERROR_GENERIC: 'Ой, щось пішло не так. Спробуйте пізніше.',
  RATE_LIMIT: 'Занадто часто. Спробуйте трохи пізніше.',
  INVALID_INPUT: 'Невірне введення. Спробуйте ще раз.',
  TOO_LARGE: 'Файл занадто великий. Максимум {max_mb} МБ.',
  DONE: 'Готово! Надсилаю кліпи та підписи.',
  CALLBACK_ERROR: 'Сталася помилка',
  ALREADY_PROCESSING: '⏳ Вже обробляю інше відео. Будь ласка, зачекайте.',

  // Accounts
  ACCOUNTS_BUTTON: '📊 Акаунти',
  ACCOUNTS_PROMPT: (
    '📊 *Перегляд акаунтів*\n\n'
    + 'Надішліть посилання або @username акаунта TikTok, Instagram або YouTube.\n'
    + 'Можна вказати одразу кілька акаунтів через кому або пробіл (макс. 8).\n'
    + 'Приклади:\n'
    + '• @coinbase\n'
    + '• https://www.tiktok.com/@coinbase\n'
    + '• https://www.instagram.com/coinbase/\n'
    + '• https://www.youtube.com/@MrBeast\n'
    + '• @user1, @user2, @user3\n'
    + '• tiktok.com/@a instagram.com/@b youtube.com/@c\n\n'
    + 'Бот покаже 5 останніх відео та загальну статистику по кожному акаунту.'
  ),
  ACCOUNTS_INVALID: 'Не вдалося розпізнати акаунт. Надішліть посилання або @username (TikTok/Instagram/YouTube).',
  ACCOUNTS_FETCHING: '⏳ Збираю дані акаунта... (може зайняти до 30 секунд)',
  ACCOUNTS_FETCHING_MULTIPLE: (count: number) => `⏳ Збираю дані ${count} акаунтів... (може зайняти час)`,
  ACCOUNTS_PROGRESS: (index: number, total: number, name: string) => `🔎 [${index}/${total}] ${name}`,
  ACCOUNTS_DONE: '✅ Готово.',
  ACCOUNTS_DONE_MULTIPLE: (success: number, total: number) => `✅ Готово. Успішно оброблено: ${success} з ${total}.`,
  ACCOUNTS_SKIPPED: (count: number) => `⚠️ Не вдалося розпізнати: ${count}`,
  ACCOUNTS_LIMIT: (limit: number) => `⚠️ Забагато акаунтів. Оброблено перші ${limit}.`,

  // Platforms
  PLATFORM_TIKTOK: 'TikTok',
  PLATFORM_SHORTS: 'YouTube Shorts',
  PLATFORM_REELS: 'Instagram Reels',

  // Pipeline messages
  PIPELINE_SENDING_VIDEO: 'Готово! Надсилаю відео...',
  PIPELINE_VIDEO_TOO_LARGE: (sizeMB: string) => `❌ Відео занадто велике для Telegram (${sizeMB}MB, ліміт 50MB)`,
  PIPELINE_VIDEO_NO_PROCESSING: 'Відео завантажено без обробки',
  PIPELINE_DONE: '✅ Обробку завершено! Напишіть /start, щоб створити нове відео.',
  PIPELINE_VIDEO_SEND_ERROR: (error: string) => `❌ Помилка надсилання відео: ${error}`,
  PIPELINE_EXTRACTING_AUDIO: 'Витягую аудіо...',
  PIPELINE_AUDIO_TOO_LARGE: (sizeMB: string) => `❌ Аудіо занадто велике для надсилання (${sizeMB}MB)`,
  PIPELINE_AUDIO_EXTRACTED: 'Аудіо витягнуто в MP3',
  PIPELINE_AUDIO_SEND_ERROR: (error: string) => `❌ Помилка надсилання аудіо: ${error}`,
  PIPELINE_SEGMENT_NO_TIME: '❌ Помилка: не вказано часовий інтервал для витягу аудіо.',
  PIPELINE_SOURCE_NOT_FOUND: '❌ Помилка: вихідний файл не знайдено. Можливо, відео не було завантажено. Спробуйте надіслати відео знову.',
  PIPELINE_FILE_NOT_FOUND: '❌ Помилка: файл відео не знайдено. Можливо, його було видалено. Спробуйте надіслати відео знову.',
  PIPELINE_EXTRACTING_SEGMENT: (start: string, end: string) => `🎵 Витягую аудіо з інтервалу ${start} - ${end}...`,
  PIPELINE_SEGMENT_TOO_LARGE: (sizeMB: string) => `❌ Аудіо занадто велике (${sizeMB}MB)`,
  PIPELINE_SEGMENT_EXTRACTED: (start: string, end: string) => `Аудіо витягнуто з інтервалу ${start}-${end}`,
  PIPELINE_SEGMENT_ERROR: (error: string) => `❌ Помилка витягу аудіо: ${error}`,
  PIPELINE_ANALYZING: (backend: string) => `🎬 Аналізую відео для пошуку найкращих моментів (${backend}). Це займе трохи часу...`,
  PIPELINE_SENDING_CLIPS: 'Готово! Надсилаю кліпи...',
  PIPELINE_CLIP_TOO_LARGE: (sizeMB: string, caption: string) => `⚠️ Кліп занадто великий для Telegram (${sizeMB}MB, ліміт 50MB): ${caption}`,
  PIPELINE_CLIP_SEND_ERROR: (error: string) => `❌ Помилка надсилання кліпу: ${error}`,
  PIPELINE_NO_CLIPS_SENT: '❌ Не вдалося надіслати жодного кліпу. Перевірте логи для деталей.',
  PIPELINE_PARTIAL_SUCCESS: (sent: number, total: number) => `✅ Надіслано ${sent} з ${total} кліпів. Напишіть /start, щоб створити нове відео.`,
  PIPELINE_TASK_ERROR: (error: string) => `Помилка при обробці завдання: ${error}`,

  // Account report labels
  REPORT_VIDEO: 'Відео',
  REPORT_UPLOADED: 'Завантажено о',
  REPORT_PLATFORM: 'Платформа',
  REPORT_SHADOWBAN: 'Тіньовий бан',
  REPORT_SHADOWBAN_YES: '🚫 Так',
  REPORT_SHADOWBAN_NO: '✅ Ні',
  REPORT_TOTAL_STATS: 'Інформація про акаунт',
  REPORT_FOLLOWERS: 'підписників',
  REPORT_VIDEOS: 'відео',
  REPORT_NA: 'Н/Д',
  REPORT_TOTAL_LIKES: 'всього лайків',
  REPORT_SAMPLE_STATS: 'Останні відео',
};

export default uk;