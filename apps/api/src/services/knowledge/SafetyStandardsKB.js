const db = require('../../config/database')

/**
 * 安全规范知识库
 * 危险品隔离、应急通道、防爆区域、泄漏分析
 */
class SafetyStandardsKB {
  constructor() {
    this.cache = {
      isolationDistances: null,
      lastUpdate: null
    }
    this.cacheExpiry = 3600000

    // 应急通道要求 (GB 50016-2014)
    this.emergencyCorridorRequirements = {
      minWidth: 800, // mm
      optimalWidth: 1200, // mm
      minHeight: 2000, // mm
      maxWalkDistance: 30000 // mm
    }

    // 防爆区域分类 (GB 50058, IEC 60079)
    this.explosionProofZones = {
      'Zone 0': {
        description: '持续存在爆炸性气体环境',
        equipmentRequirement: 'Ex ia / Ex ib',
        ventilationRate: 12
      },
      'Zone 1': {
        description: '正常运行时可能出现爆炸性气体',
        equipmentRequirement: 'Ex d / Ex e',
        ventilationRate: 8
      },
      'Zone 2': {
        description: '仅异常状态下短时间出现爆炸性气体',
        equipmentRequirement: 'Ex nA / Ex nC',
        ventilationRate: 4
      }
    }
  }

  async initialize() {
    await this._refreshCache()
  }

  async _refreshCache() {
    if (this.cache.lastUpdate && Date.now() - this.cache.lastUpdate < this.cacheExpiry) {
      return
    }

    this.cache.isolationDistances = await db('hazard_isolation_distances').select('*')
    this.cache.lastUpdate = Date.now()

    console.log(`✅ [SafetyKB] 缓存刷新: ${this.cache.isolationDistances.length}条隔离规则`)
  }

  /**
   * 计算危险品隔离距离
   */
  async calculateIsolationDistance(fluid1, fluid2) {
    await this._refreshCache()

    const rule = this.cache.isolationDistances.find(r =>
      (r.fluid_type_1 === fluid1 && r.fluid_type_2 === fluid2) ||
      (r.fluid_type_1 === fluid2 && r.fluid_type_2 === fluid1)
    )

    if (rule) {
      return {
        distance: rule.min_distance,
        reason: rule.reason || `${fluid1} ↔ ${fluid2} 安全隔离`,
        riskLevel: rule.risk_level,
        standardRef: rule.standard_ref
      }
    }

    // 默认安全距离
    return {
      distance: 1000,
      reason: `未知流体组合，使用默认隔离距离`,
      riskLevel: 'medium'
    }
  }

  /**
   * 验证应急通道
   */
  validateEmergencyCorridor(layoutPlacements) {
    const violations = []
    const req = this.emergencyCorridorRequirements

    const corridorWidth = this._calculateCorridorWidth(layoutPlacements)

    if (corridorWidth < req.minWidth) {
      violations.push({
        type: 'emergency_corridor_narrow',
        severity: 'critical',
        reason: `应急通道宽度${corridorWidth}mm < 最小要求${req.minWidth}mm`,
        currentValue: corridorWidth,
        requiredValue: req.minWidth
      })
    }

    const maxDistance = this._calculateMaxWalkDistance(layoutPlacements)
    if (maxDistance > req.maxWalkDistance) {
      violations.push({
        type: 'emergency_exit_too_far',
        severity: 'high',
        reason: `最远点到出口${(maxDistance/1000).toFixed(1)}m > 最大允许${req.maxWalkDistance/1000}m`,
        currentValue: maxDistance,
        requiredValue: req.maxWalkDistance
      })
    }

    return violations
  }

  /**
   * 确定防爆区域分类
   */
  determineExplosionProofZone(partType, fluidType, ventilationRate = 4) {
    if (partType === 'tank' || partType === 'sealed_container') {
      return {
        zone: 'Zone 0',
        reason: '密闭容器内部持续存在爆炸性气体',
        requirements: this.explosionProofZones['Zone 0']
      }
    }

    if (['valve', 'flange', 'pump', 'connector'].includes(partType)) {
      if (ventilationRate >= 8) {
        return {
          zone: 'Zone 2',
          reason: '通风良好，仅异常时短时间存在',
          requirements: this.explosionProofZones['Zone 2']
        }
      }
      return {
        zone: 'Zone 1',
        reason: '泄漏高危点，正常运行可能出现爆炸性气体',
        requirements: this.explosionProofZones['Zone 1']
      }
    }

    return {
      zone: 'Zone 2',
      reason: '通风良好的开放空间',
      requirements: this.explosionProofZones['Zone 2']
    }
  }

  /**
   * 检查安全合规性
   */
  async validateSafetyCompliance(bomData, layoutPlacements, constraints) {
    const violations = []

    // 1. 危险品隔离距离检查
    for (let i = 0; i < layoutPlacements.length; i++) {
      for (let j = i + 1; j < layoutPlacements.length; j++) {
        const p1 = layoutPlacements[i]
        const p2 = layoutPlacements[j]

        const fluid1 = p1.fluidType || constraints?.fluidType
        const fluid2 = p2.fluidType || constraints?.fluidType

        if (fluid1 && fluid2) {
          const isolation = await this.calculateIsolationDistance(fluid1, fluid2)
          const actualDistance = this._distance3D(p1.position, p2.position)

          if (actualDistance < isolation.distance) {
            violations.push({
              part1: p1.part_number || p1.tag,
              part2: p2.part_number || p2.tag,
              type: 'hazard_isolation_insufficient',
              severity: isolation.riskLevel === 'critical' ? 'critical' : 'high',
              reason: `${fluid1} ↔ ${fluid2} 隔离距离${actualDistance.toFixed(0)}mm < 要求${isolation.distance}mm`,
              currentDistance: actualDistance,
              requiredDistance: isolation.distance
            })
          }
        }
      }
    }

    // 2. 应急通道检查
    const corridorViolations = this.validateEmergencyCorridor(layoutPlacements)
    violations.push(...corridorViolations)

    return violations
  }

  _calculateCorridorWidth(placements) {
    if (placements.length < 2) return 2000
    const sortedX = placements.map(p => p.position.x).sort((a, b) => a - b)
    const gaps = sortedX.slice(1).map((x, i) => x - sortedX[i])
    return Math.min(...gaps)
  }

  _calculateMaxWalkDistance(placements) {
    if (placements.length === 0) return 0
    const maxDist = Math.max(...placements.map(p =>
      Math.sqrt(p.position.x ** 2 + p.position.y ** 2)
    ))
    return maxDist
  }

  _distance3D(pos1, pos2) {
    const dx = pos1.x - pos2.x
    const dy = pos1.y - pos2.y
    const dz = pos1.z - pos2.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }
}

module.exports = SafetyStandardsKB
