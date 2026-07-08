import dotenv from 'dotenv';

dotenv.config();

export interface Settings {
  TELEGRAM_TOKEN: string;
  DEBUG: boolean;
  
  // Limits
  MAX_SOURCE_MB: number;
  MAX_RESULT_MB: number;
  PER_USER_RPM: number;
  
  // OpenAI
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  
  // ElevenLabs
  ELEVENLABS_API_KEY: string;
  ELEVENLABS_VOICE_ID: string;
  
  // Exolyt API (optional)
  EXOLYT_API_KEY: string;
  
  // Shotstack (optional)
  SHOTSTACK_API_KEY: string;
  SHOTSTACK_STAGE: string;
  
  // TikTok API (optional)
  TIKTOK_ACCESS_TOKEN: string;
  TIKTOK_ADVERTISER_ID: string;
  
  // Paths
  DATA_DIR: string;
  DB_PATH: string;
  TMP_DIR: string;
  
  // FFmpeg
  FFMPEG_BIN: string;
  FFMPEG_THREADS: number;
}

export const settings: Readonly<Settings> = {
  TELEGRAM_TOKEN: process.env.TOKEN || '',
  DEBUG: process.env.DEBUG?.toLowerCase() === 'true',
  
  // Limits
  MAX_SOURCE_MB: parseInt(process.env.MAX_SOURCE_MB || '800', 10),
  MAX_RESULT_MB: parseInt(process.env.MAX_RESULT_MB || '1900', 10),
  PER_USER_RPM: parseInt(process.env.PER_USER_RPM || '8', 10),
  
  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  
  // ElevenLabs
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
  ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID || '',
  
  // Exolyt API (optional)
  EXOLYT_API_KEY: process.env.EXOLYT_API_KEY || '',
  
  // Shotstack (optional)
  SHOTSTACK_API_KEY: process.env.SHOTSTACK_API_KEY || '',
  SHOTSTACK_STAGE: process.env.SHOTSTACK_STAGE || 'stage',
  
  // TikTok API (optional)
  TIKTOK_ACCESS_TOKEN: process.env.TIKTOK_ACCESS_TOKEN || '',
  TIKTOK_ADVERTISER_ID: process.env.TIKTOK_ADVERTISER_ID || '',
  
  // Paths
  DATA_DIR: process.env.DATA_DIR || 'data',
  DB_PATH: process.env.DB_PATH || 'data/bot.sqlite',
  TMP_DIR: process.env.TMP_DIR || 'data/tmp',
  
  // FFmpeg
  FFMPEG_BIN: process.env.FFMPEG_BIN || 'ffmpeg',
  FFMPEG_THREADS: parseInt(process.env.FFMPEG_THREADS || '2', 10),
};