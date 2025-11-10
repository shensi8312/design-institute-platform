const express = require('express')
const UserController = require('../controllers/UserController')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

// 获取用户列表
router.get('/', authenticate, UserController.getList)

// 获取用户详情
router.get('/:id', authenticate, UserController.getDetail)

// 创建用户
router.post('/', authenticate, UserController.create)

// 更新用户
router.put('/:id', authenticate, UserController.update)

// 删除用户
router.delete('/:id', authenticate, UserController.delete)

// 重置用户密码
router.put('/:id/password', authenticate, UserController.resetPassword)

module.exports = router