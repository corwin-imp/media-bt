import { spawn } from 'child_process';
import { promisify } from 'util';

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

export function proposeSegments(path: string, clipCount: number, minS: number = 15, maxS: number = 25): Promise<Array<[number, number]>> {
  return probeDuration(path).then(dur => {
    const target = Math.max(minS, Math.min(maxS, 20));
    const step = dur / (clipCount + 1);
    const starts: number[] = [];
    
    for (let i = 1; i <= clipCount; i++) {
      starts.push(Math.max(0, i * step));
    }
    
    const segments: Array<[number, number]> = [];
    for (const start of starts) {
      const end = Math.min(dur, start + target);
      segments.push([start, end - start]);
    }
    
    return segments;
  });
}