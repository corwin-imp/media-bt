import axios from 'axios';

export async function fetchTrendingHashtags(limit: number = 5): Promise<string[]> {
  if (!process.env.EXOLYT_API_KEY) {
    // Return some default trends if no API key
    return [
      '#fyp',
      '#viral',
      '#trending',
      '#foryou',
      '#tiktok'
    ];
  }

  try {
    const response = await axios.get(
      'https://api.exolyt.com/v1/trends',
      {
        headers: {
          'Authorization': `Bearer ${process.env.EXOLYT_API_KEY}`
        }
      }
    );

    if (response.data && response.data.data) {
      return response.data.data
        .slice(0, limit)
        .map((trend: any) => trend.hashtag || trend);
    }

    return [];
  } catch (error) {
    console.error('Failed to fetch trending hashtags:', error);
    return [];
  }
}