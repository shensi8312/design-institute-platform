const express = require('express')
const ReportController = require('../controllers/ReportController')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

/**
 * V3.0 报告生成路由
 */

// 生成报告
router.post('/generate', authenticate, ReportController.generate)

// 下载报告
router.get('/download/:reportId', authenticate, ReportController.download)

module.exports = router
