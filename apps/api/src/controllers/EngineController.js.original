const EngineService = require('../services/system/EngineService')

class EngineController {
  constructor() {
    this.engineService = new EngineService()
  }

  async getEngines(req, res) {
    try {
      const result = await this.engineService.list(req.query)
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '获取引擎列表失败', error: error.message })
    }
  }

  async getEngine(req, res) {
    try {
      const result = await this.engineService.getById(req.params.id)
      if (result.success) {
        res.json(result)
      } else {
        res.status(404).json(result)
      }
    } catch (error) {
      res.status(500).json({ success: false, message: '获取引擎失败', error: error.message })
    }
  }

  async createEngine(req, res) {
    try {
      const data = {
        ...req.body,
        created_by: req.user.id,
        organization_id: req.user.organization_id
      }
      const result = await this.engineService.create(data)
      res.status(201).json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '创建引擎失败', error: error.message })
    }
  }

  async updateEngine(req, res) {
    try {
      const result = await this.engineService.update(req.params.id, req.body)
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '更新引擎失败', error: error.message })
    }
  }

  async deleteEngine(req, res) {
    try {
      const result = await this.engineService.delete(req.params.id)
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '删除引擎失败', error: error.message })
    }
  }

  async deployEngine(req, res) {
    try {
      const result = await this.engineService.deploy(req.params.id)
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '部署引擎失败', error: error.message })
    }
  }

  async executeEngine(req, res) {
    try {
      const result = await this.engineService.execute(req.params.id, req.body)
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '执行引擎失败', error: error.message })
    }
  }
}

const controller = new EngineController()
module.exports = {
  getEngines: (req, res) => controller.getEngines(req, res),
  getEngine: (req, res) => controller.getEngine(req, res),
  createEngine: (req, res) => controller.createEngine(req, res),
  updateEngine: (req, res) => controller.updateEngine(req, res),
  deleteEngine: (req, res) => controller.deleteEngine(req, res),
  deployEngine: (req, res) => controller.deployEngine(req, res),
  executeEngine: (req, res) => controller.executeEngine(req, res)
}
