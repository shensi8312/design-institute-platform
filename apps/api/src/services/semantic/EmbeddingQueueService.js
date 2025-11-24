/**
 * Embedding 队列服务 (简化版)
 * 用于异步生成 embedding
 */

class EmbeddingQueueService {
  async initialize() {
    console.log('✅ EmbeddingQueue 初始化 (Mock)')
    return true
  }

  async enqueue(chunkIds) {
    console.log(`[EmbeddingQueue] 加入队列: ${chunkIds.length} 个任务`)
    return { success: true, queued: chunkIds.length }
  }

  async getStats() {
    return {
      pending: 0,
      processing: 0,
      completed: 0
    }
  }
}

module.exports = new EmbeddingQueueService()
