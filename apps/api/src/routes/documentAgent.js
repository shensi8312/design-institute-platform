const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const { authenticate } = require('../middleware/auth')
const DocumentAgentController = require('../controllers/DocumentAgentController')

// 文件上传配置 - 使用绝对路径
const upload = multer({
  dest: path.join(__dirname, '../../uploads/temp/'),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.doc', '.txt']
    const ext = path.extname(file.originalname).toLowerCase()

    if (allowedTypes.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error(`不支持的文件类型: ${ext}`))
    }
  }
})

/**
 * 文档智能分析 Agent 路由
 */

// 测试接口（无需认证）
router.get('/test', DocumentAgentController.test.bind(DocumentAgentController))

// 分析文档（开发阶段暂时移除认证）
router.post(
  '/analyze',
  upload.single('file'),
  DocumentAgentController.analyzeDocument.bind(DocumentAgentController)
)

// 文档问答（开发阶段暂时移除认证）
router.post(
  '/ask',
  upload.single('file'),
  DocumentAgentController.askQuestion.bind(DocumentAgentController)
)

// 章节深度分析（开发阶段暂时移除认证）
router.post(
  '/analyze-sections',
  upload.single('file'),
  DocumentAgentController.analyzeSections.bind(DocumentAgentController)
)

module.exports = router
