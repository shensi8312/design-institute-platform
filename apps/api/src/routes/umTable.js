/**
 * UM表配置路由
 */

const express = require('express')
const router = express.Router()
const UMTableController = require('../controllers/UMTableController')
const { authenticate } = require('../middleware/auth')

// 获取配置类型列表
router.get('/types', authenticate, UMTableController.getConfigTypes.bind(UMTableController))

// 获取导入模板
router.get('/template', authenticate, UMTableController.getTemplate.bind(UMTableController))

// 导出配置
router.get('/export', authenticate, UMTableController.exportConfigs.bind(UMTableController))

// 批量导入
router.post('/import', authenticate, UMTableController.importConfigs.bind(UMTableController))

// 批量更新排序
router.put('/batch-sort', authenticate, UMTableController.batchUpdateSort.bind(UMTableController))

// CRUD
router.get('/', authenticate, UMTableController.getConfigs.bind(UMTableController))
router.get('/:id', authenticate, UMTableController.getConfig.bind(UMTableController))
router.post('/', authenticate, UMTableController.createConfig.bind(UMTableController))
router.put('/:id', authenticate, UMTableController.updateConfig.bind(UMTableController))
router.delete('/:id', authenticate, UMTableController.deleteConfig.bind(UMTableController))

module.exports = router
