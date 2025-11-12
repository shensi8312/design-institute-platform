const express = require('express')
const router = express.Router()
const BuildingLayoutController = require('../controllers/BuildingLayoutController')
const { authenticate } = require('../middleware/auth')

// 所有路由需要认证
router.use(authenticate)

/**
 * @route   POST /api/building-layout/setbacks
 * @desc    计算红线退距
 * @access  Private
 */
router.post('/setbacks', BuildingLayoutController.calculateSetbacks)

/**
 * @route   POST /api/building-layout/areas
 * @desc    推导建筑面积
 * @access  Private
 */
router.post('/areas', BuildingLayoutController.deriveAreas)

/**
 * @route   POST /api/building-layout/um-table
 * @desc    生成UM表（能耗计算）
 * @access  Private
 */
router.post('/um-table', BuildingLayoutController.generateUMTable)

/**
 * @route   POST /api/building-layout/compliance
 * @desc    合规检查
 * @access  Private
 */
router.post('/compliance', BuildingLayoutController.checkCompliance)

/**
 * @route   POST /api/building-layout/workflow
 * @desc    完整工作流（退距→面积→UM表→合规）
 * @access  Private
 */
router.post('/workflow', BuildingLayoutController.runFullWorkflow)

/**
 * @route   GET /api/building-layout/rules-summary
 * @desc    获取可用规则摘要
 * @access  Private
 */
router.get('/rules-summary', BuildingLayoutController.getRulesSummary)

/**
 * @route   GET /api/building-layout/example
 * @desc    获取API使用示例
 * @access  Private
 */
router.get('/example', BuildingLayoutController.getExample)

module.exports = router
