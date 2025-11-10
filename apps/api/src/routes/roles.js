const express = require('express')
const RoleController = require('../controllers/RoleController')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

// 获取角色列表
router.get('/', authenticate, RoleController.getList)

// 获取角色详情
router.get('/:id', authenticate, RoleController.getById)

// 创建角色
router.post('/', authenticate, RoleController.create)

// 更新角色
router.put('/:id', authenticate, RoleController.update)

// 删除角色
router.delete('/:id', authenticate, RoleController.delete)

// 获取系统权限列表
router.get('/system/permissions', authenticate, RoleController.getPermissionTree)

// 获取可分配的用户列表
router.get('/:id/users', authenticate, RoleController.getRoleUsers)

// 分配用户到角色
router.post('/:id/users', authenticate, RoleController.assignUsers)

module.exports = router