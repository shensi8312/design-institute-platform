const db = require('../../config/database')

/**
 * 机械工程知识库
 * 数据驱动：从数据库加载螺纹标准、法兰标准、材料属性
 */
class MechanicalEngineeringKB {
  constructor() {
    this.cache = {
      threadStandards: null,
      flangeStandards: null,
      lastUpdate: null
    }
    this.cacheExpiry = 3600000 // 1小时
  }

  async initialize() {
    await this._refreshCache()
  }

  async _refreshCache() {
    if (this.cache.lastUpdate && Date.now() - this.cache.lastUpdate < this.cacheExpiry) {
      return
    }

    this.cache.threadStandards = await db('thread_standards').select('*')
    this.cache.flangeStandards = await db('flange_standards').select('*')
    this.cache.lastUpdate = Date.now()

    console.log(`✅ [MechanicalKB] 缓存刷新: ${this.cache.threadStandards.length}个螺纹标准, ${this.cache.flangeStandards.length}个法兰标准`)
  }

  /**
   * 验证螺纹配对
   */
  async validateThreadMating(part1, part2) {
    await this._refreshCache()

    const thread1 = this._extractThreadSpec(part1.partName || part1.part_name)
    const thread2 = this._extractThreadSpec(part2.partName || part2.part_name)

    if (!thread1 || !thread2) {
      return { valid: true, reason: '无螺纹信息，跳过检查' }
    }

    // 从数据库查找螺纹标准
    const std1 = this.cache.threadStandards.find(t =>
      t.standard_system === thread1.system && t.thread_size === thread1.size
    )

    if (thread1.size !== thread2.size || thread1.system !== thread2.system) {
      return {
        valid: false,
        severity: 'critical',
        reason: `螺纹不匹配: ${thread1.size} (${thread1.system}) ≠ ${thread2.size} (${thread2.system})`
      }
    }

    const isMaleFemale = (thread1.type === 'male' && thread2.type === 'female') ||
                         (thread1.type === 'female' && thread2.type === 'male')

    if (!isMaleFemale) {
      return {
        valid: false,
        severity: 'high',
        reason: `螺纹类型不匹配: ${thread1.type} ↔ ${thread2.type} (需要公母配合)`
      }
    }

    return {
      valid: true,
      reason: `螺纹配对正确: ${thread1.size}`,
      recommendedTorque: std1?.torque_specs || null
    }
  }

  /**
   * 验证法兰配对
   */
  async validateFlangeMating(part1, part2) {
    await this._refreshCache()

    const flange1 = this._extractFlangeSpec(part1.partName || part1.part_name)
    const flange2 = this._extractFlangeSpec(part2.partName || part2.part_name)

    if (!flange1 || !flange2) {
      return { valid: true, reason: '无法兰信息' }
    }

    if (flange1.standard !== flange2.standard) {
      return {
        valid: false,
        severity: 'critical',
        reason: `法兰标准不匹配: ${flange1.standard} ≠ ${flange2.standard} (不能混用ANSI和DIN)`
      }
    }

    if (flange1.rating !== flange2.rating || flange1.size !== flange2.size) {
      return {
        valid: false,
        severity: 'high',
        reason: `法兰规格不匹配: ${flange1.rating} DN${flange1.size} ≠ ${flange2.rating} DN${flange2.size}`
      }
    }

    const std = this.cache.flangeStandards.find(f =>
      f.standard_system === flange1.standard &&
      f.pressure_rating === flange1.rating &&
      f.nominal_size === `DN${flange1.size}`
    )

    return {
      valid: true,
      reason: `法兰配对正确: ${flange1.standard} ${flange1.rating} DN${flange1.size}`,
      boltRequirements: std ? {
        boltSize: std.bolt_size,
        boltCount: std.bolt_holes,
        torque: this._calculateFlangePreload(std)
      } : null
    }
  }

  /**
   * 检查机械设计合规性
   */
  async validateMechanicalDesign(bomData, constraints) {
    const violations = []

    for (const part of bomData) {
      // 螺纹配对检查
      if (/螺栓|螺母|bolt|nut/i.test(part.partName || part.part_name)) {
        const matingParts = bomData.filter(p =>
          p !== part && /螺栓|螺母|bolt|nut/i.test(p.partName || p.part_name)
        )

        for (const mate of matingParts) {
          const validation = await this.validateThreadMating(part, mate)
          if (!validation.valid) {
            violations.push({
              partNumber: part.partNumber || part.part_number,
              partName: part.partName || part.part_name,
              mateWith: mate.partName || mate.part_name,
              type: 'thread_mismatch',
              severity: validation.severity,
              reason: validation.reason
            })
          }
        }
      }

      // 法兰配对检查
      if (/法兰|flange/i.test(part.partName || part.part_name)) {
        const flanges = bomData.filter(p =>
          p !== part && /法兰|flange/i.test(p.partName || p.part_name)
        )

        for (const otherFlange of flanges) {
          const validation = await this.validateFlangeMating(part, otherFlange)
          if (!validation.valid) {
            violations.push({
              partNumber: part.partNumber || part.part_number,
              partName: part.partName || part.part_name,
              mateWith: otherFlange.partName || otherFlange.part_name,
              type: 'flange_mismatch',
              severity: validation.severity,
              reason: validation.reason
            })
          }
        }
      }
    }

    return violations
  }

  _extractThreadSpec(partName) {
    const metricMatch = partName.match(/M(\d+)/i)
    if (metricMatch) {
      const size = `M${metricMatch[1]}`
      const type = /bolt|螺栓/i.test(partName) ? 'male' : 'female'
      return { size, system: 'metric', type }
    }

    const imperialMatch = partName.match(/([\d/]+)["']?-(\d+)/i)
    if (imperialMatch) {
      const size = `${imperialMatch[1]}"-${imperialMatch[2]}`
      const type = /bolt|螺栓/i.test(partName) ? 'male' : 'female'
      return { size, system: 'imperial', type }
    }

    return null
  }

  _extractFlangeSpec(partName) {
    const ansiMatch = partName.match(/(150|300|600)#?\s*(DN)?(\d+)/i)
    if (ansiMatch) {
      return {
        standard: 'ANSI',
        rating: `${ansiMatch[1]}#`,
        size: parseInt(ansiMatch[3])
      }
    }

    const dinMatch = partName.match(/PN(\d+)\s*(DN)?(\d+)/i)
    if (dinMatch) {
      return {
        standard: 'DIN',
        rating: `PN${dinMatch[1]}`,
        size: parseInt(dinMatch[3])
      }
    }

    return null
  }

  _calculateFlangePreload(flangeSpec) {
    // 简化计算，实际应查询螺栓预紧力表
    return {
      torquePerBolt: 50, // Nm (占位)
      totalTorque: 50 * flangeSpec.bolt_holes,
      unit: 'Nm'
    }
  }
}

module.exports = MechanicalEngineeringKB
