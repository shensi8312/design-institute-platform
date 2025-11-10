const express = require('express');
const router = express.Router();
const ChatHistoryService = require('../services/chat/ChatHistoryService');
const { authenticate } = require('../middleware/auth');

const chatHistoryService = new ChatHistoryService();

/**
 * 创建新会话
 * POST /api/chat/history/sessions
 */
router.post('/sessions', authenticate, async (req, res) => {
  try {
    const { title = '新对话', scope = 'all', metadata = {} } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    const result = await chatHistoryService.createSession(
      userId,
      organizationId,
      title,
      scope,
      metadata
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('[API] 创建会话失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取用户所有会话
 * GET /api/chat/history/sessions
 */
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const userId = req.user.id;

    const result = await chatHistoryService.getUserSessions(
      userId,
      parseInt(page),
      parseInt(pageSize)
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('[API] 获取会话列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取会话的所有消息
 * GET /api/chat/history/sessions/:conversationId/messages
 */
router.get('/sessions/:conversationId/messages', authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, pageSize = 50 } = req.query;

    const result = await chatHistoryService.getSessionMessages(
      conversationId,
      parseInt(page),
      parseInt(pageSize)
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('[API] 获取消息列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 添加消息到会话
 * POST /api/chat/history/sessions/:conversationId/messages
 */
router.post('/sessions/:conversationId/messages', authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { role, content, thinking, sources, attachments, outputFiles, metadata } = req.body;
    const userId = req.user.id;

    // 构建extras对象，过滤掉空数组和无效值
    const extras = {};
    if (thinking) extras.thinking = thinking;
    if (sources && Array.isArray(sources) && sources.length > 0) extras.sources = sources;
    if (attachments && Array.isArray(attachments) && attachments.length > 0) extras.attachments = attachments;
    if (outputFiles && Array.isArray(outputFiles) && outputFiles.length > 0) extras.outputFiles = outputFiles;
    if (metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0) extras.metadata = metadata;

    const result = await chatHistoryService.addMessage(
      conversationId,
      role,
      content,
      userId,
      extras
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('[API] 添加消息失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 删除会话
 * DELETE /api/chat/history/sessions/:conversationId
 */
router.delete('/sessions/:conversationId', authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const result = await chatHistoryService.deleteSession(conversationId, userId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('[API] 删除会话失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 更新会话标题
 * PATCH /api/chat/history/sessions/:conversationId
 */
router.patch('/sessions/:conversationId', authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { title } = req.body;

    const result = await chatHistoryService.updateSessionTitle(conversationId, title);

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('[API] 更新会话标题失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
