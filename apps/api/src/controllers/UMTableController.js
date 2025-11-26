/**
 * UM表配置控制器
 * 管理半导体行业的 UM 表（Utility Matrix）参数
 */

const knex = require('../config/database')

class UMTableController {
  /**
   * 获取所有配置
   * GET /api/um-table?type=tech_coefficient
   */
  async getConfigs(req, res) {
    try {
      const { type, active_only } = req.query

      let query = knex('um_table_config')
        .orderBy('config_type')
        .orderBy('sort_order')

      if (type) {
        query = query.where('config_type', type)
      }

      if (active_only === 'true') {
        query = query.where('is_active', true)
      }

      const configs = await query

      // 按类型分组
      const grouped = {}
      for (const config of configs) {
        if (!grouped[config.config_type]) {
          grouped[config.config_type] = []
        }
        grouped[config.config_type].push(config)
      }

      res.json({
        success: true,
        data: {
          list: configs,
          grouped: grouped,
          total: configs.length
        }
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * 获取单个配置
   * GET /api/um-table/:id
   */
  async getConfig(req, res) {
    try {
      const { id } = req.params

      const config = await knex('um_table_config')
        .where('id', id)
        .first()

      if (!config) {
        return res.status(404).json({
          success: false,
          error: '配置不存在'
        })
      }

      res.json({
        success: true,
        data: config
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * 创建配置
   * POST /api/um-table
   */
  async createConfig(req, res) {
    try {
      const {
        config_type,
        config_key,
        config_name,
        value,
        unit,
        description,
        formula,
        source,
        standard
      } = req.body

      if (!config_type || !config_key || value === undefined) {
        return res.status(400).json({
          success: false,
          error: '缺少必填字段：config_type, config_key, value'
        })
      }

      const [result] = await knex('um_table_config')
        .insert({
          config_type,
          config_key,
          config_name,
          value,
          unit,
          description,
          formula,
          source,
          standard,
          is_active: true
        })
        .returning('*')

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * 更新配置
   * PUT /api/um-table/:id
   */
  async updateConfig(req, res) {
    try {
      const { id } = req.params
      const updates = req.body

      delete updates.id
      delete updates.created_at
      updates.updated_at = new Date()

      const [result] = await knex('um_table_config')
        .where('id', id)
        .update(updates)
        .returning('*')

      if (!result) {
        return res.status(404).json({
          success: false,
          error: '配置不存在'
        })
      }

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * 删除配置
   * DELETE /api/um-table/:id
   */
  async deleteConfig(req, res) {
    try {
      const { id } = req.params

      const deleted = await knex('um_table_config')
        .where('id', id)
        .del()

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: '配置不存在'
        })
      }

      res.json({
        success: true,
        message: '删除成功'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * 批量更新排序
   * PUT /api/um-table/batch-sort
   */
  async batchUpdateSort(req, res) {
    try {
      const { items } = req.body  // [{id, sort_order}, ...]

      for (const item of items) {
        await knex('um_table_config')
          .where('id', item.id)
          .update({ sort_order: item.sort_order })
      }

      res.json({
        success: true,
        message: '排序更新成功'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * 获取配置类型列表
   * GET /api/um-table/types
   */
  async getConfigTypes(req, res) {
    const types = [
      { key: 'tech_coefficient', name: '技术节点系数', description: '不同制程对应的洁净室面积系数' },
      { key: 'cub_ratio', name: 'CUB比例', description: '不同工艺类型对应的CUB占比' },
      { key: 'um_ratio', name: 'UM表比例', description: '各功能区占洁净室面积的比例' },
      { key: 'node_multiplier', name: '制程乘数', description: '不同制程对CUB需求的乘数' }
    ]

    res.json({
      success: true,
      data: types
    })
  }

  /**
   * 获取导入模板
   * GET /api/um-table/template
   */
  async getTemplate(req, res) {
    const template = {
      description: 'UM表配置导入模板',
      columns: [
        { field: 'config_type', label: '配置类型', required: true, example: 'tech_coefficient', options: ['tech_coefficient', 'cub_ratio', 'um_ratio', 'node_multiplier'] },
        { field: 'config_key', label: '配置键', required: true, example: '28nm' },
        { field: 'config_name', label: '配置名称', required: false, example: '28纳米制程' },
        { field: 'value', label: '数值', required: true, example: 2.5 },
        { field: 'unit', label: '单位', required: false, example: '㎡/片' },
        { field: 'formula', label: '计算公式', required: false, example: '洁净室面积 = 月产能 × 系数' },
        { field: 'description', label: '说明', required: false, example: '28nm成熟制程，设备密度较低' },
        { field: 'source', label: '数据来源', required: false, example: '行业经验值' },
        { field: 'standard', label: '参考标准', required: false, example: 'SEMI E10-0304' }
      ],
      sample_data: [
        { config_type: 'tech_coefficient', config_key: '28nm', config_name: '28纳米', value: 2.5, unit: '㎡/片', formula: '洁净室面积 = 月产能 × 2.5', description: '成熟制程', source: '行业经验值' },
        { config_type: 'tech_coefficient', config_key: '14nm', config_name: '14纳米', value: 3.5, unit: '㎡/片', formula: '洁净室面积 = 月产能 × 3.5', description: '先进制程', source: '行业经验值' },
        { config_type: 'cub_ratio', config_key: 'logic', config_name: '逻辑芯片', value: 0.8, unit: '', formula: 'CUB面积 = 洁净室面积 × 0.8', description: '逻辑芯片CUB需求', source: '项目经验' },
        { config_type: 'um_ratio', config_key: 'subfab', config_name: 'SubFab', value: 0.6, unit: '', formula: 'SubFab面积 = 洁净室面积 × 0.6', description: 'SubFab层占比', source: 'UM表标准' }
      ]
    }

    res.json({ success: true, data: template })
  }

  /**
   * 批量导入配置（从Excel）
   * POST /api/um-table/import
   */
  async importConfigs(req, res) {
    try {
      const { configs } = req.body

      if (!Array.isArray(configs) || configs.length === 0) {
        return res.status(400).json({ success: false, error: '请提供配置数据' })
      }

      const results = { created: 0, updated: 0, errors: [] }

      for (const config of configs) {
        try {
          if (!config.config_type || !config.config_key || config.value === undefined) {
            results.errors.push({ config_key: config.config_key, error: '缺少必填字段' })
            continue
          }

          const existing = await knex('um_table_config')
            .where('config_type', config.config_type)
            .where('config_key', config.config_key)
            .first()

          if (existing) {
            await knex('um_table_config')
              .where('id', existing.id)
              .update({
                ...config,
                updated_at: new Date()
              })
            results.updated++
          } else {
            await knex('um_table_config').insert({
              ...config,
              is_active: true
            })
            results.created++
          }
        } catch (err) {
          results.errors.push({ config_key: config.config_key, error: err.message })
        }
      }

      res.json({ success: true, data: results })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  /**
   * 导出配置
   * GET /api/um-table/export
   */
  async exportConfigs(req, res) {
    try {
      const { type } = req.query

      let query = knex('um_table_config')
        .select('config_type', 'config_key', 'config_name', 'value', 'unit', 'formula', 'description', 'source', 'standard')
        .orderBy('config_type')
        .orderBy('sort_order')

      if (type) {
        query = query.where('config_type', type)
      }

      const configs = await query

      res.json({
        success: true,
        data: configs,
        total: configs.length
      })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
}

module.exports = new UMTableController()
