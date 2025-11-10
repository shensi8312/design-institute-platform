const express = require('express')
const DepartmentController = require('../controllers/DepartmentController')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

// 获取部门树形选择器数据（需要放在 /:id 之前）
router.get('/tree-select', authenticate, DepartmentController.getTreeSelect)

// 获取部门树（用于部门管理页面）
router.get('/tree', authenticate, DepartmentController.getTree)

// 获取部门列表
router.get('/', authenticate, DepartmentController.getList)

// 获取部门详情
router.get('/:id', authenticate, DepartmentController.getDetail)

// 创建部门
router.post('/', authenticate, DepartmentController.create)

// 更新部门
router.put('/:id', authenticate, DepartmentController.update)

// 删除部门
router.delete('/:id', authenticate, DepartmentController.delete)

// 获取部门成员（如果Controller中有这个方法）
// router.get('/:id/members', authenticate, DepartmentController.getMembers)

module.exports = router