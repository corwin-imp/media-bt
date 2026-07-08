import { detectTopMoments, getActiveBackend, isOpenCVAvailable } from '../dist/services/moment-detector.js';

const videoPath = process.argv[2] || 'data/tmp/887e96b1dab645eda3a9984b9ff8f948.mp4';
const clipCount = parseInt(process.argv[3] || '3', 10);

console.log('OpenCV available:', isOpenCVAvailable());
console.log('Active backend:', getActiveBackend());
console.log('Analyzing:', videoPath);
console.log('---');

const moments = await detectTopMoments(videoPath, 0, { clipCount, minDuration: 15, maxDuration: 25 });

console.log(`Detected ${moments.length} moment(s):`);
for (const m of moments) {
  const end = m.start + m.duration;
  console.log(`  ${m.start.toFixed(2)}s → ${end.toFixed(2)}s (${m.duration.toFixed(2)}s) score=${m.score}`);
}