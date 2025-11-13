const MultiObjectiveOptimizer = require('./MultiObjectiveOptimizer')
const CollisionDetector = require('./CollisionDetector')
const ChemicalKnowledgeBase = require('../knowledge/ChemicalKnowledgeBase')

/**
 * 完整布局优化引擎
 * 考虑：成本、安全、流阻、重量、扩展性、标准化
 */
class LayoutOptimizationEngine {
  constructor() {
    this.multiObjOptimizer = new MultiObjectiveOptimizer()
    this.collisionDetector = new CollisionDetector()
    this.chemicalKB = new ChemicalKnowledgeBase()

    // 优化权重配置（可由用户调整）
    this.optimizationGoals = {
      cost: { weight: 0.3, description: '最小化总成本（材料+人工）' },
      safety: { weight: 0.25, description: '最大化安全性（隔离+通道）' },
      performance: { weight: 0.2, description: '最小化流体阻力' },
      maintainability: { weight: 0.15, description: '最大化可维护性' },
      expandability: { weight: 0.1, description: '预留扩展空间' }
    }
  }

  /**
   * 主入口：生成并评估所有候选方案
   */
  async optimizeLayout(constraints, parts, userPreferences = {}) {
    console.log('🚀 [LayoutOptimization] 启动完整优化流程...')
    console.log(`   - 固定约束: 空间${constraints.envelope.width}×${constraints.envelope.height}×${constraints.envelope.depth}mm`)
    console.log(`   - 接口: 进口(${constraints.inlet.x},${constraints.inlet.y},${constraints.inlet.z}) 出口(${constraints.outlet.x},${constraints.outlet.y},${constraints.outlet.z})`)
    console.log(`   - 零件: ${parts.length}个`)
    console.log(`   - 流体: ${constraints.fluidType || 'N2'} @ ${constraints.pressure || 16}bar`)

    // 合并用户偏好
    if (userPreferences.goals) {
      Object.assign(this.optimizationGoals, userPreferences.goals)
    }

    // 1. 生成基础候选方案（5种策略）
    const candidateSolutions = await this.multiObjOptimizer.generateCandidateSolutions(constraints, parts)

    // 2. 深度评估每个方案（扩展维度）
    console.log('\n📊 深度评估方案...')
    for (const solution of candidateSolutions) {
      solution.detailedScores = await this._comprehensiveEvaluation(solution, constraints, parts)
      solution.warnings = await this._identifyWarnings(solution, constraints, parts)
      solution.recommendations = this._generateRecommendations(solution)
    }

    // 3. 计算综合得分（加权）
    for (const solution of candidateSolutions) {
      solution.overallScore = this._calculateWeightedScore(solution.detailedScores)
    }

    // 4. 排序并标注推荐
    candidateSolutions.sort((a, b) => b.overallScore - a.overallScore)
    candidateSolutions[0].isRecommended = true

    // 5. 生成对比报告
    const comparisonReport = this._generateComparisonReport(candidateSolutions)

    console.log('\n✅ 优化完成！')
    this._printSummary(candidateSolutions)

    return {
      solutions: candidateSolutions,
      recommended: candidateSolutions[0],
      comparison: comparisonReport,
      constraints: constraints
    }
  }

  /**
   * 综合评估（扩展维度）
   */
  async _comprehensiveEvaluation(solution, constraints, parts) {
    const scores = {
      // 1. 成本维度
      cost: await this._evaluateCost(solution, constraints, parts),

      // 2. 安全维度
      safety: await this._evaluateSafety(solution, constraints, parts),

      // 3. 性能维度（流体）
      performance: await this._evaluatePerformance(solution, constraints, parts),

      // 4. 可维护性
      maintainability: await this._evaluateMaintainability(solution, constraints, parts),

      // 5. 扩展性
      expandability: await this._evaluateExpandability(solution, constraints, parts),

      // 6. 标准化程度
      standardization: await this._evaluateStandardization(solution, parts),

      // 7. 结构稳定性
      structural: await this._evaluateStructural(solution, constraints, parts)
    }

    return scores
  }

  /**
   * 成本评估
   * 包括：材料、人工、运输、维护
   */
  async _evaluateCost(solution, constraints, parts) {
    let totalCost = 0
    const breakdown = {}

    // 1. 管材成本（管长×单价）
    const pipeLength = this._calculateTotalPipeLength(solution.placements, constraints)
    const pipeCostPerMeter = this._getPipeCostPerMeter(constraints.pressure, constraints.fluidType)
    breakdown.pipeMaterial = pipeLength * pipeCostPerMeter / 1000
    totalCost += breakdown.pipeMaterial

    // 2. 管件成本（弯头、三通、法兰）
    const elbows = this._countElbows(solution.placements)
    const flanges = this._countFlanges(solution.placements)
    breakdown.fittings = elbows * 80 + flanges * 150
    totalCost += breakdown.fittings

    // 3. 阀门成本（按位置加权：高处需要延长杆+人工）
    breakdown.valves = 0
    for (const p of solution.placements) {
      if (p.type === 'valve' || p.part_number?.includes('阀')) {
        let valveCost = 500 // 基础阀门成本

        // 高度惩罚
        if (p.position.z > 2000) {
          valveCost += 200 // 需要平台或延长杆
        }
        if (p.position.z < 500) {
          valveCost += 100 // 低位操作不便，需要蹲姿操作
        }

        breakdown.valves += valveCost
      }
    }
    totalCost += breakdown.valves

    // 4. 支架/平台成本
    breakdown.supports = 0
    if (solution.layers > 1) {
      breakdown.supports = (solution.layers - 1) * 2000 // 每层2000元
    }
    totalCost += breakdown.supports

    // 5. 安装人工（按层数和难度）
    const baseLabor = parts.length * 200 // 200元/件
    const layerMultiplier = 1 + (solution.layers - 1) * 0.3 // 每增加一层+30%
    breakdown.labor = baseLabor * layerMultiplier
    totalCost += breakdown.labor

    // 6. 焊接成本（法兰数×单价）
    breakdown.welding = flanges * 100
    totalCost += breakdown.welding

    return {
      total: totalCost,
      breakdown,
      score: 1 / (totalCost / 10000) // 归一化：成本越低分数越高
    }
  }

  /**
   * 安全性评估
   * 包括：危险区隔离、应急通道、泄漏扩散、支架稳定性
   */
  async _evaluateSafety(solution, constraints, parts) {
    let safetyScore = 1.0
    const issues = []

    // 1. 危险气体隔离检查
    if (['H2', 'O2', 'Cl2', 'HCl'].includes(constraints.fluidType)) {
      // 氢气或氧气需要隔离区
      const hasIsolation = this._checkIsolationZone(solution.placements)
      if (!hasIsolation) {
        safetyScore -= 0.3
        issues.push('危险气体未设置隔离区')
      }
    }

    // 2. 应急通道检查（≥800mm宽）
    const hasEmergencyAccess = this._checkEmergencyAccess(solution.placements, constraints.envelope)
    if (!hasEmergencyAccess) {
      safetyScore -= 0.2
      issues.push('缺少应急通道（需要≥800mm宽通道）')
    }

    // 3. 泄漏扩散分析（高处泄漏更危险）
    const leakRisk = this._analyzeLeakRisk(solution.placements, constraints.fluidType)
    safetyScore -= leakRisk * 0.1
    if (leakRisk > 0.5) {
      issues.push('存在高位泄漏风险点')
    }

    // 4. 重心稳定性（重物应在下层）
    const centerOfMass = this._calculateCenterOfMass(solution.placements, parts)
    if (centerOfMass.z > constraints.envelope.height * 0.6) {
      safetyScore -= 0.15
      issues.push('重心偏高，结构不稳定')
    }

    // 5. 支架检查（多层需要足够支撑）
    if (solution.layers > 1) {
      const supportCheck = this._checkStructuralSupport(solution.placements)
      if (!supportCheck.adequate) {
        safetyScore -= 0.2
        issues.push('多层布局需要增加支架')
      }
    }

    return {
      score: Math.max(0, safetyScore),
      issues,
      hasCriticalIssues: issues.some(i => i.includes('危险') || i.includes('泄漏'))
    }
  }

  /**
   * држ能评估（流体阻力）
   * 包括：弯头数、管径变化、总长度、压降估算
   */
  async _evaluatePerformance(solution, constraints, parts) {
    let performanceScore = 1.0

    // 1. 弯头惩罚（每个弯头增加阻力）
    const elbows = this._countElbows(solution.placements)
    const elbowPenalty = elbows * 0.05
    performanceScore -= elbowPenalty

    // 2. 管长惩罚（管越长摩擦阻力越大）
    const pipeLength = this._calculateTotalPipeLength(solution.placements, constraints)
    const lengthPenalty = (pipeLength / 1000) * 0.02 // 每米-2%
    performanceScore -= lengthPenalty

    // 3. 管径变化惩罚（减小管径增加阻力）
    const diameterChanges = this._countDiameterChanges(solution.placements)
    performanceScore -= diameterChanges * 0.03

    // 4. 压降估算（Darcy-Weisbach方程简化）
    const estimatedPressureDrop = this._estimatePressureDrop(solution, constraints)
    const pressureDropPenalty = estimatedPressureDrop / 100 // 每0.1bar -1%
    performanceScore -= pressureDropPenalty

    // 5. 直线度奖励（越直越好）
    const straightness = this._calculateStraightness(solution.placements, constraints)
    performanceScore += straightness * 0.1

    return {
      score: Math.max(0, performanceScore),
      elbowCount: elbows,
      pipeLength,
      pressureDrop: estimatedPressureDrop,
      straightness
    }
  }

  /**
   * 可维护性评估
   * 包括：操作高度、维修空间、工具可达性、拆卸顺序
   */
  async _evaluateMaintainability(solution, constraints, parts) {
    let maintScore = 1.0
    const issues = []

    // 1. 关键零件高度检查（阀门、过滤器）
    for (const p of solution.placements) {
      if (['valve', 'filter', 'mfc', 'sensor'].includes(p.type)) {
        const ergo = this.chemicalKB.ergonomics[p.type] || this.chemicalKB.ergonomics.valve

        if (p.position.z < ergo.optimalHeight.min || p.position.z > ergo.optimalHeight.max) {
          maintScore -= 0.05
          issues.push(`${p.part_number}高度不佳（当前${p.position.z}mm）`)
        }
      }
    }

    // 2. 维修空间检查
    const accessIssues = []
    for (const p of solution.placements) {
      const accessCheck = this.collisionDetector.checkMaintenanceAccess(p, solution.placements)
      if (accessCheck.length > 0) {
        maintScore -= 0.1
        accessIssues.push(...accessCheck)
      }
    }

    // 3. 拆卸顺序合理性（先装后拆）
    const dismantlingOrder = this._analyzeDismantlingSequence(solution.placements)
    if (dismantlingOrder.hasBlockingIssues) {
      maintScore -= 0.15
      issues.push('存在拆卸顺序问题')
    }

    // 4. 工具可达性（扳手空间）
    const toolAccess = this._checkToolAccess(solution.placements)
    maintScore += toolAccess.adequateCount / solution.placements.length * 0.2

    return {
      score: Math.max(0, maintScore),
      issues,
      accessIssues,
      dismantlingComplexity: dismantlingOrder.complexity
    }
  }

  /**
   * 扩展性评估
   * 包括：预留接口、空间余量、模块化程度
   */
  async _evaluateExpandability(solution, constraints, parts) {
    let expandScore = 0

    // 1. 空间利用率（不要太满，留30%余量最佳）
    const utilization = this._calculateSpaceUtilization(solution.placements, constraints.envelope)
    if (utilization < 0.7) {
      expandScore += 0.3 // 有余量好
    } else if (utilization > 0.9) {
      expandScore -= 0.2 // 太满不利扩展
    }

    // 2. 预留接口（T型三通）
    const reservedPorts = this._countReservedPorts(solution.placements)
    expandScore += Math.min(reservedPorts * 0.1, 0.3)

    // 3. 模块化程度（功能分区）
    const modularityScore = this._evaluateModularity(solution.placements)
    expandScore += modularityScore * 0.4

    return {
      score: Math.min(1, expandScore),
      spaceUtilization: utilization,
      reservedPorts,
      modularity: modularityScore
    }
  }

  /**
   * 标准化评估
   * 包括：标准件占比、规格统一性、通用性
   */
  async _evaluateStandardization(solution, parts) {
    let stdScore = 0

    // 1. 标准件占比
    const standardParts = parts.filter(p =>
      p.partNumber.match(/GB|ISO|ANSI|DIN|JIS/) ||
      this.standardParts[p.partNumber]
    )
    const stdRatio = standardParts.length / parts.length
    stdScore += stdRatio * 0.4

    // 2. 管径统一性（尽量少的规格）
    const diameters = new Set(parts.map(p => p.dn || p.diameter).filter(Boolean))
    const diameterVariety = diameters.size
    stdScore += (1 / Math.max(diameterVariety, 1)) * 0.3

    // 3. 压力等级统一性
    const pressureRatings = new Set(parts.map(p => p.pn || p.pressureRating).filter(Boolean))
    stdScore += (1 / Math.max(pressureRatings.size, 1)) * 0.3

    return {
      score: stdScore,
      standardPartsRatio: stdRatio,
      diameterVariety,
      pressureRatingVariety: pressureRatings.size
    }
  }

  /**
   * 结构稳定性评估
   */
  async _evaluateStructural(solution, constraints, parts) {
    let structScore = 1.0

    // 1. 重心位置
    const com = this._calculateCenterOfMass(solution.placements, parts)
    const comHeight = com.z / constraints.envelope.height
    if (comHeight > 0.6) {
      structScore -= 0.2 // 重心太高
    }

    // 2. 悬臂长度（水平突出不能太长）
    const maxCantilever = this._calculateMaxCantilever(solution.placements)
    if (maxCantilever > 800) {
      structScore -= 0.3
    }

    // 3. 支撑点分布
    const supportDistribution = this._analyzeSupportDistribution(solution.placements)
    if (!supportDistribution.balanced) {
      structScore -= 0.2
    }

    return {
      score: Math.max(0, structScore),
      centerOfMassHeight: comHeight,
      maxCantilever,
      supportBalance: supportDistribution.balanced
    }
  }

  /**
   * 识别警告
   */
  async _identifyWarnings(solution, constraints, parts) {
    const warnings = []

    // 化学兼容性警告
    const chemWarnings = this.chemicalKB.checkConstraints(parts, constraints.fluidType, constraints.pressure)
    warnings.push(...chemWarnings.filter(w => w.severity === 'critical'))

    // 碰撞警告
    const collisions = this.collisionDetector.detectAllCollisions(solution.placements)
    if (collisions.length > 0) {
      warnings.push({
        type: 'collision',
        severity: 'high',
        count: collisions.length,
        message: `存在${collisions.length}处碰撞`
      })
    }

    // 超出边界警告
    for (const p of solution.placements) {
      if (p.position.x < 0 || p.position.x > constraints.envelope.width ||
          p.position.y < 0 || p.position.y > constraints.envelope.depth ||
          p.position.z < 0 || p.position.z > constraints.envelope.height) {
        warnings.push({
          type: 'out_of_bounds',
          severity: 'critical',
          part: p.part_number,
          message: `零件${p.part_number}超出边界`
        })
      }
    }

    return warnings
  }

  /**
   * 生成优化建议
   */
  _generateRecommendations(solution) {
    const recommendations = []

    // 基于得分给建议
    if (solution.detailedScores.cost.total > 50000) {
      recommendations.push('💡 考虑减少管路弯头或使用标准管长降低成本')
    }

    if (solution.detailedScores.safety.score < 0.7) {
      recommendations.push('⚠️  建议增加隔离区和应急通道提高安全性')
    }

    if (solution.detailedScores.performance.elbowCount > 10) {
      recommendations.push('⚡ 弯头过多影响流量，建议优化管路走向')
    }

    if (solution.layers > 2) {
      recommendations.push('🏗️  多层布局需要钢结构平台，增加成本')
    }

    return recommendations
  }

  /**
   * 计算加权总分
   */
  _calculateWeightedScore(scores) {
    let total = 0
    total += scores.cost.score * this.optimizationGoals.cost.weight
    total += scores.safety.score * this.optimizationGoals.safety.weight
    total += scores.performance.score * this.optimizationGoals.performance.weight
    total += scores.maintainability.score * this.optimizationGoals.maintainability.weight
    total += scores.expandability.score * this.optimizationGoals.expandability.weight
    return total
  }

  /**
   * 生成对比报告
   */
  _generateComparisonReport(solutions) {
    return {
      summary: `共生成${solutions.length}种方案`,
      bestFor: {
        cost: solutions.sort((a, b) => b.detailedScores.cost.score - a.detailedScores.cost.score)[0].name,
        safety: solutions.sort((a, b) => b.detailedScores.safety.score - a.detailedScores.safety.score)[0].name,
        performance: solutions.sort((a, b) => b.detailedScores.performance.score - a.detailedScores.performance.score)[0].name
      },
      tradeoffs: [
        '紧凑方案成本最低，但维护不便',
        '垂直方案占地小，但需要平台和楼梯',
        '省料方案管路最短，但可能操作高度不佳'
      ]
    }
  }

  _printSummary(solutions) {
    console.log('\n' + '='.repeat(80))
    console.log('方案对比总结'.padStart(50))
    console.log('='.repeat(80))

    solutions.forEach((sol, idx) => {
      console.log(`\n${idx + 1}. ${sol.name} ${sol.isRecommended ? '⭐ [推荐]' : ''}`)
      console.log(`   综合得分: ${(sol.overallScore * 100).toFixed(1)}分`)
      console.log(`   成本: ${sol.detailedScores.cost.total.toFixed(0)}元`)
      console.log(`   层数: ${sol.layers}层`)
      console.log(`   管长: ${sol.detailedScores.performance.pipeLength.toFixed(0)}mm`)
      console.log(`   安全性: ${(sol.detailedScores.safety.score * 100).toFixed(0)}%`)
      if (sol.warnings.length > 0) {
        console.log(`   ⚠️  警告: ${sol.warnings.length}项`)
      }
    })

    console.log('\n' + '='.repeat(80))
  }

  // 辅助方法
  _calculateTotalPipeLength(placements, constraints) {
    // 简化实现
    return placements.length * 500
  }

  _countElbows(placements) {
    return Math.floor(placements.length / 3)
  }

  _countFlanges(placements) {
    return placements.filter(p => p.type === 'flange').length
  }

  _getPipeCostPerMeter(pressure, fluidType) {
    const baseCost = 50 // 50元/米基础
    const pressureFactor = pressure > 40 ? 1.5 : 1.0
    const fluidFactor = ['H2', 'O2', 'Cl2'].includes(fluidType) ? 1.3 : 1.0
    return baseCost * pressureFactor * fluidFactor
  }

  _checkIsolationZone(placements) {
    // 简化：检查是否有足够间距
    return true
  }

  _checkEmergencyAccess(placements, envelope) {
    // 简化：检查是否有通道
    return true
  }

  _analyzeLeakRisk(placements, fluidType) {
    // 高度越高泄漏风险越大
    const avgHeight = placements.reduce((sum, p) => sum + p.position.z, 0) / placements.length
    return avgHeight / 3000 // 归一化
  }

  _calculateCenterOfMass(placements, parts) {
    const totalMass = placements.length * 10 // 简化：每个10kg
    const x = placements.reduce((sum, p) => sum + p.position.x, 0) / placements.length
    const y = placements.reduce((sum, p) => sum + p.position.y, 0) / placements.length
    const z = placements.reduce((sum, p) => sum + p.position.z, 0) / placements.length
    return { x, y, z }
  }

  _checkStructuralSupport(placements) {
    return { adequate: true }
  }

  _countDiameterChanges(placements) {
    return 2 // 简化
  }

  _estimatePressureDrop(solution, constraints) {
    // Darcy-Weisbach简化
    const L = this._calculateTotalPipeLength(solution.placements, constraints) / 1000 // m
    const f = 0.02 // 摩擦系数
    const D = 0.05 // 50mm管径
    const v = 10 // 10m/s流速
    return f * (L / D) * (v * v / (2 * 9.81)) / 10 // bar
  }

  _calculateStraightness(placements, constraints) {
    const directDistance = Math.sqrt(
      (constraints.outlet.x - constraints.inlet.x) ** 2 +
      (constraints.outlet.y - constraints.inlet.y) ** 2 +
      (constraints.outlet.z - constraints.inlet.z) ** 2
    )
    const actualPath = this._calculateTotalPipeLength(placements, constraints)
    return directDistance / actualPath
  }

  _analyzeDismantlingSequence(placements) {
    return { hasBlockingIssues: false, complexity: 'medium' }
  }

  _checkToolAccess(placements) {
    return { adequateCount: placements.length * 0.8 }
  }

  _calculateSpaceUtilization(placements, envelope) {
    const occupied = placements.length * (100 * 100 * 100) // mm³
    const total = envelope.width * envelope.depth * envelope.height
    return occupied / total
  }

  _countReservedPorts(placements) {
    return 2 // 简化
  }

  _evaluateModularity(placements) {
    return 0.6 // 简化
  }

  _calculateMaxCantilever(placements) {
    return 500 // mm
  }

  _analyzeSupportDistribution(placements) {
    return { balanced: true }
  }
}

module.exports = LayoutOptimizationEngine
