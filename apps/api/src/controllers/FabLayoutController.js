/**
 * FAB 布局生成控制器
 *
 * 提供 REST API 接口供 Revit 插件和前端调用
 */

const fabLayoutGenerator = require('../services/fab/FabLayoutGeneratorService')

class FabLayoutController {
  /**
   * 生成 FAB 布局
   * POST /api/fab-layout/generate
   *
   * Request Body:
   * {
   *   site: {
   *     boundary: [{x, y}, ...],  // 场地边界点（闭合多边形，单位：米）
   *     boundaries: [{type, properties}, ...]  // 各边界类型信息
   *   },
   *   project: {
   *     chips_per_month: 30000,   // 月产能（片/月）
   *     process_type: 'logic',   // 工艺类型
   *     technology_node: '28nm'  // 技术节点
   *   },
   *   options: {
   *     format: 'revit'          // 输出格式：'raw' | 'revit' | 'svg'
   *   }
   * }
   */
  async generateLayout(req, res) {
    try {
      const { site, project, options = {} } = req.body

      // 参数验证
      if (!site || !site.boundary || site.boundary.length < 3) {
        return res.status(400).json({
          success: false,
          error: '场地边界至少需要3个点',
          required: {
            site: {
              boundary: '[{x, y}, {x, y}, {x, y}, ...]'
            }
          }
        })
      }

      if (!project) {
        return res.status(400).json({
          success: false,
          error: '缺少项目参数',
          required: {
            project: {
              chips_per_month: 'number',
              process_type: 'string (optional)',
              technology_node: 'string (optional)'
            }
          }
        })
      }

      console.log('[FabLayoutController] 开始生成布局')
      console.log('[FabLayoutController] 场地点数:', site.boundary.length)
      console.log('[FabLayoutController] 月产能:', project.chips_per_month)

      // 生成布局
      const result = await fabLayoutGenerator.generateLayout({
        site,
        project,
        options
      })

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error
        })
      }

      // 根据格式要求返回
      const format = options.format || 'raw'

      if (format === 'revit') {
        const revitData = fabLayoutGenerator.exportForRevit(result)
        return res.json(revitData)
      }

      return res.json(result)
    } catch (error) {
      console.error('[FabLayoutController] 生成布局失败:', error)
      return res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * 获取示例输入参数
   * GET /api/fab-layout/example
   */
  async getExample(req, res) {
    const example = {
      description: 'FAB 布局生成 API 示例输入',
      endpoint: 'POST /api/fab-layout/generate',
      request_body: {
        site: {
          boundary: [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 300, y: 250 },
            { x: 0, y: 250 }
          ],
          boundaries: [
            { type: 'main_road', direction: 'south', properties: { road_class: 'arterial' } },
            { type: 'secondary_road', direction: 'east', properties: { road_class: 'collector' } },
            { type: 'property_line', direction: 'north', properties: {} },
            { type: 'property_line', direction: 'west', properties: {} }
          ]
        },
        project: {
          chips_per_month: 30000,
          process_type: 'logic',
          technology_node: '28nm',
          max_building_height: 24
        },
        options: {
          format: 'revit',
          include_svg: false
        }
      },
      response_example: {
        success: true,
        data: {
          version: '1.0.0',
          units: 'meters',
          levels: [
            { id: 'level_0', name: 'L1', elevation: 0 }
          ],
          masses: [
            {
              id: 'cleanroom',
              name: '洁净室',
              type: 'cleanroom',
              location: { x: 100, y: 100, z: 0 },
              dimensions: { width: 100, depth: 80, height: 12 },
              floors: 2,
              total_area: 16000
            }
          ]
        }
      }
    }

    res.json(example)
  }

  /**
   * 获取功能区配置
   * GET /api/fab-layout/zones
   */
  async getZoneConfig(req, res) {
    const config = {
      cleanroom: {
        name: '洁净室',
        nameEn: 'Cleanroom',
        description: '主要生产区域，包含光刻、刻蚀、薄膜等工艺设备',
        defaultHeight: 12,
        properties: ['cleanroom_class', 'vibration_class', 'temperature_range', 'humidity_range']
      },
      cub: {
        name: 'CUB动力区',
        nameEn: 'Central Utility Building',
        description: '提供电力、冷却水、压缩空气、特气等动力设施',
        defaultHeight: 10,
        properties: ['utility_types', 'redundancy_level']
      },
      office: {
        name: '办公区',
        nameEn: 'Office',
        description: '行政办公、研发、会议等功能',
        defaultHeight: 4,
        properties: ['entrance', 'floors']
      },
      warehouse: {
        name: '仓库',
        nameEn: 'Warehouse',
        description: '原材料和成品仓储',
        defaultHeight: 8,
        properties: ['storage_type', 'loading_dock']
      },
      parking: {
        name: '停车场',
        nameEn: 'Parking',
        description: '员工和访客停车区域',
        defaultHeight: 0,
        properties: ['spaces', 'type']
      }
    }

    res.json({
      success: true,
      zones: config
    })
  }

  /**
   * 验证布局参数
   * POST /api/fab-layout/validate
   */
  async validateInput(req, res) {
    try {
      const { site, project } = req.body
      const errors = []
      const warnings = []

      // 验证场地
      if (!site) {
        errors.push('缺少场地信息 (site)')
      } else if (!site.boundary || site.boundary.length < 3) {
        errors.push('场地边界至少需要3个点')
      } else {
        // 计算场地面积
        let area = 0
        const n = site.boundary.length
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n
          area += site.boundary[i].x * site.boundary[j].y
          area -= site.boundary[j].x * site.boundary[i].y
        }
        area = Math.abs(area) / 2

        if (area < 10000) {
          warnings.push(`场地面积 ${area.toFixed(0)}㎡ 较小，可能无法满足FAB布局需求`)
        }
      }

      // 验证项目参数
      if (!project) {
        errors.push('缺少项目参数 (project)')
      } else {
        if (!project.chips_per_month) {
          errors.push('缺少月产能参数 (chips_per_month)')
        } else if (project.chips_per_month < 1000) {
          warnings.push('月产能较低，建议至少1000片/月')
        }
      }

      const valid = errors.length === 0

      res.json({
        success: true,
        valid,
        errors,
        warnings
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * 导出为 Revit 格式
   * POST /api/fab-layout/export/revit
   */
  async exportRevit(req, res) {
    try {
      const { layout } = req.body

      if (!layout) {
        return res.status(400).json({
          success: false,
          error: '缺少布局数据'
        })
      }

      const revitData = fabLayoutGenerator.exportForRevit(layout)

      res.json(revitData)
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
}

module.exports = new FabLayoutController()
