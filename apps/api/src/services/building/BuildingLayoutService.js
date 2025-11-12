const RuleEvaluationEngine = require('../rules/RuleEvaluationEngine')
const DesignRulesRepository = require('../../repositories/DesignRulesRepository')

/**
 * 建筑强排服务
 * 提供退距计算、面积推导、UM表生成、合规检查等功能
 */
class BuildingLayoutService {
  constructor() {
    this.ruleEngine = new RuleEvaluationEngine()
    this.rulesRepo = new DesignRulesRepository()
  }

  /**
   * 计算红线退距
   * @param {Object} siteInfo - 场地信息
   * @param {Array} siteInfo.boundaries - 边界列表
   * @param {number} siteInfo.building_height - 建筑高度
   * @param {string} siteInfo.building_type - 建筑类型
   * @returns {Object} 退距计算结果
   */
  async calculateSetbacks(siteInfo) {
    try {
      // 1. 获取适用的退距规则
      const setbackRules = await this.rulesRepo.findByCategory('layout_setback', {
        is_active: true,
        review_status: 'approved'
      })

      if (setbackRules.length === 0) {
        return {
          success: false,
          message: '未找到退距规则'
        }
      }

      const results = []

      // 2. 对每条边界评估退距
      for (const boundary of siteInfo.boundaries || []) {
        const context = {
          boundary_type: boundary.type,
          building_height: siteInfo.building_height || 15,
          building_type: siteInfo.building_type || 'fab',
          ...boundary.properties
        }

        // 评估所有匹配的规则
        const boundaryResults = []
        for (const rule of setbackRules) {
          const result = await this.ruleEngine.evaluate(rule, context)
          if (result.success && !result.skipped) {
            boundaryResults.push(result)

            // 更新规则使用统计
            await this.rulesRepo.incrementUsageCount(rule.id)
          }
        }

        // 取最大退距值（最严格的要求）
        if (boundaryResults.length > 0) {
          const maxSetback = boundaryResults.reduce((max, r) =>
            r.result > max.result ? r : max
          )

          results.push({
            boundary_id: boundary.id,
            boundary_name: boundary.name || boundary.type,
            boundary_type: boundary.type,
            required_distance: maxSetback.result,
            unit: maxSetback.unit,
            applied_rule: {
              rule_code: maxSetback.rule_code,
              rule_name: maxSetback.rule_name
            },
            details: maxSetback.details,
            all_applicable_rules: boundaryResults.map(r => ({
              rule_code: r.rule_code,
              distance: r.result
            }))
          })
        }
      }

      return {
        success: true,
        setbacks: results,
        total_boundaries: siteInfo.boundaries?.length || 0,
        rules_applied: setbackRules.length
      }
    } catch (error) {
      console.error('计算退距失败:', error)
      return {
        success: false,
        message: '计算退距失败',
        error: error.message
      }
    }
  }

  /**
   * 推导建筑面积
   * @param {Object} projectParams - 项目参数
   * @param {number} projectParams.chips_per_month - 月产能（片）
   * @param {string} projectParams.process_type - 工艺类型
   * @param {string} projectParams.technology_node - 技术节点
   * @returns {Object} 面积分配结果
   */
  async deriveAreas(projectParams) {
    try {
      // 1. 获取面积推导规则
      const areaRules = await this.rulesRepo.findByCategory('layout_area', {
        is_active: true,
        review_status: 'approved'
      })

      if (areaRules.length === 0) {
        return {
          success: false,
          message: '未找到面积推导规则'
        }
      }

      const areas = {}
      const context = {
        ...projectParams
      }

      // 2. 按依赖顺序评估规则（多轮评估）
      let maxIterations = 10 // 防止无限循环
      let iteration = 0
      let rulesRemaining = [...areaRules]

      while (rulesRemaining.length > 0 && iteration < maxIterations) {
        iteration++
        const evaluatedInThisRound = []

        for (const rule of rulesRemaining) {
          const ruleStructure = typeof rule.rule_structure === 'string'
            ? JSON.parse(rule.rule_structure)
            : rule.rule_structure

          const targetArea = ruleStructure.rule.target_area
          const dependencies = ruleStructure.rule.dependencies || []

          // 检查依赖是否已满足
          const dependenciesMet = dependencies.every(dep =>
            context.hasOwnProperty(dep)
          )

          if (dependenciesMet) {
            const result = await this.ruleEngine.evaluate(rule, context)
            if (result.success && !result.skipped) {
              areas[targetArea] = {
                value: result.result,
                unit: result.unit,
                formula: result.formula,
                rule_code: result.rule_code,
                rule_name: result.rule_name,
                dependencies: dependencies
              }

              // 将计算结果添加到上下文，供后续规则使用
              context[`${targetArea}_area`] = result.result

              // 更新规则使用统计
              await this.rulesRepo.incrementSuccessCount(rule.id)

              evaluatedInThisRound.push(rule)
            }
          }
        }

        // 移除已评估的规则
        rulesRemaining = rulesRemaining.filter(r => !evaluatedInThisRound.includes(r))

        // 如果本轮没有评估任何规则，说明有循环依赖或缺少输入
        if (evaluatedInThisRound.length === 0) {
          console.warn('剩余规则无法评估，可能缺少输入参数:', rulesRemaining.map(r => r.rule_code))
          break
        }
      }

      // 计算总面积
      const totalArea = Object.values(areas).reduce((sum, a) => sum + a.value, 0)

      return {
        success: true,
        areas: areas,
        total_building_area: totalArea,
        rules_applied: Object.keys(areas).length,
        input_parameters: projectParams
      }
    } catch (error) {
      console.error('推导面积失败:', error)
      return {
        success: false,
        message: '推导面积失败',
        error: error.message
      }
    }
  }

  /**
   * 生成UM表（能耗计算）
   * @param {Object} areas - 面积分配结果
   * @returns {Object} UM表
   */
  async generateUMTable(areas) {
    try {
      // 1. 获取能耗公式规则
      const umRules = await this.rulesRepo.findByCategory('layout_um', {
        is_active: true,
        review_status: 'approved'
      })

      if (umRules.length === 0) {
        return {
          success: false,
          message: '未找到能耗计算规则'
        }
      }

      const umTable = {}

      // 2. 准备上下文（从 areas 提取）
      const context = {}
      for (const [areaType, areaData] of Object.entries(areas)) {
        if (typeof areaData === 'object' && areaData.value !== undefined) {
          context[`${areaType}_area`] = areaData.value
        } else {
          context[`${areaType}_area`] = areaData
        }
      }

      // 3. 对每种能耗类型计算
      for (const rule of umRules) {
        const ruleStructure = typeof rule.rule_structure === 'string'
          ? JSON.parse(rule.rule_structure)
          : rule.rule_structure

        const utilityType = ruleStructure.meta.utility_type

        const result = await this.ruleEngine.evaluate(rule, context)
        if (result.success && !result.skipped) {
          umTable[utilityType] = {
            value: result.result,
            unit: result.unit,
            formula: result.formula,
            rule_code: result.rule_code,
            rule_name: result.rule_name,
            dependencies: ruleStructure.rule.dependencies || []
          }

          // 更新规则使用统计
          await this.rulesRepo.incrementSuccessCount(rule.id)
        }
      }

      return {
        success: true,
        um_table: umTable,
        rules_applied: Object.keys(umTable).length,
        input_areas: context
      }
    } catch (error) {
      console.error('生成UM表失败:', error)
      return {
        success: false,
        message: '生成UM表失败',
        error: error.message
      }
    }
  }

  /**
   * 合规检查
   * @param {Object} layoutDesign - 布局设计方案
   * @param {Object} layoutDesign.building_height - 建筑高度
   * @param {Object} layoutDesign.spacing - 建筑间距
   * @param {Object} layoutDesign.fire_resistance_rating - 耐火等级
   * @returns {Object} 合规检查结果
   */
  async checkCompliance(layoutDesign) {
    try {
      // 1. 获取合规检查规则
      const complianceRules = await this.rulesRepo.findByCategory('layout_compliance', {
        is_active: true,
        review_status: 'approved'
      })

      if (complianceRules.length === 0) {
        return {
          success: false,
          message: '未找到合规检查规则'
        }
      }

      const checkResults = []

      // 2. 逐条检查
      for (const rule of complianceRules) {
        const result = await this.ruleEngine.evaluate(rule, layoutDesign)

        if (result.success && !result.skipped) {
          checkResults.push({
            rule_code: result.rule_code,
            rule_name: result.rule_name,
            standard: result.standard || '',
            standard_name: result.standard_name || '',
            passed: result.compliant,
            details: result.results
          })

          // 更新规则使用统计
          if (result.compliant) {
            await this.rulesRepo.incrementSuccessCount(rule.id)
          } else {
            await this.rulesRepo.incrementUsageCount(rule.id)
          }
        }
      }

      const allPassed = checkResults.every(r => r.passed)
      const violations = checkResults.filter(r => !r.passed)

      return {
        success: true,
        compliant: allPassed,
        checks: checkResults,
        violations: violations,
        total_checks: checkResults.length,
        passed_checks: checkResults.filter(r => r.passed).length
      }
    } catch (error) {
      console.error('合规检查失败:', error)
      return {
        success: false,
        message: '合规检查失败',
        error: error.message
      }
    }
  }

  /**
   * 完整工作流：退距 → 面积 → UM表 → 合规
   * @param {Object} input - 输入参数
   * @param {Object} input.siteInfo - 场地信息
   * @param {Object} input.projectParams - 项目参数
   * @returns {Object} 完整工作流结果
   */
  async runFullWorkflow(input) {
    try {
      const { siteInfo, projectParams } = input

      console.log('[BuildingLayoutService] 开始完整工作流')

      // 1. 计算退距
      console.log('[BuildingLayoutService] 步骤1: 计算退距')
      const setbacksResult = await this.calculateSetbacks(siteInfo)
      if (!setbacksResult.success) {
        return {
          success: false,
          step: 'setbacks',
          message: '退距计算失败',
          error: setbacksResult.message
        }
      }

      // 2. 推导面积
      console.log('[BuildingLayoutService] 步骤2: 推导面积')
      const areasResult = await this.deriveAreas(projectParams)
      if (!areasResult.success) {
        return {
          success: false,
          step: 'areas',
          message: '面积推导失败',
          error: areasResult.message
        }
      }

      // 3. 生成UM表
      console.log('[BuildingLayoutService] 步骤3: 生成UM表')
      const umTableResult = await this.generateUMTable(areasResult.areas)
      if (!umTableResult.success) {
        return {
          success: false,
          step: 'um_table',
          message: 'UM表生成失败',
          error: umTableResult.message
        }
      }

      // 4. 合规检查
      console.log('[BuildingLayoutService] 步骤4: 合规检查')
      const complianceResult = await this.checkCompliance({
        ...siteInfo,
        ...areasResult,
        ...umTableResult
      })

      console.log('[BuildingLayoutService] 工作流完成')

      return {
        success: true,
        workflow: {
          setbacks: setbacksResult.setbacks,
          areas: areasResult.areas,
          total_building_area: areasResult.total_building_area,
          um_table: umTableResult.um_table,
          compliance: complianceResult
        },
        summary: {
          setback_rules_applied: setbacksResult.rules_applied,
          area_rules_applied: areasResult.rules_applied,
          um_rules_applied: umTableResult.rules_applied,
          compliance_checks: complianceResult.total_checks,
          overall_compliant: complianceResult.compliant
        }
      }
    } catch (error) {
      console.error('[BuildingLayoutService] 工作流失败:', error)
      return {
        success: false,
        message: '工作流执行失败',
        error: error.message
      }
    }
  }

  /**
   * 获取可用的规则列表
   * @returns {Object} 规则统计
   */
  async getRulesSummary() {
    try {
      const categories = ['layout_setback', 'layout_area', 'layout_um', 'layout_compliance']
      const summary = {}

      for (const category of categories) {
        const rules = await this.rulesRepo.findByCategory(category, {
          is_active: true,
          review_status: 'approved'
        })
        summary[category] = {
          total: rules.length,
          rules: rules.map(r => ({
            code: r.rule_code,
            name: r.rule_name,
            confidence: r.confidence_score,
            usage_count: r.usage_count
          }))
        }
      }

      return {
        success: true,
        summary
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }
}

module.exports = BuildingLayoutService
