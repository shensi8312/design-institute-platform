const DigitalSiteService = require('../services/system/DigitalSiteService')

/**
 * 数字工地控制器 - 暂时返回占位数据，方便前端联调
 */
class DigitalSiteController {
  constructor() {
    this.digitalSiteService = new DigitalSiteService()
  }

  async getOverview(req, res) {
    try {
      const result = await this.digitalSiteService.getOverview({ siteId: req.query.siteId })
      res.json(result)
    } catch (error) {
      console.error('获取数字工地概览失败:', error)
      res.status(500).json({
        success: false,
        message: '获取数字工地概览失败',
        error: error.message
      })
    }
  }

  async getProjects(req, res) {
    try {
      const result = await this.digitalSiteService.listProjects()
      res.json(result)
    } catch (error) {
      console.error('获取数字工地项目失败:', error)
      res.status(500).json({
        success: false,
        message: '获取数字工地项目失败',
        error: error.message
      })
    }
  }

  async getAlerts(req, res) {
    try {
      const result = await this.digitalSiteService.listAlerts({
        page: parseInt(req.query.page, 10) || 1,
        pageSize: parseInt(req.query.pageSize, 10) || 20,
        siteId: req.query.siteId,
        projectId: req.query.projectId,
        level: req.query.level,
        status: req.query.status,
        from: req.query.from,
        to: req.query.to,
        tagId: req.query.tagId,
        orderBy: req.query.orderBy,
        order: req.query.order
      })
      res.json(result)
    } catch (error) {
      console.error('获取数字工地告警失败:', error)
      res.status(500).json({
        success: false,
        message: '获取数字工地告警失败',
        error: error.message
      })
    }
  }

  async createAlert(req, res) {
    try {
      const userId = req.user?.id || 'system'
      const result = await this.digitalSiteService.createAlert(req.body, userId)
      res.status(201).json(result)
    } catch (error) {
      console.error('创建数字工地告警失败:', error)
      res.status(400).json({
        success: false,
        message: error.message || '创建数字工地告警失败'
      })
    }
  }

  async acknowledgeAlert(req, res) {
    try {
      const userId = req.user?.id || 'system'
      const status = req.body.status || 'acknowledged'
      const note = req.body.note
      const result = await this.digitalSiteService.acknowledgeAlert(req.params.id, status, note, userId)

      if (!result.success) {
        return res.status(404).json(result)
      }

      res.json(result)
    } catch (error) {
      console.error('更新告警状态失败:', error)
      res.status(400).json({
        success: false,
        message: error.message || '更新告警状态失败'
      })
    }
  }

  async resolveAlert(req, res) {
    try {
      const userId = req.user?.id || 'system'
      const note = req.body.note
      const result = await this.digitalSiteService.resolveAlert(req.params.id, note, userId)

      if (!result.success) {
        return res.status(404).json(result)
      }

      res.json(result)
    } catch (error) {
      console.error('关闭告警失败:', error)
      res.status(400).json({
        success: false,
        message: error.message || '关闭告警失败'
      })
    }
  }

  async getAlertDetail(req, res) {
    try {
      const result = await this.digitalSiteService.getAlertById(req.params.id)
      if (!result.success) {
        return res.status(404).json(result)
      }
      res.json(result)
    } catch (error) {
      console.error('获取告警详情失败:', error)
      res.status(500).json({
        success: false,
        message: '获取告警详情失败',
        error: error.message
      })
    }
  }

  async getStats(req, res) {
    try {
      const result = await this.digitalSiteService.getStats({
        siteId: req.query.siteId,
        from: req.query.from,
        to: req.query.to
      })
      res.json(result)
    } catch (error) {
      console.error('获取数字工地统计失败:', error)
      res.status(500).json({
        success: false,
        message: '获取数字工地统计失败',
        error: error.message
      })
    }
  }

  async getTags(req, res) {
    try {
      const result = await this.digitalSiteService.listTags()
      res.json(result)
    } catch (error) {
      console.error('获取数字工地标签失败:', error)
      res.status(500).json({
        success: false,
        message: '获取数字工地标签失败',
        error: error.message
      })
    }
  }
}

const controller = new DigitalSiteController()

module.exports = {
  getOverview: (req, res) => controller.getOverview(req, res),
  getProjects: (req, res) => controller.getProjects(req, res),
  getAlerts: (req, res) => controller.getAlerts(req, res),
  createAlert: (req, res) => controller.createAlert(req, res),
  acknowledgeAlert: (req, res) => controller.acknowledgeAlert(req, res),
  resolveAlert: (req, res) => controller.resolveAlert(req, res),
  getAlertDetail: (req, res) => controller.getAlertDetail(req, res),
  getStats: (req, res) => controller.getStats(req, res),
  getTags: (req, res) => controller.getTags(req, res)
}
