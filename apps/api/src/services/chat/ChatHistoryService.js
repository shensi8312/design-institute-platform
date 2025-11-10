/**
 * 聊天历史记录服务
 * 适配现有的 chat_conversations 和 chat_messages 表
 */
class ChatHistoryService {
  constructor() {
    this.db = require('../../config/database');
    this.defaultAssistantId = 'assistant_knowledge_qa';
  }

  /**
   * 创建新会话
   */
  async createSession(userId, organizationId, title = '新对话', scope = 'all', metadata = {}) {
    try {
      const [conversation] = await this.db('chat_conversations')
        .insert({
          user_id: userId,
          organization_id: organizationId,
          assistant_id: this.defaultAssistantId,
          title,
          scope,
          context: metadata,
          status: 'active'
        })
        .returning('*');

      return { success: true, data: conversation };
    } catch (error) {
      console.error('[ChatHistory] 创建会话失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取用户的所有会话
   */
  async getUserSessions(userId, page = 1, pageSize = 20) {
    try {
      const offset = (page - 1) * pageSize;

      const conversations = await this.db('chat_conversations')
        .where({ user_id: userId, status: 'active' })
        .whereNull('deleted_at')
        .orderBy('last_activity_at', 'desc')
        .limit(pageSize)
        .offset(offset)
        .select('*');

      const total = await this.db('chat_conversations')
        .where({ user_id: userId, status: 'active' })
        .whereNull('deleted_at')
        .count('* as count')
        .first();

      return {
        success: true,
        data: {
          conversations,
          total: parseInt(total.count),
          page,
          pageSize
        }
      };
    } catch (error) {
      console.error('[ChatHistory] 获取会话列表失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取会话的所有消息
   */
  async getSessionMessages(conversationId, page = 1, pageSize = 50) {
    try {
      const offset = (page - 1) * pageSize;

      const messages = await this.db('chat_messages')
        .where({ conversation_id: conversationId })
        .orderBy('created_at', 'asc')
        .limit(pageSize)
        .offset(offset)
        .select('*');

      const total = await this.db('chat_messages')
        .where({ conversation_id: conversationId })
        .count('* as count')
        .first();

      return {
        success: true,
        data: {
          messages,
          total: parseInt(total.count),
          page,
          pageSize
        }
      };
    } catch (error) {
      console.error('[ChatHistory] 获取消息列表失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 添加消息到会话
   */
  async addMessage(conversationId, role, content, userId, extras = {}) {
    try {
      // 确保 JSONB 字段正确序列化
      const insertData = {
        conversation_id: conversationId,
        user_id: userId,
        role,
        content,
        thinking: extras.thinking || null,
        metadata: extras.metadata || {}
      };

      // 处理 JSONB 字段（PostgreSQL JSONB类型可以直接接受对象/数组，不需要stringify）
      // 确保字段是有效的JSON值
      if (extras.sources && Array.isArray(extras.sources) && extras.sources.length > 0) {
        // 清理sources数据，移除可能导致JSON错误的字段
        const cleanSources = extras.sources.map(source => {
          const cleaned = {};
          // 只保留基本的、有效的字段
          const allowedFields = ['id', 'citation', 'document_name', 'document_id', 'section', 'article', 'page', 'score', 'preview', 'file_type'];

          allowedFields.forEach(key => {
            if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
              if (typeof source[key] === 'string') {
                // 清理字符串：移除控制字符，保留正常文本
                let cleanStr = source[key]
                  .replace(/[\x00-\x1F\x7F]/g, ' ')  // 移除所有控制字符
                  .trim()
                  .substring(0, 500);                 // 限制长度
                if (cleanStr) {
                  cleaned[key] = cleanStr;
                }
              } else if (typeof source[key] === 'number') {
                cleaned[key] = source[key];
              }
            }
          });

          return cleaned;
        });
        // PostgreSQL JSONB类型需要JSON字符串
        insertData.sources = JSON.stringify(cleanSources);
        insertData.reference_docs = JSON.stringify(cleanSources);
      }
      if (extras.attachments && Array.isArray(extras.attachments) && extras.attachments.length > 0) {
        insertData.attachments = JSON.stringify(extras.attachments);
      }
      if (extras.outputFiles && Array.isArray(extras.outputFiles) && extras.outputFiles.length > 0) {
        insertData.output_files = JSON.stringify(extras.outputFiles);
      }

      const [message] = await this.db('chat_messages')
        .insert(insertData)
        .returning('*');

      // 更新会话的最后活动时间和消息计数
      await this.db('chat_conversations')
        .where({ id: conversationId })
        .update({
          last_activity_at: this.db.fn.now(),
          message_count: this.db.raw('message_count + 1')
        });

      // 如果是第一条消息，自动生成会话标题
      const messageCount = await this.db('chat_messages')
        .where({ conversation_id: conversationId })
        .count('* as count')
        .first();

      if (parseInt(messageCount.count) === 1 && role === 'user') {
        const title = content.length > 30 ? content.substring(0, 30) + '...' : content;
        await this.updateSessionTitle(conversationId, title);
      }

      return { success: true, data: message };
    } catch (error) {
      console.error('[ChatHistory] 添加消息失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新会话标题
   */
  async updateSessionTitle(conversationId, title) {
    try {
      await this.db('chat_conversations')
        .where({ id: conversationId })
        .update({ title, updated_at: this.db.fn.now() });

      return { success: true };
    } catch (error) {
      console.error('[ChatHistory] 更新会话标题失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 删除会话（软删除）
   */
  async deleteSession(conversationId, userId) {
    try {
      // 验证会话所有权
      const conversation = await this.db('chat_conversations')
        .where({ id: conversationId, user_id: userId })
        .first();

      if (!conversation) {
        return { success: false, message: '会话不存在或无权限' };
      }

      await this.db('chat_conversations')
        .where({ id: conversationId })
        .update({
          deleted_at: this.db.fn.now(),
          status: 'archived'
        });

      return { success: true };
    } catch (error) {
      console.error('[ChatHistory] 删除会话失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 清空用户的所有会话
   */
  async clearUserSessions(userId) {
    try {
      await this.db('chat_conversations')
        .where({ user_id: userId })
        .update({
          deleted_at: this.db.fn.now(),
          status: 'archived'
        });

      return { success: true };
    } catch (error) {
      console.error('[ChatHistory] 清空会话失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取会话的上下文（最近N条消息）
   */
  async getSessionContext(conversationId, limit = 10) {
    try {
      const messages = await this.db('chat_messages')
        .where({ conversation_id: conversationId })
        .orderBy('created_at', 'desc')
        .limit(limit)
        .select('role', 'content')
        .then(rows => rows.reverse()); // 反转为正序

      return { success: true, data: messages };
    } catch (error) {
      console.error('[ChatHistory] 获取会话上下文失败:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = ChatHistoryService;
