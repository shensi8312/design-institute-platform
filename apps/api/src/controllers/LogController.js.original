const LogService = require('../services/system/LogService')

class LogController {
  constructor() {
    this.logService = new LogService()
  }

  async getLogs(req, res) {
    try {
      const filters = {
        ...req.query,
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0
      }
      const result = await this.logService.query(filters)
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '获取日志失败', error: error.message })
    }
  }

  async getStatistics(req, res) {
    try {
      const result = await this.logService.getStatistics(req.query)
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '获取统计失败', error: error.message })
    }
  }

  async exportLogs(req, res) {
    try {
      const result = await this.logService.export(req.query, req.query.format)
      if (req.query.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', 'attachment; filename=logs.csv')
        res.send(result.data)
      } else {
        res.json(result)
      }
    } catch (error) {
      res.status(500).json({ success: false, message: '导出日志失败', error: error.message })
    }
  }

  async cleanup(req, res) {
    try {
      const { days = 90 } = req.body
      const result = await this.logService.cleanup(days)
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '清理日志失败', error: error.message })
    }
  }
}

const controller = new LogController()
module.exports = {
  getLogs: (req, res) => controller.getLogs(req, res),
  getStatistics: (req, res) => controller.getStatistics(req, res),
  exportLogs: (req, res) => controller.exportLogs(req, res),
  cleanup: (req, res) => controller.cleanup(req, res)
}
