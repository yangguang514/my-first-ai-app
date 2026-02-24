// 引入依赖
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// 初始化客户端
const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1', // OpenAI用户去掉这行
});

async function main() {
  try {
    console.log('🤖 正在向AI提问...\n');
    
    const completion = await openai.chat.completions.create({
      model: 'deepseek-chat', // OpenAI用户用 'gpt-3.5-turbo'
      messages: [
        { role: 'system', content: '你是一个冷酷的AI助手，喜欢在回答问题时加上冷酷的语气。' },
        { role: 'user', content: '写一首关于编程的小诗，50字以内' }
      ],
      temperature: 0.7, // 控制创造力，0-2之间
      stream: true,
    });

    console.log('✅ AI回复：');
    for await (const part of completion) {
      const delta = part.choices[0].delta.content || '';
      process.stdout.write(delta);
    }
    console.log('\n');
    
  } catch (error) {
    console.error('❌ 出错了：', error.message);
  }
}

main();