const { spawn } = require('child_process')
const path = require('path')

/**
 * 建筑布局优化服务
 * 基于OR-Tools CP-SAT求解器进行多目标优化
 */
class LayoutOptimizationService {
  constructor() {
    this.pythonScript = path.join(__dirname, '../../python/layout_optimizer.py')
  }

  /**
   * 调用Python优化脚本
   * @param {Object} params - 参数对象
   * @returns {Promise<Object>} 结果
   */
  async callPython(params) {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', [this.pythonScript])

      let stdoutData = ''
      let stderrData = ''

      // 发送输入
      python.stdin.write(JSON.stringify(params))
      python.stdin.end()

      // 收集输出
      python.stdout.on('data', (data) => {
        stdoutData += data.toString()
      })

      python.stderr.on('data', (data) => {
        stderrData += data.toString()
      })

      python.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`Python script exited with code ${code}: ${stderrData}`))
        }

        try {
          const result = JSON.parse(stdoutData)
          resolve(result)
        } catch (error) {
          reject(new Error(`Failed to parse Python output: ${stdoutData}`))
        }
      })

      python.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`))
      })
    })
  }

  /**
   * 优化建筑布局
   * @param {Object} params - 优化参数
   * @returns {Promise<Object>} 优化结果
   *
   * 参数说明:
   * {
   *   site_boundary: [[x1,y1], [x2,y2], ...],  // 场地边界
   *   required_area: 10000,                      // 要求建筑面积(m²)
   *   setback_distances: {                       // 退距要求
   *     north: 10, south: 10, east: 10, west: 10
   *   },
   *   objectives: {                              // 优化目标权重(总和=1)
   *     cost_weight: 0.4,        // 成本权重
   *     space_weight: 0.3,       // 空间利用率权重
   *     sunlight_weight: 0.2,    // 日照权重
   *     energy_weight: 0.1       // 能耗权重
   *   },
   *   constraints: {                             // 额外约束
   *     min_spacing_to_site_boundary: 5,        // 距场地边界最小距离
   *     prefer_square_shape: true                // 偏好正方形
   *   },
   *   options: {                                 // 求解选项
   *     max_time_seconds: 60,                    // 最大求解时间
   *     num_solutions: 5                         // 返回解决方案数量
   *   }
   * }
   *
   * 返回结果:
   * {
   *   success: true,
   *   status: 'optimal',                          // 'optimal' | 'feasible' | 'infeasible'
   *   solver_info: {
   *     wall_time: 2.34,                          // 求解时间(秒)
   *     num_branches: 1234,                       // 分支数
   *     num_conflicts: 56,                        // 冲突数
   *     num_solutions_found: 5                    // 找到的解决方案数
   *   },
   *   site_info: {
   *     site_boundary: [...],                     // 原始场地边界
   *     setback_boundary: [...],                  // 退距后的边界
   *     required_area: 10000                      // 要求面积
   *   },
   *   solutions: [                                // 所有解决方案(按得分排序)
   *     {
   *       rank: 1,                                // 排名
   *       building_footprint: [...],              // 建筑轮廓坐标
   *       dimensions: {
   *         width: 80.5, length: 124.2,
   *         area: 10000, perimeter: 409.4,
   *         orientation: 'north-south'            // 'north-south' | 'east-west'
   *       },
   *       position: { x: 20.0, y: 30.0 },        // 左下角位置
   *       scores: {
   *         total_score: 8750,                    // 总得分
   *         space_utilization: 65.5,              // 空间利用率(%)
   *         sunlight_score: 100,                  // 日照得分
   *         energy_score: 78.3,                   // 能耗得分
   *         cost_per_meter: 409400                // 建造成本(元)
   *       }
   *     },
   *     ...                                       // 更多解决方案
   *   ],
   *   best_solution: {...}                        // 最佳解决方案(与solutions[0]相同)
   * }
   */
  async optimizeLayout(params) {
    try {
      // 验证必需参数
      if (!params.site_boundary || !Array.isArray(params.site_boundary)) {
        return {
          success: false,
          error: 'site_boundary is required and must be an array of coordinates'
        }
      }

      if (!params.required_area || params.required_area <= 0) {
        return {
          success: false,
          error: 'required_area is required and must be positive'
        }
      }

      // 设置默认值
      const optimizationParams = {
        operation: 'optimize_layout',
        site_boundary: params.site_boundary,
        required_area: params.required_area,
        setback_distances: params.setback_distances || {
          north: 10,
          south: 10,
          east: 10,
          west: 10
        },
        objectives: params.objectives || {
          cost_weight: 0.4,
          space_weight: 0.3,
          sunlight_weight: 0.2,
          energy_weight: 0.1
        },
        constraints: params.constraints || {},
        options: params.options || {
          max_time_seconds: 60,
          num_solutions: 5
        }
      }

      // 调用Python优化器
      const result = await this.callPython(optimizationParams)

      return result
    } catch (error) {
      console.error('布局优化失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 快速优化 - 使用默认参数快速生成建筑布局
   * @param {Array} siteBoundary - 场地边界
   * @param {number} requiredArea - 要求面积
   * @param {Object} setbackDistances - 退距要求
   * @returns {Promise<Object>} 优化结果
   */
  async quickOptimize(siteBoundary, requiredArea, setbackDistances) {
    return this.optimizeLayout({
      site_boundary: siteBoundary,
      required_area: requiredArea,
      setback_distances: setbackDistances,
      objectives: {
        cost_weight: 0.4,
        space_weight: 0.3,
        sunlight_weight: 0.2,
        energy_weight: 0.1
      },
      options: {
        max_time_seconds: 30,  // 快速模式 - 30秒
        num_solutions: 3       // 返回3个解决方案
      }
    })
  }

  /**
   * 成本优先优化 - 最小化建造成本
   * @param {Object} params - 基础参数
   * @returns {Promise<Object>} 优化结果
   */
  async optimizeForCost(params) {
    return this.optimizeLayout({
      ...params,
      objectives: {
        cost_weight: 0.7,      // 成本权重最高
        space_weight: 0.2,
        sunlight_weight: 0.05,
        energy_weight: 0.05
      }
    })
  }

  /**
   * 空间优先优化 - 最大化空间利用率
   * @param {Object} params - 基础参数
   * @returns {Promise<Object>} 优化结果
   */
  async optimizeForSpace(params) {
    return this.optimizeLayout({
      ...params,
      objectives: {
        cost_weight: 0.1,
        space_weight: 0.7,     // 空间利用率权重最高
        sunlight_weight: 0.1,
        energy_weight: 0.1
      }
    })
  }

  /**
   * 绿色建筑优化 - 优化日照和能耗
   * @param {Object} params - 基础参数
   * @returns {Promise<Object>} 优化结果
   */
  async optimizeForGreen(params) {
    return this.optimizeLayout({
      ...params,
      objectives: {
        cost_weight: 0.2,
        space_weight: 0.2,
        sunlight_weight: 0.3,  // 日照权重高
        energy_weight: 0.3     // 能耗权重高
      }
    })
  }

  /**
   * 批量优化 - 尝试多种优化策略并比较
   * @param {Object} params - 基础参数
   * @returns {Promise<Object>} 所有策略的结果
   */
  async batchOptimize(params) {
    try {
      const strategies = [
        { name: 'balanced', description: '平衡方案', objectives: { cost_weight: 0.4, space_weight: 0.3, sunlight_weight: 0.2, energy_weight: 0.1 } },
        { name: 'cost_optimized', description: '成本优先', objectives: { cost_weight: 0.7, space_weight: 0.2, sunlight_weight: 0.05, energy_weight: 0.05 } },
        { name: 'space_optimized', description: '空间优先', objectives: { cost_weight: 0.1, space_weight: 0.7, sunlight_weight: 0.1, energy_weight: 0.1 } },
        { name: 'green_building', description: '绿色建筑', objectives: { cost_weight: 0.2, space_weight: 0.2, sunlight_weight: 0.3, energy_weight: 0.3 } }
      ]

      const results = []

      for (const strategy of strategies) {
        const result = await this.optimizeLayout({
          ...params,
          objectives: strategy.objectives,
          options: {
            max_time_seconds: 30,  // 每个策略30秒
            num_solutions: 2       // 每个策略返回2个解
          }
        })

        if (result.success) {
          results.push({
            strategy_name: strategy.name,
            strategy_description: strategy.description,
            objectives: strategy.objectives,
            result: result
          })
        }
      }

      return {
        success: true,
        total_strategies: strategies.length,
        successful_strategies: results.length,
        strategies: results
      }
    } catch (error) {
      console.error('批量优化失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

module.exports = LayoutOptimizationService
