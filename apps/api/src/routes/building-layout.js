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

// ========== 知识图谱相关路由 ==========

/**
 * @route   POST /api/building-layout/graph/sync/:ruleId
 * @desc    同步单个规则到知识图谱
 * @access  Private
 */
router.post('/graph/sync/:ruleId', BuildingLayoutController.syncRuleToGraph)

/**
 * @route   POST /api/building-layout/graph/sync-all
 * @desc    批量同步所有规则到知识图谱
 * @access  Private
 */
router.post('/graph/sync-all', BuildingLayoutController.syncAllRulesToGraph)

/**
 * @route   GET /api/building-layout/graph/dependencies/:ruleCode
 * @desc    获取规则依赖图
 * @access  Private
 */
router.get('/graph/dependencies/:ruleCode', BuildingLayoutController.getRuleDependencyGraph)

/**
 * @route   GET /api/building-layout/graph/chain/:ruleCode
 * @desc    获取规则依赖链
 * @access  Private
 */
router.get('/graph/chain/:ruleCode', BuildingLayoutController.getRuleDependencyChain)

/**
 * @route   GET /api/building-layout/graph/statistics
 * @desc    获取图谱统计信息
 * @access  Private
 */
router.get('/graph/statistics', BuildingLayoutController.getGraphStatistics)

// ========== 几何处理相关路由 ==========

/**
 * @route   POST /api/building-layout/geometry/parse-dxf
 * @desc    解析DXF文件
 * @access  Private
 */
router.post('/geometry/parse-dxf', BuildingLayoutController.parseDXF)

/**
 * @route   POST /api/building-layout/geometry/parse-shp
 * @desc    解析SHP文件
 * @access  Private
 */
router.post('/geometry/parse-shp', BuildingLayoutController.parseSHP)

/**
 * @route   POST /api/building-layout/geometry/calculate-setback
 * @desc    计算几何退距
 * @access  Private
 */
router.post('/geometry/calculate-setback', BuildingLayoutController.calculateGeometricSetback)

/**
 * @route   POST /api/building-layout/geometry/site-setback
 * @desc    从文件计算场地退距
 * @access  Private
 */
router.post('/geometry/site-setback', BuildingLayoutController.calculateSiteSetbackFromFile)

/**
 * @route   POST /api/building-layout/geometry/generate-footprint
 * @desc    生成建筑轮廓
 * @access  Private
 */
router.post('/geometry/generate-footprint', BuildingLayoutController.generateBuildingFootprint)

module.exports = router
