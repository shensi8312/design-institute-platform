const BuildingLayoutService = require('../services/building/BuildingLayoutService')

/**
 * 建筑强排控制器
 * 处理建筑布局相关的HTTP请求
 */
class BuildingLayoutController {
  constructor() {
    this.service = new BuildingLayoutService()
  }

  /**
   * 计算红线退距
   * POST /api/building-layout/setbacks
   * @param {Object} req.body.siteInfo - 场地信息
   */
  async calculateSetbacks(req, res) {
    try {
      const { siteInfo } = req.body

      if (!siteInfo || !siteInfo.boundaries) {
        return res.status(400).json({
          success: false,
          message: '请提供场地信息和边界数据'
        })
      }

      const result = await this.service.calculateSetbacks(siteInfo)

      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('计算退距失败:', error)
      res.status(500).json({
        success: false,
        message: '计算退距失败',
        error: error.message
      })
    }
  }

  /**
   * 推导建筑面积
   * POST /api/building-layout/areas
   * @param {Object} req.body.projectParams - 项目参数
   */
  async deriveAreas(req, res) {
    try {
      const { projectParams } = req.body

      if (!projectParams) {
        return res.status(400).json({
          success: false,
          message: '请提供项目参数'
        })
      }

      const result = await this.service.deriveAreas(projectParams)

      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('推导面积失败:', error)
      res.status(500).json({
        success: false,
        message: '推导面积失败',
        error: error.message
      })
    }
  }

  /**
   * 生成UM表
   * POST /api/building-layout/um-table
   * @param {Object} req.body.areas - 面积数据
   */
  async generateUMTable(req, res) {
    try {
      const { areas } = req.body

      if (!areas || Object.keys(areas).length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供面积数据'
        })
      }

      const result = await this.service.generateUMTable(areas)

      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('生成UM表失败:', error)
      res.status(500).json({
        success: false,
        message: '生成UM表失败',
        error: error.message
      })
    }
  }

  /**
   * 合规检查
   * POST /api/building-layout/compliance
   * @param {Object} req.body.layoutDesign - 布局设计方案
   */
  async checkCompliance(req, res) {
    try {
      const { layoutDesign } = req.body

      if (!layoutDesign) {
        return res.status(400).json({
          success: false,
          message: '请提供布局设计方案'
        })
      }

      const result = await this.service.checkCompliance(layoutDesign)

      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('合规检查失败:', error)
      res.status(500).json({
        success: false,
        message: '合规检查失败',
        error: error.message
      })
    }
  }

  /**
   * 完整工作流
   * POST /api/building-layout/workflow
   * @param {Object} req.body.siteInfo - 场地信息
   * @param {Object} req.body.projectParams - 项目参数
   */
  async runFullWorkflow(req, res) {
    try {
      const { siteInfo, projectParams } = req.body

      // 验证必需参数
      if (!siteInfo || !projectParams) {
        return res.status(400).json({
          success: false,
          message: '请提供场地信息和项目参数'
        })
      }

      if (!siteInfo.boundaries || siteInfo.boundaries.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供场地边界信息'
        })
      }

      const result = await this.service.runFullWorkflow({
        siteInfo,
        projectParams
      })

      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('工作流执行失败:', error)
      res.status(500).json({
        success: false,
        message: '工作流执行失败',
        error: error.message
      })
    }
  }

  /**
   * 获取规则摘要
   * GET /api/building-layout/rules-summary
   */
  async getRulesSummary(req, res) {
    try {
      const result = await this.service.getRulesSummary()

      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取规则摘要失败:', error)
      res.status(500).json({
        success: false,
        message: '获取规则摘要失败',
        error: error.message
      })
    }
  }

  /**
   * 测试接口 - 返回示例输入格式
   * GET /api/building-layout/example
   */
  async getExample(req, res) {
    try {
      const example = {
        description: '建筑强排完整工作流示例',
        endpoint: 'POST /api/building-layout/workflow',
        request_body: {
          siteInfo: {
            building_height: 30,
            building_type: 'fab',
            boundaries: [
              {
                id: 'b1',
                name: '东侧-高速公路',
                type: 'expressway',
                properties: {
                  road_level: 'expressway'
                }
              },
              {
                id: 'b2',
                name: '南侧-主干道',
                type: 'main_road',
                properties: {
                  road_width: 40
                }
              },
              {
                id: 'b3',
                name: '西侧-次干道',
                type: 'secondary_road',
                properties: {
                  road_width: 20
                }
              },
              {
                id: 'b4',
                name: '北侧-用地红线',
                type: 'property_line',
                properties: {}
              }
            ],
            spacing: 15,
            fire_resistance_rating: 2
          },
          projectParams: {
            chips_per_month: 10000,
            process_type: 'semiconductor_fab',
            technology_node: '28nm'
          }
        },
        expected_response: {
          success: true,
          workflow: {
            setbacks: [
              {
                boundary_id: 'b1',
                boundary_type: 'expressway',
                required_distance: 60,
                unit: 'meters',
                applied_rule: {
                  rule_code: 'SETBACK-EXPRESSWAY-001',
                  rule_name: '高速公路红线退距'
                }
              }
            ],
            areas: {
              cleanroom: {
                value: 26000,
                unit: 'square_meters',
                formula: 'chips_per_month * 2.5 + 1000'
              },
              office: {
                value: 7800,
                unit: 'square_meters',
                formula: 'cleanroom_area * 0.3'
              },
              warehouse: {
                value: 3900,
                unit: 'square_meters',
                formula: 'cleanroom_area * 0.15'
              }
            },
            total_building_area: 37700,
            um_table: {
              power: {
                value: 21434400,
                unit: 'watts',
                formula: '(cleanroom_area * 800 + office_area * 50 + warehouse_area * 30) * 1.2'
              },
              cooling: {
                value: 15916500,
                unit: 'watts',
                formula: '(cleanroom_area * 500 + office_area * 100) * 1.15'
              }
            },
            compliance: {
              compliant: true,
              checks: [],
              violations: []
            }
          }
        }
      }

      res.json({
        success: true,
        example
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取示例失败',
        error: error.message
      })
    }
  }
}

// 创建实例并导出
const controller = new BuildingLayoutController()

module.exports = {
  calculateSetbacks: (req, res) => controller.calculateSetbacks(req, res),
  deriveAreas: (req, res) => controller.deriveAreas(req, res),
  generateUMTable: (req, res) => controller.generateUMTable(req, res),
  checkCompliance: (req, res) => controller.checkCompliance(req, res),
  runFullWorkflow: (req, res) => controller.runFullWorkflow(req, res),
  getRulesSummary: (req, res) => controller.getRulesSummary(req, res),
  getExample: (req, res) => controller.getExample(req, res)
}
