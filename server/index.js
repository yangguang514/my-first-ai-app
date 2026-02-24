import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

app.post('/api/translate', async (req, res) => {
  const { text, targetLang = '中文' } = req.body;

  if (!text) {
    return res.status(400).json({ error: '请提供原文' });
  }

  try {
    const prompt = `请先识别出当前原文的语言，然后将他翻译成${targetLang}，并尽量符合中文语法和语境。并提供一个例句。以JSON格式返回，包含三个字段：
                    - original: 原文
                    - translation: 译文
                    - example: 一个包含该词的例句（用${targetLang}）
                    
                    原文：${text}
                    
                    请只返回JSON，不要有其他内容。`;

    const completion = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个翻译助手，总是返回有效的JSON。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
    });

    const content = completion.choices[0].message.content;
    
    // 尝试提取JSON（防止AI添加额外文字）
    const jsonMatch = content.match(/\{.*\}/s);
    if (!jsonMatch) {
      throw new Error('AI没有返回有效的JSON');
    }
    const result = JSON.parse(jsonMatch[0]);
    
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '翻译失败', detail: error.message });
  }
});

app.listen(port, () => {
  console.log(`翻译代理服务器运行在 http://localhost:${port}`);
});