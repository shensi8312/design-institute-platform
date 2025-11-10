const { MilvusClient } = require('@zilliz/milvus2-sdk-node')

async function resetMilvus() {
  console.log('🔄 重置Milvus集合...')

  const client = new MilvusClient({
    address: 'localhost:19530'
  })

  try {
    // 1. 删除旧集合
    const collectionName = 'knowledge_vectors'

    const hasCollection = await client.hasCollection({
      collection_name: collectionName
    })

    if (hasCollection.value) {
      console.log(`删除旧集合: ${collectionName}`)
      await client.dropCollection({
        collection_name: collectionName
      })
      console.log('✅ 旧集合已删除')
    } else {
      console.log('ℹ️  集合不存在,无需删除')
    }

    // 2. 创建新集合 (768维)
    console.log('创建新集合 (768维)...')

    await client.createCollection({
      collection_name: collectionName,
      fields: [
        {
          name: 'id',
          data_type: 5, // Int64
          is_primary_key: true,
          autoID: true
        },
        {
          name: 'document_id',
          data_type: 21, // VarChar
          max_length: 100
        },
        {
          name: 'chunk_index',
          data_type: 5 // Int64
        },
        {
          name: 'chunk_text',
          data_type: 21, // VarChar
          max_length: 65535
        },
        {
          name: 'embedding',
          data_type: 101, // FloatVector
          dim: 768  // nomic-embed-text 维度
        }
      ],
      enable_dynamic_field: true
    })

    console.log('✅ 集合创建成功')

    // 3. 创建索引
    console.log('创建索引...')

    await client.createIndex({
      collection_name: collectionName,
      field_name: 'embedding',
      index_type: 'IVF_FLAT',
      metric_type: 'IP',
      params: { nlist: 128 }
    })

    console.log('✅ 索引创建成功')

    // 4. 集合创建完成(Milvus会自动加载)
    console.log('✅ 集合已就绪(自动加载)')
    console.log('\n🎉 Milvus重置完成!')

  } catch (error) {
    console.error('❌ 重置失败:', error)
    process.exit(1)
  } finally {
    await client.closeConnection()
    process.exit(0)
  }
}

resetMilvus()
