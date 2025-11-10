const RAGService = require('../services/rag/RAGService')

class RAGController {
  constructor() {
    this.ragService = new RAGService()
  }

  /**
   * 初始化RAG服务
   */
  async initialize(req, res) {
    try {
      const result = await this.ragService.initialize()

      if (result.success) {
        return res.json({
          success: true,
          message: 'RAG服务初始化成功'
        })
      } else {
        return res.status(500).json({
          success: false,
          message: result.error
        })
      }
    } catch (error) {
      console.error('初始化RAG服务失败:', error)
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * 处理文档向量化
   * POST /api/rag/process-document
   */
  async processDocument(req, res) {
    try {
      const { document_id } = req.body

      if (!document_id) {
        return res.status(400).json({
          success: false,
          message: '文档ID不能为空'
        })
      }

      console.log(`开始处理文档向量化: ${document_id}`)

      const result = await this.ragService.processUploadedDocument(document_id)

      if (result.success) {
        return res.json({
          success: true,
          data: result,
          message: '文档处理成功'
        })
      } else {
        return res.status(500).json({
          success: false,
          message: result.error
        })
      }
    } catch (error) {
      console.error('处理文档失败:', error)
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * RAG检索
   * POST /api/rag/retrieve
   */
  async retrieve(req, res) {
    try {
      const { query, kb_id, top_k = 5 } = req.body
      const userId = req.user?.id

      if (!query) {
        return res.status(400).json({
          success: false,
          message: '查询内容不能为空'
        })
      }

      const result = await this.ragService.retrieve(query, kb_id, top_k, userId)

      if (result.success) {
        return res.json({
          success: true,
          data: result
        })
      } else {
        return res.status(500).json({
          success: false,
          message: result.error
        })
      }
    } catch (error) {
      console.error('RAG检索失败:', error)
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * RAG问答 - 完整流程
   * POST /api/rag/query
   */
  async query(req, res) {
    try {
      const { question, kb_id, conversation_history = [] } = req.body
      const userId = req.user?.id

      if (!question) {
        return res.status(400).json({
          success: false,
          message: '问题不能为空'
        })
      }

      console.log(`RAG查询: ${question}`)

      const result = await this.ragService.query(
        question,
        kb_id,
        conversation_history,
        userId
      )

      if (result.success) {
        return res.json({
          success: true,
          data: result
        })
      } else {
        return res.status(500).json({
          success: false,
          message: result.error
        })
      }
    } catch (error) {
      console.error('RAG查询失败:', error)
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }

  /**
   * RAG流式问答
   * POST /api/rag/query-stream
   */
  async queryStream(req, res) {
    try {
      const { question, kb_id, conversation_history = [] } = req.body

      if (!question) {
        return res.status(400).json({
          success: false,
          message: '问题不能为空'
        })
      }

      // 设置SSE响应头
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      console.log(`RAG流式查询: ${question}`)

      // 流式处理回调
      await this.ragService.queryStream(
        question,
        kb_id,
        conversation_history,
        (chunk) => {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`)
        }
      )

      res.end()
    } catch (error) {
      console.error('RAG流式查询失败:', error)
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`)
      res.end()
    }
  }

  /**
   * 聊天接口 - 带会话管理
   * POST /api/rag/chat
   */
  async chat(req, res) {
    try {
      const { message, kb_id, conversation_id } = req.body
      const userId = req.user?.id

      if (!message) {
        return res.status(400).json({
          success: false,
          message: '消息不能为空'
        })
      }

      // TODO: 从数据库加载会话历史
      const conversationHistory = []

      const result = await this.ragService.query(
        message,
        kb_id,
        conversationHistory,
        userId
      )

      if (result.success) {
        // TODO: 保存会话消息到数据库
        return res.json({
          success: true,
          data: {
            answer: result.answer,
            sources: result.sources,
            conversation_id: conversation_id
          }
        })
      } else {
        return res.status(500).json({
          success: false,
          message: result.error
        })
      }
    } catch (error) {
      console.error('聊天失败:', error)
      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  }
}

module.exports = new RAGController()
