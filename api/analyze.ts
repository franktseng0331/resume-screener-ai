import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com'
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, temperature } = req.body;
    
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages,
      response_format: { type: 'json_object' },
      temperature: temperature || 0.6
    });

    res.status(200).json(response);
  } catch (error: any) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
}
