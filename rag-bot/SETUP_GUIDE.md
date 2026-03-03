# 会议纪要问答智能体 - 数据导入指南

## 概述
这个脚本用于将会议纪要文档（PDF格式）导入到 Pinecone 向量数据库，为问答智能体提供数据底座。

## 配置步骤

### 1. 环境变量配置
复制 `.env.example` 为 `.env`，并配置以下信息：

```bash
cp .env.example .env
```

### 2. 配置信息

#### Pinecone 配置
- **PINECONE_API_KEY**: 你的 Pinecone API 密钥
  - 从 [Pinecone 控制台](https://app.pinecone.io/) 获取
- **PINECONE_INDEX**: 向量索引名称（默认: `meeting-minutes`）
- **PINECONE_NAMESPACE**: 命名空间（默认: `default`）

#### 嵌入模型配置
- **EMBEDDING_PROVIDER**: 选择 `openai` 或 `ollama`（默认: `openai`）

**如果使用 OpenAI:**
```env
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-your-api-key-here
```

**如果使用 Ollama:**
```env
EMBEDDING_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

#### 文本分割配置（可选）
```env
CHUNK_SIZE=300        # 每个文本块的大小
CHUNK_OVERLAP=80      # 块之间的重叠部分
```

### 3. Pinecone 索引准备

在 Pinecone 控制台创建索引：
- **索引名称**: `meeting-minutes`（或你在 `.env` 中指定的名称）
- **维度**: 
  - OpenAI 嵌入模型: `1536`
  - Ollama nomic-embed-text: `768`
- **度量**: `cosine`

## 使用方法

### 导入会议纪要（默认）
```bash
node scripts/ingest.js
```
默认会自动检测和导入：`data/20260302_航运事业部_会议纪要.pdf`

### 导入其他文档（可选）
```bash
# 导入 .txt 文件
SOURCE_FILE_PATH=data/hr_policy.txt node scripts/ingest.js

# 导入其他 PDF 文件
SOURCE_FILE_PATH=data/your_document.pdf node scripts/ingest.js
```

## 数据流程图

```
┌─────────────────────┐
│  会议纪要 PDF 文件   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   PDF 加载器        │
│  (PDFLoader)        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  文本分割器         │
│ (RecursiveText      │
│  Splitter)          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  嵌入生成           │
│ (OpenAI/Ollama)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Pinecone 向量库    │
│ (VectorStore)       │
└─────────────────────┘
           │
           ▼
    ┌──────────────┐
    │ 问答智能体    │
    │ (QA Agent)   │
    └──────────────┘
```

## 数据准备

### 支持的文件格式
- ✅ PDF 文件 (`.pdf`)
- ✅ 文本文件 (`.txt`)

### 当前数据文件
- `data/20260302_航运事业部_会议纪要.pdf` - 会议纪要（默认）
- `data/hr_policy.txt` - HR 政策
- `data/horse.txt` - 示例文档

## 故障排查

| 错误 | 解决方案 |
|------|--------|
| `PINECONE_API_KEY is required` | 检查 `.env` 文件中的 `PINECONE_API_KEY` 配置 |
| `Pinecone 索引不存在` | 在 Pinecone 控制台创建对应索引 |
| `OPENAI_API_KEY is required` | 如果使用 OpenAI，检查 API 密钥配置 |
| `无法连接到 Ollama` | 确保 Ollama 服务运行在指定的 `OLLAMA_BASE_URL` |
| `Pull embedding model first` | 运行 `ollama pull nomic-embed-text` 下载模型 |

## 下一步

数据导入完成后，可以使用 Pinecone 向量库构建：
1. **问答系统** - 基于会议纪要的 Q&A
2. **智能搜索** - 快速查找会议相关信息
3. **会议摘要** - 自动生成会议要点
4. **决议跟踪** - 追踪会议决议的执行
