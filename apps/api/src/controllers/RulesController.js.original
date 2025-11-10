const RulesService = require('../services/system/RulesService')

class RulesController {
  constructor() {
    this.rulesService = new RulesService()
  }

  async getRules(req, res) {
    try {
      const result = await this.rulesService.list(req.query)
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '获取规则列表失败', error: error.message })
    }
  }

  async getRule(req, res) {
    try {
      const result = await this.rulesService.getById(req.params.id)
      if (result.success) {
        res.json(result)
      } else {
        res.status(404).json(result)
      }
    } catch (error) {
      res.status(500).json({ success: false, message: '获取规则失败', error: error.message })
    }
  }

  async createRule(req, res) {
    try {
      const data = { ...req.body, created_by: req.user.id }
      const result = await this.rulesService.create(data)
      res.status(201).json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '创建规则失败', error: error.message })
    }
  }

  async updateRule(req, res) {
    try {
      const result = await this.rulesService.update(req.params.id, req.body)
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '更新规则失败', error: error.message })
    }
  }

  async deleteRule(req, res) {
    try {
      const result = await this.rulesService.delete(req.params.id)
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '删除规则失败', error: error.message })
    }
  }

  async executeRule(req, res) {
    try {
      const result = await this.rulesService.execute(req.params.id, req.body)
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, message: '执行规则失败', error: error.message })
    }
  }
}

const controller = new RulesController()
module.exports = {
  getRules: (req, res) => controller.getRules(req, res),
  getRule: (req, res) => controller.getRule(req, res),
  createRule: (req, res) => controller.createRule(req, res),
  updateRule: (req, res) => controller.updateRule(req, res),
  deleteRule: (req, res) => controller.deleteRule(req, res),
  executeRule: (req, res) => controller.executeRule(req, res)
}
