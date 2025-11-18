const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const ProjectController = require('../controllers/ProjectController')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

// 确保上传目录存在
const uploadDir = 'uploads/project_documents'
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    // 允许的文件类型
    const allowedTypes = /pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())

    if (extname) {
      return cb(null, true)
    } else {
      cb(new Error('不支持的文件类型'))
    }
  }
})

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

// ===== V3.0 项目文档管理 =====

// 上传项目文档
router.post('/:id/documents/upload', authenticate, upload.single('file'), ProjectController.uploadDocument)

// 获取项目文档列表
router.get('/:id/documents', authenticate, ProjectController.getDocuments)

// 获取项目文档统计
router.get('/:id/documents-stats', authenticate, ProjectController.getDocumentStatistics)

// 获取文档详情
router.get('/:id/documents/:documentId', authenticate, ProjectController.getDocumentDetail)

// 更新文档信息
router.put('/:id/documents/:documentId', authenticate, ProjectController.updateDocument)

// 删除文档
router.delete('/:id/documents/:documentId', authenticate, ProjectController.deleteDocument)

module.exports = router
