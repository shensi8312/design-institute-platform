/**
 * 规则评估引擎
 * 支持多种规则类型的统一评估
 */
class RuleEvaluationEngine {
  constructor() {
    this.evaluators = {
      'layout_setback': this.evaluateSetbackRule.bind(this),
      'layout_area': this.evaluateAreaRule.bind(this),
      'layout_um': this.evaluateUMRule.bind(this),
      'layout_compliance': this.evaluateComplianceRule.bind(this)
    }
  }

  /**
   * 评估规则
   * @param {Object} rule - design_rules 表中的一条记录
   * @param {Object} context - 评估上下文
   * @returns {Object} 评估结果
   */
  async evaluate(rule, context) {
    try {
      // 解析规则结构
      const ruleStructure = typeof rule.rule_structure === 'string'
        ? JSON.parse(rule.rule_structure)
        : rule.rule_structure

      const ruleType = ruleStructure.meta.rule_type
      const evaluator = this.evaluators[ruleType]

      if (!evaluator) {
        return {
          success: false,
          error: `未知规则类型: ${ruleType}`
        }
      }

      // 检查规则适用范围
      if (!this.checkScope(ruleStructure.scope, context)) {
        return {
          success: false,
          skipped: true,
          reason: '规则不适用于当前上下文'
        }
      }

      // 执行评估
      const result = await evaluator(ruleStructure, context)

      return {
        success: true,
        rule_id: rule.id,
        rule_code: rule.rule_code,
        rule_name: rule.rule_name,
        ...result
      }
    } catch (error) {
      console.error('规则评估失败:', error)
      return {
        success: false,
        error: error.message,
        rule_id: rule.id,
        rule_code: rule.rule_code
      }
    }
  }

  /**
   * 批量评估规则
   * @param {Array} rules - 规则列表
   * @param {Object} context - 评估上下文
   * @returns {Array} 评估结果列表
   */
  async evaluateBatch(rules, context) {
    const results = []

    for (const rule of rules) {
      const result = await this.evaluate(rule, context)
      results.push(result)
    }

    return results
  }

  /**
   * 检查规则适用范围
   * @param {Object} scope - 规则适用范围
   * @param {Object} context - 评估上下文
   * @returns {boolean} 是否适用
   */
  checkScope(scope, context) {
    if (!scope) return true

    // 检查建筑类型
    if (scope.building_types && context.building_type) {
      if (!scope.building_types.includes(context.building_type)) {
        return false
      }
    }

    // 检查边界类型
    if (scope.boundary_type && context.boundary_type) {
      if (scope.boundary_type !== context.boundary_type) {
        return false
      }
    }

    // 检查工艺类型
    if (scope.process_type && context.process_type) {
      if (scope.process_type !== context.process_type) {
        return false
      }
    }

    // 检查技术节点
    if (scope.technology_node && context.technology_node) {
      if (Array.isArray(scope.technology_node)) {
        if (!scope.technology_node.includes(context.technology_node)) {
          return false
        }
      } else if (scope.technology_node !== context.technology_node) {
        return false
      }
    }

    return true
  }

  /**
   * 评估退距规则
   * @param {Object} ruleStructure - 规则结构
   * @param {Object} context - 评估上下文
   * @returns {Object} 评估结果
   */
  evaluateSetbackRule(ruleStructure, context) {
    const { base_distance, conditions } = ruleStructure.rule
    let totalDistance = base_distance
    const adjustments = []

    // 评估条件
    for (const condition of conditions || []) {
      if (condition.condition_type === 'building_height') {
        const height = context.building_height || 0
        if (this.compareValues(height, condition.operator, condition.threshold)) {
          totalDistance += condition.adjustment
          adjustments.push({
            type: condition.condition_type,
            condition: `${condition.operator} ${condition.threshold}`,
            value: height,
            adjustment: condition.adjustment
          })
        }
      } else if (condition.condition_type === 'boundary_level') {
        const boundaryType = context.boundary_type
        if (condition.mapping && condition.mapping[boundaryType]) {
          totalDistance = condition.mapping[boundaryType]
          adjustments.push({
            type: condition.condition_type,
            boundary: boundaryType,
            distance: condition.mapping[boundaryType]
          })
        }
      }
    }

    return {
      result: totalDistance,
      unit: ruleStructure.rule.unit,
      details: {
        base: base_distance,
        adjustments: adjustments,
        total: totalDistance
      }
    }
  }

  /**
   * 评估面积规则
   * @param {Object} ruleStructure - 规则结构
   * @param {Object} context - 评估上下文
   * @returns {Object} 评估结果
   */
  evaluateAreaRule(ruleStructure, context) {
    const { formula, constraints } = ruleStructure.rule
    const expression = formula.expression

    try {
      // 替换变量并计算
      let result = this.evaluateExpression(expression, context)

      // 应用约束
      if (constraints) {
        if (constraints.min_area && result < constraints.min_area) {
          result = constraints.min_area
        }
        if (constraints.max_area && result > constraints.max_area) {
          result = constraints.max_area
        }
        if (constraints.multiple_of) {
          result = Math.ceil(result / constraints.multiple_of) * constraints.multiple_of
        }
      }

      return {
        result: result,
        unit: ruleStructure.evaluation.result_unit,
        formula: expression,
        context: context,
        constraints_applied: constraints || {}
      }
    } catch (error) {
      return {
        result: null,
        error: `表达式计算失败: ${error.message}`,
        formula: expression
      }
    }
  }

  /**
   * 评估能耗规则
   * @param {Object} ruleStructure - 规则结构
   * @param {Object} context - 评估上下文
   * @returns {Object} 评估结果
   */
  evaluateUMRule(ruleStructure, context) {
    // UM规则的评估逻辑与面积规则类似
    return this.evaluateAreaRule(ruleStructure, context)
  }

  /**
   * 评估合规检查规则
   * @param {Object} ruleStructure - 规则结构
   * @param {Object} context - 评估上下文
   * @returns {Object} 评估结果
   */
  evaluateComplianceRule(ruleStructure, context) {
    const { check_items } = ruleStructure.rule
    const results = []
    let allPassed = true

    for (const item of check_items) {
      const itemResult = {
        item: item.item,
        description: item.description,
        passed: true,
        violations: []
      }

      // 评估条件
      for (const condition of item.conditions || []) {
        try {
          const conditionMet = this.evaluateCondition(condition, context)
          if (!conditionMet) {
            itemResult.passed = false
            allPassed = false
            itemResult.violations.push({
              condition: condition.if,
              requirement: condition.then,
              requirement_text: condition.requirement || '',
              actual: this.extractRelevantContext(condition, context)
            })
          }
        } catch (error) {
          itemResult.passed = false
          allPassed = false
          itemResult.violations.push({
            condition: condition.if,
            error: `条件评估失败: ${error.message}`
          })
        }
      }

      results.push(itemResult)
    }

    return {
      compliant: allPassed,
      results: results,
      standard: ruleStructure.meta.standard_code || '',
      standard_name: ruleStructure.meta.standard_name || ''
    }
  }

  /**
   * 计算表达式
   * @param {string} expression - 数学表达式
   * @param {Object} context - 变量上下文
   * @returns {number} 计算结果
   */
  evaluateExpression(expression, context) {
    // 创建安全的评估环境
    let evalExpression = expression

    // 替换变量
    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g')
      evalExpression = evalExpression.replace(regex, value)
    }

    // 使用 Function 构造器安全评估（避免 eval）
    try {
      const func = new Function(`return ${evalExpression}`)
      return func()
    } catch (error) {
      throw new Error(`表达式计算失败: ${evalExpression}`)
    }
  }

  /**
   * 评估条件
   * @param {Object} condition - 条件对象
   * @param {Object} context - 评估上下文
   * @returns {boolean} 条件是否满足
   */
  evaluateCondition(condition, context) {
    const ifClause = condition.if
    const thenClause = condition.then

    // 评估 if 子句
    const ifResult = this.evaluateLogicalExpression(ifClause, context)

    if (!ifResult) {
      return true // 如果 if 不满足，则跳过此条件
    }

    // 评估 then 子句
    const thenResult = this.evaluateLogicalExpression(thenClause, context)

    return thenResult
  }

  /**
   * 评估逻辑表达式
   * @param {string} expression - 逻辑表达式
   * @param {Object} context - 评估上下文
   * @returns {boolean} 评估结果
   */
  evaluateLogicalExpression(expression, context) {
    // 替换变量
    let evalExpression = expression
    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g')
      evalExpression = evalExpression.replace(regex, JSON.stringify(value))
    }

    // 安全评估
    try {
      const func = new Function(`return ${evalExpression}`)
      return func()
    } catch (error) {
      console.error('逻辑表达式评估失败:', evalExpression, error)
      return false
    }
  }

  /**
   * 比较值
   * @param {number} value - 值
   * @param {string} operator - 操作符
   * @param {number} threshold - 阈值
   * @returns {boolean} 比较结果
   */
  compareValues(value, operator, threshold) {
    switch (operator) {
      case '>': return value > threshold
      case '>=': return value >= threshold
      case '<': return value < threshold
      case '<=': return value <= threshold
      case '==': return value == threshold
      case '===': return value === threshold
      case '!=': return value != threshold
      case '!==': return value !== threshold
      default: return false
    }
  }

  /**
   * 提取相关上下文
   * @param {Object} condition - 条件对象
   * @param {Object} context - 完整上下文
   * @returns {Object} 相关的上下文数据
   */
  extractRelevantContext(condition, context) {
    // 从条件中提取变量名
    const variables = this.extractVariables(condition.if + ' ' + condition.then)
    const relevantContext = {}

    for (const variable of variables) {
      if (context.hasOwnProperty(variable)) {
        relevantContext[variable] = context[variable]
      }
    }

    return relevantContext
  }

  /**
   * 从表达式中提取变量名
   * @param {string} expression - 表达式
   * @returns {Array} 变量名列表
   */
  extractVariables(expression) {
    // 简单的变量提取（匹配标识符）
    const matches = expression.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || []
    // 过滤掉 JavaScript 关键字
    const keywords = ['true', 'false', 'null', 'undefined', 'if', 'then', 'and', 'or']
    return [...new Set(matches)].filter(v => !keywords.includes(v))
  }

  /**
   * 获取评估摘要
   * @param {Array} results - 评估结果列表
   * @returns {Object} 评估摘要
   */
  getSummary(results) {
    const total = results.length
    const successful = results.filter(r => r.success && !r.skipped).length
    const failed = results.filter(r => !r.success && !r.skipped).length
    const skipped = results.filter(r => r.skipped).length

    return {
      total,
      successful,
      failed,
      skipped,
      successRate: total > 0 ? (successful / total * 100).toFixed(2) : 0
    }
  }
}

module.exports = RuleEvaluationEngine
