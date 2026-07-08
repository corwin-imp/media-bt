import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

export async function generateScript(trend: string | null, durationSeconds: number): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  try {
    const prompt = trend
      ? `Generate a short, engaging TikTok-style script (${durationSeconds}s) about ${trend}. Keep it punchy and suitable for subtitles.`
      : `Generate a short, engaging TikTok-style script (${durationSeconds}s). Make it punchy and suitable for subtitles.`;

    const completion = await openaiClient.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a TikTok content creator. Write short, engaging scripts.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 200
    });

    return completion.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('OpenAI API error:', error);
    return null;
  }
}