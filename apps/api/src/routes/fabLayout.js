/**
 * FAB 布局生成路由
 */

const express = require('express')
const router = express.Router()
const FabLayoutController = require('../controllers/FabLayoutController')
const knex = require('../config/database')

// 生成 FAB 布局
router.post('/generate', FabLayoutController.generateLayout.bind(FabLayoutController))

// 获取示例输入
router.get('/example', FabLayoutController.getExample.bind(FabLayoutController))

// 获取功能区配置
router.get('/zones', FabLayoutController.getZoneConfig.bind(FabLayoutController))

// 验证输入参数
router.post('/validate', FabLayoutController.validateInput.bind(FabLayoutController))

// 导出为 Revit 格式
router.post('/export/revit', FabLayoutController.exportRevit.bind(FabLayoutController))

// ============ 约束管理 API ============

// 布局约束 CRUD
router.get('/constraints', async (req, res) => {
  try {
    const data = await knex('fab_layout_constraints').orderBy('priority')
    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/constraints', async (req, res) => {
  try {
    const id = `constraint_${Date.now()}`
    await knex('fab_layout_constraints').insert({ id, ...req.body, is_active: true })
    res.json({ success: true, id })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/constraints/:id', async (req, res) => {
  try {
    await knex('fab_layout_constraints').where('id', req.params.id).update(req.body)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.delete('/constraints/:id', async (req, res) => {
  try {
    await knex('fab_layout_constraints').where('id', req.params.id).delete()
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 邻接关系 CRUD
router.get('/adjacency', async (req, res) => {
  try {
    const data = await knex('fab_zone_adjacency').orderBy('priority')
    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/adjacency', async (req, res) => {
  try {
    const id = `adjacency_${Date.now()}`
    await knex('fab_zone_adjacency').insert({ id, ...req.body, is_active: true })
    res.json({ success: true, id })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/adjacency/:id', async (req, res) => {
  try {
    await knex('fab_zone_adjacency').where('id', req.params.id).update(req.body)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.delete('/adjacency/:id', async (req, res) => {
  try {
    await knex('fab_zone_adjacency').where('id', req.params.id).delete()
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 动线规则 CRUD
router.get('/traffic-rules', async (req, res) => {
  try {
    const data = await knex('fab_traffic_rules').orderBy('priority')
    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/traffic-rules', async (req, res) => {
  try {
    const id = `traffic_${Date.now()}`
    await knex('fab_traffic_rules').insert({ id, ...req.body, is_active: true })
    res.json({ success: true, id })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/traffic-rules/:id', async (req, res) => {
  try {
    await knex('fab_traffic_rules').where('id', req.params.id).update(req.body)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.delete('/traffic-rules/:id', async (req, res) => {
  try {
    await knex('fab_traffic_rules').where('id', req.params.id).delete()
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 强排规则 API（从 design_rules 表获取 rule_type='strong_layout' 的规则）
router.get('/strong-layout-rules', async (req, res) => {
  try {
    const rules = await knex('design_rules')
      .where('rule_type', 'strong_layout')
      .where('is_active', true)
      .orderBy('priority', 'desc')

    const data = rules.map(r => {
      const structure = typeof r.rule_structure === 'string'
        ? JSON.parse(r.rule_structure)
        : r.rule_structure

      return {
        id: r.id,
        code: r.rule_code,
        name: r.rule_name,
        subType: structure?.subType || '',
        constraintType: structure?.constraintType || 'MIN',
        value: parseFloat(structure?.value) || 0,
        unit: structure?.unit || '',
        scope: structure?.scope || {},
        reviewStatus: r.review_status,
        confidence: r.confidence_score,
        source: typeof r.source === 'string' ? JSON.parse(r.source) : r.source
      }
    })

    res.json({ success: true, data, total: data.length })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 获取约束汇总（供布局生成预览）
router.get('/constraints-summary', async (req, res) => {
  try {
    const [constraints, adjacency, trafficRules, strongLayoutRules] = await Promise.all([
      knex('fab_layout_constraints').where('is_active', true).count('* as count').first(),
      knex('fab_zone_adjacency').where('is_active', true).count('* as count').first(),
      knex('fab_traffic_rules').where('is_active', true).count('* as count').first(),
      knex('design_rules')
        .where('rule_type', 'strong_layout')
        .where('is_active', true)
        .whereIn('review_status', ['approved', 'auto_approved'])
        .count('* as count')
        .first()
    ])

    res.json({
      success: true,
      data: {
        fab_constraints: parseInt(constraints.count),
        adjacency_rules: parseInt(adjacency.count),
        traffic_rules: parseInt(trafficRules.count),
        strong_layout_rules: parseInt(strongLayoutRules.count),
        total: parseInt(constraints.count) + parseInt(adjacency.count) +
               parseInt(trafficRules.count) + parseInt(strongLayoutRules.count)
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

module.exports = router
