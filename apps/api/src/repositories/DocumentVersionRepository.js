const BaseRepository = require('./BaseRepository')

/**
 * 文档版本Repository
 */
class DocumentVersionRepository extends BaseRepository {
  constructor() {
    super('knowledge_document_versions')
  }

  /**
   * 创建新版本
   */
  async createVersion(versionData) {
    const version = await this.create(versionData)

    // 将同一文档的其他版本设置为非当前版本
    if (versionData.is_current) {
      await this.db(this.tableName)
        .where('document_id', versionData.document_id)
        .where('id', '!=', version.id)
        .update({ is_current: false })
    }

    return version
  }

  /**
   * 获取文档的所有版本
   */
  async getVersionsByDocId(docId) {
    return await this.db(this.tableName)
      .where('document_id', docId)
      .orderBy('version_number', 'desc')
  }

  /**
   * 获取文档的当前版本
   */
  async getCurrentVersion(docId) {
    return await this.db(this.tableName)
      .where('document_id', docId)
      .where('is_current', true)
      .first()
  }

  /**
   * 获取文档的特定版本
   */
  async getVersionByNumber(docId, versionNumber) {
    return await this.db(this.tableName)
      .where('document_id', docId)
      .where('version_number', versionNumber)
      .first()
  }

  /**
   * 切换到特定版本
   */
  async switchToVersion(docId, versionId) {
    // 1. 将所有版本设置为非当前
    await this.db(this.tableName)
      .where('document_id', docId)
      .update({ is_current: false })

    // 2. 将指定版本设置为当前
    const version = await this.update(versionId, { is_current: true })

    // 3. 更新主文档表的current_version
    if (version) {
      await this.db('knowledge_documents')
        .where('id', docId)
        .update({ current_version: version.version_number })
    }

    return version
  }

  /**
   * 获取下一个版本号
   */
  async getNextVersionNumber(docId) {
    const result = await this.db(this.tableName)
      .where('document_id', docId)
      .max('version_number as max_version')
      .first()

    return (result.max_version || 0) + 1
  }

  /**
   * 检查文件哈希是否已存在（避免重复上传相同文件）
   */
  async checkDuplicateByHash(docId, fileHash) {
    return await this.db(this.tableName)
      .where('document_id', docId)
      .where('file_hash', fileHash)
      .first()
  }

  /**
   * 删除旧版本（保留最近N个版本）
   */
  async deleteOldVersions(docId, keepCount = 10) {
    // 获取所有版本，按版本号倒序
    const versions = await this.getVersionsByDocId(docId)

    // 如果版本数不超过保留数，不删除
    if (versions.length <= keepCount) {
      return { deleted: 0 }
    }

    // 获取要删除的版本ID
    const versionsToDelete = versions.slice(keepCount).map(v => v.id)

    // 删除旧版本
    const deleted = await this.db(this.tableName)
      .whereIn('id', versionsToDelete)
      .delete()

    return { deleted, versions: versionsToDelete }
  }
}

module.exports = DocumentVersionRepository
