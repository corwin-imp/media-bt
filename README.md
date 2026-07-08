# Node Shorts - Telegram Video Clip Bot

Node.js version of the TikTok video clip generation bot. This bot processes long videos, creates short clips (15-25 seconds), and can generate AI voiceovers and subtitles.

## Features

- Download videos from YouTube, TikTok, or direct MP4 URLs
- Multiple processing modes:
  - **Top moments**: Content-aware highlight detection (see [Smart Moment Detection](#smart-moment-detection-opencv))
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
│   │   ├── clipper.ts           # Segment detection (OpenCV + fallback)
│   │   ├── moment-detector.ts   # opencv4nodejs highlight analysis
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

## Smart Moment Detection (OpenCV)

The **Top moments** mode uses content-aware analysis via [`opencv4nodejs`](https://github.com/justadudewhohacks/opencv4nodejs) to find genuinely interesting segments instead of just slicing the timeline evenly.

### How it scores frames

For every sampled frame (default 2 fps, resized to 160px wide for speed), it computes:

| Signal | Weight | Why |
|--------|--------|-----|
| **Motion** (mean absdiff vs previous frame) | 0.55 | Action, movement, highlights |
| **Brightness** (mean luminance, gaussian peak @128) | 0.25 | Avoid dark/overexposed shots |
| **Saturation** (HSV S-channel mean) | 0.20 | Vivid frames are more engaging |

These per-frame scores are aggregated into sliding windows of ~20s. The top-N non-overlapping windows are selected greedily.

### Smooth start & end

To avoid cutting mid-action, boundaries are **snapped to the nearest detected scene cut** within ±3 seconds (scene cuts = strong local motion maxima, `mean + 2.5·σ`). Durations are then clamped to the 15–25s range.

### Backend selection (automatic)

The default and recommended backend is:

1. **ffmpeg `signalstats`** — zero native dependencies; uses ffmpeg's built-in video analysis filter to compute motion (via `YDIF`), brightness (via `YAVG`), and saturation (via `SATAVG`). This is the out-of-the-box backend and the only one most users need.

Optionally, a native backend can be used (faster for very long videos, equivalent results):

2. **`opencv4nodejs`** / **`@u4/opencv4nodejs`** — native OpenCV bindings. **Both require a system OpenCV install and `cmake` to compile the native module** (neither ships truly prebuilt binaries despite some docs suggesting otherwise).

Smart detection **always works** out of the box because backend #1 only requires ffmpeg (already a project prerequisite).

### Installation (optional native OpenCV backend)

> ⚠️ The native OpenCV backend is purely optional and requires a C++ build toolchain (`cmake`, a compiler, and system OpenCV libraries). You can skip this entirely — the ffmpeg `signalstats` backend is used by default and produces equivalent results.

If you do want the native backend, install OpenCV 4.x and `cmake` first, then:

```bash
npm install opencv4nodejs
```

*Windows:* install OpenCV 4.x and set `OPENCV_DIR` (e.g. `set OPENCV_DIR=C:\opencv\build\x64\vc16`).
*macOS:* `brew install opencv@4 cmake`
*Linux:* `sudo apt install libopencv-dev python3-opencv cmake`

If the native module fails to load, the detector automatically falls back to the **ffmpeg `signalstats` backend** (no extra installation) — smart detection still works.

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