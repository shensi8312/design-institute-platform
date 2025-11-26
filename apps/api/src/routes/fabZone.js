/**
 * FAB 功能区配置路由
 */

const express = require('express')
const router = express.Router()
const FabZoneController = require('../controllers/FabZoneController')

// 获取统计数据
router.get('/statistics', FabZoneController.getStatistics.bind(FabZoneController))

// 获取导入模板
router.get('/template', FabZoneController.getTemplate.bind(FabZoneController))

// 批量导入
router.post('/import', FabZoneController.importFromExcel.bind(FabZoneController))

// CRUD
router.get('/', FabZoneController.getAll.bind(FabZoneController))
router.get('/:id', FabZoneController.getById.bind(FabZoneController))
router.post('/', FabZoneController.create.bind(FabZoneController))
router.put('/:id', FabZoneController.update.bind(FabZoneController))
router.delete('/:id', FabZoneController.delete.bind(FabZoneController))

module.exports = router
