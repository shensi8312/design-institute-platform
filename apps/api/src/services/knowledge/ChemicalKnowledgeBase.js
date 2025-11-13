/**
 * 化学/材料知识库
 * 定义不同流体对材料/密封的约束
 */
class ChemicalKnowledgeBase {
  constructor() {
    // 流体-材料兼容性矩阵
    this.fluidMaterialMatrix = {
      // 高纯氢气
      H2: {
        allowedMaterials: ['316L', '304L', 'Monel'],
        forbiddenMaterials: ['碳钢', '铜合金'], // 氢脆风险
        sealingType: 'VCR金属密封', // 防氢渗透
        purity: '>99.999%',
        pressureRating: 'PN40以上',
        leakRate: '<1e-9 mbar·L/s'
      },

      // 腐蚀性气体（HCl, Cl2）
      HCl: {
        allowedMaterials: ['Hastelloy C276', 'PTFE内衬'],
        forbiddenMaterials: ['304', '316L'], // 氯离子腐蚀
        sealingType: 'PTFE垫片',
        wetability: '湿氯气需要升级到Hastelloy',
        temperatureLimit: '<60°C'
      },

      Cl2: {
        allowedMaterials: ['Hastelloy C276', 'Monel 400', 'PTFE内衬'],
        forbiddenMaterials: ['304', '316L', '碳钢'],
        sealingType: 'PTFE垫片',
        dryOnly: true,
        comment: '湿氯气极强腐蚀性'
      },

      // 惰性气体（N2, Ar）
      N2: {
        allowedMaterials: ['304', '316', '316L', '铝合金'],
        sealingType: '橡胶O型圈或金属垫片',
        comment: '无特殊要求，成本优先'
      },

      Ar: {
        allowedMaterials: ['304', '316', '316L', '铝合金'],
        sealingType: '橡胶O型圈',
        comment: '惰性气体，最低要求'
      },

      // 氧气
      O2: {
        allowedMaterials: ['316L', '黄铜（脱脂）', '不锈钢（脱脂）'],
        forbiddenMaterials: ['含油材料', '铝合金', '有机物'],
        sealingType: '金属垫片或PTFE',
        degreasing: '必须脱脂处理',
        sparkRisk: '避免铁质零件（燃烧风险）',
        pressureLimit: 'PN25以上需要特殊设计'
      },

      // 氨气
      NH3: {
        allowedMaterials: ['316L', '碳钢'],
        forbiddenMaterials: ['铜合金', '锌合金'], // 应力腐蚀
        sealingType: '橡胶O型圈（丁腈橡胶）',
        temperatureLimit: '<50°C'
      }
    }

    // 压力等级-壁厚对照表
    this.pressureRatings = {
      PN16: { maxPressure: 16, wallThickness: { DN50: 2.9, DN25: 2.6, DN15: 2.3 } },
      PN40: { maxPressure: 40, wallThickness: { DN50: 3.6, DN25: 3.2, DN15: 2.9 } },
      PN64: { maxPressure: 64, wallThickness: { DN50: 4.5, DN25: 4.0, DN15: 3.6 } }
    }

    // 人体工程学约束
    this.ergonomics = {
      valve: {
        optimalHeight: { min: 800, max: 1500 }, // mm
        handwheelClearance: 200, // 手轮周围空间
        operationForce: { max: 250 } // N
      },
      sensor: {
        readableHeight: { min: 1200, max: 1800 }, // 显示屏可读高度
        maintenanceAccess: 300 // mm
      },
      flange: {
        boltingClearance: 200, // 法兰螺栓操作空间
        wrenchAccess: 150 // 扳手操作空间
      }
    }
  }

  /**
   * 验证流体-材料兼容性
   */
  validateFluidMaterial(fluidType, material) {
    const constraint = this.fluidMaterialMatrix[fluidType]
    if (!constraint) {
      return { valid: true, reason: '未知流体，无约束' }
    }

    // 检查禁用材料
    if (constraint.forbiddenMaterials?.some(m => material.includes(m))) {
      return {
        valid: false,
        reason: `${fluidType}禁用${material}（${constraint.wetability || constraint.sparkRisk || '腐蚀风险'}）`,
        severity: 'critical'
      }
    }

    // 检查允许材料
    if (constraint.allowedMaterials &&
        !constraint.allowedMaterials.some(m => material.includes(m))) {
      return {
        valid: false,
        reason: `${fluidType}需要使用${constraint.allowedMaterials.join('或')}材料`,
        severity: 'high'
      }
    }

    return {
      valid: true,
      reason: `${material}可用于${fluidType}`,
      recommendations: constraint
    }
  }

  /**
   * 推荐密封类型
   */
  recommendSealing(fluidType, pressure, temperature) {
    const fluid = this.fluidMaterialMatrix[fluidType]
    if (!fluid) return '橡胶O型圈（默认）'

    // 高压 → 金属密封
    if (pressure > 40) return 'VCR金属密封或C型密封垫'

    // 高纯/氢气 → VCR
    if (fluidType === 'H2' || fluid.purity) return 'VCR金属密封'

    // 腐蚀性 → PTFE
    if (fluid.forbiddenMaterials?.length > 3) return 'PTFE垫片'

    // 氧气 → 脱脂密封
    if (fluidType === 'O2') return '金属垫片或PTFE（脱脂）'

    return fluid.sealingType || '橡胶O型圈'
  }

  /**
   * 检查人体工程学约束
   */
  checkErgonomics(part, position) {
    const violations = []

    if (part.type === 'valve' || part.partName?.includes('阀')) {
      const ergo = this.ergonomics.valve

      if (position.z < ergo.optimalHeight.min) {
        violations.push({
          type: 'ergonomics',
          severity: 'medium',
          reason: `阀门高度${position.z}mm过低，建议${ergo.optimalHeight.min}-${ergo.optimalHeight.max}mm`
        })
      }

      if (position.z > ergo.optimalHeight.max) {
        violations.push({
          type: 'ergonomics',
          severity: 'medium',
          reason: `阀门高度${position.z}mm过高，操作不便`
        })
      }
    }

    if (part.type === 'sensor' || part.partName?.includes('传感器')) {
      const ergo = this.ergonomics.sensor

      if (position.z < ergo.readableHeight.min || position.z > ergo.readableHeight.max) {
        violations.push({
          type: 'ergonomics',
          severity: 'low',
          reason: `传感器显示屏高度${position.z}mm不在最佳可读范围${ergo.readableHeight.min}-${ergo.readableHeight.max}mm`
        })
      }
    }

    return violations
  }

  /**
   * 检查所有约束
   */
  checkConstraints(bomData, fluidType, pressure = 16, temperature = 25) {
    const violations = []

    for (const part of bomData) {
      // 1. 材料检查
      const material = part.specification || part.partName
      const matCheck = this.validateFluidMaterial(fluidType, material)
      if (!matCheck.valid) {
        violations.push({
          partNumber: part.partNumber,
          partName: part.partName,
          type: 'material_incompatible',
          severity: matCheck.severity,
          reason: matCheck.reason
        })
      }

      // 2. 密封类型检查
      if (part.partName.includes('密封') || part.partName.includes('gasket') || part.partName.includes('seal')) {
        const recommended = this.recommendSealing(fluidType, pressure, temperature)
        if (!part.partName.includes(recommended.split('密封')[0]) &&
            !part.partName.includes(recommended.split('垫片')[0])) {
          violations.push({
            partNumber: part.partNumber,
            partName: part.partName,
            type: 'sealing_mismatch',
            severity: 'medium',
            reason: `建议使用${recommended}，当前为${part.partName}`
          })
        }
      }

      // 3. 压力等级检查
      if (part.partName.match(/PN(\d+)/)) {
        const partPN = parseInt(part.partName.match(/PN(\d+)/)[1])
        if (partPN < pressure) {
          violations.push({
            partNumber: part.partNumber,
            partName: part.partName,
            type: 'pressure_rating_insufficient',
            severity: 'critical',
            reason: `零件压力等级PN${partPN}低于系统压力${pressure}bar`
          })
        }
      }
    }

    return violations
  }

  /**
   * 生成材料推荐报告
   */
  generateRecommendationReport(fluidType, pressure, temperature) {
    const fluid = this.fluidMaterialMatrix[fluidType]
    if (!fluid) {
      return {
        fluidType,
        materials: ['304', '316L'],
        sealing: '橡胶O型圈',
        notes: '通用配置'
      }
    }

    return {
      fluidType,
      materials: fluid.allowedMaterials,
      avoidMaterials: fluid.forbiddenMaterials,
      sealing: this.recommendSealing(fluidType, pressure, temperature),
      pressureRating: fluid.pressureRating || 'PN16',
      specialNotes: [
        fluid.degreasing ? '⚠️ 需要脱脂处理' : null,
        fluid.dryOnly ? '⚠️ 仅适用于干燥气体' : null,
        fluid.sparkRisk ? '⚠️ 注意火花风险' : null,
        fluid.comment
      ].filter(Boolean)
    }
  }
}

module.exports = ChemicalKnowledgeBase
