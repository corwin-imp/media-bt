# Node Shorts - Telegram Video Clip Bot

Node.js version of the TikTok video clip generation bot. This bot processes long videos, creates short clips (15-25 seconds), and can generate AI voiceovers and subtitles.

## Features

- Download videos from YouTube, TikTok, or direct MP4 URLs
- Multiple processing modes:
  - **Top moments**: Automatically finds interesting segments
  - **Custom segment**: Manually specify start/end times
  - **Entire material**: Process the whole video
  - **Download only**: Download without processing
  - **Audio only**: Extract audio as MP3
- Quality selection (1080p, 720p, 480p, 360p)
- AI-powered script generation (OpenAI)
- Text-to-speech (ElevenLabs)
- Automatic subtitles generation
- Custom music overlay with segment selection
- Trending hashtag suggestions

## Prerequisites

- Node.js 18+ and npm
- FFmpeg installed and in PATH
- yt-dlp installed and in PATH (for YouTube/TikTok downloads)

### Installing FFmpeg

**Windows:**
```bash
# Using Chocolatey
choco install ffmpeg

# Or download from https://ffmpeg.org/download.html
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install ffmpeg
```

### Installing yt-dlp

```bash
pip install yt-dlp
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd node-shorts
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment file and configure:
```bash
cp .env.example .env
```

4. Edit `.env` and add your API keys:
```env
# Required
TOKEN=your_telegram_bot_token_here

# Optional but recommended
OPENAI_API_KEY=your_openai_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_voice_id

# Optional
EXOLYT_API_KEY=your_exolyt_api_key
TIKTOK_ACCESS_TOKEN=your_tiktok_access_token
```

## Getting a Telegram Bot Token

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow the instructions
3. Copy the bot token and paste it in your `.env` file

## Usage

### Development Mode

```bash
npm run dev
```

This runs the bot with hot-reloading using tsx.

### Production Mode

```bash
npm run build
npm start
```

### Watch Mode

```bash
npm run watch
```

This builds and watches for changes.

## Project Structure

```
node-shorts/
├── src/
│   ├── config/           # Configuration settings
│   ├── handlers/         # Telegram bot handlers
│   ├── services/         # Business logic services
│   │   ├── clipper.ts           # Video segment detection
│   │   ├── renderer-ffmpeg.ts   # FFmpeg video rendering
│   │   ├── openai-llm.ts        # OpenAI script generation
│   │   ├── elevenlabs-tts.ts    # ElevenLabs TTS
│   │   ├── video-downloader.ts  # Video downloading
│   │   ├── trends.ts            # Trending hashtags
│   │   ├── tiktok-poster.ts     # TikTok posting (stub)
│   │   └── pipeline.ts          # Main processing pipeline
│   ├── storage/          # Data storage layer
│   ├── utils/            # Utility functions
│   ├── i18n/             # Internationalization
│   └── index.ts          # Main entry point
├── data/                 # Data directory (gitignored)
├── .env                  # Environment variables (gitignored)
├── package.json
├── tsconfig.json
└── README.md
```

## Environment Variables

See `.env.example` for all available configuration options:

| Variable | Description | Required |
|----------|-------------|----------|
| `TOKEN` | Telegram bot token | Yes |
| `DEBUG` | Enable debug logging | No |
| `MAX_SOURCE_MB` | Maximum source file size | No |
| `MAX_RESULT_MB` | Maximum result file size | No |
| `OPENAI_API_KEY` | OpenAI API key for scripts | No |
| `ELEVENLABS_API_KEY` | ElevenLabs API key for TTS | No |
| `ELEVENLABS_VOICE_ID` | ElevenLabs voice ID | No |
| `EXOLYT_API_KEY` | Exolyt API key for trends | No |
| `TIKTOK_ACCESS_TOKEN` | TikTok access token for posting | No |

## How It Works

1. User sends `/start` command to bot
2. User provides video URL or uploads video file
3. Bot downloads/processes the video
4. User selects processing mode and options
5. Bot processes the video:
   - Segments video into clips
   - Generates AI script (if OpenAI configured)
   - Creates voiceover (if ElevenLabs configured)
   - Generates subtitles
   - Applies music overlay (optional)
6. Bot sends completed clips back to user

## Troubleshooting

### Bot doesn't respond
- Check that your `.env` file is properly configured
- Ensure the bot token is correct
- Check the bot logs for errors

### FFmpeg not found
- Make sure FFmpeg is installed and in your PATH
- Test with `ffmpeg -version` in terminal

### yt-dlp not found
- Make sure yt-dlp is installed
- Test with `yt-dlp --version` in terminal

### Memory issues with large videos
- Reduce `MAX_SOURCE_MB` in `.env`
- Process videos in smaller segments

## License

MIT

## Credits

Original Python version adapted to Node.js/TypeScript.