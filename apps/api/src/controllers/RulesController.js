const RulesService = require('../services/system/RulesService')
const RuleExtractionService = require('../services/rules/RuleExtractionService')
const db = require('../config/database')

class RulesController {
  constructor() {
    this.rulesService = new RulesService()
    this.extractionService = new RuleExtractionService()
  }

  // 获取规则列表(支持筛选+分页)
  async getRules(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        category_id,
        review_status,
        priority,
        search
      } = req.query

      let query = db('design_rules')
        .select('design_rules.*', 'rule_categories.name as category_name')
        .leftJoin('rule_categories', 'design_rules.category_id', 'rule_categories.id')
        .where('design_rules.deleted_at', null)

      // 筛选条件
      if (category_id) {
        query = query.where('design_rules.category_id', category_id)
      }

      if (review_status) {
        query = query.where('design_rules.review_status', review_status)
      }

      if (priority) {
        query = query.where('design_rules.priority', priority)
      }

      if (search) {
        query = query.where(function() {
          this.where('design_rules.rule_code', 'like', `%${search}%`)
            .orWhere('design_rules.rule_name', 'like', `%${search}%`)
        })
      }

      // 计算总数
      const countQuery = query.clone().count('* as total')
      const [{ total }] = await countQuery

      // 分页查询
      const offset = (page - 1) * limit
      const rules = await query
        .orderBy('design_rules.created_at', 'desc')
        .limit(limit)
        .offset(offset)

      res.json({
        success: true,
        data: {
          rules,
          total: parseInt(total),
          page: parseInt(page),
          limit: parseInt(limit)
        }
      })
    } catch (error) {
      console.error('[RulesController] 获取规则列表失败:', error)
      res.status(500).json({ success: false, message: '获取规则列表失败', error: error.message })
    }
  }

  // 获取规则详情
  async getRuleById(req, res) {
    try {
      const rule = await db('design_rules')
        .select('design_rules.*', 'rule_categories.name as category_name')
        .leftJoin('rule_categories', 'design_rules.category_id', 'rule_categories.id')
        .where('design_rules.id', req.params.id)
        .where('design_rules.deleted_at', null)
        .first()

      if (!rule) {
        return res.status(404).json({ success: false, message: '规则不存在' })
      }

      res.json({ success: true, data: rule })
    } catch (error) {
      console.error('[RulesController] 获取规则详情失败:', error)
      res.status(500).json({ success: false, message: '获取规则详情失败', error: error.message })
    }
  }

  // 更新规则
  async updateRule(req, res) {
    try {
      const { id } = req.params
      const updates = { ...req.body, updated_at: new Date() }

      // 如果更新parameters,确保是JSON格式
      if (updates.parameters && typeof updates.parameters === 'object') {
        updates.parameters = JSON.stringify(updates.parameters)
      }

      await db('design_rules')
        .where('id', id)
        .update(updates)

      res.json({ success: true, message: '更新成功' })
    } catch (error) {
      console.error('[RulesController] 更新规则失败:', error)
      res.status(500).json({ success: false, message: '更新规则失败', error: error.message })
    }
  }

  // 审核通过
  async approveRule(req, res) {
    try {
      const { id } = req.params
      const { reviewed_by, review_comment } = req.body

      await db('design_rules')
        .where('id', id)
        .update({
          review_status: 'approved',
          reviewed_by,
          reviewed_at: new Date(),
          review_comment,
          is_active: true,
          updated_at: new Date()
        })

      res.json({ success: true, message: '审核通过' })
    } catch (error) {
      console.error('[RulesController] 审核通过失败:', error)
      res.status(500).json({ success: false, message: '审核通过失败', error: error.message })
    }
  }

  // 审核拒绝
  async rejectRule(req, res) {
    try {
      const { id } = req.params
      const { reviewed_by, review_comment } = req.body

      await db('design_rules')
        .where('id', id)
        .update({
          review_status: 'rejected',
          reviewed_by,
          reviewed_at: new Date(),
          review_comment,
          is_active: false,
          updated_at: new Date()
        })

      res.json({ success: true, message: '已拒绝' })
    } catch (error) {
      console.error('[RulesController] 审核拒绝失败:', error)
      res.status(500).json({ success: false, message: '审核拒绝失败', error: error.message })
    }
  }

  // 批量审核通过
  async batchApprove(req, res) {
    try {
      const { rule_ids, reviewed_by } = req.body

      if (!rule_ids || rule_ids.length === 0) {
        return res.status(400).json({ success: false, message: '请提供规则ID' })
      }

      await db('design_rules')
        .whereIn('id', rule_ids)
        .update({
          review_status: 'approved',
          reviewed_by,
          reviewed_at: new Date(),
          is_active: true,
          updated_at: new Date()
        })

      res.json({
        success: true,
        message: `成功审核 ${rule_ids.length} 条规则`
      })
    } catch (error) {
      console.error('[RulesController] 批量审核失败:', error)
      res.status(500).json({ success: false, message: '批量审核失败', error: error.message })
    }
  }

  // 获取分类列表
  async getCategories(req, res) {
    try {
      const categories = await db('rule_categories')
        .where('is_active', true)
        .orderBy('sort_order', 'asc')

      res.json({ success: true, data: categories })
    } catch (error) {
      console.error('[RulesController] 获取分类失败:', error)
      res.status(500).json({ success: false, message: '获取分类失败', error: error.message })
    }
  }

  // 获取分类统计
  async getCategoriesWithStats(req, res) {
    try {
      const categories = await db('rule_categories')
        .select(
          'rule_categories.*',
          db.raw('COUNT(design_rules.id) as count')
        )
        .leftJoin('design_rules', function() {
          this.on('rule_categories.id', '=', 'design_rules.category_id')
            .andOn('design_rules.deleted_at', 'IS', db.raw('NULL'))
        })
        .where('rule_categories.is_active', true)
        .groupBy('rule_categories.id')
        .orderBy('rule_categories.sort_order', 'asc')

      res.json({ success: true, data: categories })
    } catch (error) {
      console.error('[RulesController] 获取分类统计失败:', error)
      res.status(500).json({ success: false, message: '获取分类统计失败', error: error.message })
    }
  }

  // 从文档提取规则
  async extractRulesFromDocument(req, res) {
    try {
      const { documentId } = req.body

      if (!documentId) {
        return res.status(400).json({ success: false, message: '请提供文档ID' })
      }

      console.log(`[RulesController] 开始从文档提取规则: ${documentId}`)

      const result = await this.extractionService.extractRulesFromGraph(documentId)

      res.json(result)
    } catch (error) {
      console.error('[RulesController] 提取规则失败:', error)
      res.status(500).json({ success: false, message: '提取规则失败', error: error.message })
    }
  }

  // 删除规则(软删除)
  async deleteRule(req, res) {
    try {
      await db('design_rules')
        .where('id', req.params.id)
        .update({
          deleted_at: new Date(),
          is_active: false
        })

      res.json({ success: true, message: '删除成功' })
    } catch (error) {
      console.error('[RulesController] 删除规则失败:', error)
      res.status(500).json({ success: false, message: '删除规则失败', error: error.message })
    }
  }

  // 创建规则
  async createRule(req, res) {
    try {
      const data = {
        ...req.body,
        created_by: req.user.id,
        created_at: new Date(),
        updated_at: new Date()
      }

      const [id] = await db('design_rules').insert(data).returning('id')

      res.status(201).json({ success: true, data: { id } })
    } catch (error) {
      console.error('[RulesController] 创建规则失败:', error)
      res.status(500).json({ success: false, message: '创建规则失败', error: error.message })
    }
  }
}

const controller = new RulesController()

module.exports = {
  getRules: (req, res) => controller.getRules(req, res),
  getRuleById: (req, res) => controller.getRuleById(req, res),
  updateRule: (req, res) => controller.updateRule(req, res),
  deleteRule: (req, res) => controller.deleteRule(req, res),
  approveRule: (req, res) => controller.approveRule(req, res),
  rejectRule: (req, res) => controller.rejectRule(req, res),
  batchApprove: (req, res) => controller.batchApprove(req, res),
  getCategories: (req, res) => controller.getCategories(req, res),
  getCategoriesWithStats: (req, res) => controller.getCategoriesWithStats(req, res),
  extractRulesFromDocument: (req, res) => controller.extractRulesFromDocument(req, res),
  createRule: (req, res) => controller.createRule(req, res)
}
