const express = require('express')
const AIReviewController = require('../controllers/AIReviewController')
const { authenticate } = require('../middleware/auth')

const router = express.Router()

/**
 * V3.0 AI审查路由
 */

// 启动合同审查
router.post('/start', authenticate, AIReviewController.startContractReview)

// 获取审查任务状态
router.get('/jobs/:jobId', authenticate, AIReviewController.getJobStatus)

module.exports = router
