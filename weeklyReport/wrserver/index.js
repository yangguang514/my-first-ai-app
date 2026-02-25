import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3002;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

// Few-shot 示例：高质量的周报格式
const weeklyReportExamples = [
  {
    role: "user",
    content: `以下是我本周的工作记录，请帮我整理成周报：

周一：参加产品需求评审会，讨论新功能优先级
周二：修复用户反馈的登录bug，花了半天时间
周三：开发支付页面，完成了前端布局
周四：和设计师沟通UI调整方案，下午继续开发支付逻辑
周五：上午写周报，下午团队周会`
  },
  {
    role: "assistant",
    content: `# 本周工作周报（2024年3月第2周）

## 📋 本周完成
1. **需求评审**：参加产品需求评审会，明确新功能开发优先级
2. **Bug修复**：修复用户登录异常问题，定位并解决session失效原因
3. **支付功能开发**：
   - 完成支付页面前端布局
   - 实现基础支付逻辑
   - 与设计师确认UI调整方案

## ⚠️ 存在问题
- 支付流程中的异常处理尚未完善，需要补充边界情况测试
- 登录bug暴露了现有session管理机制不健壮，需考虑优化方案

## 📅 下周计划
1. 完成支付功能的联调测试
2. 补充支付异常处理逻辑
3. 参与技术评审会
4. 整理项目文档`
  },
  {
    role: "user",
    content: `记录：周二上午修复了数据库连接池的bug，下午写了接口文档。周三和测试同学过了一遍测试用例，发现几个边界问题。周四改bug，周五上线。`
  },
  {
    role: "assistant",
    content: `# 本周工作周报（2024年3月第3周）

## 📋 本周完成
1. **数据库优化**：修复连接池配置问题，提升系统稳定性
2. **文档建设**：完成核心接口的技术文档编写
3. **质量保障**：
   - 与测试团队评审测试用例，发现并修复5个边界问题
   - 完成版本迭代，周五顺利上线

## ⚠️ 存在问题
- 测试用例评审中发现部分接口缺乏异常处理，已补充完善
- 上线前发现环境配置差异，需要规范化部署流程

## 📅 下周计划
1. 监控上线后系统运行状态
2. 处理可能出现的线上问题
3. 开始下一版本的需求预研`
  }
];

app.post('/api/generate-report', async (req, res) => {
  const { notes } = req.body;

  if (!notes) {
    return res.status(400).json({ error: '请提供工作记录' });
  }

  try {
    const userQuery = {
      role: "user",
      content: `以下是我本周的工作记录，请按照示例的格式帮我生成周报：\n\n${notes}`
    };

    const completion = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个专业的周报生成助手。严格遵循示例中的格式和风格，输出结构清晰的周报。使用合适的emoji增强可读性。' },
        ...weeklyReportExamples,
        userQuery
      ],
      temperature: 0.4,
    });

    const report = completion.choices[0].message.content;
    res.json({ report });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '生成失败', detail: error.message });
  }
});

app.listen(port, () => {
  console.log(`周报生成器运行在 http://localhost:${port}`);
});