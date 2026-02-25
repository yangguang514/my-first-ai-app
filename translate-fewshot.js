import OpenAI from "openai";
import dotenv from "dotenv";

// 加载环境变量
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com/v1", // 如果用OpenAI，删除这行
});

async function translateWithFewShot(text, targetLang = "中文") {
  try {
    const fewShotExamples = [
      {
        role: "user",
        content:
          "将以下英文翻译成中文：\n原文：Artificial intelligence\n译文：",
      },
      {
        role: "assistant",
        content: "人工智能",
      },
      {
        role: "user",
        content: "将以下英文翻译成中文：\n原文：Machine learning\n译文：",
      },
      {
        role: "assistant",
        content: "机器学习",
      },
      {
        role: "user",
        content:
          '将以下英文翻译成中文，并提供例句：\n原文：Blockchain\n请以JSON格式返回：{"original": "原文", "translation": "译文", "example": "包含该词的中文例句"}',
      },
      {
        role: "assistant",
        content: JSON.stringify({
          original: "Blockchain",
          translation: "区块链",
          example: "区块链技术正在改变金融行业。",
        }),
      },
    ];

    // 当前查询
    const userQuery = {
      role: "user",
      content: `将以下英文翻译成${targetLang},并提供例句。请以相同的JSON格式返回：\n原文：${text}`,
    };
    const completion = await openai.chat.completions.create({
      model: "deepseek-chat", // OpenAI用户用 'gpt-3.5-turbo'
      messages: [
        {
          role: "system",
          content: "你是一个专业的翻译助手，严格遵循示例中的格式",
        },
        ...fewShotExamples,
        userQuery,
      ],
      temperature: 0.3, // 低温度让输出更稳定
      response_format: { type: "json_object" }, // 重要！强制返回JSON（仅部分模型支持，DeepSeek可能不支持，但我们用提示词保证）
    });

    const content = completion.choices[0].message.content;
    console.log('✨ 翻译结果：', content);

    // 解析JSON

    try{
        const result = JSON.parse(content);
        console.log('📦 解析后的JSON对象：', result);
    }catch (parseError) {
        console.error('❌ JSON解析出错：', parseError.message);
        console.log('原始内容：', content);
    }
  } catch (error) {
    console.error("❌ 出错：", error.message);
    if (error.code === "ERR_INVALID_RETURN_VALUE") {
      console.log("原始返回：", error.response?.data);
    }
  }
}


translateWithFewShot('Deep learning');