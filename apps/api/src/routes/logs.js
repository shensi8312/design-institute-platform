const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const LogController = require('../controllers/LogController');

// 日志管理
router.get('/', authenticate, LogController.getLogs);
router.get('/statistics', authenticate, LogController.getStatistics);
router.get('/export', authenticate, LogController.exportLogs);
router.post('/cleanup', authenticate, LogController.cleanup);

module.exports = router;
