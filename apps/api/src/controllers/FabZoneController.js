/**
 * FAB 功能区配置控制器
 */

const knex = require('../config/database')

class FabZoneController {
  /**
   * 获取所有功能区配置
   * GET /api/fab-zone
   */
  async getAll(req, res) {
    try {
      const { category, is_active } = req.query

      let query = knex('fab_zone_config').orderBy('sort_order')

      if (category) {
        query = query.where('category', category)
      }
      if (is_active !== undefined) {
        query = query.where('is_active', is_active === 'true')
      }

      const zones = await query

      res.json({
        success: true,
        data: zones,
        total: zones.length
      })
    } catch (error) {
      console.error('[FabZoneController] 获取功能区失败:', error)
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * 获取单个功能区
   * GET /api/fab-zone/:id
   */
  async getById(req, res) {
    try {
      const zone = await knex('fab_zone_config').where('id', req.params.id).first()

      if (!zone) {
        return res.status(404).json({ success: false, error: '功能区不存在' })
      }

      res.json({ success: true, data: zone })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * 创建功能区
   * POST /api/fab-zone
   */
  async create(req, res) {
    try {
      const data = req.body

      // 验证必填字段
      if (!data.zone_type || !data.name) {
        return res.status(400).json({ success: false, error: '功能区类型和名称必填' })
      }

      // 检查类型是否已存在
      const existing = await knex('fab_zone_config').where('zone_type', data.zone_type).first()
      if (existing) {
        return res.status(400).json({ success: false, error: '功能区类型已存在' })
      }

      const [zone] = await knex('fab_zone_config').insert({
        ...data,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      }).returning('*')

      res.json({ success: true, data: zone })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * 更新功能区
   * PUT /api/fab-zone/:id
   */
  async update(req, res) {
    try {
      const data = req.body
      delete data.id
      delete data.created_at

      const [zone] = await knex('fab_zone_config')
        .where('id', req.params.id)
        .update({
          ...data,
          updated_at: knex.fn.now()
        })
        .returning('*')

      if (!zone) {
        return res.status(404).json({ success: false, error: '功能区不存在' })
      }

      res.json({ success: true, data: zone })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * 删除功能区
   * DELETE /api/fab-zone/:id
   */
  async delete(req, res) {
    try {
      const deleted = await knex('fab_zone_config').where('id', req.params.id).delete()

      if (!deleted) {
        return res.status(404).json({ success: false, error: '功能区不存在' })
      }

      res.json({ success: true, message: '删除成功' })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * 批量导入功能区配置（从Excel）
   * POST /api/fab-zone/import
   */
  async importFromExcel(req, res) {
    try {
      const { zones } = req.body

      if (!Array.isArray(zones) || zones.length === 0) {
        return res.status(400).json({ success: false, error: '请提供功能区数据' })
      }

      const results = { created: 0, updated: 0, errors: [] }

      for (const zone of zones) {
        try {
          const existing = await knex('fab_zone_config').where('zone_type', zone.zone_type).first()

          if (existing) {
            await knex('fab_zone_config')
              .where('zone_type', zone.zone_type)
              .update({ ...zone, updated_at: knex.fn.now() })
            results.updated++
          } else {
            await knex('fab_zone_config').insert({
              ...zone,
              created_at: knex.fn.now(),
              updated_at: knex.fn.now()
            })
            results.created++
          }
        } catch (err) {
          results.errors.push({ zone_type: zone.zone_type, error: err.message })
        }
      }

      res.json({ success: true, data: results })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * 导出功能区配置模板
   * GET /api/fab-zone/template
   */
  async getTemplate(req, res) {
    try {
      const template = {
        description: 'FAB功能区配置导入模板',
        columns: [
          { field: 'zone_type', label: '功能区类型', required: true, example: 'cleanroom' },
          { field: 'name', label: '中文名称', required: true, example: '洁净室' },
          { field: 'name_en', label: '英文名称', required: false, example: 'Cleanroom' },
          { field: 'category', label: '分类', required: true, example: 'production', options: ['production', 'utility', 'logistics', 'admin', 'safety', 'site'] },
          { field: 'area_ratio', label: '面积比例', required: false, example: 0.35, note: '相对洁净室面积的比例' },
          { field: 'default_height', label: '默认高度(m)', required: false, example: 12 },
          { field: 'default_floors', label: '默认层数', required: false, example: 2 },
          { field: 'width_depth_ratio', label: '宽深比', required: false, example: 1.5 },
          { field: 'color', label: '显示颜色', required: false, example: '#4a90d9' },
          { field: 'properties', label: '属性(JSON)', required: false, example: '{"cleanroom_class": "ISO 5"}' }
        ],
        sample_data: [
          {
            zone_type: 'cleanroom',
            name: '洁净室',
            name_en: 'Cleanroom',
            category: 'production',
            area_ratio: 1.0,
            default_height: 12,
            default_floors: 2,
            width_depth_ratio: 1.5,
            color: '#4a90d9',
            properties: { cleanroom_class: 'ISO 5/6' }
          }
        ]
      }

      res.json({ success: true, data: template })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * 获取分类统计
   * GET /api/fab-zone/statistics
   */
  async getStatistics(req, res) {
    try {
      const stats = await knex('fab_zone_config')
        .select('category')
        .count('* as count')
        .groupBy('category')

      const total = await knex('fab_zone_config').count('* as total').first()
      const active = await knex('fab_zone_config').where('is_active', true).count('* as count').first()

      res.json({
        success: true,
        data: {
          total: parseInt(total.total),
          active: parseInt(active.count),
          by_category: stats.reduce((acc, s) => {
            acc[s.category] = parseInt(s.count)
            return acc
          }, {})
        }
      })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
}

module.exports = new FabZoneController()
