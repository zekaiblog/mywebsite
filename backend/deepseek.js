import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

const SYSTEM_PROMPT = `You are a friendly assistant on a personal website. The site owner has enabled you to chat with visitors. 
Be helpful, concise, and warm. If someone asks for the site owner, say they can leave a message and the owner will get back to them. 
Keep responses reasonably short (a few sentences) unless the user asks for more detail.`;

export async function getBotReply(userMessage, conversationHistory = [], imageUrl = null) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return 'Chatbot is not configured. Please set DEEPSEEK_API_KEY.';
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory.slice(-10).map((m) => {
      const content = [];
      if (m.image_url) {
        content.push({
          type: 'image_url',
          image_url: { url: m.image_url }
        });
      }
      content.push({
        type: 'text',
        text: m.content
      });
      return {
        role: m.is_from_bot ? 'assistant' : 'user',
        content: content.length === 1 ? content[0].text : content
      };
    })
  ];

  // Add current user message
  const userContent = [];
  if (imageUrl) {
    userContent.push({
      type: 'image_url',
      image_url: { url: imageUrl }
    });
  }
  userContent.push({
    type: 'text',
    text: userMessage
  });

  messages.push({
    role: 'user',
    content: userContent.length === 1 ? userContent[0].text : userContent
  });

  try {
    const completion = await client.chat.completions.create({
      model: 'deepseek-chat', // Using text model for now, can be upgraded to vision model when available
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
