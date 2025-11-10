const express = require('express')
const DigitalSiteController = require('../controllers/DigitalSiteController')
const { authenticate } = require('../middleware/auth')
const { validateRequest } = require('../middleware/validation')
const { body } = require('express-validator')
const axios = require('axios')

const router = express.Router()

router.get('/overview', authenticate, DigitalSiteController.getOverview)
router.get('/stats', authenticate, DigitalSiteController.getStats)
router.get('/projects', authenticate, DigitalSiteController.getProjects)
router.get('/alerts', authenticate, DigitalSiteController.getAlerts)
router.get('/alerts/:id', authenticate, DigitalSiteController.getAlertDetail)

router.post(
  '/alerts',
  authenticate,
  [
    body('siteId').notEmpty().withMessage('siteId 不能为空'),
    body('alertCode').notEmpty().withMessage('alertCode 不能为空'),
    body('alertLevel').optional().isString(),
    body('detectedAt').optional().isISO8601()
  ],
  validateRequest,
  DigitalSiteController.createAlert
)

router.patch(
  '/alerts/:id/ack',
  authenticate,
  [body('status').optional().isIn(['acknowledged', 'resolved']).withMessage('status 无效')],
  validateRequest,
  DigitalSiteController.acknowledgeAlert
)

router.patch(
  '/alerts/:id/resolve',
  authenticate,
  DigitalSiteController.resolveAlert
)

router.get('/tags', authenticate, DigitalSiteController.getTags)

// 视频代理路由 - 解决CORS问题（支持范围请求）
router.get('/video-proxy', async (req, res) => {
  try {
    const { url } = req.query

    if (!url) {
      return res.status(400).json({ error: '缺少url参数' })
    }

    // 验证URL是否来自可信源
    if (!url.startsWith('http://10.10.19.3/')) {
      return res.status(403).json({ error: '不允许的视频源' })
    }

    console.log('代理视频请求:', url)

    // 准备请求头（支持范围请求）
    const headers = {}
    if (req.headers.range) {
      headers['Range'] = req.headers.range
    }

    // 使用流式传输视频
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 30000,
      headers: headers,
      validateStatus: (status) => status < 500 // 接受 200-499 状态码
    })

    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Range')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges')

    // 设置视频相关响应头
    res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4')
    res.setHeader('Accept-Ranges', 'bytes')

    // 如果是范围请求，设置206状态码
    if (response.status === 206) {
      res.status(206)
      if (response.headers['content-range']) {
        res.setHeader('Content-Range', response.headers['content-range'])
      }
    }

    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length'])
    }

    // 流式传输
    response.data.pipe(res)

    // 处理流错误
    response.data.on('error', (err) => {
      console.error('视频流传输错误:', err.message)
      if (!res.headersSent) {
        res.status(500).json({ error: '视频流传输失败' })
      }
    })

  } catch (error) {
    console.error('视频代理错误:', error.message, error.response?.status)
    if (!res.headersSent) {
      res.status(500).json({ error: '视频加载失败: ' + error.message })
    }
  }
})

module.exports = router
