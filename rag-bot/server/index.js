import express from "express";
import cors from "cors";
import { OllamaEmbeddings } from "@langchain/ollama";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChatOpenAI } from "@langchain/openai";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PROMPT_TEMPLATES = {
  general_qa: `你是“马类知识助手”。请仅基于提供的上下文回答问题。
要求：
1) 优先给出直接结论，再给简短依据。
2) 如果上下文包含时间、地点、物种名，请尽量保留这些关键信息。
3) 如果上下文不足以回答，明确说“根据当前资料无法确定”，并说明缺少什么信息。
4) 不要编造，不要使用上下文之外的知识。

上下文：
{context}`,

  timeline_expert: `你是“马类演化时间线助手”。请仅依据上下文回答。
回答格式：
- 时间点/时期：
- 关键事件：
- 证据片段（简述）：

要求：
1) 优先梳理演化顺序（如始新世、物种变化、形态变化）。
2) 若用户问“最早/最晚/先后关系”，必须给清晰顺序。
3) 信息不足时写“根据当前资料无法确定”。
4) 禁止编造。

上下文：
{context}`,

  compare_expert: `你是“马属对比分析助手”。请仅依据上下文进行比较说明。
回答格式：
- 对比对象：
- 相同点：
- 不同点：
- 适用场景/结论：

要求：
1) 适合回答“冰岛马 vs 普氏野马”“古马 vs 现代马”等问题。
2) 对比维度优先：体型、步态、栖息环境、食性、驯化与保护状态。
3) 缺失维度要明确标注“资料未提及”。
4) 禁止编造。

上下文：
{context}`,

  strict_citation: `你是“证据优先的马类资料问答助手”。只能用上下文内容回答。
要求：
1) 每个核心结论后都附“依据：”并复述对应上下文信息。
2) 若发现上下文内部信息可能冲突，先指出冲突再给保守结论。
3) 不能确定时，输出“根据当前资料无法确定”。
4) 语言简洁，不要扩写，不要编造。

上下文：
{context}`,
};

function getPromptTemplateText() {
  const key = (process.env.PROMPT_TEMPLATE || "general_qa").toLowerCase();
  return PROMPT_TEMPLATES[key] || PROMPT_TEMPLATES.general_qa;
}

// 初始化向量库（每次请求都重新连接，实际应复用）
async function getVectorStore() {
  const embeddings = new OllamaEmbeddings({
    model: process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text",
    baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
  });
  const vectorStore = await Chroma.fromExistingCollection(embeddings, {
    collectionName: process.env.CHROMA_COLLECTION || "horse",
    url: process.env.CHROMA_URL || "http://localhost:8000",
  });
  return vectorStore;
}

// 创建检索链
async function createChain() {
  const vectorStore = await getVectorStore();
  const topK = Number(process.env.RETRIEVER_TOP_K || 6);
  const searchType = (
    process.env.RETRIEVER_SEARCH_TYPE || "similarity"
  ).toLowerCase();

  if (searchType === "mmr") {
    console.warn(
      "RETRIEVER_SEARCH_TYPE=mmr is not supported by this Chroma setup. Falling back to similarity.",
    );
  }

  const retriever = vectorStore.asRetriever({
    k: topK,
    searchType: "similarity",
  });

  // 定义提示模板
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", getPromptTemplateText()],
    ["human", "{input}"],
  ]);

  const llm = new ChatOpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    modelName: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    configuration: {
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    },
    temperature: 0,
  });

  // 创建文档组合链
  const combineDocsChain = await createStuffDocumentsChain({
    llm,
    prompt,
  });

  // 创建检索链
  const chain = await createRetrievalChain({
    retriever,
    combineDocsChain,
  });

  return chain;
}

app.post("/api/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: "请提供问题" });
    }

    const chain = await createChain();
    const result = await chain.invoke({ input: question });

    // result 包含 answer 和 context（检索到的文档片段）
    res.json({
      answer: result.answer,
      sources: result.context.map(
        (doc) => doc.pageContent.substring(0, 100) + "...",
      ), // 只返回片段预览
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3003;
app.listen(PORT, () => {
  console.log(`HR 问答服务器运行在 http://localhost:${PORT}`);
});
