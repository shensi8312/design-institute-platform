const ContractReviewService = require('../services/ai/ContractReviewService')

/**
 * AI审查Controller
 * V3.0 合同AI审查
 */
class AIReviewController {
  constructor() {
    this.contractReviewService = new ContractReviewService()
  }

  /**
   * 启动合同审查
   */
  async startContractReview(req, res) {
    try {
      const { documentId } = req.body
      const options = req.body.options || {}

      if (!documentId) {
        return res.status(400).json({
          success: false,
          message: '文档ID不能为空'
        })
      }

      const result = await this.contractReviewService.startReview(documentId, options)

      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('启动合同审查失败:', error)
      res.status(500).json({
        success: false,
        message: '启动审查失败',
        error: error.message
      })
    }
  }

  /**
   * 获取最新审查任务
   */
  async getLatestJob(req, res) {
    try {
      const { documentId } = req.query

      if (!documentId) {
        return res.status(400).json({
          success: false,
          message: '文档ID不能为空'
        })
      }

      const result = await this.contractReviewService.getLatestJob(documentId)

      if (result.success) {
        res.json(result)
      } else {
        res.status(404).json(result)
      }
    } catch (error) {
      console.error('获取最新任务失败:', error)
      res.status(500).json({
        success: false,
        message: '获取最新任务失败',
        error: error.message
      })
    }
  }

  /**
   * 获取审查任务状态
   */
  async getJobStatus(req, res) {
    try {
      const { jobId } = req.params

      const result = await this.contractReviewService.getJobStatus(jobId)

      if (result.success) {
        res.json(result)
      } else {
        res.status(404).json(result)
      }
    } catch (error) {
      console.error('获取任务状态失败:', error)
      res.status(500).json({
        success: false,
        message: '获取任务状态失败',
        error: error.message
      })
    }
  }
}

// 创建实例并导出
const controller = new AIReviewController()

module.exports = {
  startContractReview: (req, res) => controller.startContractReview(req, res),
  getLatestJob: (req, res) => controller.getLatestJob(req, res),
  getJobStatus: (req, res) => controller.getJobStatus(req, res)
}
