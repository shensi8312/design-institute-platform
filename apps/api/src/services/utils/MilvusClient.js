const { MilvusClient: MilvusSDK } = require('@zilliz/milvus2-sdk-node')
const EmbeddingService = require('../rag/EmbeddingService')

/**
 * Milvus 向量数据库客户端
 * 统一接口实现
 */
class MilvusClient {
  constructor(options = {}) {
    const {
      host = process.env.MILVUS_HOST || 'localhost',
      port = process.env.MILVUS_PORT || 19530,
      collectionName = process.env.MILVUS_COLLECTION || 'semantic_chunks',
      dimension = 768
    } = options

    this.host = host
    this.port = port
    this.collectionName = collectionName
    this.dimension = dimension
    this.client = null
    this.embeddingService = new EmbeddingService()
  }

  /**
   * 初始化连接
   */
  async initialize() {
    try {
      this.client = new MilvusSDK({
        address: `${this.host}:${this.port}`
      })

      // 检查 collection 是否存在
      const hasCollection = await this.client.hasCollection({
        collection_name: this.collectionName
      })

      if (!hasCollection.value) {
        console.log(`[Milvus] 创建 collection: ${this.collectionName}`)
        await this._createCollection()
      } else {
        console.log(`[Milvus] 连接到现有 collection: ${this.collectionName}`)
      }

      // 加载 collection
      await this.client.loadCollection({
        collection_name: this.collectionName
      })

      console.log(`✅ Milvus 客户端初始化成功: ${this.host}:${this.port}`)
      return true
    } catch (error) {
      console.error('[Milvus] 初始化失败:', error)
      throw error
    }
  }

  /**
   * 创建 collection
   */
  async _createCollection() {
    const schema = {
      collection_name: this.collectionName,
      description: 'Semantic chunks for unified document processing',
      fields: [
        {
          name: 'id',
          data_type: 21, // VarChar
          max_length: 100,
          is_primary_key: true,
          autoID: false
        },
        {
          name: 'text',
          data_type: 21, // VarChar
          max_length: 65535
        },
        {
          name: 'domain',
          data_type: 21, // VarChar
          max_length: 50
        },
        {
          name: 'type',
          data_type: 21, // VarChar
          max_length: 50
        },
        {
          name: 'tenant_id',
          data_type: 21, // VarChar
          max_length: 100
        },
        {
          name: 'project_id',
          data_type: 21, // VarChar
          max_length: 100
        },
        {
          name: 'metadata',
          data_type: 21, // VarChar (JSON 序列化)
          max_length: 65535
        },
        {
          name: 'embedding',
          data_type: 101, // FloatVector
          dim: this.dimension
        }
      ],
      enable_dynamic_field: false
    }

    await this.client.createCollection(schema)

    // 创建索引
    await this.client.createIndex({
      collection_name: this.collectionName,
      field_name: 'embedding',
      index_type: 'IVF_FLAT',
      metric_type: 'IP', // Inner Product (cosine similarity when normalized)
      params: { nlist: 128 }
    })

    console.log(`[Milvus] Collection 创建成功: ${this.collectionName}`)
  }

  /**
   * 插入或更新向量
   */
  async upsert(chunks) {
    try {
      if (!Array.isArray(chunks) || chunks.length === 0) {
        return { success: true, count: 0 }
      }

      const data = []

      for (const chunk of chunks) {
        // 确保有 embedding
        if (!chunk.embedding || chunk.embedding.length === 0) {
          console.warn(`[Milvus] Chunk ${chunk.id} 缺少 embedding, 生成中...`)
          chunk.embedding = await this._generateEmbedding(chunk.text)
        }

        data.push({
          id: chunk.id,
          text: chunk.text,
          domain: chunk.domain,
          type: chunk.type,
          tenant_id: chunk.metadata?.tenant_id || '',
          project_id: chunk.metadata?.project_id || '',
          metadata: JSON.stringify(chunk.metadata || {}),
          embedding: chunk.embedding
        })
      }

      // Milvus upsert
      await this.client.upsert({
        collection_name: this.collectionName,
        data: data
      })

      console.log(`[Milvus] 成功插入/更新 ${chunks.length} 个向量`)
      return { success: true, count: chunks.length }
    } catch (error) {
      console.error('[Milvus] 插入失败:', error)
      throw error
    }
  }

  /**
   * 向量搜索
   */
  async search(query, filterObj = {}, limit = 10) {
    try {
      const queryEmbedding = await this._generateEmbedding(query)

      // 构建过滤表达式
      const filter = this._buildFilterExpression(filterObj)

      const searchParams = {
        collection_name: this.collectionName,
        data: [queryEmbedding],
        limit: limit,
        output_fields: ['id', 'text', 'domain', 'type', 'metadata'],
        params: { nprobe: 10 }
      }

      if (filter) {
        searchParams.filter = filter
      }

      const results = await this.client.search(searchParams)

      // 转换为统一格式
      const formattedResults = []
      if (results.results && results.results.length > 0) {
        for (const result of results.results) {
          formattedResults.push({
            id: result.id,
            text: result.text,
            score: result.score,
            domain: result.domain,
            type: result.type,
            metadata: result.metadata ? JSON.parse(result.metadata) : {}
          })
        }
      }

      return formattedResults
    } catch (error) {
      console.error('[Milvus] 搜索失败:', error)
      throw error
    }
  }

  /**
   * 删除向量
   */
  async delete(ids) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return { success: true, count: 0 }
      }

      // 构建删除表达式
      const expr = `id in [${ids.map(id => `"${id}"`).join(',')}]`

      await this.client.delete({
        collection_name: this.collectionName,
        filter: expr
      })

      console.log(`[Milvus] 成功删除 ${ids.length} 个向量`)
      return { success: true, count: ids.length }
    } catch (error) {
      console.error('[Milvus] 删除失败:', error)
      throw error
    }
  }

  /**
   * 构建 Milvus 过滤表达式
   */
  _buildFilterExpression(filterObj) {
    const conditions = []

    if (filterObj.domain) {
      conditions.push(`domain == "${filterObj.domain}"`)
    }

    if (filterObj.type) {
      conditions.push(`type == "${filterObj.type}"`)
    }

    if (filterObj.tenantId) {
      conditions.push(`tenant_id == "${filterObj.tenantId}"`)
    }

    if (filterObj.projectId) {
      conditions.push(`project_id == "${filterObj.projectId}"`)
    }

    return conditions.length > 0 ? conditions.join(' && ') : null
  }

  /**
   * 生成 embedding
   */
  async _generateEmbedding(text) {
    try {
      const embedding = await this.embeddingService.generateEmbedding(text)
      return embedding
    } catch (error) {
      console.error('[Milvus] Embedding 生成失败:', error)
      throw error
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const stats = await this.client.getCollectionStatistics({
        collection_name: this.collectionName
      })

      return {
        status: 'ok',
        backend: 'milvus',
        collection: this.collectionName,
        stats: stats.data
      }
    } catch (error) {
      return {
        status: 'error',
        backend: 'milvus',
        error: error.message
      }
    }
  }

  /**
   * 关闭连接
   */
  async close() {
    console.log('[Milvus] 连接已关闭')
  }
}

module.exports = MilvusClient
