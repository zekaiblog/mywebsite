import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

const SYSTEM_PROMPT = `You are a friendly assistant on a personal website. The site owner has enabled you to chat with visitors. 
Be helpful, concise, and warm. If someone asks for the site owner, say they can leave a message and the owner will get back to them. 
Keep responses reasonably short (a few sentences) unless the user asks for more detail.`;

export async function getBotReply(userMessage, conversationHistory = []) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return 'Chatbot is not configured. Please set DEEPSEEK_API_KEY.';
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory.slice(-10).map((m) => ({
      role: m.is_from_bot ? 'assistant' : 'user',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  try {
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });
    return completion.choices[0]?.message?.content?.trim() || 'Sorry, I could not generate a reply.';
  } catch (err) {
    console.error('DeepSeek API error:', err.message);
    return 'Sorry, the assistant is temporarily unavailable. Please try again later.';
  }
}
