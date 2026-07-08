import { createRequire } from 'module';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Moment detection supports two analysis backends:
//   1. Native opencv4nodejs (optional, faster for very long videos). Both the
//      original `opencv4nodejs` and the `@u4/opencv4nodejs` fork require a
//      system OpenCV install + cmake to build the native binding, so neither is
//      a default dependency here. Users who have built one can drop it in.
//   2. ffmpeg `signalstats` (default, zero native deps). Computes the same
//      motion/brightness/saturation features via ffmpeg's built-in filter.
// The bot boots and smart detection works with either backend available.
const require = createRequire(import.meta.url);

type Backend = 'opencv-u4' | 'opencv-original' | 'ffmpeg';

let cv: any = null;
let activeBackend: Backend = 'ffmpeg';
let cvLoadError: string | null = null;

try {
  cv = require('@u4/opencv4nodejs');
  activeBackend = 'opencv-u4';
} catch {
  try {
    cv = require('opencv4nodejs');
    activeBackend = 'opencv-original';
  } catch (err) {
    cv = null;
    activeBackend = 'ffmpeg';
    cvLoadError = err instanceof Error ? err.message : String(err);
  }
}

/**
 * Whether a native opencv4nodejs binding is available at runtime.
 * When false, the ffmpeg-based analyzer is used automatically.
 */
export function isOpenCVAvailable(): boolean {
  return cv !== null;
}

export function getActiveBackend(): Backend {
  return activeBackend;
}

export function getOpenCVLoadError(): string | null {
  return cvLoadError;
}

export interface DetectedMoment {
  start: number; // seconds
  duration: number; // seconds
  score: number; // 0..1 normalized
}

export interface MomentDetectionOptions {
  clipCount: number;
  minDuration?: number; // default 15
  maxDuration?: number; // default 25
  sampleFps?: number; // default 2 (frames per second to analyze)
  targetWidth?: number; // analysis resize width, default 160
}

interface FrameSample {
  time: number; // seconds
  motion: number; // mean absolute pixel difference vs previous frame (0..255)
  brightness: number; // mean luminance (0..255)
  saturation: number; // mean saturation (0..255)
}

interface SceneCut {
  time: number;
}

const DEFAULTS = {
  minDuration: 15,
  maxDuration: 25,
  sampleFps: 2,
  targetWidth: 160,
} as const;

// Scoring weights (sum can be anything; we normalize later).
const WEIGHTS = {
  motion: 0.55,
  brightness: 0.25,
  saturation: 0.2,
};

/**
 * Run ffprobe quickly to get the video FPS and duration.
 */
function probeVideoMeta(videoPath: string): Promise<{ fps: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=r_frame_rate,duration:format=duration',
      '-of', 'default=noprint_wrappers=1',
      videoPath,
    ]);

    let stdout = '';
    let stderr = '';
    ffprobe.stdout.on('data', (d: Buffer) => (stdout += d));
    ffprobe.stderr.on('data', (d: Buffer) => (stderr += d));
    ffprobe.on('close', (code: number) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed: ${stderr}`));
        return;
      }
      let fps = 30;
      let duration = 0;
      const fpsMatch = stdout.match(/r_frame_rate=(\d+)\/(\d+)/);
      if (fpsMatch) {
        const num = parseFloat(fpsMatch[1]);
        const den = parseFloat(fpsMatch[2]) || 1;
        fps = den ? num / den : 30;
      }
      const durMatch = stdout.match(/duration=([\d.]+)/);
      if (durMatch) {
        duration = parseFloat(durMatch[1]);
      }
      resolve({ fps: fps > 0 ? fps : 30, duration });
    });
    ffprobe.on('error', (err: Error) => reject(new Error(`ffprobe not found: ${err.message}`)));
  });
}

/**
 * Sample the video using OpenCV VideoCapture, computing per-frame
 * motion / brightness / saturation features via real pixel analysis.
 */
async function sampleFramesOpenCV(
  videoPath: string,
  opts: Required<Omit<MomentDetectionOptions, 'clipCount'>>,
  videoDuration: number,
  fps: number
): Promise<FrameSample[]> {
  const cap = new cv.VideoCapture(videoPath);
  const totalFrames = cap.get(cv.CAP_PROP_FRAME_COUNT) || Math.round(videoDuration * fps);

  const sampleStepFrames = Math.max(1, Math.round(fps / opts.sampleFps));

  const samples: FrameSample[] = [];
  let prevGray: any = null;

  const maxFrame = Math.max(0, totalFrames - 1);

  for (let frameIdx = 0; frameIdx <= maxFrame; frameIdx += sampleStepFrames) {
    cap.set(cv.CAP_PROP_POS_FRAMES, frameIdx);
    let frame = cap.read();
    if (!frame || frame.empty) {
      frame = cap.read();
      if (!frame || frame.empty) continue;
    }

    const scale = opts.targetWidth / frame.cols;
    const small = frame.resize(
      new cv.Size(opts.targetWidth, Math.max(1, Math.round(frame.rows * scale))),
      0, 0, cv.INTER_AREA
    );

    const gray = small.bgrToGray();
    const hsv = small.cvtColor(cv.COLOR_BGR2HSV);

    const brightness = gray.mean().x;
    const saturation = hsv.split()[1].mean().x;

    let motion = 0;
    if (prevGray) {
      const diff = gray.absdiff(prevGray);
      motion = diff.mean().x;
    }
    samples.push({
      time: frameIdx / fps,
      motion,
      brightness,
      saturation,
    });
    prevGray = gray;

    if (samples.length > 1 && samples[samples.length - 1].time > videoDuration + 5) break;
  }

  cap.release();
  return samples;
}

/**
 * Sample the video using ffmpeg's `signalstats` filter (no native deps).
 *
 * signalstats emits, per frame:
 *   - YAVG   : mean luminance          -> brightness
 *   - SATAVG : mean saturation         -> saturation
 *   - YDIF   : mean inter-frame Y diff -> motion (real frame-difference!)
 *
 * This mirrors the OpenCV feature set closely using only ffmpeg (which the
 * project already requires), so smart detection works with zero native deps.
 */
/**
 * Escape a file path for use inside an ffmpeg filtergraph string.
 * ffmpeg treats ':' and '\' as special in filter args, so we must escape them.
 * (Same approach as escapeSubtitlesPath in renderer-ffmpeg.ts.)
 */
function escapeFFmpegFilterPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:');
}

async function sampleFramesFFmpeg(
  videoPath: string,
  opts: Required<Omit<MomentDetectionOptions, 'clipCount'>>
): Promise<FrameSample[]> {
  const statsFile = path.join(tmpdir(), `signalstats-${uuidv4()}.txt`);
  const escapedStatsFile = escapeFFmpegFilterPath(statsFile);
  const args = [
    '-hide_banner',
    '-nostats',
    '-i', videoPath,
    '-an',
    '-vf',
    `fps=${opts.sampleFps},scale=${opts.targetWidth}:-1,signalstats,metadata=print:file='${escapedStatsFile}'`,
    '-f', 'null',
    '-',
  ];

  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);
    let stderr = '';
    ffmpeg.stderr.on('data', (d: Buffer) => (stderr += d));
    ffmpeg.on('close', (code: number) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg signalstats failed (exit ${code}): ${stderr.slice(-500)}`));
        return;
      }
      resolve();
    });
    ffmpeg.on('error', (err: Error) => reject(new Error(`ffmpeg not found: ${err.message}`)));
  });

  let raw = '';
  try {
    raw = await fs.readFile(statsFile, 'utf8');
  } finally {
    await fs.unlink(statsFile).catch(() => {});
  }

  const blocks = raw.split(/frame:/).slice(1);
  const samples: FrameSample[] = [];

  for (const block of blocks) {
    const timeMatch = block.match(/pts_time:([\d.]+)/);
    const yavgMatch = block.match(/lavfi\.signalstats\.YAVG=([\d.]+)/);
    const satavgMatch = block.match(/lavfi\.signalstats\.SATAVG=([\d.]+)/);
    const ydifMatch = block.match(/lavfi\.signalstats\.YDIF=([\d.]+)/);
    if (!timeMatch) continue;

    samples.push({
      time: parseFloat(timeMatch[1]),
      motion: ydifMatch ? parseFloat(ydifMatch[1]) : 0,
      brightness: yavgMatch ? parseFloat(yavgMatch[1]) : 128,
      saturation: satavgMatch ? parseFloat(satavgMatch[1]) : 0,
    });
  }

  return samples;
}

/**
 * Detect scene cuts from the per-frame motion signal: strong local maxima
 * (mean + 2.5 * stddev). Shared by both backends.
 */
function detectCutsFromMotion(samples: FrameSample[]): SceneCut[] {
  if (samples.length < 3) return [];

  const motionValues = samples.map((s) => s.motion);
  const usableMotion = motionValues.length > 1 ? motionValues.slice(1) : motionValues;
  const mean = usableMotion.reduce((a, b) => a + b, 0) / Math.max(1, usableMotion.length);
  const variance =
    usableMotion.reduce((a, b) => a + (b - mean) * (b - mean), 0) /
    Math.max(1, usableMotion.length);
  const stddev = Math.sqrt(variance);
  const cutThreshold = mean + 2.5 * stddev;

  const cuts: SceneCut[] = [];
  for (let i = 1; i < samples.length - 1; i++) {
    const s = samples[i];
    if (
      s.motion >= cutThreshold &&
      s.motion > samples[i - 1].motion &&
      s.motion >= samples[i + 1].motion
    ) {
      cuts.push({ time: s.time });
    }
  }
  return cuts;
}

/** Map a raw brightness value (0..255) to a 0..1 quality score (penalize dark/bright). */
function brightnessQuality(b: number): number {
  const center = 128;
  const sigma = 70;
  return Math.exp(-((b - center) ** 2) / (2 * sigma * sigma));
}

/**
 * Compute an instant "interestingness" score for every sampled frame, then
 * aggregate into per-window scores of length `targetDuration`.
 */
function scoreWindows(
  samples: FrameSample[],
  targetDuration: number,
  sampleInterval: number
): number[] {
  if (samples.length === 0) return [];

  const maxMotion = Math.max(1, ...samples.map((s) => s.motion));
  const maxSat = Math.max(1, ...samples.map((s) => s.saturation));

  const instant = samples.map((s) => {
    const m = (s.motion / maxMotion) * WEIGHTS.motion;
    const b = brightnessQuality(s.brightness) * WEIGHTS.brightness;
    const sat = (s.saturation / maxSat) * WEIGHTS.saturation;
    return m + b + sat;
  });

  const windowSamples = Math.max(1, Math.round(targetDuration / sampleInterval));
  const windowScores: number[] = [];
  for (let i = 0; i + windowSamples <= instant.length; i++) {
    let sum = 0;
    for (let j = i; j < i + windowSamples; j++) sum += instant[j];
    windowScores.push(sum / windowSamples);
  }
  return windowScores;
}

/** Snap a boundary time to the nearest scene cut within `toleranceS`. */
function snapToCut(time: number, cuts: SceneCut[], toleranceS: number): number {
  let best = time;
  let bestDist = toleranceS;
  for (const c of cuts) {
    const d = Math.abs(c.time - time);
    if (d <= bestDist) {
      bestDist = d;
      best = c.time;
    }
  }
  return best;
}

/**
 * Main entry point: detect the most interesting non-overlapping moments.
 * Uses OpenCV if a native binding is available, otherwise ffmpeg signalstats.
 * Returns at most `clipCount` moments, sorted chronologically.
 */
export async function detectTopMoments(
  videoPath: string,
  durationHint: number,
  options: MomentDetectionOptions
): Promise<DetectedMoment[]> {
  const opts: Required<Omit<MomentDetectionOptions, 'clipCount'>> = {
    minDuration: options.minDuration ?? DEFAULTS.minDuration,
    maxDuration: options.maxDuration ?? DEFAULTS.maxDuration,
    sampleFps: options.sampleFps ?? DEFAULTS.sampleFps,
    targetWidth: options.targetWidth ?? DEFAULTS.targetWidth,
  };

  let fps = 30;
  let duration = durationHint;
  try {
    const meta = await probeVideoMeta(videoPath);
    fps = meta.fps;
    duration = meta.duration || durationHint;
  } catch {
    // keep defaults
  }

  if (duration <= 0) {
    throw new Error('Could not determine video duration');
  }

  // Sample frames using the best available backend.
  let samples: FrameSample[];
  if (cv) {
    samples = await sampleFramesOpenCV(videoPath, opts, duration, fps);
  } else {
    samples = await sampleFramesFFmpeg(videoPath, opts);
  }

  if (samples.length < 4) {
    throw new Error('Not enough frames sampled for analysis');
  }

  const cuts = detectCutsFromMotion(samples);

  const targetDuration = Math.max(opts.minDuration, Math.min(opts.maxDuration, 20));
  const sampleInterval = 1 / opts.sampleFps;
  const windowScores = scoreWindows(samples, targetDuration, sampleInterval);
  if (windowScores.length === 0) {
    throw new Error('No windows could be scored');
  }

  const maxScore = Math.max(...windowScores);
  const minScore = Math.min(...windowScores);
  const range = Math.max(1e-6, maxScore - minScore);

  const indexed = windowScores.map((score, i) => ({ i, score }));
  indexed.sort((a, b) => b.score - a.score);

  const windowSamples = Math.max(1, Math.round(targetDuration / sampleInterval));
  const minSeparationSamples = Math.max(1, Math.round(windowSamples * 0.8));
  const chosen: Array<{ i: number; score: number }> = [];

  for (const cand of indexed) {
    if (chosen.length >= options.clipCount) break;
    const overlaps = chosen.some((c) => Math.abs(c.i - cand.i) < minSeparationSamples);
    if (overlaps) continue;
    chosen.push(cand);
  }

  chosen.sort((a, b) => a.i - b.i);

  const moments: DetectedMoment[] = chosen.map((c) => {
    const startSample = c.i;
    const endSample = Math.min(samples.length - 1, c.i + windowSamples - 1);

    let rawStart = samples[startSample].time;
    let rawEnd = samples[endSample].time;

    // Smooth boundaries: snap to a nearby scene cut so we don't split mid-action.
    rawStart = snapToCut(rawStart, cuts, 3);
    rawEnd = snapToCut(rawEnd, cuts, 3);

    let d = rawEnd - rawStart;
    if (d < opts.minDuration) {
      rawEnd = Math.min(duration, rawStart + opts.minDuration);
      d = rawEnd - rawStart;
    }
    if (d > opts.maxDuration) {
      rawEnd = rawStart + opts.maxDuration;
      d = opts.maxDuration;
    }
    if (rawStart < 0) rawStart = 0;
    if (rawEnd > duration) {
      rawEnd = duration;
      d = rawEnd - rawStart;
    }

    const normalizedScore = (c.score - minScore) / range;
    return {
      start: Math.max(0, rawStart),
      duration: Math.max(opts.minDuration, Math.min(opts.maxDuration, d)),
      score: Number(normalizedScore.toFixed(3)),
    };
  });

  // Top up with secondary peaks if not enough distinct moments were found.
  if (moments.length < options.clipCount) {
    for (const cand of indexed) {
      if (moments.length >= options.clipCount) break;
      const t = samples[cand.i].time;
      const tooClose = moments.some((m) => Math.abs(m.start - t) < opts.minDuration * 0.6);
      if (tooClose) continue;
      const start = Math.max(0, Math.min(duration - opts.minDuration, t));
      moments.push({
        start,
        duration: targetDuration,
        score: Number(((cand.score - minScore) / range).toFixed(3)),
      });
    }
  }

  moments.sort((a, b) => a.start - b.start);
  return moments;
}