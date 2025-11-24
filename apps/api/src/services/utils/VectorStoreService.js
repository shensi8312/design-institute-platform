/**
 * 向量存储服务统一接口
 * 支持多种向量数据库后端: Milvus, Chroma, pgvector
 */
class VectorStoreService {
  constructor(backend = null) {
    this.backend = backend || process.env.VECTOR_STORE_BACKEND || 'milvus'
    this.client = null
  }

  /**
   * 初始化向量存储客户端
   */
  async initialize() {
    try {
      switch (this.backend) {
        case 'milvus':
          const MilvusClient = require('./MilvusClient')
          this.client = new MilvusClient()
          break

        case 'chroma':
          const ChromaClient = require('./ChromaClient')
          this.client = new ChromaClient()
          break

        case 'pgvector':
          const PgVectorClient = require('./PgVectorClient')
          this.client = new PgVectorClient()
          break

        default:
          throw new Error(`不支持的向量存储后端: ${this.backend}`)
      }

      await this.client.initialize()
      console.log(`✅ 向量存储初始化成功: ${this.backend}`)
      return this.client
    } catch (error) {
      console.error(`[VectorStore] ${this.backend} 初始化失败:`, error)
      throw error
    }
  }

  /**
   * 插入或更新向量
   */
  async upsert(chunks) {
    if (!this.client) {
      await this.initialize()
    }
    return await this.client.upsert(chunks)
  }

  /**
   * 搜索向量
   */
  async search(query, filterObj = {}, limit = 10) {
    if (!this.client) {
      await this.initialize()
    }
    return await this.client.search(query, filterObj, limit)
  }

  /**
   * 删除向量
   */
  async delete(ids) {
    if (!this.client) {
      await this.initialize()
    }
    return await this.client.delete(ids)
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    if (!this.client) {
      return { status: 'not_initialized', backend: this.backend }
    }
    return await this.client.healthCheck()
  }

  /**
   * 关闭连接
   */
  async close() {
    if (this.client) {
      await this.client.close()
    }
  }
}

module.exports = VectorStoreService
