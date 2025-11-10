const BaseRepository = require('./BaseRepository')

/**
 * 向量索引Repository
 */
class VectorRepository extends BaseRepository {
  constructor() {
    super('knowledge_vectors')
  }

  /**
   * 批量插入向量记录
   */
  async batchInsertVectors(vectors) {
    return await this.db(this.tableName).insert(vectors).returning('*')
  }

  /**
   * 获取文档的所有向量
   */
  async getVectorsByDocId(docId) {
    return await this.db(this.tableName)
      .where('document_id', docId)
      .orderBy('chunk_index', 'asc')
  }

  /**
   * 获取特定版本的向量
   */
  async getVectorsByVersionId(versionId) {
    return await this.db(this.tableName)
      .where('version_id', versionId)
      .orderBy('chunk_index', 'asc')
  }

  /**
   * 删除文档的所有向量
   */
  async deleteByDocId(docId) {
    return await this.db(this.tableName)
      .where('document_id', docId)
      .delete()
  }

  /**
   * 删除特定版本的向量
   */
  async deleteByVersionId(versionId) {
    return await this.db(this.tableName)
      .where('version_id', versionId)
      .delete()
  }

  /**
   * 根据Milvus ID查询向量记录
   */
  async getByMilvusId(milvusId) {
    return await this.db(this.tableName)
      .where('milvus_id', milvusId)
      .first()
  }

  /**
   * 批量根据Milvus ID查询向量记录
   */
  async getByMilvusIds(milvusIds) {
    return await this.db(this.tableName)
      .whereIn('milvus_id', milvusIds)
  }

  /**
   * 获取文档的向量统计
   */
  async getVectorStats(docId) {
    const result = await this.db(this.tableName)
      .where('document_id', docId)
      .count('* as total')
      .first()

    return {
      total: parseInt(result.total) || 0
    }
  }
}

module.exports = VectorRepository
