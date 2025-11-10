const express = require('express')
const MenuController = require('../controllers/MenuController')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

// 获取菜单列表
router.get('/', authenticate, MenuController.getList)

// 获取菜单树
router.get('/tree', authenticate, MenuController.getTree)

// 获取用户菜单
router.get('/user', authenticate, MenuController.getUserMenus)

// 获取菜单详情
router.get('/:id', authenticate, MenuController.getById)

// 创建菜单
router.post('/', authenticate, MenuController.create)

// 更新菜单
router.put('/:id', authenticate, MenuController.update)

// 删除菜单
router.delete('/:id', authenticate, MenuController.delete)

// 更新菜单排序
router.put('/:id/sort', authenticate, MenuController.updateSort)

// 更新菜单状态
router.put('/:id/status', authenticate, MenuController.updateStatus)

module.exports = router
