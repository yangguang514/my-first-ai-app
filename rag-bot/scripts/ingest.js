import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { OllamaEmbeddings } from "@langchain/ollama";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

function buildEmbeddings() {
  const provider = (process.env.EMBEDDING_PROVIDER || "ollama").toLowerCase();

  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai."
      );
    }
    return {
      provider,
      embeddings: new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
      }),
    };
  }

  if (provider === "ollama") {
    return {
      provider,
      embeddings: new OllamaEmbeddings({
        model: process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text",
        baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
      }),
    };
  }

  throw new Error(
    `Unsupported EMBEDDING_PROVIDER: ${provider}. Allowed values: openai, ollama`
  );
}

// 1. 加载文档
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceFilePath =
  process.env.SOURCE_FILE_PATH ||
  path.resolve(__dirname, "../data/horse.txt");
const loader = new TextLoader(sourceFilePath);
const docs = await loader.load();

// 2. 分割文档（chunk）
const chunkSize = Number(process.env.CHUNK_SIZE || 300);
const chunkOverlap = Number(process.env.CHUNK_OVERLAP || 80);
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize,
  chunkOverlap,
  separators: ["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""],
});
const splitDocs = await splitter.splitDocuments(docs);
console.log(
  `Split into ${splitDocs.length} chunks (size=${chunkSize}, overlap=${chunkOverlap})`
);

// 3. 创建嵌入并存入向量库
const { provider, embeddings } = buildEmbeddings();
console.log(`当前嵌入提供商: ${provider}`);
const chromaUrl = process.env.CHROMA_URL || "http://localhost:8000";

// 4. 使用 Chroma 向量库（本地运行）
try {
  await Chroma.fromDocuments(splitDocs, embeddings, {
    collectionName: "horse",
    url: chromaUrl,
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (provider === "ollama" && message.includes("404")) {
    throw new Error(
      `${message}\nHint: pull embedding model first, e.g. 'ollama pull ${process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text"}'`
    );
  }
  if (message.includes("Failed to connect to chromadb")) {
    throw new Error(
      `${message}\nHint: start Chroma server first or set CHROMA_URL to a reachable endpoint. Current CHROMA_URL=${chromaUrl}`
    );
  }
  throw error;
}

console.log("✅ 文档已存入向量库");
