const express = require('express')
const ProjectController = require('../controllers/ProjectController')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

// 获取项目列表
router.get('/', authenticate, ProjectController.getList)

// 获取项目详情
router.get('/:id', authenticate, ProjectController.getDetail)

// 创建项目
router.post('/', authenticate, ProjectController.create)

// 更新项目
router.put('/:id', authenticate, ProjectController.update)

// 删除项目
router.delete('/:id', authenticate, ProjectController.delete)

// 归档项目
router.put('/:id/archive', authenticate, ProjectController.archive)

// 恢复项目
router.put('/:id/restore', authenticate, ProjectController.restore)

// 获取项目成员
router.get('/:id/members', authenticate, ProjectController.getMembers)

// 添加项目成员
router.post('/:id/members', authenticate, ProjectController.addMember)

// 移除项目成员
router.delete('/:id/members/:userId', authenticate, ProjectController.removeMember)

// 获取项目统计
router.get('/:id/statistics', authenticate, ProjectController.getStatistics)

module.exports = router
