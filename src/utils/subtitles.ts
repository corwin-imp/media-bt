import { promises as fs } from 'fs';
import path from 'path';

export async function writeSimpleSRT(text: string, durationS: number, outPath: string): Promise<void> {
  const words = text.split(' ');
  const wordsPerSecond = words.length / durationS;
  const chunkSize = Math.max(1, Math.round(wordsPerSecond * 2)); // 2-second chunks
  
  let srtContent = '';
  let currentStart = 0;
  
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    const currentEnd = Math.min(currentStart + 2, durationS);
    const subtitleNumber = Math.floor(i / chunkSize) + 1;
    
    srtContent += `${subtitleNumber}\n`;
    srtContent += `${formatTime(currentStart)} --> ${formatTime(currentEnd)}\n`;
    srtContent += `${chunk}\n\n`;
    
    currentStart = currentEnd;
    if (currentStart >= durationS) break;
  }
  
  await fs.writeFile(outPath, srtContent, 'utf-8');
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}