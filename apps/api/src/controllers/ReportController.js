const ReportGenerationService = require('../services/report/ReportGenerationService')

/**
 * 报告Controller
 * V3.0 报告生成
 */
class ReportController {
  constructor() {
    this.reportService = new ReportGenerationService()
  }

  /**
   * 生成报告
   */
  async generate(req, res) {
    try {
      const {
        projectId,
        documentId,
        reportType,
        format
      } = req.body

      if (!documentId) {
        return res.status(400).json({
          success: false,
          message: '文档ID不能为空'
        })
      }

      const result = await this.reportService.generateReport({
        projectId,
        documentId,
        reportType,
        format
      })

      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('生成报告失败:', error)
      res.status(500).json({
        success: false,
        message: '生成报告失败',
        error: error.message
      })
    }
  }

  /**
   * 下载报告
   */
  async download(req, res) {
    try {
      const { reportId } = req.params

      // TODO: 实现报告下载逻辑
      // 需要在数据库中记录生成的报告信息

      res.status(501).json({
        success: false,
        message: '报告下载功能待实现'
      })
    } catch (error) {
      console.error('下载报告失败:', error)
      res.status(500).json({
        success: false,
        message: '下载报告失败',
        error: error.message
      })
    }
  }
}

// 创建实例并导出
const controller = new ReportController()

module.exports = {
  generate: (req, res) => controller.generate(req, res),
  download: (req, res) => controller.download(req, res)
}
