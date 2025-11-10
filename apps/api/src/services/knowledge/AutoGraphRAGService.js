/**
 * 自动GraphRAG处理服务
 * 监听文档向量化完成事件，自动触发知识图谱提取
 */

const axios = require('axios')
const db = require('../../config/database')
const DocumentProcessorService = require('../document/DocumentProcessorService')

class AutoGraphRAGService {
  /**
   * 处理新上传的文档 - 完整流程（向量化 + 图谱提取）
   */
  static async processDocument(docId) {
    try {
      console.log(`🔄 开始完整处理文档: ${docId}`)

      // 调用DocumentProcessorService的完整处理流程
      // 这包括：PDF解析、文本分块、向量化、Milvus插入、图谱提取
      const processor = new DocumentProcessorService()
      await processor.processDocument(docId)

      console.log(`✅ 文档处理完成: ${docId}`)
      return true

    } catch (error) {
      console.error(`❌ 文档处理失败: ${docId}`, error.message)
      return false
    }
  }
  
  /**
   * 批量处理待处理的文档
   */
  static async processPendingDocuments() {
    try {
      // 查找vectorization_status为pending或graph_extraction_status为pending的文档
      const pendingDocs = await db('knowledge_documents')
        .where(function() {
          this.where('vectorization_status', 'pending')
              .orWhere('graph_extraction_status', 'pending')
        })
        .whereNotNull('minio_path')  // 确保文件存在
        .limit(10)
      
      console.log(`📋 找到 ${pendingDocs.length} 个待处理文档`)
      
      for (const doc of pendingDocs) {
        await this.processDocument(doc.id)
        // 避免过快处理
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      return pendingDocs.length
    } catch (error) {
      console.error('批量处理失败:', error)
      return 0
    }
  }
  
  /**
   * 启动自动处理定时器
   */
  static startAutoProcessor() {
    // 每30秒检查一次
    setInterval(async () => {
      await this.processPendingDocuments()
    }, 30000)
    
    // 立即执行一次
    this.processPendingDocuments()
    
    console.log('🤖 GraphRAG自动处理服务已启动')
  }
}

module.exports = AutoGraphRAGService