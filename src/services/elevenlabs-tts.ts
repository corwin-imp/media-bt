import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';

export async function synthesizeTTS(text: string, outDir: string): Promise<string | null> {
  if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID) {
    return null;
  }

  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
      {
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    await fs.mkdir(outDir, { recursive: true });
    const audioPath = path.join(outDir, `tts_${Date.now()}.mp3`);
    await fs.writeFile(audioPath, Buffer.from(response.data));
    
    return audioPath;
  } catch (error) {
    console.error('ElevenLabs TTS error:', error);
    return null;
  }
}