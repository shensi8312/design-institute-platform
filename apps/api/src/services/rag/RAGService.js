const EmbeddingService = require('./EmbeddingService')
const MilvusService = require('./MilvusService')
const axios = require('axios')
const db = require('../../config/database')

/**
 * RAG检索增强生成服务
 */
class RAGService {
  constructor() {
    this.embeddingService = new EmbeddingService()
    this.milvusService = new MilvusService()
    this.llmApiBase = process.env.OPENAI_API_BASE || 'http://10.10.18.2:8000/v1'
    this.llmApiKey = process.env.OPENAI_API_KEY || 'sk-test'
    this.llmModel = process.env.OPENAI_MODEL || 'Qwen3-32B'
  }

  /**
   * 初始化服务
   */
  async initialize() {
    console.log('初始化RAG服务...')
    const result = await this.milvusService.initCollection()
    if (result.success) {
      console.log('✅ RAG服务初始化成功')
    } else {
      console.error('❌ RAG服务初始化失败:', result.error)
    }
    return result
  }

  /**
   * 处理文档上传并向量化
   */
  async processUploadedDocument(documentId) {
    try {
      console.log(`\n开始处理文档: ${documentId}`)

      // 1. 获取文档信息
      const document = await db('knowledge_documents')
        .where({ id: documentId })
        .first()

      if (!document) {
        return { success: false, error: '文档不存在' }
      }

      console.log(`文档名称: ${document.name}`)

      // 2. 获取文档内容
      if (!document.content) {
        return { success: false, error: '文档内容为空' }
      }

      // 3. 文本分块并生成向量
      const result = await this.embeddingService.processDocument(
        document,
        document.content
      )

      if (!result.success) {
        throw new Error(result.error)
      }

      console.log(`生成了${result.chunks.length}个文本块的向量`)

      // 4. 存入Milvus
      if (result.chunks.length > 0) {
        const insertResult = await this.milvusService.insertVectors(result.chunks)

        if (!insertResult.success) {
          throw new Error(insertResult.error)
        }

        // 5. 更新文档状态
        await db('knowledge_documents')
          .where({ id: documentId })
          .update({
            vector_status: 'completed',
            vector_indexed_at: db.fn.now(),
            metadata: db.raw(`
              COALESCE(metadata, '{}'::jsonb) ||
              '{"chunk_count": ${result.chunks.length}}'::jsonb
            `)
          })

        console.log(`✅ 文档${documentId}处理完成`)

        return {
          success: true,
          document_id: documentId,
          chunks_created: result.chunks.length,
          message: '文档向量化完成'
        }
      } else {
        return {
          success: false,
          error: '未能生成有效的文本块'
        }
      }
    } catch (error) {
      console.error('处理文档失败:', error)

      // 更新失败状态
      await db('knowledge_documents')
        .where({ id: documentId })
        .update({ vector_status: 'failed' })

      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * RAG检索 - 查找相关文档
   */
  async retrieve(query, kbId = null, topK = 5, userId = null) {
    try {
      console.log(`\n🔍 RAG检索: ${query}`)

      // 1. 生成查询向量
      const queryEmbResult = await this.embeddingService.generateEmbedding(query)

      if (!queryEmbResult.success) {
        throw new Error('查询向量生成失败')
      }

      console.log('✅ 查询向量生成成功')

      // 2. 向量检索
      let filter = null
      if (kbId) {
        // 构建过滤条件 - 只检索指定知识库的文档
        const docs = await db('knowledge_documents')
          .where({ kb_id: kbId, vector_status: 'completed' })
          .select('id')

        if (docs.length === 0) {
          return {
            success: true,
            results: [],
            message: '知识库中没有已索引的文档'
          }
        }

        const docIds = docs.map(d => `"${d.id}"`).join(',')
        filter = `document_id in [${docIds}]`
      }

      const searchResult = await this.milvusService.search(
        queryEmbResult.embedding,
        topK,
        filter
      )

      if (!searchResult.success) {
        throw new Error(searchResult.error)
      }

      console.log(`✅ 检索到${searchResult.results.length}个相关文档块`)

      // 3. 获取文档详细信息并构建上下文
      const enrichedResults = await this.enrichResults(searchResult.results)

      return {
        success: true,
        results: enrichedResults,
        total: enrichedResults.length
      }
    } catch (error) {
      console.error('RAG检索失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 丰富检索结果 - 添加文档信息和上下文
   */
  async enrichResults(results) {
    const enriched = []

    for (const result of results) {
      // 获取文档信息
      const doc = await db('knowledge_documents')
        .where({ id: result.document_id })
        .first()

      if (doc) {
        enriched.push({
          ...result,
          document_name: doc.name,
          file_type: doc.file_type,
          kb_id: doc.kb_id,
          created_at: doc.created_at,
          // 来源引用
          source: {
            document_id: doc.id,
            document_name: doc.name,
            chunk_index: result.chunk_index,
            file_type: doc.file_type
          }
        })
      }
    }

    return enriched
  }

  /**
   * RAG生成 - 基于检索结果生成答案
   */
  async generate(query, retrievalResults, conversationHistory = []) {
    try {
      console.log(`\n🧠 RAG生成答案...`)

      // 1. 构建上下文
      const context = retrievalResults
        .map((r, i) => `[文档${i + 1}: ${r.document_name}]\n${r.chunk_text}`)
        .join('\n\n---\n\n')

      console.log(`上下文长度: ${context.length}字符`)

      // 2. 构建Prompt
      const systemPrompt = `你是一个专业的知识助手。请基于以下提供的文档内容回答用户问题。

重要规则:
1. 只使用提供的文档内容回答问题
2. 如果文档中没有相关信息，明确告知用户
3. 回答时引用具体的文档名称
4. 保持回答准确、专业、易懂

参考文档:
${context}

请基于以上文档回答用户问题。`

      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: query }
      ]

      // 3. 调用LLM生成答案
      console.log('调用LLM生成答案...')

      const response = await axios.post(
        `${this.llmApiBase}/chat/completions`,
        {
          model: this.llmModel,
          messages: messages,
          temperature: 0.7,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.llmApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      )

      if (!response.data || !response.data.choices || !response.data.choices[0]) {
        throw new Error('LLM响应格式错误')
      }

      const answer = response.data.choices[0].message.content

      console.log(`✅ 答案生成成功 (${answer.length}字符)`)

      // 4. 构建完整响应
      return {
        success: true,
        answer: answer,
        sources: retrievalResults.map(r => r.source),
        context_used: retrievalResults.length,
        model: this.llmModel
      }
    } catch (error) {
      console.error('RAG生成失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 完整的RAG查询流程
   */
  async query(question, kbId = null, conversationHistory = [], userId = null) {
    try {
      console.log('\n' + '='.repeat(80))
      console.log('🚀 RAG查询开始')
      console.log('='.repeat(80))

      // 1. 检索相关文档
      const retrievalResult = await this.retrieve(question, kbId, 5, userId)

      if (!retrievalResult.success) {
        throw new Error(retrievalResult.error)
      }

      if (retrievalResult.results.length === 0) {
        return {
          success: true,
          answer: '抱歉，我在知识库中没有找到相关信息来回答您的问题。',
          sources: [],
          retrieval_count: 0
        }
      }

      // 2. 生成答案
      const generationResult = await this.generate(
        question,
        retrievalResult.results,
        conversationHistory
      )

      if (!generationResult.success) {
        throw new Error(generationResult.error)
      }

      console.log('\n' + '='.repeat(80))
      console.log('✅ RAG查询完成')
      console.log('='.repeat(80) + '\n')

      return {
        success: true,
        answer: generationResult.answer,
        sources: generationResult.sources,
        retrieval_count: retrievalResult.results.length,
        model: generationResult.model
      }
    } catch (error) {
      console.error('RAG查询失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 流式RAG查询
   */
  async queryStream(question, kbId = null, conversationHistory = [], onChunk = null) {
    try {
      console.log('\n🚀 RAG流式查询开始')

      // 1. 检索相关文档
      const retrievalResult = await this.retrieve(question, kbId, 5)

      if (!retrievalResult.success || retrievalResult.results.length === 0) {
        if (onChunk) {
          onChunk({
            type: 'answer',
            content: '抱歉，我在知识库中没有找到相关信息。'
          })
          onChunk({ type: 'done', sources: [] })
        }
        return
      }

      // 发送来源信息
      if (onChunk) {
        onChunk({
          type: 'sources',
          sources: retrievalResult.results.map(r => r.source)
        })
      }

      // 2. 构建上下文和Prompt
      const context = retrievalResult.results
        .map((r, i) => `[文档${i + 1}: ${r.document_name}]\n${r.chunk_text}`)
        .join('\n\n---\n\n')

      const systemPrompt = `你是一个专业的知识助手。请基于以下提供的文档内容回答用户问题。

参考文档:
${context}

请基于以上文档回答用户问题。`

      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: question }
      ]

      // 3. 流式调用LLM
      const response = await axios.post(
        `${this.llmApiBase}/chat/completions`,
        {
          model: this.llmModel,
          messages: messages,
          temperature: 0.7,
          max_tokens: 2000,
          stream: true
        },
        {
          headers: {
            'Authorization': `Bearer ${this.llmApiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'stream',
          timeout: 60000
        }
      )

      // 处理流式响应
      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\n').filter(line => line.trim())

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                if (onChunk) {
                  onChunk({ type: 'done', sources: retrievalResult.results.map(r => r.source) })
                }
                resolve()
                return
              }

              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content
                if (content && onChunk) {
                  onChunk({ type: 'answer', content })
                }
              } catch (e) {
                // 忽略JSON解析错误
              }
            }
          }
        })

        response.data.on('error', reject)
      })
    } catch (error) {
      console.error('RAG流式查询失败:', error)
      throw error
    }
  }
}

module.exports = RAGService
