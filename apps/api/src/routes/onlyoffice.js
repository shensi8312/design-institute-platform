/**
 * OnlyOffice在线编辑器路由
 */

const express = require('express');
const router = express.Router();
const OnlyOfficeService = require('../services/document/OnlyOfficeService');
const { authenticate } = require('../middleware/auth');

/**
 * 获取编辑器配置
 * GET /api/onlyoffice/config/:documentId
 */
router.get('/config/:documentId', authenticate, async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user.userId;
    const userName = req.user.username || '匿名用户';

    const config = await OnlyOfficeService.getEditorConfig(documentId, userId, userName);

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('[OnlyOffice API] 获取配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * OnlyOffice回调接口
 * POST /api/onlyoffice/callback/:documentId
 *
 * 重要：此接口由OnlyOffice Document Server调用，无需JWT认证
 */
router.post('/callback/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const callbackData = req.body;

    console.log(`[OnlyOffice Callback] documentId=${documentId}, status=${callbackData.status}`);

    const result = await OnlyOfficeService.handleCallback(documentId, callbackData);

    res.json(result);
  } catch (error) {
    console.error('[OnlyOffice Callback] 处理失败:', error);
    res.json({ error: 1, message: error.message });
  }
});

module.exports = router;
