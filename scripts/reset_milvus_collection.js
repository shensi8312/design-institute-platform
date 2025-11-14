const MilvusService = require('../apps/api/src/services/rag/MilvusService')

/**
 * 重置Milvus集合
 */
async function resetMilvusCollection() {
  console.log('🔄 重置Milvus集合...')

  const milvusService = new MilvusService()
  const collectionName = 'assembly_parts_vectors'

  try {
    const hasCollection = await milvusService.client.hasCollection({
      collection_name: collectionName
    })

    if (hasCollection.value) {
      console.log(`  找到现有集合: ${collectionName}`)

      await milvusService.client.dropCollection({
        collection_name: collectionName
      })

      console.log(`  ✅ 集合已删除: ${collectionName}`)
    } else {
      console.log(`  ℹ️  集合不存在: ${collectionName}`)
    }

    console.log('✅ 重置完成！现在可以运行vectorize_242_parts.js创建新集合')
  } catch (error) {
    console.error('❌ 重置失败:', error)
    throw error
  } finally {
    process.exit(0)
  }
}

resetMilvusCollection()
  .catch(err => {
    console.error('💥 失败:', err)
    process.exit(1)
  })
