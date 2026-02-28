import OpenAI from 'openai';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 初始化客户端
const client = new OpenAI({
  apiKey: process.env.QWEN_API_KEY,
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});

const SYSTEM_PROMPT = `You are a friendly assistant on a personal website. The site owner has enabled you to chat with visitors.
Be helpful, concise, and warm. If someone asks for the site owner, say they can leave a message and the owner will get back to them.
Keep responses reasonably short (a few sentences) unless the user asks for more detail.`;

/**
 * 辅助函数：将本地图片转换为 Base64 格式
 * 适配 DashScope 要求的 data:image/xxx;base64, 格式
 */
function encodeImageToBase64(relativeUrl) {
  try {
    // 移除路径开头的 '/' 并拼接绝对路径
    const absolutePath = path.join(__dirname, relativeUrl.startsWith('/') ? relativeUrl.substring(1) : relativeUrl);
    
    if (!fs.existsSync(absolutePath)) return null;

    const fileBuffer = fs.readFileSync(absolutePath);
    const extension = path.extname(absolutePath).replace('.', '').toLowerCase();
    // 映射常见的 MIME 类型
    const mimeType = extension === 'jpg' ? 'jpeg' : extension;
    
    return `data:image/${mimeType};base64,${fileBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Image encoding error:', error);
    return null;
  }
}

export async function getBotReply(userMessage, conversationHistory = [], imageUrl = null) {
  if (!process.env.QWEN_API_KEY) {
    return 'Chatbot is not configured. Please set QWEN_API_KEY.';
  }

  // 1. 处理历史记录中的图片（如果有）
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory.slice(-10).map((m) => {
      const content = [];
      if (m.image_url) {
        const base64 = encodeImageToBase64(m.image_url);
        if (base64) {
          content.push({
            type: 'image_url',
            image_url: { url: base64 }
          });
        }
      }
      content.push({ type: 'text', text: m.content });
      
      return {
        role: m.is_from_bot ? 'assistant' : 'user',
        content: content.length === 1 ? content[0].text : content
      };
    })
  ];

  // 2. 处理当前发送的图片
  const userContent = [];
  if (imageUrl) {
    const base64 = encodeImageToBase64(imageUrl);
    if (base64) {
      userContent.push({
        type: 'image_url',
        image_url: { url: base64 }
      });
    }
  }

  // 3. 添加当前用户消息文本
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
      model: 'qwen-vl-plus', // 确保模型名称正确
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content?.trim() || 'Sorry, I could not generate a reply.';
  } catch (err) {
    // 打印更详细的错误信息
    console.error('Qwen API error:', err.response?.data || err.message);
    return 'Sorry, the assistant is temporarily unavailable. Please try again later.';
  }
}