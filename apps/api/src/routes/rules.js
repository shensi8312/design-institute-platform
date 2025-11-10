const express = require('express')
const router = express.Router()
const RulesController = require('../controllers/RulesController')
const { authenticate } = require('../middleware/auth')

// 获取规则分类(带统计)
router.get('/categories', authenticate, RulesController.getCategories)
router.get('/categories/stats', authenticate, RulesController.getCategoriesWithStats)

// 规则CRUD
router.get('/', authenticate, RulesController.getRules)
router.get('/:id', authenticate, RulesController.getRuleById)
router.post('/', authenticate, RulesController.createRule)
router.put('/:id', authenticate, RulesController.updateRule)
router.delete('/:id', authenticate, RulesController.deleteRule)

// 审核操作
router.post('/:id/approve', authenticate, RulesController.approveRule)
router.post('/:id/reject', authenticate, RulesController.rejectRule)
router.post('/batch-approve', authenticate, RulesController.batchApprove)

// 从文档提取规则
router.post('/extract', authenticate, RulesController.extractRulesFromDocument)

module.exports = router
