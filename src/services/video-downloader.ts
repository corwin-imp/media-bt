import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { settings } from '../config/settings.js';

const YT_RE = /youtu\.be\/|youtube\.com\//;
const TT_RE = /tiktok\.com\//;

// Note: This is a simplified implementation. In production, you'd want to use
// a proper yt-dlp wrapper or implement more robust video downloading

async function downloadWithYTDLP(url: string, outDir: string, quality?: number): Promise<string> {
  await fs.mkdir(outDir, { recursive: true });
  
  const outputPath = path.join(outDir, `${uuidv4().hex}.mp4`);
  
  return new Promise((resolve, reject) => {
    const args = [
      '-f', quality ? `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]/best` : 'bestvideo+bestaudio/best',
      '-o', outputPath,
      url,
      '--no-playlist',
      '--retries', '3',
      '--fragment-retries', '3',
      '--quiet',
      '--no-warnings',
      '--merge-output-format', 'mp4'
    ];

    const ytdlp = spawn('yt-dlp', args);
    let stderr = '';
    let stdout = '';

    ytdlp.stdout.on('data', (data: Buffer) => {
      stdout += data;
    });

    ytdlp.stderr.on('data', (data: Buffer) => {
      stderr += data;
    });

    ytdlp.on('close', (code: number) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp failed: ${stderr}`));
        return;
      }
      resolve(outputPath);
    });

    ytdlp.on('error', (err: Error) => {
      reject(new Error(`yt-dlp not found: ${err.message}`));
    });
  });
}

async function downloadHTTPMP4(url: string, outDir: string): Promise<string> {
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${uuidv4().hex}.mp4`);
  
  const response = await axios({
    method: 'GET',
    url,
    responseType: 'stream',
    timeout: 120000,
    maxRedirects: 5
  });

  const writer = fs.createWriteStream(outPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(outPath));
    writer.on('error', reject);
  });
}

export async function resolveSource(url: string): Promise<string> {
  if (url.endsWith('.mp4')) {
    return downloadHTTPMP4(url, settings.TMP_DIR);
  }

  if (YT_RE.test(url) || TT_RE.test(url)) {
    return downloadWithYTDLP(url, settings.TMP_DIR);
  }

  try {
    return downloadWithYTDLP(url, settings.TMP_DIR);
  } catch {
    throw new Error('Unsupported URL. Please send YouTube/TikTok/MP4.');
  }
}

export async function resolveSourceWithQuality(url: string, quality: number): Promise<string> {
  if (url.endsWith('.mp4')) {
    return downloadHTTPMP4(url, settings.TMP_DIR);
  }

  if (YT_RE.test(url) || TT_RE.test(url)) {
    return downloadWithYTDLP(url, settings.TMP_DIR, quality);
  }

  try {
    return downloadWithYTDLP(url, settings.TMP_DIR, quality);
  } catch {
    throw new Error('Unsupported URL. Please send YouTube/TikTok/MP4.');
  }
}

async function extractAudioFromVideo(videoPath: string, outDir: string): Promise<string> {
  await fs.mkdir(outDir, { recursive: true });
  const baseName = path.basename(videoPath, path.extname(videoPath));
  const mp3Path = path.join(outDir, `${baseName}.mp3`);
  
  return new Promise((resolve, reject) => {
    const args = [
      '-i', videoPath,
      '-vn',
      '-acodec', 'libmp3lame',
      '-ab', '192k',
      '-y',
      mp3Path
    ];

    const ffmpeg = spawn(settings.FFMPEG_BIN, args);
    let stderr = '';

    ffmpeg.stderr.on('data', (data: Buffer) => {
      stderr += data;
    });

    ffmpeg.on('close', (code: number) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg error: ${stderr}`));
        return;
      }
      resolve(mp3Path);
    });

    ffmpeg.on('error', (err: Error) => {
      reject(new Error(`ffmpeg not found: ${err.message}`));
    });
  });
}

export async function resolveAudioOnly(url: string | null, videoPath: string | null): Promise<string> {
  if (url) {
    if (YT_RE.test(url) || TT_RE.test(url)) {
      return downloadWithYTDLP(url, settings.TMP_DIR);
    }
    
    if (url.endsWith('.mp4')) {
      const videoFile = await downloadHTTPMP4(url, settings.TMP_DIR);
      return extractAudioFromVideo(videoFile, settings.TMP_DIR);
    }

    try {
      return downloadWithYTDLP(url, settings.TMP_DIR);
    } catch {
      throw new Error('Unsupported URL for audio. Please send YouTube/TikTok/MP4.');
    }
  } else if (videoPath) {
    return extractAudioFromVideo(videoPath, settings.TMP_DIR);
  } else {
    throw new Error('No source specified for audio.');
  }
}