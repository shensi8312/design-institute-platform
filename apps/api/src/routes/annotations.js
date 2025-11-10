const express = require('express')
const router = express.Router()
const AnnotationController = require('../controllers/AnnotationController')
const { authenticate } = require('../middleware/auth')
const multer = require('multer')
const path = require('path')
const fs = require('fs')

// 确保上传目录存在
const uploadDir = 'uploads/annotations/'
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true })
}

// 配置文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
})

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB
    },
    fileFilter: (req, file, cb) => {
        // 允许的文件类型
        const allowedTypes = /pdf|doc|docx|txt|md|png|jpg|jpeg|dwg|rvt|ifc|json/
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
        
        if (extname) {
            return cb(null, true)
        } else {
            cb(new Error('不支持的文件类型'))
        }
    }
})

// 所有路由都需要认证
router.use(authenticate)

// 标注任务管理
router.post('/tasks', upload.single('file'), AnnotationController.createTask)
router.get('/tasks', AnnotationController.getTasks)
router.post('/tasks/:taskId/annotate', AnnotationController.saveAnnotation)
router.post('/tasks/:taskId/auto-annotate', AnnotationController.autoAnnotate)

module.exports = router