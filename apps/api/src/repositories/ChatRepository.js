const BaseRepository = require('./BaseRepository')

/**
 * 聊天助手Repository
 */
class ChatAssistantRepository extends BaseRepository {
  constructor() {
    super('chat_assistants')
  }

  /**
   * 获取用户有权限的助手列表
   */
  async findByUserPermissions(userId, departmentId, organizationId, isAdmin = false) {
    let query = this.db('chat_assistants')
      .select([
        'chat_assistants.*',
        'users.name as owner_name',
        'projects.name as project_name'
      ])
      .leftJoin('users', 'chat_assistants.owner_id', 'users.id')
      .leftJoin('projects', 'chat_assistants.project_id', 'projects.id')
      .where('chat_assistants.deleted_at', null)
    
    // 非管理员只能看到有权限的助手
    if (!isAdmin) {
      query = query.where(function() {
        this.where('chat_assistants.owner_id', userId)
          .orWhere('chat_assistants.permission_level', 'public')
          .orWhere(function() {
            this.where('chat_assistants.permission_level', 'organization')
              .andWhere('chat_assistants.organization_id', organizationId)
          })
          .orWhere(function() {
            this.where('chat_assistants.permission_level', 'department')
              .andWhere('chat_assistants.department_id', departmentId)
          })
      })
    }
    
    return await query.orderBy('chat_assistants.created_at', 'desc')
  }

  /**
   * 获取助手详情（包含关联信息）
   */
  async findByIdWithDetails(assistantId) {
    const assistant = await this.db('chat_assistants')
      .select([
        'chat_assistants.*',
        'users.name as owner_name',
        'projects.name as project_name'
      ])
      .leftJoin('users', 'chat_assistants.owner_id', 'users.id')
      .leftJoin('projects', 'chat_assistants.project_id', 'projects.id')
      .where('chat_assistants.id', assistantId)
      .where('chat_assistants.deleted_at', null)
      .first()
    
    if (assistant) {
      // 解析JSON字段
      assistant.kb_ids = JSON.parse(assistant.kb_ids || '[]')
      assistant.settings = JSON.parse(assistant.settings || '{}')
    }
    
    return assistant
  }

  /**
   * 更新助手使用统计
   */
  async updateUsageStats(assistantId) {
    return await this.db('chat_assistants')
      .where('id', assistantId)
      .increment('usage_count', 1)
      .update('last_used_at', new Date())
  }
}

/**
 * 聊天会话Repository
 */
class ChatConversationRepository extends BaseRepository {
  constructor() {
    super('chat_conversations')
  }

  /**
   * 获取用户的会话列表
   */
  async findByUserId(userId, options = {}) {
    let query = this.db('chat_conversations')
      .select([
        'chat_conversations.*',
        'chat_assistants.name as assistant_name',
        'chat_assistants.icon as assistant_icon'
      ])
      .leftJoin('chat_assistants', 'chat_conversations.assistant_id', 'chat_assistants.id')
      .where('chat_conversations.user_id', userId)
      .where('chat_conversations.deleted_at', null)
    
    // 助手筛选
    if (options.assistantId) {
      query = query.where('chat_conversations.assistant_id', options.assistantId)
    }
    
    // 状态筛选
    if (options.status) {
      query = query.where('chat_conversations.status', options.status)
    }
    
    // 排序
    query = query.orderBy(options.orderBy || 'chat_conversations.updated_at', options.order || 'desc')
    
    // 分页
    if (options.limit) {
      query = query.limit(options.limit)
    }
    if (options.offset) {
      query = query.offset(options.offset)
    }
    
    return await query
  }

  /**
   * 获取会话详情（包含最近消息）
   */
  async findByIdWithMessages(conversationId, messageLimit = 20) {
    const conversation = await this.findById(conversationId)
    
    if (conversation) {
      // 获取最近的消息
      conversation.messages = await this.db('chat_messages')
        .where('conversation_id', conversationId)
        .orderBy('created_at', 'desc')
        .limit(messageLimit)
    }
    
    return conversation
  }

  /**
   * 更新会话摘要
   */
  async updateSummary(conversationId, summary) {
    return await this.update(conversationId, {
      summary,
      updated_at: new Date()
    })
  }

  /**
   * 更新会话状态
   */
  async updateStatus(conversationId, status) {
    return await this.update(conversationId, {
      status,
      updated_at: new Date()
    })
  }
}

/**
 * 聊天消息Repository
 */
class ChatMessageRepository extends BaseRepository {
  constructor() {
    super('chat_messages')
  }

  /**
   * 获取会话的消息列表
   */
  async findByConversationId(conversationId, options = {}) {
    let query = this.db('chat_messages')
      .where('conversation_id', conversationId)
    
    // 角色筛选
    if (options.role) {
      query = query.where('role', options.role)
    }
    
    // 排序
    query = query.orderBy(options.orderBy || 'created_at', options.order || 'asc')
    
    // 分页
    if (options.limit) {
      query = query.limit(options.limit)
    }
    if (options.offset) {
      query = query.offset(options.offset)
    }
    
    return await query
  }

  /**
   * 获取消息上下文（前后n条消息）
   */
  async getMessageContext(messageId, contextSize = 5) {
    const message = await this.findById(messageId)
    if (!message) return null
    
    // 获取前后消息
    const [before, after] = await Promise.all([
      this.db('chat_messages')
        .where('conversation_id', message.conversation_id)
        .where('created_at', '<', message.created_at)
        .orderBy('created_at', 'desc')
        .limit(contextSize),
      this.db('chat_messages')
        .where('conversation_id', message.conversation_id)
        .where('created_at', '>', message.created_at)
        .orderBy('created_at', 'asc')
        .limit(contextSize)
    ])
    
    return {
      message,
      before: before.reverse(),
      after
    }
  }

  /**
   * 保存消息和元数据
   */
  async createWithMetadata(messageData) {
    const { metadata, ...message } = messageData
    
    // 创建消息
    const createdMessage = await this.create(message)
    
    // 如果有元数据，保存到关联表
    if (metadata) {
      await this.db('chat_message_metadata').insert({
        message_id: createdMessage.id,
        ...metadata
      })
    }
    
    return createdMessage
  }

  /**
   * 获取消息的引用文档
   */
  async getReferences(messageId) {
    return await this.db('chat_message_references')
      .select([
        'chat_message_references.*',
        'knowledge_documents.name as document_name',
        'knowledge_documents.file_type'
      ])
      .leftJoin('knowledge_documents', 'chat_message_references.document_id', 'knowledge_documents.id')
      .where('message_id', messageId)
  }

  /**
   * 保存消息引用
   */
  async saveReferences(messageId, references) {
    if (!references || references.length === 0) return
    
    const referenceRecords = references.map(ref => ({
      message_id: messageId,
      document_id: ref.document_id,
      chunk_id: ref.chunk_id,
      score: ref.score,
      content: ref.content
    }))
    
    return await this.db('chat_message_references').insert(referenceRecords)
  }
}

/**
 * 聊天反馈Repository
 */
class ChatFeedbackRepository extends BaseRepository {
  constructor() {
    super('chat_feedbacks')
  }

  /**
   * 获取消息的反馈
   */
  async findByMessageId(messageId) {
    return await this.db('chat_feedbacks')
      .where('message_id', messageId)
      .first()
  }

  /**
   * 保存或更新反馈
   */
  async upsertFeedback(messageId, userId, feedback) {
    const existing = await this.findOne({
      message_id: messageId,
      user_id: userId
    })
    
    if (existing) {
      return await this.update(existing.id, {
        ...feedback,
        updated_at: new Date()
      })
    } else {
      return await this.create({
        message_id: messageId,
        user_id: userId,
        ...feedback
      })
    }
  }

  /**
   * 获取助手的反馈统计
   */
  async getAssistantFeedbackStats(assistantId) {
    const stats = await this.db('chat_feedbacks')
      .select('rating')
      .count('* as count')
      .avg('rating as avg_rating')
      .join('chat_messages', 'chat_feedbacks.message_id', 'chat_messages.id')
      .join('chat_conversations', 'chat_messages.conversation_id', 'chat_conversations.id')
      .where('chat_conversations.assistant_id', assistantId)
      .groupBy('rating')
    
    const totalCount = stats.reduce((sum, item) => sum + parseInt(item.count), 0)
    const avgRating = stats.length > 0 
      ? stats.reduce((sum, item) => sum + item.rating * parseInt(item.count), 0) / totalCount
      : 0
    
    return {
      totalFeedbacks: totalCount,
      averageRating: avgRating.toFixed(2),
      distribution: stats.reduce((acc, item) => {
        acc[item.rating] = parseInt(item.count)
        return acc
      }, {})
    }
  }
}

module.exports = {
  ChatAssistantRepository,
  ChatConversationRepository,
  ChatMessageRepository,
  ChatFeedbackRepository
}