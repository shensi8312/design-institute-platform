const ChatService = require('../services/system/ChatService')

/**
 * 聊天Controller - 重构版
 * 使用Service层架构
 */
class ChatController {
  constructor() {
    this.chatService = new ChatService()
  }

  /**
   * 创建AI助手
   */
  async createAssistant(req, res) {
    try {
      const data = {
        ...req.body,
        owner_id: req.user.id,
        department_id: req.user.department_id,
        organization_id: req.user.organization_id
      }
      
      const result = await this.chatService.create(data)
      
      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('创建助手失败:', error)
      res.status(500).json({
        success: false,
        message: '创建助手失败',
        error: error.message
      })
    }
  }

  /**
   * 获取助手列表
   */
  async getAssistants(req, res) {
    try {
      const result = await this.chatService.getUserAssistants(req.user)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取助手列表失败:', error)
      res.status(500).json({
        success: false,
        message: '获取助手列表失败',
        error: error.message
      })
    }
  }

  /**
   * 获取单个助手信息
   */
  async getAssistant(req, res) {
    try {
      const { id } = req.params
      const assistant = await this.chatService.assistantRepository.findByIdWithDetails(id)
      
      if (!assistant) {
        return res.status(404).json({
          success: false,
          message: '助手不存在'
        })
      }
      
      res.json({
        success: true,
        data: assistant
      })
    } catch (error) {
      console.error('获取助手详情失败:', error)
      res.status(500).json({
        success: false,
        message: '获取助手详情失败',
        error: error.message
      })
    }
  }

  /**
   * 更新助手
   */
  async updateAssistant(req, res) {
    try {
      const { id } = req.params
      const data = {
        ...req.body,
        updated_by: req.user.id
      }
      
      const result = await this.chatService.update(id, data)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('更新助手失败:', error)
      res.status(500).json({
        success: false,
        message: '更新助手失败',
        error: error.message
      })
    }
  }

  /**
   * 删除助手
   */
  async deleteAssistant(req, res) {
    try {
      const { id } = req.params
      const result = await this.chatService.delete(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('删除助手失败:', error)
      res.status(500).json({
        success: false,
        message: '删除助手失败',
        error: error.message
      })
    }
  }

  /**
   * 创建会话
   */
  async createConversation(req, res) {
    try {
      const { assistantId, title } = req.body
      
      if (!assistantId) {
        return res.status(400).json({
          success: false,
          message: '助手ID不能为空'
        })
      }
      
      const result = await this.chatService.createConversation(
        assistantId,
        req.user.id,
        title
      )
      
      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('创建会话失败:', error)
      res.status(500).json({
        success: false,
        message: '创建会话失败',
        error: error.message
      })
    }
  }

  /**
   * 获取用户的会话列表
   */
  async getConversations(req, res) {
    try {
      const { page = 1, pageSize = 20, assistantId, status } = req.query
      const offset = (page - 1) * pageSize
      
      const conversations = await this.chatService.conversationRepository.findByUserId(
        req.user.id,
        {
          assistantId,
          status,
          limit: pageSize,
          offset
        }
      )
      
      const total = await this.chatService.conversationRepository.count({
        user_id: req.user.id,
        deleted_at: null
      })
      
      res.json({
        success: true,
        data: {
          list: conversations,
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        }
      })
    } catch (error) {
      console.error('获取会话列表失败:', error)
      res.status(500).json({
        success: false,
        message: '获取会话列表失败',
        error: error.message
      })
    }
  }

  /**
   * 获取会话详情
   */
  async getConversation(req, res) {
    try {
      const { id } = req.params
      const conversation = await this.chatService.conversationRepository.findByIdWithMessages(id)
      
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: '会话不存在'
        })
      }
      
      if (conversation.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: '无权限访问该会话'
        })
      }
      
      res.json({
        success: true,
        data: conversation
      })
    } catch (error) {
      console.error('获取会话详情失败:', error)
      res.status(500).json({
        success: false,
        message: '获取会话详情失败',
        error: error.message
      })
    }
  }

  /**
   * 发送消息
   */
  async sendMessage(req, res) {
    try {
      const { conversationId } = req.params
      const { content, useWorkflow } = req.body
      
      if (!content) {
        return res.status(400).json({
          success: false,
          message: '消息内容不能为空'
        })
      }
      
      const result = await this.chatService.sendMessage(
        conversationId,
        req.user.id,
        content,
        { useWorkflow }
      )
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('发送消息失败:', error)
      res.status(500).json({
        success: false,
        message: '发送消息失败',
        error: error.message
      })
    }
  }

  /**
   * 获取会话消息历史
   */
  async getMessages(req, res) {
    try {
      const { conversationId } = req.params
      const { page = 1, pageSize = 20 } = req.query
      const offset = (page - 1) * pageSize
      
      const result = await this.chatService.getConversationMessages(
        conversationId,
        req.user.id,
        {
          limit: pageSize,
          offset,
          order: 'desc'
        }
      )
      
      if (result.success) {
        // 反转消息顺序，最新的在最后
        result.data = result.data.reverse()
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取消息历史失败:', error)
      res.status(500).json({
        success: false,
        message: '获取消息历史失败',
        error: error.message
      })
    }
  }

  /**
   * 提供消息反馈
   */
  async provideFeedback(req, res) {
    try {
      const { messageId } = req.params
      const { rating, comment } = req.body
      
      if (!rating) {
        return res.status(400).json({
          success: false,
          message: '评分不能为空'
        })
      }
      
      const result = await this.chatService.provideFeedback(
        messageId,
        req.user.id,
        { rating, comment }
      )
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('提供反馈失败:', error)
      res.status(500).json({
        success: false,
        message: '提供反馈失败',
        error: error.message
      })
    }
  }

  /**
   * 删除会话
   */
  async deleteConversation(req, res) {
    try {
      const { id } = req.params
      const result = await this.chatService.deleteConversation(id, req.user.id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('删除会话失败:', error)
      res.status(500).json({
        success: false,
        message: '删除会话失败',
        error: error.message
      })
    }
  }

  /**
   * 导出会话
   */
  async exportConversation(req, res) {
    try {
      const { id } = req.params
      const { format = 'json' } = req.query
      
      const result = await this.chatService.exportConversation(
        id,
        req.user.id,
        format
      )
      
      if (!result.success) {
        return res.status(400).json(result)
      }
      
      if (format === 'markdown') {
        res.setHeader('Content-Type', 'text/markdown')
        res.setHeader('Content-Disposition', `attachment; filename=conversation_${id}.md`)
        res.send(result.data)
      } else {
        res.json(result)
      }
    } catch (error) {
      console.error('导出会话失败:', error)
      res.status(500).json({
        success: false,
        message: '导出会话失败',
        error: error.message
      })
    }
  }

  /**
   * 获取助手统计信息
   */
  async getAssistantStatistics(req, res) {
    try {
      const { id } = req.params
      const result = await this.chatService.getAssistantStatistics(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取助手统计失败:', error)
      res.status(500).json({
        success: false,
        message: '获取助手统计失败',
        error: error.message
      })
    }
  }

  /**
   * 清空会话
   */
  async clearConversation(req, res) {
    try {
      const { id } = req.params
      
      // 检查会话权限
      const conversation = await this.chatService.conversationRepository.findById(id)
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: '会话不存在'
        })
      }
      
      if (conversation.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: '无权限操作该会话'
        })
      }
      
      // 删除所有消息
      await this.chatService.messageRepository.db('chat_messages')
        .where('conversation_id', id)
        .delete()
      
      // 重置会话
      await this.chatService.conversationRepository.update(id, {
        message_count: 0,
        summary: null,
        updated_at: new Date()
      })
      
      res.json({
        success: true,
        message: '会话已清空'
      })
    } catch (error) {
      console.error('清空会话失败:', error)
      res.status(500).json({
        success: false,
        message: '清空会话失败',
        error: error.message
      })
    }
  }

  /**
   * 重新生成消息
   */
  async regenerateMessage(req, res) {
    try {
      const { messageId } = req.params
      
      // 获取消息信息
      const message = await this.chatService.messageRepository.findById(messageId)
      if (!message) {
        return res.status(404).json({
          success: false,
          message: '消息不存在'
        })
      }
      
      // 获取会话信息
      const conversation = await this.chatService.conversationRepository.findById(
        message.conversation_id
      )
      
      if (conversation.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: '无权限操作该消息'
        })
      }
      
      // 获取前一条用户消息
      const context = await this.chatService.messageRepository.getMessageContext(messageId, 1)
      const userMessage = context.before.find(m => m.role === 'user')
      
      if (!userMessage) {
        return res.status(400).json({
          success: false,
          message: '找不到对应的用户消息'
        })
      }
      
      // 删除当前AI消息
      await this.chatService.messageRepository.delete(messageId)
      
      // 重新发送消息
      const result = await this.chatService.sendMessage(
        conversation.id,
        req.user.id,
        userMessage.content
      )
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('重新生成消息失败:', error)
      res.status(500).json({
        success: false,
        message: '重新生成消息失败',
        error: error.message
      })
    }
  }
}

// 创建实例并导出
const controller = new ChatController()

module.exports = {
  // 助手相关
  createAssistant: (req, res) => controller.createAssistant(req, res),
  getAssistants: (req, res) => controller.getAssistants(req, res),
  getAssistant: (req, res) => controller.getAssistant(req, res),
  updateAssistant: (req, res) => controller.updateAssistant(req, res),
  deleteAssistant: (req, res) => controller.deleteAssistant(req, res),
  getAssistantStatistics: (req, res) => controller.getAssistantStatistics(req, res),
  
  // 会话相关
  createConversation: (req, res) => controller.createConversation(req, res),
  getConversations: (req, res) => controller.getConversations(req, res),
  getConversation: (req, res) => controller.getConversation(req, res),
  deleteConversation: (req, res) => controller.deleteConversation(req, res),
  clearConversation: (req, res) => controller.clearConversation(req, res),
  exportConversation: (req, res) => controller.exportConversation(req, res),
  
  // 消息相关
  sendMessage: (req, res) => controller.sendMessage(req, res),
  getMessages: (req, res) => controller.getMessages(req, res),
  regenerateMessage: (req, res) => controller.regenerateMessage(req, res),
  provideFeedback: (req, res) => controller.provideFeedback(req, res)
}