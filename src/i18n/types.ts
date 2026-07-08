export interface Translations {
  // Start
  START_BUTTON: string;

  // Language
  LANG_BUTTON: string;
  LANG_TITLE: string;
  LANG_SELECTED: (langName: string) => string;
  LANG_RUSSIAN: string;
  LANG_ENGLISH: string;

  // Commands / Start
  START: string;
  HELP: string;
  CANCELLED: string;

  // Source
  ASK_SOURCE: string;
  SOURCE_RECEIVED: string;
  INVALID_URL: string;
  VIDEO_RECEIVED_DOWNLOADING: string;

  // Quality
  ASK_QUALITY: string;
  INVALID_QUALITY: string;
  QUALITY_SELECTED: string;

  // Trim
  ASK_CLIP_COUNT: string;
  ASK_CUSTOM_SEGMENT: string;
  INVALID_SEGMENT_FORMAT: string;
  INVALID_SEGMENT_RANGE: string;
  SEGMENT_TOO_SHORT: string;
  SEGMENT_TOO_LONG: string;
  INVALID_CLIP_COUNT: string;

  // Main menu
  MAIN_MENU_TITLE: string;
  UPLOAD_BUTTON: string;

  // Button texts (dynamic)
  TRIM_BUTTON: string;
  TRIM_TOP_MOMENTS_BTN: (count: number) => string;
  TRIM_CUSTOM_SEGMENT_BTN: (start: string, end: string) => string;
  AUDIO_ONLY_ENABLED: string;
  AUDIO_ONLY_DISABLED: string;
  MUSIC_REPLACED: string;
  MUSIC_CHANGE: string;
  AUDIO_MENU_HEADPHONES: string;
  AUDIO_MENU_MUSIC: string;
  AUDIO_MENU_DEFAULT: string;
  SPEED_BUTTON: (speed: number) => string;
  AUTO_MODE_SELECTED_PLATFORM: (label: string) => string;
  AUTO_MODE_DEFAULT: string;

  // Trim menu
  TRIM_MENU_TITLE: string;
  TRIM_TOP_MOMENTS: string;
  TRIM_TOP_MOMENTS_CHECKED: string;
  TRIM_CUSTOM_SEGMENT: string;
  TRIM_CUSTOM_SEGMENT_CHECKED: string;

  // Audio menu
  AUDIO_MENU_TITLE: string;

  // Tags
  TAGS_BUTTON: string;
  TAGS_MENU_TITLE: string;
  TAGS_YES: string;
  TAGS_NO: string;
  TAGS_TOP_TRENDS: (formatted: string) => string;

  // Auto mode
  AUTO_MODE_TITLE: string;
  AUTO_MODE_OFF: string;
  AUTO_MODE_SELECTED: (platformLabel: string) => string;
  AUTO_MODE_CLEARED: string;

  // Music
  ASK_MUSIC: string;
  MUSIC_RECEIVED: string;
  NO_MUSIC: string;
  MUSIC_PROMPT_OR_SKIP: string;
  ASK_AUDIO_SEGMENT: string;
  AUDIO_SEGMENT_SELECTED: string;
  AUDIO_SEGMENT_ALL: string;

  // Speed
  ASK_PLAYBACK_SPEED: string;
  INVALID_PLAYBACK_SPEED: string;
  PLAYBACK_SPEED_SELECTED: (speedLabel: string) => string;
  PLAYBACK_SPEED_RESET: string;

  // Processing
  PROCESSING_START: string;
  TRIM_REQUIRED: string;
  SOURCE_INVALID: string;

  // Common
  BACK_BUTTON: string;
  ERROR_GENERIC: string;
  RATE_LIMIT: string;
  INVALID_INPUT: string;
  TOO_LARGE: string;
  DONE: string;
  CALLBACK_ERROR: string;
  ALREADY_PROCESSING: string;

  // Accounts
  ACCOUNTS_BUTTON: string;
  ACCOUNTS_PROMPT: string;
  ACCOUNTS_INVALID: string;
  ACCOUNTS_FETCHING: string;
  ACCOUNTS_DONE: string;

  // Platforms
  PLATFORM_TIKTOK: string;
  PLATFORM_SHORTS: string;
  PLATFORM_REELS: string;

  // Pipeline messages
  PIPELINE_SENDING_VIDEO: string;
  PIPELINE_VIDEO_TOO_LARGE: (sizeMB: string) => string;
  PIPELINE_VIDEO_NO_PROCESSING: string;
  PIPELINE_DONE: string;
  PIPELINE_VIDEO_SEND_ERROR: (error: string) => string;
  PIPELINE_EXTRACTING_AUDIO: string;
  PIPELINE_AUDIO_TOO_LARGE: (sizeMB: string) => string;
  PIPELINE_AUDIO_EXTRACTED: string;
  PIPELINE_AUDIO_SEND_ERROR: (error: string) => string;
  PIPELINE_SEGMENT_NO_TIME: string;
  PIPELINE_SOURCE_NOT_FOUND: string;
  PIPELINE_FILE_NOT_FOUND: string;
  PIPELINE_EXTRACTING_SEGMENT: (start: string, end: string) => string;
  PIPELINE_SEGMENT_TOO_LARGE: (sizeMB: string) => string;
  PIPELINE_SEGMENT_EXTRACTED: (start: string, end: string) => string;
  PIPELINE_SEGMENT_ERROR: (error: string) => string;
  PIPELINE_ANALYZING: (backend: string) => string;
  PIPELINE_SENDING_CLIPS: string;
  PIPELINE_CLIP_TOO_LARGE: (sizeMB: string, caption: string) => string;
  PIPELINE_CLIP_SEND_ERROR: (error: string) => string;
  PIPELINE_NO_CLIPS_SENT: string;
  PIPELINE_PARTIAL_SUCCESS: (sent: number, total: number) => string;
  PIPELINE_TASK_ERROR: (error: string) => string;

  // Account report labels
  REPORT_VIDEO: string;
  REPORT_UPLOADED: string;
  REPORT_PLATFORM: string;
  REPORT_SHADOWBAN: string;
  REPORT_TOTAL_STATS: string;
  REPORT_FOLLOWERS: string;
  REPORT_VIDEOS: string;
  REPORT_NA: string;

  // Publishing (cross-posting to TikTok/Instagram/YouTube)
  PUBLISH_BUTTON: string;
  PUBLISH_MENU_TITLE: string;
  PUBLISH_NO_ACCOUNTS: (platformLabel: string) => string;
  PUBLISH_SELECT_ACCOUNT: (platformLabel: string) => string;
  PUBLISH_SELECT_PLATFORM: string;
  PUBLISH_MENU_ADD_CRED: string;
  PUBLISH_MENU_MY_ACCOUNTS: string;
  PUBLISH_ADD_TITLE: (platformLabel: string) => string;
  PUBLISH_ADD_PROMPT: (fields: string) => string;
  PUBLISH_ADD_SUCCESS: (label: string) => string;
  PUBLISH_ADD_INVALID: string;
  PUBLISH_ASK_LABEL: string;
  PUBLISH_CRED_DELETED: string;
  PUBLISH_NO_CREDS: string;
  PUBLISH_LIST_TITLE: string;
  PUBLISH_LABEL_LABEL: string;
  PUBLISH_STARTED: string;
  PUBLISH_PROGRESS: (message: string) => string;
  PUBLISH_SUCCESS: (message: string) => string;
  PUBLISH_FAILED: (message: string) => string;
  PUBLISH_DONE: string;
  PUBLISH_AFTER_CLIP_PROMPT: string;
  PUBLISH_CLIP_PROMPT: (platformLabel: string) => string;
}
