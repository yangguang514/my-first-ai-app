import { TextLoader } from "langchain/document_loaders/fs/text";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { OllamaEmbeddings } from "@langchain/ollama";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

dotenv.config();

function buildEmbeddings() {
  const provider = (process.env.EMBEDDING_PROVIDER || "ollama").toLowerCase();
  console.log("DEBUG: EMBEDDING_PROVIDER from env =", process.env.EMBEDDING_PROVIDER);
  console.log("DEBUG: provider variable =", provider);

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
const dataDir = path.resolve(__dirname, "../data");

// 支持从命令行参数或环境变量指定文件，默认查找PDF文件
let sourceFilePath = process.env.SOURCE_FILE_PATH;
if (!sourceFilePath) {
  const pdfFile = path.resolve(dataDir, "20260302_航运事业部_会议纪要.pdf");
  if (fs.existsSync(pdfFile)) {
    sourceFilePath = pdfFile;
  } else {
    sourceFilePath = path.resolve(dataDir, "horse.txt");
  }
}

console.log(`Loading document from: ${sourceFilePath}`);
let docs;

if (sourceFilePath.toLowerCase().endsWith(".pdf")) {
  const loader = new PDFLoader(sourceFilePath);
  docs = await loader.load();
  console.log(`Loaded PDF with ${docs.length} pages`);
} else {
  const loader = new TextLoader(sourceFilePath);
  docs = await loader.load();
  console.log(`Loaded text file`);
}

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

// 4. 使用 Pinecone 向量库
const pineconeApiKey = process.env.PINECONE_API_KEY;
if (!pineconeApiKey) {
  throw new Error(
    "PINECONE_API_KEY is required. Please set it in your .env file or environment variables."
  );
}

const pineconeIndex = process.env.PINECONE_INDEX || "meeting-minutes";
const pineconeNamespace = process.env.PINECONE_NAMESPACE || "default";

try {
  // 初始化 Pinecone 客户端
  const pinecone = new Pinecone({
    apiKey: pineconeApiKey,
  });

  // 获取索引
  const index = pinecone.Index(pineconeIndex);

  console.log(`📤 开始上传 ${splitDocs.length} 个文档块到 Pinecone...`);
  console.log(`   索引: ${pineconeIndex}, 命名空间: ${pineconeNamespace}`);

  // 创建向量存储并上传文档
  await PineconeStore.fromDocuments(splitDocs, embeddings, {
    pineconeIndex: index,
    namespace: pineconeNamespace,
  });

  console.log(`✅ 文档已成功上传到 Pinecone`);
  console.log(`📊 上传文档数: ${splitDocs.length}`);
  console.log(`🔗 索引信息:`);
  console.log(`   - 索引名: ${pineconeIndex}`);
  console.log(`   - 命名空间: ${pineconeNamespace}`);
  console.log(`   - 嵌入提供商: ${provider}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ 导入失败: ${message}`);
  if (message.includes("PINECONE_API_KEY")) {
    throw new Error(
      `${message}\nHint: PINECONE_API_KEY 未设置。请在 .env 文件中配置。`
    );
  }
  if (message.includes("404") || message.includes("not found")) {
    throw new Error(
      `${message}\nHint: Pinecone 索引 '${pineconeIndex}' 不存在。请先在 Pinecone 控制面板中创建索引。`
    );
  }
  if (message.includes("timeout") || message.includes("Timeout")) {
    throw new Error(
      `${message}\nHint: OpenAI API 超时。请检查网络连接或稍后重试。`
    );
  }
  throw error;
}
