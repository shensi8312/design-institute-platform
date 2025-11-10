const express = require('express')
const OrganizationController = require('../controllers/OrganizationController')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

// 获取组织列表
router.get('/', authenticate, OrganizationController.getList)

// 获取组织树
router.get('/tree', authenticate, OrganizationController.getDepartmentTree)

// 获取组织详情
router.get('/:id', authenticate, OrganizationController.getDetail)

// 创建组织
router.post('/', authenticate, OrganizationController.create)

// 更新组织
router.put('/:id', authenticate, OrganizationController.update)

// 删除组织
router.delete('/:id', authenticate, OrganizationController.delete)

module.exports = router