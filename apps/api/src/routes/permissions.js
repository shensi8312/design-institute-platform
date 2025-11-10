const express = require('express')
const PermissionController = require('../controllers/PermissionController')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

// 获取权限列表
router.get('/', authenticate, PermissionController.getList)

// 获取权限树
router.get('/tree', authenticate, PermissionController.getTree)

// 创建权限
router.post('/', authenticate, PermissionController.create)

// 获取权限详情
router.get('/:id', authenticate, PermissionController.getById)

// 更新权限
router.put('/:id', authenticate, PermissionController.update)

// 删除权限
router.delete('/:id', authenticate, PermissionController.delete)

// 批量删除
router.delete('/batch', authenticate, PermissionController.batchDelete)

// 获取用户权限
router.get('/user/:userId', authenticate, PermissionController.getUserPermissions)

// 检查权限
router.post('/check', authenticate, PermissionController.checkMyPermission)

module.exports = router
