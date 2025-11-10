const BaseService = require('../BaseService')
const BaseRepository = require('../../repositories/BaseRepository')

class RulesRepository extends BaseRepository {
  constructor() {
    super('business_rules')
  }
}

class RulesService extends BaseService {
  constructor() {
    const rulesRepository = new RulesRepository()
    super(rulesRepository)
    this.rulesRepository = rulesRepository
  }

  async create(data) {
    try {
      const rule = await this.rulesRepository.create({
        name: data.name,
        description: data.description,
        type: data.type,
        conditions: JSON.stringify(data.conditions),
        actions: JSON.stringify(data.actions),
        priority: data.priority || 0,
        status: 'active',
        created_by: data.created_by
      })
      return { success: true, data: rule }
    } catch (error) {
      return { success: false, message: '创建规则失败', error: error.message }
    }
  }

  async list(options = {}) {
    try {
      const rules = await this.rulesRepository.findAll(options)
      return { success: true, data: rules }
    } catch (error) {
      return { success: false, message: '获取规则列表失败', error: error.message }
    }
  }

  async getById(id) {
    try {
      const rule = await this.rulesRepository.findById(id)
      if (!rule) {
        return { success: false, message: '规则不存在' }
      }
      rule.conditions = JSON.parse(rule.conditions || '[]')
      rule.actions = JSON.parse(rule.actions || '[]')
      return { success: true, data: rule }
    } catch (error) {
      return { success: false, message: '获取规则失败', error: error.message }
    }
  }

  async update(id, data) {
    try {
      const updates = {}
      if (data.name) updates.name = data.name
      if (data.description) updates.description = data.description
      if (data.conditions) updates.conditions = JSON.stringify(data.conditions)
      if (data.actions) updates.actions = JSON.stringify(data.actions)
      if (data.priority !== undefined) updates.priority = data.priority
      if (data.status) updates.status = data.status
      
      await this.rulesRepository.update(id, updates)
      return { success: true, message: '规则更新成功' }
    } catch (error) {
      return { success: false, message: '更新规则失败', error: error.message }
    }
  }

  async delete(id) {
    try {
      await this.rulesRepository.delete(id)
      return { success: true, message: '规则删除成功' }
    } catch (error) {
      return { success: false, message: '删除规则失败', error: error.message }
    }
  }

  async execute(ruleId, context = {}) {
    try {
      const rule = await this.getById(ruleId)
      if (!rule.success) return rule
      
      // 评估条件
      const conditionsMet = this.evaluateConditions(rule.data.conditions, context)
      
      if (conditionsMet) {
        // 执行动作
        const results = await this.executeActions(rule.data.actions, context)
        return { success: true, executed: true, results }
      }
      
      return { success: true, executed: false, message: '条件不满足' }
    } catch (error) {
      return { success: false, message: '执行规则失败', error: error.message }
    }
  }

  evaluateConditions(conditions, context) {
    // 简化的条件评估逻辑
    return conditions.every(condition => {
      const value = context[condition.field]
      switch (condition.operator) {
        case 'equals': return value === condition.value
        case 'not_equals': return value !== condition.value
        case 'greater_than': return value > condition.value
        case 'less_than': return value < condition.value
        case 'contains': return value && value.includes(condition.value)
        default: return false
      }
    })
  }

  async executeActions(actions, context) {
    const results = []
    for (const action of actions) {
      // 简化的动作执行逻辑
      results.push({
        action: action.type,
        result: 'executed',
        context
      })
    }
    return results
  }
}

module.exports = RulesService
