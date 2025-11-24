const axios = require('axios')

/**
 * 文本嵌入服务 - 负责文本分块和向量生成
 */
class EmbeddingService {
  constructor() {
    // Embedding API配置 - 必须从环境变量读取
    if (!process.env.EMBEDDING_API_BASE) {
      throw new Error('环境变量 EMBEDDING_API_BASE 未配置')
    }
    if (!process.env.EMBEDDING_MODEL) {
      throw new Error('环境变量 EMBEDDING_MODEL 未配置')
    }

    this.apiBase = process.env.EMBEDDING_API_BASE
    this.apiKey = process.env.EMBEDDING_API_KEY || 'sk-test'
    this.embeddingModel = process.env.EMBEDDING_MODEL

    // 分块参数
    this.chunkSize = 500 // 每块字符数
    this.chunkOverlap = 50 // 重叠字符数
  }

  /**
   * 文本分块
   */
  chunkText(text, chunkSize = this.chunkSize, overlap = this.chunkOverlap) {
    const chunks = []
    let position = 0

    while (position < text.length) {
      let end = position + chunkSize

      // 尝试在句子边界分块
      if (end < text.length) {
        const sentenceEnds = ['。', '！', '？', '\\n', '；']
        for (let i = end; i > position + chunkSize / 2; i--) {
          if (sentenceEnds.includes(text[i])) {
            end = i + 1
            break
          }
        }
      }

      const chunk = text.slice(position, end).trim()
      if (chunk.length > 0) {
        chunks.push(chunk)
      }

      position = end - overlap
    }

    return chunks
  }

  /**
   * 生成单个文本的向量
   */
  async generateEmbedding(text) {
    try {
      // 截断超长文本
      const maxLength = 2000
      const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text

      const response = await axios.post(
        `${this.apiBase}/embeddings`,
        {
          model: this.embeddingModel,
          input: truncatedText
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      )

      if (!response.data || !response.data.data || !response.data.data[0]) {
        throw new Error('Embedding响应格式错误')
      }

      return {
        success: true,
        embedding: response.data.data[0].embedding
      }
    } catch (error) {
      console.error('生成向量失败:', error.message)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 批量生成向量
   */
  async generateBatchEmbeddings(texts) {
    const results = []

    for (let i = 0; i < texts.length; i++) {
      const result = await this.generateEmbedding(texts[i])
      results.push(result)

      // 避免请求过快
      if (i < texts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return results
  }

  /**
   * 处理文档 - 分块并生成向量
   */
  async processDocument(document, content) {
    try {
      console.log(`处理文档: ${document.name}`)

      // 1. 文本分块
      const textChunks = this.chunkText(content)
      console.log(`生成了${textChunks.length}个文本块`)

      if (textChunks.length === 0) {
        return {
          success: false,
          error: '没有有效的文本内容'
        }
      }

      // 2. 生成向量
      const chunks = []
      for (let i = 0; i < textChunks.length; i++) {
        const chunk = textChunks[i]

        const embResult = await this.generateEmbedding(chunk)

        if (embResult.success) {
          chunks.push({
            document_id: document.id,
            chunk_index: i,
            chunk_text: chunk,
            embedding: embResult.embedding,
            kb_id: document.kb_id || null,
            metadata: {
              document_name: document.name,
              file_type: document.file_type,
              chunk_length: chunk.length
            }
          })

          console.log(`  ✓ 块${i + 1}/${textChunks.length} 向量化完成`)
        } else {
          console.warn(`  ✗ 块${i + 1} 向量化失败:`, embResult.error)
        }

        // 限速
        if (i < textChunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      return {
        success: true,
        chunks: chunks
      }
    } catch (error) {
      console.error('处理文档失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

module.exports = EmbeddingService
