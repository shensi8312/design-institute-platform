const express = require('express')
const router = express.Router()
const UnifiedRuleController = require('../controllers/UnifiedRuleController')
const { authenticate } = require('../middleware/auth')

// 特定路由必须在通用路由之前定义
router.get('/pending', authenticate, UnifiedRuleController.getPendingRules)

// 强排图生成端点
router.post('/:ruleType/:ruleId/diagram', authenticate, UnifiedRuleController.generateRuleDiagram)
router.post('/:ruleType/batch-diagram', authenticate, UnifiedRuleController.generateBatchDiagrams)

// 规则类型相关的特定路由
router.post('/:ruleType/learn', authenticate, UnifiedRuleController.learnRules)
router.post('/:ruleType/match', authenticate, UnifiedRuleController.matchRules)
router.post('/:ruleType/recommend', authenticate, UnifiedRuleController.recommendRules)
router.post('/:ruleType/feedback', authenticate, UnifiedRuleController.submitFeedback)
router.get('/:ruleType/config', authenticate, UnifiedRuleController.getLearningConfig)
router.put('/:ruleType/config', authenticate, UnifiedRuleController.updateLearningConfig)
router.get('/:ruleType/statistics', authenticate, UnifiedRuleController.getStatistics)
router.get('/:ruleType/learning-report', authenticate, UnifiedRuleController.getLearningReport)
router.post('/:ruleType/batch-learning', authenticate, UnifiedRuleController.triggerBatchLearning)

// 规则ID相关的特定路由
router.post('/:ruleType/:ruleId/approve', authenticate, UnifiedRuleController.approveRule)
router.post('/:ruleType/:ruleId/reject', authenticate, UnifiedRuleController.rejectRule)

// 通用CRUD路由（放在最后）
router.get('/:ruleType', authenticate, UnifiedRuleController.getRules)
router.get('/:ruleType/:ruleId', authenticate, UnifiedRuleController.getRule)
router.post('/:ruleType', authenticate, UnifiedRuleController.createRule)
router.put('/:ruleType/:ruleId', authenticate, UnifiedRuleController.updateRule)
router.delete('/:ruleType/:ruleId', authenticate, UnifiedRuleController.deleteRule)

module.exports = router
