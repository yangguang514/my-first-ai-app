import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";

dotenv.config();

async function checkPinecone() {
  const pineconeApiKey = process.env.PINECONE_API_KEY;
  if (!pineconeApiKey) {
    console.error("❌ PINECONE_API_KEY 未设置");
    process.exit(1);
  }

  const pineconeIndex = process.env.PINECONE_INDEX || "meeting-minutes";
  const pineconeNamespace = process.env.PINECONE_NAMESPACE || "default";

  console.log(`🔍 检查 Pinecone 索引...`);
  console.log(`   索引名: ${pineconeIndex}`);
  console.log(`   命名空间: ${pineconeNamespace}\n`);

  try {
    const pinecone = new Pinecone({
      apiKey: pineconeApiKey,
    });

    const index = pinecone.Index(pineconeIndex);

    // 获取索引统计信息
    const indexDescription = await index.describeIndexStats({
      filter: { namespace: pineconeNamespace },
    });

    console.log(`📊 索引统计:`);
    console.log(`   总向量数: ${indexDescription.totalVectorCount || 0}`);
    console.log(`   命名空间: ${pineconeNamespace}`);
    if (indexDescription.namespaces && indexDescription.namespaces[pineconeNamespace]) {
      const stats = indexDescription.namespaces[pineconeNamespace];
      console.log(`   当前命名空间向量数: ${stats.vectorCount || 0}`);
    } else {
      console.log(`   当前命名空间向量数: 0 (命名空间不存在或为空)`);
    }

    // 尝试列出一些向量的 metadata
    console.log(`\n📄 样本向量 (前 5 个):`)
    try {
      const listResponse = await index.listPaginated({
        namespace: pineconeNamespace,
        limit: 5,
      });

      if (listResponse.vectors && listResponse.vectors.length > 0) {
        listResponse.vectors.forEach((vec, i) => {
          console.log(`   [${i + 1}] ID: ${vec.id}`);
          if (vec.metadata) {
            console.log(`       Metadata: ${JSON.stringify(vec.metadata).substring(0, 100)}`);
          }
        });
      } else {
        console.log(`   (无向量数据)`);
      }
    } catch (e) {
      console.log(`   (无法列出向量: ${e.message})`);
    }

    // 建议
    console.log(`\n💡 建议:`);
    const ns = indexDescription.namespaces?.[pineconeNamespace];
    if (!ns || ns.vectorCount === 0) {
      console.log(`   1. 当前命名空间为空，需要运行: node scripts/ingest.js`);
    } else {
      console.log(`   1. 当前命名空间中有 ${ns.vectorCount} 个向量`);
      console.log(`   2. 查看服务器日志以确认检索到的文档内容`);
      console.log(`   3. 如需清空并重新导入，可以修改 PINECONE_NAMESPACE 为新值`);
    }

  } catch (error) {
    console.error(`❌ 错误: ${error.message}`);
    if (error.message.includes("not found")) {
      console.error(`   索引 "${pineconeIndex}" 不存在，请在 Pinecone 控制台创建它`);
    }
    process.exit(1);
  }
}

checkPinecone();
