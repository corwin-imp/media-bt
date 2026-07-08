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

export function renderClipLocal(params: RenderClipParams): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      await fs.mkdir(params.outDir, { recursive: true });
      
      const outPath = path.join(params.outDir, `clip_${uuidv4().replace(/-/g, '')}.mp4`);
      const { crf, preset, targetWidth, targetHeight } = getQualityParams(params.quality);
      
      // Build video filter
      const vfParts: string[] = [
        `scale=iw*min(${targetWidth}/iw\\,${targetHeight}/ih):ih*min(${targetWidth}/iw\\,${targetHeight}/ih)`,
        `pad=${targetWidth}:${targetHeight}:(${targetWidth}-iw*min(${targetWidth}/iw\\,${targetHeight}/ih))/2:(${targetHeight}-ih*min(${targetWidth}/iw\\,${targetHeight}/ih))/2:black`
      ];

      if (params.subtitlesSrt) {
        const subPath = escapeSubtitlesPath(params.subtitlesSrt);
        vfParts.push(`subtitles=filename='${subPath}'`);
      }

      const vf = vfParts.join(',');

      // Determine which rendering strategy to use
        if (params.musicAudio) {
        let audioFilter: string;
        
        if (params.audioStartTime !== null && params.audioStartTime !== undefined && params.audioEndTime !== null && params.audioEndTime !== undefined) {
          const audioDuration = params.audioEndTime - params.audioStartTime;
          audioFilter = `[1:a]atrim=${params.audioStartTime.toFixed(3)}:${params.audioEndTime.toFixed(3)},asetpts=PTS-STARTPTS[a]`;
        } else {
          audioFilter = `[1:a]atrim=0:${params.durationS.toFixed(3)},asetpts=PTS-STARTPTS[a]`;
        }
        
        const audioFilterSync = `${audioFilter};[a]apad=whole_dur=${params.durationS.toFixed(3)}[a_sync]`;
        
        // Check if we need to check audio duration
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

        const args = buildMusicArgs(
          params.sourceVideo,
          params.musicAudio,
          params.startS,
          params.durationS,
          outPath,
          audioFilterSync,
          vf,
          params.subtitlesSrt,
          crf,
          preset
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
          preset
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
          preset
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
  preset: string = 'veryfast'
): string[] {
  const baseArgs = ['-hide_banner', '-y'];
  const encodingArgs = getTelegramVideoEncodingArgs(crf, preset);

  if (!subtitlesSrt) {
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
    // Re-encode video for subtitles
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
  preset: string = 'veryfast'
): string[] {
  const baseArgs = ['-hide_banner', '-y'];
  const encodingArgs = getTelegramVideoEncodingArgs(crf, preset);

  if (!subtitlesSrt) {
    // Always re-encode for Telegram compatibility
    return [
      ...baseArgs,
      '-ss', startS.toFixed(3),
      '-i', sourceVideo,
      '-i', ttsAudio,
      '-t', durationS.toFixed(3),
      '-filter_complex', `[1:a]atrim=0:${durationS.toFixed(3)},asetpts=PTS-STARTPTS[a];[a]apad=whole_dur=${durationS.toFixed(3)}[a_sync]`,
      '-map', '0:v',
      '-map', '[a_sync]',
      ...encodingArgs,
      outPath
    ];
  } else {
    // Re-encode video for subtitles
    return [
      ...baseArgs,
      '-i', sourceVideo,
      '-i', ttsAudio,
      '-filter_complex', `[0:v]trim=${startS.toFixed(3)}:${(startS + durationS).toFixed(3)},setpts=PTS-STARTPTS,${vf}[v];[1:a]atrim=0:${durationS.toFixed(3)},asetpts=PTS-STARTPTS[a];[a]apad=whole_dur=${durationS.toFixed(3)}[a_sync]`,
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
  preset: string = 'veryfast'
): string[] {
  const baseArgs = ['-hide_banner', '-y'];
  const encodingArgs = getTelegramVideoEncodingArgs(crf, preset);

  if (!subtitlesSrt) {
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
    // Re-encode video for subtitles
    return [
      ...baseArgs,
      '-i', sourceVideo,
      '-filter_complex', `[0:v]trim=${startS.toFixed(3)}:${(startS + durationS).toFixed(3)},setpts=PTS-STARTPTS,${vf}[v];[0:a]atrim=${startS.toFixed(3)}:${(startS + durationS).toFixed(3)},asetpts=PTS-STARTPTS[a]`,
      '-map', '[v]',
      '-map', '[a]',
      ...encodingArgs,
      outPath
    ];
  }
}
