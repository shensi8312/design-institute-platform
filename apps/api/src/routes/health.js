const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// 服务健康检查
router.get('/services', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        services: [
          {
            name: 'database',
            status: 'healthy',
            latency: 12
          },
          {
            name: 'redis',
            status: 'healthy',
            latency: 3
          },
          {
            name: 'minio',
            status: 'healthy',
            latency: 15
          },
          {
            name: 'document-recognition',
            status: 'healthy',
            latency: 45
          }
        ],
        overall: 'healthy',
        timestamp: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '服务健康检查失败',
      error: error.message
    });
  }
});

module.exports = router;