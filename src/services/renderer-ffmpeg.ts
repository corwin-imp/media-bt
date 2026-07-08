import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface RenderClipParams {
  sourceVideo: string;
  startS: number;
  durationS: number;
  ttsAudio?: string | null;
  subtitlesSrt?: string | null;
  outDir: string;
  musicAudio?: string | null;
  audioStartTime?: number | null;
  audioEndTime?: number | null;
  quality?: number | null;
  playbackSpeed?: number | null;
}

export function probeAudioDuration(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      audioPath
    ]);

    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (data: Buffer) => {
      stdout += data;
    });

    ffprobe.stderr.on('data', (data: Buffer) => {
      stderr += data;
    });

    ffprobe.on('close', (code: number) => {
      if (code !== 0) {
        reject(new Error(`ffprobe error: ${stderr}`));
        return;
      }
      try {
        const duration = parseFloat(stdout.trim());
        resolve(duration);
      } catch (err) {
        reject(new Error(`Failed to parse audio duration: ${err}`));
      }
    });

    ffprobe.on('error', (err: Error) => {
      reject(new Error(`ffprobe not found: ${err.message}`));
    });
  });
}

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);
    let stderr = '';

    ffmpeg.stderr.on('data', (data: Buffer) => {
      stderr += data;
    });

    ffmpeg.on('close', (code: number) => {
      if (code !== 0) {
        reject(new Error(stderr || 'FFmpeg failed'));
        return;
      }
      resolve();
    });

    ffmpeg.on('error', (err: Error) => {
      reject(new Error(`ffmpeg not found: ${err.message}`));
    });
  });
}

function escapeSubtitlesPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:');
}

function getQualityParams(quality?: number | null): { crf: string; preset: string; targetWidth: number; targetHeight: number } {
  if (quality && quality >= 1080) {
    return {
      crf: '18',
      preset: 'slow',
      targetWidth: 1080,
      targetHeight: 1920
    };
  } else if (quality && quality >= 720) {
    return {
      crf: '20',
      preset: 'medium',
      targetWidth: 720,
      targetHeight: 1280
    };
  } else {
    return {
      crf: '23',
      preset: 'veryfast',
      targetWidth: 1080,
      targetHeight: 1920
    };
  }
}

/**
 * Returns true when a non-trivial playback speed (≠ 1) is requested.
 * Defensive: coerces strings (legacy TEXT schema) to numbers before testing.
 */
function hasPlaybackSpeed(speed?: number | null | string): boolean {
  if (speed === null || speed === undefined || speed === '') return false;
  const n = Number(speed);
  if (!Number.isFinite(n)) return false;
  return Math.abs(n - 1) > 0.001;
}

/**
 * Coerces playbackSpeed (possibly a string from a legacy TEXT column) to a
 * finite number, or null when unset/invalid.
 */
function toSpeedNumber(speed?: number | null | string): number | null {
  if (speed === null || speed === undefined || speed === '') return null;
  const n = Number(speed);
  return Number.isFinite(n) ? n : null;
}

/**
 * Builds an ffmpeg atempo chain filter for the given speed.
 * A single atempo filter only supports the [0.5, 2.0] range, so for
 * out-of-range speeds we chain multiple atempo filters.
 */
function getAtempoFilter(speed: number): string {
  const parts: string[] = [];
  let remaining = speed;
  while (remaining > 2.0) {
    parts.push('atempo=2.0');
    remaining /= 2.0;
  }
  while (remaining < 0.5) {
    parts.push('atempo=0.5');
    remaining /= 0.5;
  }
  parts.push(`atempo=${remaining.toFixed(4)}`);
  return parts.join(',');
}

/**
 * Video PTS filter that changes playback speed (2.0 => twice as fast).
 * Applied AFTER subtitles so baked-in subtitles are scaled together with
 * the video, keeping them in sync with the sped-up speech/audio.
 */
function getSetptsFilter(speed: number): string {
  return `setpts=PTS/${speed.toFixed(4)}`;
}

export function renderClipLocal(params: RenderClipParams): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      await fs.mkdir(params.outDir, { recursive: true });

      const outPath = path.join(params.outDir, `clip_${uuidv4().replace(/-/g, '')}.mp4`);
      const { crf, preset, targetWidth, targetHeight } = getQualityParams(params.quality);

      const speedActive = hasPlaybackSpeed(params.playbackSpeed);
      const speed = speedActive ? (toSpeedNumber(params.playbackSpeed) as number) : 1;
      // Duration of the resulting clip after applying playback speed.
      const outDuration = params.durationS / speed;

      // Build video filter
      const vfParts: string[] = [
        `scale=iw*min(${targetWidth}/iw\\,${targetHeight}/ih):ih*min(${targetWidth}/iw\\,${targetHeight}/ih)`,
        `pad=${targetWidth}:${targetHeight}:(${targetWidth}-iw*min(${targetWidth}/iw\\,${targetHeight}/ih))/2:(${targetHeight}-ih*min(${targetWidth}/iw\\,${targetHeight}/ih))/2:black`
      ];

      if (params.subtitlesSrt) {
        const subPath = escapeSubtitlesPath(params.subtitlesSrt);
        vfParts.push(`subtitles=filename='${subPath}'`);
      }

      // Playback speed is applied last so subtitles stay in sync.
      if (speedActive) {
        vfParts.push(getSetptsFilter(speed));
      }

      const vf = vfParts.join(',');

      // Determine which rendering strategy to use
      if (params.musicAudio) {
        // Probe music duration to validate the requested segment
        if (params.audioStartTime !== null && params.audioStartTime !== undefined && params.audioEndTime !== null && params.audioEndTime !== undefined) {
          try {
            const audioDuration = await probeAudioDuration(params.musicAudio);
            if (params.audioEndTime > audioDuration) {
              console.warn(`Audio segment end (${params.audioEndTime}s) exceeds audio duration (${audioDuration}s). Using full audio.`);
              params.audioStartTime = null;
              params.audioEndTime = null;
            }
          } catch (err) {
            console.warn(`Failed to probe audio duration, using as-is: ${err}`);
          }
        }

        // Build audio filter for music (with optional atrim, atempo, apad)
        let audioFilterCore: string;
        if (params.audioStartTime !== null && params.audioStartTime !== undefined && params.audioEndTime !== null && params.audioEndTime !== undefined) {
          audioFilterCore = `[1:a]atrim=${params.audioStartTime.toFixed(3)}:${params.audioEndTime.toFixed(3)},asetpts=PTS-STARTPTS`;
        } else {
          audioFilterCore = `[1:a]atrim=0:${params.durationS.toFixed(3)},asetpts=PTS-STARTPTS`;
        }
        if (speedActive) {
          audioFilterCore += `,${getAtempoFilter(speed)}`;
        }
        const audioFilter = `${audioFilterCore}[a];[a]apad=whole_dur=${outDuration.toFixed(3)}[a_sync]`;

        const args = buildMusicArgs(
          params.sourceVideo,
          params.musicAudio,
          params.startS,
          params.durationS,
          outPath,
          audioFilter,
          vf,
          params.subtitlesSrt,
          crf,
          preset,
          params.playbackSpeed
        );

        await runFFmpeg(args);
      } else if (params.ttsAudio) {
        const args = buildTTSArgs(
          params.sourceVideo,
          params.ttsAudio,
          params.startS,
          params.durationS,
          outPath,
          vf,
          params.subtitlesSrt,
          crf,
          preset,
          params.playbackSpeed
        );

        await runFFmpeg(args);
      } else {
        const args = buildNoTTSArgs(
          params.sourceVideo,
          params.startS,
          params.durationS,
          outPath,
          vf,
          params.subtitlesSrt,
          crf,
          preset,
          params.playbackSpeed
        );

        await runFFmpeg(args);
      }

      resolve(outPath);
    } catch (err) {
      const error = err as Error;
      if (error.message.includes("No such filter: 'subtitles'") ||
          error.message.includes("Error initializing filter 'subtitles'")) {
        console.warn('FFmpeg without libass, rendering without subtitles.');
        // Retry without subtitles
        return renderClipLocal({
          ...params,
          subtitlesSrt: undefined
        }).then(resolve).catch(reject);
      }
      reject(err);
    }
  });
}

// Common encoding settings for Telegram compatibility
function getTelegramVideoEncodingArgs(crf: string, preset: string): string[] {
  return [
    '-c:v', 'libx264',
    '-preset', preset,
    '-crf', crf,
    '-profile:v', 'high',
    '-level', '4.1',
    '-pix_fmt', 'yuv420p',
    '-maxrate', '5M',
    '-bufsize', '10M',
    '-r', '30',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '2',
    '-movflags', '+faststart',
    '-threads', '2',
    '-fflags', '+genpts'
  ];
}

function buildMusicArgs(
  sourceVideo: string,
  musicAudio: string,
  startS: number,
  durationS: number,
  outPath: string,
  audioFilter: string,
  vf: string,
  subtitlesSrt?: string | null,
  crf: string = '23',
  preset: string = 'veryfast',
  playbackSpeed?: number | null
): string[] {
  const baseArgs = ['-hide_banner', '-y'];
  const encodingArgs = getTelegramVideoEncodingArgs(crf, preset);
  const speedActive = hasPlaybackSpeed(playbackSpeed);

  if (!subtitlesSrt && !speedActive) {
    // Always re-encode for Telegram compatibility
    return [
      ...baseArgs,
      '-ss', startS.toFixed(3),
      '-i', sourceVideo,
      '-i', musicAudio,
      '-t', durationS.toFixed(3),
      '-filter_complex', audioFilter,
      '-map', '0:v',
      '-map', '[a_sync]',
      ...encodingArgs,
      outPath
    ];
  } else {
    // Re-encode video (for subtitles and/or playback speed)
    return [
      ...baseArgs,
      '-i', sourceVideo,
      '-i', musicAudio,
      '-filter_complex', `[0:v]trim=${startS.toFixed(3)}:${(startS + durationS).toFixed(3)},setpts=PTS-STARTPTS,${vf}[v];${audioFilter}`,
      '-map', '[v]',
      '-map', '[a_sync]',
      ...encodingArgs,
      outPath
    ];
  }
}

function buildTTSArgs(
  sourceVideo: string,
  ttsAudio: string,
  startS: number,
  durationS: number,
  outPath: string,
  vf: string,
  subtitlesSrt?: string | null,
  crf: string = '23',
  preset: string = 'veryfast',
  playbackSpeed?: number | null
): string[] {
  const baseArgs = ['-hide_banner', '-y'];
  const encodingArgs = getTelegramVideoEncodingArgs(crf, preset);
  const speedActive = hasPlaybackSpeed(playbackSpeed);
  const speed = speedActive ? (toSpeedNumber(playbackSpeed) as number) : 1;
  const outDuration = durationS / speed;
  const atempoSuffix = speedActive ? `,${getAtempoFilter(speed)}` : '';
  const audioFilter = `[1:a]atrim=0:${durationS.toFixed(3)},asetpts=PTS-STARTPTS${atempoSuffix}[a];[a]apad=whole_dur=${outDuration.toFixed(3)}[a_sync]`;

  if (!subtitlesSrt && !speedActive) {
    // Always re-encode for Telegram compatibility
    return [
      ...baseArgs,
      '-ss', startS.toFixed(3),
      '-i', sourceVideo,
      '-i', ttsAudio,
      '-t', durationS.toFixed(3),
      '-filter_complex', audioFilter,
      '-map', '0:v',
      '-map', '[a_sync]',
      ...encodingArgs,
      outPath
    ];
  } else {
    // Re-encode video (for subtitles and/or playback speed)
    return [
      ...baseArgs,
      '-i', sourceVideo,
      '-i', ttsAudio,
      '-filter_complex', `[0:v]trim=${startS.toFixed(3)}:${(startS + durationS).toFixed(3)},setpts=PTS-STARTPTS,${vf}[v];${audioFilter}`,
      '-map', '[v]',
      '-map', '[a_sync]',
      ...encodingArgs,
      outPath
    ];
  }
}

function buildNoTTSArgs(
  sourceVideo: string,
  startS: number,
  durationS: number,
  outPath: string,
  vf: string,
  subtitlesSrt?: string | null,
  crf: string = '23',
  preset: string = 'veryfast',
  playbackSpeed?: number | null
): string[] {
  const baseArgs = ['-hide_banner', '-y'];
  const speedActive = hasPlaybackSpeed(playbackSpeed);
  const speed = speedActive ? (toSpeedNumber(playbackSpeed) as number) : 1;
  const atempoSuffix = speedActive ? `,${getAtempoFilter(speed)}` : '';

  if (!subtitlesSrt && !speedActive) {
    // Always re-encode for Telegram compatibility
    return [
      ...baseArgs,
      '-ss', startS.toFixed(3),
      '-i', sourceVideo,
      '-t', durationS.toFixed(3),
      '-c:v', 'libx264',
      '-preset', preset,
      '-crf', crf,
      '-profile:v', 'high',
      '-level', '4.1',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-ac', '2',
      '-movflags', '+faststart',
      '-threads', '2',
      '-fflags', '+genpts',
      outPath
    ];
  } else {
    const encodingArgs = getTelegramVideoEncodingArgs(crf, preset);
    return [
      ...baseArgs,
      '-i', sourceVideo,
      '-filter_complex', `[0:v]trim=${startS.toFixed(3)}:${(startS + durationS).toFixed(3)},setpts=PTS-STARTPTS,${vf}[v];[0:a]atrim=${startS.toFixed(3)}:${(startS + durationS).toFixed(3)},asetpts=PTS-STARTPTS${atempoSuffix}[a]`,
      '-map', '[v]',
      '-map', '[a]',
      ...encodingArgs,
      outPath
    ];
  }
}