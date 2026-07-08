import { spawn } from 'child_process';
import {
  detectTopMoments,
  getActiveBackend,
  isOpenCVAvailable,
} from './moment-detector.js';

export function probeDuration(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=nokey=1:noprint_wrappers=1',
      path
    ]);

    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (data) => {
      stdout += data;
    });

    ffprobe.stderr.on('data', (data) => {
      stderr += data;
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed: ${stderr}`));
        return;
      }
      try {
        const duration = parseFloat(stdout.trim());
        if (isNaN(duration)) {
          reject(new Error(`Could not parse duration: ${stdout}`));
        } else {
          resolve(duration);
        }
      } catch (err) {
        reject(new Error(`Failed to parse duration: ${err}`));
      }
    });

    ffprobe.on('error', (err) => {
      reject(new Error(`ffprobe not found. Please install ffmpeg: ${err.message}`));
    });
  });
}

/**
 * Fallback algorithm (original behavior): split the video into N evenly spaced
 * segments of a fixed target duration. Used when OpenCV is not available or
 * content-aware detection fails for any reason.
 */
function proposeEvenSplitSegments(
  duration: number,
  clipCount: number,
  minS: number,
  maxS: number
): Array<[number, number]> {
  const target = Math.max(minS, Math.min(maxS, 20));
  const step = duration / (clipCount + 1);
  const starts: number[] = [];

  for (let i = 1; i <= clipCount; i++) {
    starts.push(Math.max(0, i * step));
  }

  const segments: Array<[number, number]> = [];
  for (const start of starts) {
    const end = Math.min(duration, start + target);
    segments.push([start, end - start]);
  }

  return segments;
}

/**
 * Propose the best segments for short clips.
 *
 * If opencv4nodejs is available, performs content-aware moment detection
 * (motion + brightness + saturation) with scene-cut-snapped boundaries for
 * smooth, well-timed starts and ends. Otherwise falls back to an even split.
 *
 * Returns an array of [startSeconds, durationSeconds] tuples.
 */
export async function proposeSegments(
  path: string,
  clipCount: number,
  minS: number = 15,
  maxS: number = 25
): Promise<Array<[number, number]>> {
  const duration = await probeDuration(path);

  const backend = getActiveBackend();
  if (backend === 'ffmpeg' && !isOpenCVAvailable()) {
    // ffmpeg signalstats is the default, zero-dependency backend. A native
    // opencv4nodejs binding is optional (needs system OpenCV + cmake to build)
    // and only speeds up very long videos; results are equivalent without it.
    console.log(
      `[clipper] Using ffmpeg signalstats analyzer for moment detection` +
      ` (native opencv4nodejs is optional and not installed).`
    );
  }

  try {
    console.log(`[clipper] Analyzing video for top moments (backend: ${backend})...`);
    const moments = await detectTopMoments(path, duration, {
      clipCount,
      minDuration: minS,
      maxDuration: maxS,
    });

    if (moments.length === 0) {
      throw new Error('No moments detected');
    }

    const segments: Array<[number, number]> = moments.map((m) => [m.start, m.duration]);
    console.log(
      `[clipper] Detection succeeded (${backend}). Selected ${segments.length} moment(s): ` +
      segments
        .map(([s, d], i) =>
          `#${i + 1} @ ${s.toFixed(1)}s (${d.toFixed(1)}s, score ${(moments[i]?.score ?? 0).toFixed(2)})`
        )
        .join(', ')
    );
    return segments;
  } catch (err) {
    console.error(`[clipper] Moment detection failed: ${err}`);
    console.warn(`[clipper] Falling back to even-split segment selection.`);
    return proposeEvenSplitSegments(duration, clipCount, minS, maxS);
  }
}
