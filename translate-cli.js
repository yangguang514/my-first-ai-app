import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1', // 如果用OpenAI，删除这行
});

async function translate(text, targetLang = '中文') {
  try {
    const prompt = `请将以下英文翻译成${targetLang}，并提供一个例句。以JSON格式返回，包含三个字段：
- original: 原文
- translation: 译文
- example: 一个包含该词的例句（用${targetLang}）

原文：${text}

请只返回JSON，不要有其他内容。`;

    const completion = await openai.chat.completions.create({
      model: 'deepseek-chat', // OpenAI用户用 'gpt-3.5-turbo'
      messages: [
        { role: 'system', content: '你是一个翻译助手，总是返回有效的JSON。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3, // 低温度让输出更稳定
      response_format: { type: 'json_object' } // 重要！强制返回JSON（仅部分模型支持，DeepSeek可能不支持，但我们用提示词保证）
    });

    const content = completion.choices[0].message.content;
    
    // 解析JSON
    const result = JSON.parse(content);
    console.log('📦 解析后的JSON对象：', result);
    console.log('\n--- 翻译结果 ---');
    console.log(`原文：${result.original}`);
    console.log(`译文：${result.translation}`);
    console.log(`例句：${result.example}`);
    
  } catch (error) {
    console.error('❌ 出错：', error.message);
    if (error.code === 'ERR_INVALID_RETURN_VALUE') {
      console.log('原始返回：', error.response?.data);
    }
  }
}

// 从命令行获取参数
const args = process.argv.slice(2);
const inputText = args[0] || 'Hello world';
translate(inputText, '中文');