const express = require('express')
const router = express.Router()
const GraphLearningController = require('../controllers/GraphLearningController')
const { authenticate } = require('../middleware/auth')

// 所有路由需要认证
router.use(authenticate)

// 用户反馈学习
router.post('/kb/:kbId/feedback', GraphLearningController.submitFeedback)

// 查询模式学习
router.post('/kb/:kbId/learn/queries', GraphLearningController.learnFromQueries)

// 自主学习
router.post('/kb/:kbId/learn/autonomous', GraphLearningController.triggerAutonomousLearning)

// 概念漂移检测
router.post('/kb/:kbId/learn/drift', GraphLearningController.detectConceptDrift)

// 学习历史
router.get('/kb/:kbId/learning/history', GraphLearningController.getLearningHistory)

// 学习统计
router.get('/kb/:kbId/learning/stats', GraphLearningController.getLearningStats)

// 配置学习参数
router.put('/kb/:kbId/learning/config', GraphLearningController.configureLearning)

// 导出模型
router.get('/kb/:kbId/learning/export', GraphLearningController.exportModel)

module.exports = router