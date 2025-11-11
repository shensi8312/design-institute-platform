const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const SystemController = require('../controllers/SystemController');

// 系统管理
router.get('/info', authenticate, SystemController.getSystemInfo);
router.get('/health', SystemController.getServiceHealth);  // 健康检查不需要认证
router.get('/database/status', authenticate, SystemController.getDatabaseStatus);
router.get('/config', authenticate, SystemController.getSystemConfig);
router.put('/config', authenticate, SystemController.updateSystemConfig);

// 服务监控 - 内部重定向
router.get('/monitor', authenticate, (req, res, next) => {
  // 内部重定向到 service-health 路由
  req.url = '/service-health/all';
  req.app.handle(req, res, next);
});

module.exports = router;
