const { MilvusClient } = require('@zilliz/milvus2-sdk-node')

/**
 * Milvus向量数据库服务
 */
class MilvusService {
  constructor() {
    this.collectionName = process.env.MILVUS_COLLECTION || 'knowledge_vectors'
    this.dimension = 768 // nomic-embed-text 的向量维度 (Ollama)

    // Milvus连接配置
    this.client = new MilvusClient({
      address: process.env.MILVUS_ADDRESS || process.env.MILVUS_HOST || 'localhost:19530',
      username: process.env.MILVUS_USERNAME || '',
      password: process.env.MILVUS_PASSWORD || ''
    })
  }

  /**
   * 初始化集合
   */
  async initCollection() {
    try {
      console.log(`检查Milvus集合: ${this.collectionName}`)

      // 1. 检查集合是否存在
      const hasCollection = await this.client.hasCollection({
        collection_name: this.collectionName
      })

      if (hasCollection.value) {
        console.log('✅ 集合已存在')
        return { success: true, message: '集合已存在' }
      }

      // 2. 创建集合
      console.log('创建新集合...')

      await this.client.createCollection({
        collection_name: this.collectionName,
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
            dim: this.dimension
          }
        ],
        enable_dynamic_field: true
      })

      // 3. 创建索引
      await this.client.createIndex({
        collection_name: this.collectionName,
        field_name: 'embedding',
        index_type: 'IVF_FLAT',
        metric_type: 'IP', // 内积距离
        params: { nlist: 128 }
      })

      // 4. 加载集合
      await this.client.loadCollection({
        collection_name: this.collectionName
      })

      console.log('✅ 集合创建成功')

      return { success: true, message: '集合创建成功' }
    } catch (error) {
      console.error('初始化集合失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 插入向量
   */
  async insertVectors(chunks) {
    try {
      if (!chunks || chunks.length === 0) {
        return { success: false, error: '没有要插入的数据' }
      }

      console.log(`向Milvus插入${chunks.length}条向量...`)

      const data = chunks.map(chunk => ({
        document_id: chunk.document_id,
        chunk_index: chunk.chunk_index,
        chunk_text: chunk.chunk_text,
        embedding: chunk.embedding,
        kb_id: chunk.kb_id,
        metadata: JSON.stringify(chunk.metadata || {})
      }))

      const result = await this.client.insert({
        collection_name: this.collectionName,
        data: data
      })

      // 刷新以确保数据持久化
      await this.client.flush({
        collection_names: [this.collectionName]
      })

      console.log(`✅ 成功插入${result.insert_cnt}条向量`)

      return {
        success: true,
        insert_count: result.insert_cnt,
        ids: result.IDs?.int_id?.data || result.IDs || []  // Milvus 2.x返回的ID格式
      }
    } catch (error) {
      console.error('插入向量失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 向量检索
   */
  async search(queryEmbedding, topK = 5, filter = null) {
    try {
      const searchParams = {
        collection_name: this.collectionName,
        data: [queryEmbedding],  // 使用data而不是vectors
        limit: topK,
        output_fields: ['document_id', 'chunk_index', 'chunk_text', 'kb_id', 'metadata'],
        params: { nprobe: 10 }
      }

      if (filter) {
        searchParams.filter = filter
      }

      console.log(`Milvus搜索参数: limit=${topK}, filter=${filter || 'none'}`)

      const results = await this.client.search(searchParams)

      console.log(`Milvus原始结果:`, JSON.stringify(results).substring(0, 200))

      // 格式化结果
      const formattedResults = results.results?.map(item => ({
        id: item.id,
        document_id: item.document_id,
        chunk_index: item.chunk_index,
        chunk_text: item.chunk_text,
        kb_id: item.kb_id,
        score: item.score,
        metadata: typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata
      })) || []

      return {
        success: true,
        results: formattedResults
      }
    } catch (error) {
      console.error('向量检索失败:', error)
      return {
        success: false,
        error: error.message,
        results: []
      }
    }
  }

  /**
   * 删除文档的所有向量
   */
  async deleteByDocumentId(documentId) {
    try {
      await this.client.delete({
        collection_name: this.collectionName,
        filter: `document_id == "${documentId}"`
      })

      console.log(`✅ 已删除文档${documentId}的所有向量`)

      return { success: true }
    } catch (error) {
      console.error('删除向量失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

module.exports = MilvusService
