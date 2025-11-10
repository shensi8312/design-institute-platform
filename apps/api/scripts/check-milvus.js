const { MilvusClient } = require('@zilliz/milvus2-sdk-node')

async function checkMilvus() {
  const client = new MilvusClient({
    address: 'localhost:19530'
  })

  try {
    const collectionName = 'knowledge_vectors'

    // 1. 获取集合统计
    const stats = await client.getCollectionStatistics({
      collection_name: collectionName
    })

    console.log('📊 Milvus集合统计:')
    console.log(JSON.stringify(stats, null, 2))

    // 2. 查询所有数据
    const query = await client.query({
      collection_name: collectionName,
      filter: '',
      output_fields: ['document_id', 'chunk_index', 'chunk_text'],
      limit: 10
    })

    console.log(`\n📄 集合中的数据 (${query.length}条):`)
    query.forEach((item, i) => {
      console.log(`\n${i + 1}. Document: ${item.document_id}`)
      console.log(`   Chunk: ${item.chunk_index}`)
      console.log(`   Text: ${item.chunk_text?.substring(0, 100)}...`)
    })

  } catch (error) {
    console.error('❌ 检查失败:', error)
  } finally {
    await client.closeConnection()
    process.exit(0)
  }
}

checkMilvus()
