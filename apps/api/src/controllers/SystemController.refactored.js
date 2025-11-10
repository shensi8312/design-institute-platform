const SystemService = require('../services/system/SystemService')

class SystemController {
  constructor() {
    this.systemService = new SystemService()
  }

  async getSystemInfo(req, res) {
    try {
      const result = await this.systemService.getSystemInfo()
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '获取系统信息失败', error: error.message })
    }
  }

  async getDatabaseStatus(req, res) {
    try {
      const result = await this.systemService.getDatabaseStatus()
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '获取数据库状态失败', error: error.message })
    }
  }

  async getServiceHealth(req, res) {
    try {
      const result = await this.systemService.getServiceHealth()
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '健康检查失败', error: error.message })
    }
  }

  async getSystemConfig(req, res) {
    try {
      const result = await this.systemService.getSystemConfig()
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '获取系统配置失败', error: error.message })
    }
  }

  async updateSystemConfig(req, res) {
    try {
      const { key, value } = req.body
      const result = await this.systemService.updateSystemConfig(key, value)
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '更新系统配置失败', error: error.message })
    }
  }

  async getSystemStatus(req, res) {
    try {
      const status = {
        success: true,
        data: {
          status: 'operational',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          services: {
            database: 'connected',
            redis: 'connected',
            minio: 'connected'
          },
          timestamp: new Date()
        }
      }
      res.json(status)
    } catch (error) {
      res.status(500).json({ success: false, message: '获取系统状态失败', error: error.message })
    }
  }
}

const controller = new SystemController()
module.exports = {
  getSystemInfo: (req, res) => controller.getSystemInfo(req, res),
  getDatabaseStatus: (req, res) => controller.getDatabaseStatus(req, res),
  getServiceHealth: (req, res) => controller.getServiceHealth(req, res),
  getSystemConfig: (req, res) => controller.getSystemConfig(req, res),
  updateSystemConfig: (req, res) => controller.updateSystemConfig(req, res),
  getSystemStatus: (req, res) => controller.getSystemStatus(req, res)
}
