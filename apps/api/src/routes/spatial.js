const router = require('express').Router();
const SpatialController = require('../controllers/SpatialController');
const { authenticate } = require('../middleware/auth');

// 生成布局
router.post('/generate', authenticate, SpatialController.generateLayout);

// 优化布局
router.post('/optimize', authenticate, SpatialController.optimizeLayout);

// 分析流线
router.post('/analyze/:layoutId', authenticate, SpatialController.analyzeFlow);

// 学习案例
router.post('/learn', authenticate, SpatialController.learnFromCase);

// 获取模板
router.get('/templates', authenticate, SpatialController.getTemplates);

// 获取统计
router.get('/statistics', authenticate, SpatialController.getStatistics);

// 批量生成
router.post('/batch-generate', authenticate, SpatialController.batchGenerate);

// 比较布局
router.post('/compare', authenticate, SpatialController.compareLayouts);

module.exports = router;