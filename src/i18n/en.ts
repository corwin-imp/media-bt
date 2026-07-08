import type { Translations } from './types.js';

export const en: Translations = {
  // Start
  START_BUTTON: '🏠 Home',

  // Language
  LANG_BUTTON: '🌐 Language',
  LANG_TITLE: '🌐 *Select language*',
  LANG_SELECTED: (langName: string) => `✅ Language changed to: ${langName}.`,
  LANG_RUSSIAN: '🇷🇺 Русский',
  LANG_ENGLISH: '🇬🇧 English',

  // Commands / Start
  START: (
    'Hi! I will help you cut clips from long videos for TikTok (15–25 sec), '
    + 'generate an English script, voiceover, subtitles and (optionally) publish.\n\n'
    + 'Send a video link (YouTube/TikTok/file) or upload a file here.\n'
    + 'Commands: /help, /cancel'
  ),
  HELP: (
    'How it works:\n'
    + '1) Send a link or upload a video (up to {max_mb} MB).\n'
    + '2) Choose options via the menu buttons.\n'
    + '3) I will assemble clips with voiceover (English), subtitles and send them back.\n\n'
    + 'Tips: the first 2–3 seconds are the hook! Do not overuse auto-posting (TikTok policies).'
  ),
  CANCELLED: 'Okay, cancelled. If anything — /start',

  // Source
  ASK_SOURCE: 'Send a link (YouTube/TikTok) or upload a video file.',
  SOURCE_RECEIVED: 'Source received.',
  INVALID_URL: 'Please send a valid link or a video file.',
  VIDEO_RECEIVED_DOWNLOADING: '📁 Video received. Downloading...',

  // Quality
  ASK_QUALITY: (
    'Choose the video quality to download:\n'
    + '1080 - Full HD (best quality, larger size)\n'
    + '720 - HD\n'
    + '480 - SD\n'
    + '360 - Low quality (smaller size)\n\n'
    + 'Type: 1080, 720, 480 or 360'
  ),
  INVALID_QUALITY: 'Please choose a quality: 1080, 720, 480 or 360.',
  QUALITY_SELECTED: 'Quality {quality}p selected. Downloading video...',

  // Trim
  ASK_CLIP_COUNT: 'How many clips to make? (e.g. 3, from 1 to 10)',
  ASK_CUSTOM_SEGMENT: (
    'Specify the start and end of the segment in MM:SS format separated by a space.\n'
    + 'Examples:\n'
    + '- 0:40 1:00 (from 40 seconds to 1 minute)\n'
    + '- 1:20 1:40 (from 1 minute 20 seconds to 1 minute 40 seconds)'
  ),
  INVALID_SEGMENT_FORMAT: (
    'Invalid format. Provide two times in MM:SS format separated by a space.\n'
    + 'Example: 0:40 1:00'
  ),
  INVALID_SEGMENT_RANGE: 'Start must be less than end. Try again.',
  SEGMENT_TOO_SHORT: 'Minimum duration is 5 seconds.',
  SEGMENT_TOO_LONG: 'Maximum duration is 60 seconds.',
  INVALID_CLIP_COUNT: 'Enter the number of clips from 1 to 10.',

  // Main menu
  MAIN_MENU_TITLE: '🎬 *Video processing settings*\n\nChoose options:',
  UPLOAD_BUTTON: '🚀 Upload',

  // Button texts (dynamic)
  TRIM_BUTTON: '✂️ Trim',
  TRIM_TOP_MOMENTS_BTN: (count: number) => `✂️ Trim: Top moments (${count} clips) ✓`,
  TRIM_CUSTOM_SEGMENT_BTN: (start: string, end: string) => `✂️ Trim: Interval ${start}-${end} ✓`,
  AUDIO_ONLY_ENABLED: '🎵 Audio only (MP3) ✓',
  AUDIO_ONLY_DISABLED: '🎵 Audio only (MP3)',
  MUSIC_REPLACED: '🎵 Audio: Replaced ✓',
  MUSIC_CHANGE: '🎵 Change audio',
  AUDIO_MENU_HEADPHONES: '🎧 Audio ✓',
  AUDIO_MENU_MUSIC: '🎵 Audio ✓',
  AUDIO_MENU_DEFAULT: '🎵 Audio',
  SPEED_BUTTON: (speed: number) => `⚡️ Speed: ${speed}x`,
  AUTO_MODE_SELECTED_PLATFORM: (label: string) => `🎯 Auto mode: ${label} ✓`,
  AUTO_MODE_DEFAULT: '🎯 Auto mode',

  // Trim menu
  TRIM_MENU_TITLE: '✂️ *Choose trim type:*',
  TRIM_TOP_MOMENTS: '🎯 Top moments',
  TRIM_TOP_MOMENTS_CHECKED: '🎯 Top moments ✓',
  TRIM_CUSTOM_SEGMENT: '✂️ Custom segment',
  TRIM_CUSTOM_SEGMENT_CHECKED: '✂️ Custom segment ✓',

  // Audio menu
  AUDIO_MENU_TITLE: '🎵 *Audio settings:*',

  // Tags
  TAGS_BUTTON: '🏷️ Tags',
  TAGS_MENU_TITLE: '🏷️ *Want to peek at trends for hashtags?*',
  TAGS_YES: '✅ Yes, show trends',
  TAGS_NO: '❌ No, skip',
  TAGS_TOP_TRENDS: (formatted: string) => `🏷️ *Top trends:*\n${formatted}`,

  // Auto mode
  AUTO_MODE_TITLE: '🎯 *Auto mode*\n\nChoose a platform — I will automatically configure trim, duration and number of clips for the format:',
  AUTO_MODE_OFF: '❌ Turn off auto mode',
  AUTO_MODE_SELECTED: (platformLabel: string) => `✅ Auto mode enabled: ${platformLabel}.`,
  AUTO_MODE_CLEARED: 'Auto mode disabled. Settings reset to manual.',

  // Music
  ASK_MUSIC: 'Want to replace the audio with a song? Send an mp3 file or type "no" to skip.',
  MUSIC_RECEIVED: 'Music received.',
  NO_MUSIC: 'No audio replacement.',
  MUSIC_PROMPT_OR_SKIP: 'Please send an MP3 file or write "no" to skip.',
  ASK_AUDIO_SEGMENT: (
    'Specify the start and end of the audio segment in MM:SS format separated by a space.\n'
    + 'Examples:\n'
    + '- 0:20 1:30 (from 20 seconds to 1 minute 30 seconds)\n'
    + '- Write \'all\' to use the entire audio'
  ),
  AUDIO_SEGMENT_SELECTED: 'Audio segment selected: from {start} to {end}.',
  AUDIO_SEGMENT_ALL: 'Will use the entire audio.',

  // Speed
  ASK_PLAYBACK_SPEED: (
    '⚡️ *Playback speed*\n\n'
    + 'Current speed: {current}\n\n'
    + 'Enter a new value from 0.5 to 3.\n'
    + '• 1 — normal speed\n'
    + '• less than 1 — slowdown (e.g. 0.5)\n'
    + '• greater than 1 — speedup (e.g. 1.5, 2, max 3)\n\n'
    + 'Decimal separator can be a dot or a comma.'
  ),
  INVALID_PLAYBACK_SPEED: 'Invalid value. Enter a number from 0.5 to 3 (e.g. 0.5, 1, 1.5, 2, 3).',
  PLAYBACK_SPEED_SELECTED: (speedLabel: string) => `Playback speed set to: ${speedLabel}.`,
  PLAYBACK_SPEED_RESET: 'Playback speed reset to normal (1x).',

  // Processing
  PROCESSING_START: 'Starting processing. This may take a while. I will send progress and the result.',
  TRIM_REQUIRED: '⚠️ Please choose a trim mode or enable "Audio only (MP3)".',
  SOURCE_INVALID: '❌ Error: the video was not uploaded. Please first send a video or link, choose the quality, and then configure the options.',

  // Common
  BACK_BUTTON: '◀️ Back',
  ERROR_GENERIC: 'Oops, something went wrong. Try again later.',
  RATE_LIMIT: 'Too often. Try a little later.',
  INVALID_INPUT: 'Invalid input. Please try again.',
  TOO_LARGE: 'File is too large. Maximum {max_mb} MB.',
  DONE: 'Done! Sending clips and captions.',
  CALLBACK_ERROR: 'An error occurred',
  ALREADY_PROCESSING: '⏳ Already processing another video. Please wait.',

  // Accounts
  ACCOUNTS_BUTTON: '📊 Accounts',
  ACCOUNTS_PROMPT: (
    '📊 *View accounts*\n\n'
    + 'Send a link or @username of a TikTok, Instagram or YouTube account.\n'
    + 'Examples:\n'
    + '• @coinbase\n'
    + '• https://www.tiktok.com/@coinbase\n'
    + '• https://www.instagram.com/coinbase/\n'
    + '• https://www.youtube.com/@MrBeast\n\n'
    + 'The bot will show the 5 latest videos and overall statistics.'
  ),
  ACCOUNTS_INVALID: 'Could not recognize the account. Send a link or @username (TikTok/Instagram/YouTube).',
  ACCOUNTS_FETCHING: '⏳ Collecting account data... (may take up to 30 seconds)',
  ACCOUNTS_DONE: '✅ Done.',

  // Platforms
  PLATFORM_TIKTOK: 'TikTok',
  PLATFORM_SHORTS: 'YouTube Shorts',
  PLATFORM_REELS: 'Instagram Reels',

  // Pipeline messages
  PIPELINE_SENDING_VIDEO: 'Done! Sending video...',
  PIPELINE_VIDEO_TOO_LARGE: (sizeMB: string) => `❌ Video is too large for Telegram (${sizeMB}MB, limit 50MB)`,
  PIPELINE_VIDEO_NO_PROCESSING: 'Video downloaded without processing',
  PIPELINE_DONE: '✅ Processing complete! Type /start to create a new video.',
  PIPELINE_VIDEO_SEND_ERROR: (error: string) => `❌ Error sending video: ${error}`,
  PIPELINE_EXTRACTING_AUDIO: 'Extracting audio...',
  PIPELINE_AUDIO_TOO_LARGE: (sizeMB: string) => `❌ Audio is too large to send (${sizeMB}MB)`,
  PIPELINE_AUDIO_EXTRACTED: 'Audio extracted to MP3',
  PIPELINE_AUDIO_SEND_ERROR: (error: string) => `❌ Error sending audio: ${error}`,
  PIPELINE_SEGMENT_NO_TIME: '❌ Error: no time interval specified for audio extraction.',
  PIPELINE_SOURCE_NOT_FOUND: '❌ Error: source file not found. The video may not have been uploaded. Try sending the video again.',
  PIPELINE_FILE_NOT_FOUND: '❌ Error: video file not found. It may have been deleted. Try sending the video again.',
  PIPELINE_EXTRACTING_SEGMENT: (start: string, end: string) => `🎵 Extracting audio from interval ${start} - ${end}...`,
  PIPELINE_SEGMENT_TOO_LARGE: (sizeMB: string) => `❌ Audio is too large (${sizeMB}MB)`,
  PIPELINE_SEGMENT_EXTRACTED: (start: string, end: string) => `Audio extracted from interval ${start}-${end}`,
  PIPELINE_SEGMENT_ERROR: (error: string) => `❌ Error extracting audio: ${error}`,
  PIPELINE_ANALYZING: (backend: string) => `🎬 Analyzing the video to find the best moments (${backend}). This will take a moment...`,
  PIPELINE_SENDING_CLIPS: 'Done! Sending clips...',
  PIPELINE_CLIP_TOO_LARGE: (sizeMB: string, caption: string) => `⚠️ Clip is too large for Telegram (${sizeMB}MB, limit 50MB): ${caption}`,
  PIPELINE_CLIP_SEND_ERROR: (error: string) => `❌ Error sending clip: ${error}`,
  PIPELINE_NO_CLIPS_SENT: '❌ Failed to send any clip. Check the logs for details.',
  PIPELINE_PARTIAL_SUCCESS: (sent: number, total: number) => `✅ Sent ${sent} of ${total} clips. Type /start to create a new video.`,
  PIPELINE_TASK_ERROR: (error: string) => `Error processing task: ${error}`,

  // Account report labels
  REPORT_VIDEO: 'Video',
  REPORT_UPLOADED: 'Uploaded at',
  REPORT_PLATFORM: 'Platform',
  REPORT_SHADOWBAN: 'Shadowban',
  REPORT_TOTAL_STATS: 'Overall account statistics',
  REPORT_FOLLOWERS: 'followers',
  REPORT_VIDEOS: 'videos',
  REPORT_NA: 'N/A',

  // Publishing (cross-posting to TikTok/Instagram/YouTube)
  PUBLISH_BUTTON: '📤 Publish',
  PUBLISH_MENU_TITLE: '📤 *Publish to social media*\n\nChoose a platform to post the finished clip to:',
  PUBLISH_NO_ACCOUNTS: (platformLabel: string) => `No saved accounts for ${platformLabel}. Add one first via "My accounts".`,
  PUBLISH_SELECT_ACCOUNT: (platformLabel: string) => `Select an account to publish to ${platformLabel}:`,
  PUBLISH_SELECT_PLATFORM: 'Choose a platform:',
  PUBLISH_MENU_ADD_CRED: '➕ Add account',
  PUBLISH_MENU_MY_ACCOUNTS: '📋 My accounts',
  PUBLISH_ADD_TITLE: (platformLabel: string) => `➕ *Add ${platformLabel} account*\n\nYou will need API credentials.`,
  PUBLISH_ADD_PROMPT: (fields: string) => `Send the values as JSON or key:value on separate lines.\nRequired fields:\n${fields}`,
  PUBLISH_ADD_SUCCESS: (label: string) => `✅ Account "${label}" saved.`,
  PUBLISH_ADD_INVALID: 'Invalid format. Send the fields as JSON or key:value on separate lines.',
  PUBLISH_ASK_LABEL: 'What name to show for this account? (e.g. "Main TikTok")',
  PUBLISH_CRED_DELETED: '🗑 Account deleted.',
  PUBLISH_NO_CREDS: 'You have no saved accounts yet.',
  PUBLISH_LIST_TITLE: '📋 *Your accounts*',
  PUBLISH_LABEL_LABEL: 'Name',
  PUBLISH_STARTED: '🚀 Starting publish...',
  PUBLISH_PROGRESS: (message: string) => `⏳ ${message}`,
  PUBLISH_SUCCESS: (message: string) => `✅ ${message}`,
  PUBLISH_FAILED: (message: string) => `❌ Publish failed: ${message}`,
  PUBLISH_DONE: 'Publish flow finished.',
  PUBLISH_AFTER_CLIP_PROMPT: 'Want to publish this clip to a social platform?',
  PUBLISH_CLIP_PROMPT: (platformLabel: string) => `📤 Publish this clip to ${platformLabel}?`,
};

export default en;