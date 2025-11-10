const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const SystemController = require('../controllers/SystemController.refactored');

// 系统管理
router.get('/info', authenticate, SystemController.getSystemInfo);
router.get('/health', SystemController.getServiceHealth);  // 健康检查不需要认证
router.get('/database/status', authenticate, SystemController.getDatabaseStatus);
router.get('/config', authenticate, SystemController.getSystemConfig);
router.put('/config', authenticate, SystemController.updateSystemConfig);
router.get('/status', authenticate, SystemController.getSystemStatus);

// 服务监控 - 重定向到serviceHealth路由
router.get('/monitor', authenticate, async (req, res) => {
  try {
    const axios = require('axios');
    const response = await axios.get('http://localhost:3000/api/service-health/all', {
      headers: { Authorization: req.headers.authorization }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: '获取服务监控信息失败',
      error: error.message 
    });
  }
});

module.exports = router;
