const db = require('../../config/database')

/**
 * 文档处理错误日志服务
 */
class DocumentErrorLogger {
  /**
   * 记录错误
   * @param {Object} errorInfo
   * @param {string} errorInfo.documentId - 文档ID
   * @param {string} errorInfo.errorStage - 错误阶段（parsing/ocr/vectorization/graph_extraction/rule_extraction/yolo）
   * @param {string} errorInfo.errorType - 错误类型
   * @param {string} errorInfo.errorMessage - 错误消息
   * @param {Object} errorInfo.errorDetails - 详细错误信息（堆栈、上下文等）
   * @param {number} errorInfo.maxRetries - 最大重试次数（默认3次）
   */
  async logError(errorInfo) {
    try {
      const {
        documentId,
        errorStage,
        errorType,
        errorMessage,
        errorDetails = {},
        maxRetries = 3
      } = errorInfo

      const [error] = await db('document_processing_errors')
        .insert({
          document_id: documentId,
          error_stage: errorStage,
          error_type: errorType,
          error_message: errorMessage,
          error_details: JSON.stringify(errorDetails),
          retry_count: 0,
          max_retries: maxRetries,
          retry_status: 'pending',
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*')

      console.log(`[ErrorLogger] 已记录错误: ${documentId} - ${errorStage} - ${errorType}`)

      return error
    } catch (error) {
      console.error('[ErrorLogger] 记录错误失败:', error.message)
      return null
    }
  }

  /**
   * 获取文档的所有错误
   * @param {string} documentId
   */
  async getDocumentErrors(documentId) {
    try {
      const errors = await db('document_processing_errors')
        .where({ document_id: documentId })
        .orderBy('created_at', 'desc')

      return errors
    } catch (error) {
      console.error('[ErrorLogger] 获取文档错误失败:', error.message)
      return []
    }
  }

  /**
   * 获取需要重试的错误
   * @param {number} limit - 返回数量限制
   */
  async getRetryableErrors(limit = 10) {
    try {
      const errors = await db('document_processing_errors')
        .where('retry_status', 'pending')
        .whereRaw('retry_count < max_retries')
        .orderBy('created_at', 'asc')
        .limit(limit)

      return errors
    } catch (error) {
      console.error('[ErrorLogger] 获取可重试错误失败:', error.message)
      return []
    }
  }

  /**
   * 更新重试状态
   * @param {string} errorId
   * @param {string} status - 'retrying', 'success', 'abandoned'
   */
  async updateRetryStatus(errorId, status) {
    try {
      await db('document_processing_errors')
        .where({ id: errorId })
        .update({
          retry_status: status,
          retry_count: db.raw('retry_count + 1'),
          last_retry_at: new Date(),
          updated_at: new Date()
        })

      console.log(`[ErrorLogger] 更新重试状态: ${errorId} -> ${status}`)
    } catch (error) {
      console.error('[ErrorLogger] 更新重试状态失败:', error.message)
    }
  }

  /**
   * 标记错误为已解决
   * @param {string} errorId
   */
  async markAsResolved(errorId) {
    return await this.updateRetryStatus(errorId, 'success')
  }

  /**
   * 标记错误为已放弃（超过重试次数）
   * @param {string} errorId
   */
  async markAsAbandoned(errorId) {
    return await this.updateRetryStatus(errorId, 'abandoned')
  }

  /**
   * 获取错误统计
   */
  async getErrorStats() {
    try {
      const stats = await db('document_processing_errors')
        .select('error_stage')
        .count('* as count')
        .groupBy('error_stage')

      const retryStats = await db('document_processing_errors')
        .select('retry_status')
        .count('* as count')
        .groupBy('retry_status')

      return {
        byStage: stats,
        byRetryStatus: retryStats
      }
    } catch (error) {
      console.error('[ErrorLogger] 获取错误统计失败:', error.message)
      return { byStage: [], byRetryStatus: [] }
    }
  }

  /**
   * 清理旧错误记录（超过30天的已解决错误）
   */
  async cleanupOldErrors() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      const deleted = await db('document_processing_errors')
        .where('retry_status', 'success')
        .where('updated_at', '<', thirtyDaysAgo)
        .del()

      console.log(`[ErrorLogger] 清理了${deleted}条旧错误记录`)

      return deleted
    } catch (error) {
      console.error('[ErrorLogger] 清理旧错误记录失败:', error.message)
      return 0
    }
  }
}

module.exports = DocumentErrorLogger
