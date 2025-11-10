/**
 * 零件目录服务 - 统一管理零件本体、连接模板、标准映射
 */
class PartsCatalogService {
  constructor() {
    this.db = require('../../config/database')
  }

  /**
   * 零件选择 - 多目标打分器
   * @param {Object} targetAttrs - PID推断的目标属性 {family, dn, pn, end_type, face_type, mat, std}
   * @returns {Object} {part, score, alternatives: [{part, score, reason}]}
   */
  async selectPart(targetAttrs) {
    const { family, dn, pn, end_type, face_type, mat, std } = targetAttrs

    // 1. 主过滤 (只保留严格必需的过滤,end_type和face_type用于打分)
    let query = this.db('parts_catalog')
      .where({ family })
      .modify((qb) => {
        if (dn !== undefined) qb.where({ dn })
        if (pn !== undefined) qb.where({ pn })
        // end_type 和 face_type 不作为硬过滤条件,而是用于后续打分
      })

    const candidates = await query.select('*')

    if (candidates.length === 0) {
      throw new Error(`缺料: ${family} DN${dn} PN${pn} ${end_type}`)
    }

    // 2. 多目标打分
    const weights = {
      dn_match: 0.3,
      pn_match: 0.25,
      end_type_match: 0.2,
      mat_match: 0.1,
      std_compat: 0.1,
      stock_level: 0.05
    }

    const scored = candidates.map(part => {
      let score = 0
      let details = {}

      // DN匹配（精确）
      if (part.dn === dn) {
        score += weights.dn_match
        details.dn = 1.0
      }

      // PN匹配（允许高等级代替低等级）
      if (part.pn === pn) {
        score += weights.pn_match
        details.pn = 1.0
      } else if (part.pn > pn) {
        score += weights.pn_match * 0.8
        details.pn = 0.8
      }

      // 端型匹配
      if (end_type && part.end_type === end_type) {
        score += weights.end_type_match
        details.end_type = 1.0
      }

      // 面型匹配（仅对法兰和垫片）
      if (face_type && ['flange', 'gasket'].includes(family)) {
        if (part.face_type === face_type) {
          score += weights.end_type_match * 0.5  // 使用0.5权重避免过度惩罚
          details.face_type = 1.0
        }
      }

      // 材质匹配
      if (mat && part.mat === mat) {
        score += weights.mat_match
        details.mat = 1.0
      } else if (mat && this._materialCompatible(part.mat, mat)) {
        score += weights.mat_match * 0.7
        details.mat = 0.7
      }

      // 标准兼容性
      if (std && part.std?.startsWith(std.split(' ')[0])) {
        score += weights.std_compat
        details.std = 1.0
      }

      // 库存可得性（预留字段）
      if (part.stock_qty > 0) {
        score += weights.stock_level
        details.stock = 1.0
      }

      return {
        part,
        score,
        details,
        reason: this._explainScore(details)
      }
    })

    // 3. 排序返回
    scored.sort((a, b) => b.score - a.score)

    const top = scored[0]
    const alternatives = scored.slice(1, 4).filter(s => s.score > 0.5)

    return {
      part: top.part,
      score: top.score,
      reason: top.reason,
      alternatives,
      uncertain: alternatives.length > 0 && (top.score - alternatives[0].score < 0.1)
    }
  }

  /**
   * 查询连接模板（参数化版本）
   */
  async getConnectionTemplate(familyA, familyB, attrs) {
    const { dn, pn, end_type, face_type, std } = attrs

    // 1. 精确匹配
    let template = await this.db('connection_templates')
      .where({ family_a: familyA, family_b: familyB })
      .where({ dn, pn })
      .modify(qb => {
        if (end_type) qb.where({ end_type })
        if (face_type) qb.where({ face_type })
      })
      .first()

    // 2. 回退到参数化公式模板
    if (!template) {
      template = await this.db('connection_templates')
        .where({ family_a: familyA, family_b: familyB })
        .whereNull('dn')  // 通用模板
        .first()

      if (template && template.formula) {
        template = this._evaluateFormula(template, { dn, pn, std })
      }
    }

    if (!template) {
      throw new Error(`缺少连接模板: ${familyA}↔${familyB} DN${dn} PN${pn}`)
    }

    return template
  }

  /**
   * 参数化公式求值
   * @example formula: {"pcd_mm": "125 + (dn-50)*2.5", "bolt_count": "dn<=80?4:8"}
   */
  _evaluateFormula(template, context) {
    const { dn, pn, std } = context
    const result = JSON.parse(JSON.stringify(template))

    if (template.formula) {
      for (const [key, expr] of Object.entries(template.formula)) {
        try {
          // 简单安全eval（生产环境应用专用解析器）
          const value = eval(expr.replace(/dn/g, dn).replace(/pn/g, pn))
          result.fasteners = result.fasteners || {}
          result.fasteners[key] = value
        } catch (e) {
          console.error(`公式求值失败: ${expr}`, e)
        }
      }
    }

    return result
  }

  /**
   * 材质兼容性判断
   */
  _materialCompatible(matA, matB) {
    const compatGroups = [
      ['304', '316', '316L'],
      ['A105', 'A350-LF2'],
      ['Q235', 'Q345']
    ]

    for (const group of compatGroups) {
      if (group.includes(matA) && group.includes(matB)) {
        return true
      }
    }

    return false
  }

  /**
   * 解释打分详情
   */
  _explainScore(details) {
    const parts = []
    if (details.dn === 1.0) parts.push('DN精确匹配')
    if (details.pn === 1.0) parts.push('PN精确匹配')
    else if (details.pn === 0.8) parts.push('PN高代低')
    if (details.end_type === 1.0) parts.push('端型匹配')
    if (details.mat === 1.0) parts.push('材质匹配')
    else if (details.mat === 0.7) parts.push('材质兼容')
    if (details.std === 1.0) parts.push('标准一致')
    return parts.join(' + ')
  }

  /**
   * 获取零件端口信息（显式ports[]）
   */
  async getPartPorts(partId) {
    const ports = await this.db('part_ports')
      .where({ part_id: partId })
      .select('*')

    return ports.map(p => ({
      id: p.port_id,
      type: p.port_type,        // 'bore' | 'face' | 'thread'
      axis: typeof p.axis === 'string' ? JSON.parse(p.axis) : p.axis,  // [dx, dy, dz]
      origin: typeof p.origin === 'string' ? JSON.parse(p.origin) : p.origin, // [x, y, z]
      dn: p.dn,
      face_type: p.face_type,
      meta: typeof p.meta === 'string' ? JSON.parse(p.meta || '{}') : (p.meta || {})
    }))
  }

  /**
   * 标准映射查询
   */
  async getStandardMapping(lineClass) {
    const mapping = await this.db('standards_map')
      .where({ line_class: lineClass })
      .first()

    if (!mapping) return null

    return typeof mapping.defaults === 'string'
      ? JSON.parse(mapping.defaults)
      : mapping.defaults
  }

  /**
   * 带紧固件的零件选择 - 自动补充螺栓和垫片
   * @param {Object} targetAttrs - 目标属性
   * @param {Object} template - 连接模板（包含fasteners信息）
   * @returns {Array} 主零件+紧固件数组
   */
  async selectPartWithFasteners(targetAttrs, template) {
    // 1. 选择主零件
    const result = await this.selectPart(targetAttrs)
    const parts = [{
      ...result.part,
      quantity: 1,
      role: 'main',
      score: result.score,
      reason: result.reason
    }]

    // 2. 如果连接模板包含紧固件，自动添加
    if (template && template.fasteners) {
      const fasteners = typeof template.fasteners === 'string'
        ? JSON.parse(template.fasteners)
        : template.fasteners

      // 添加螺栓
      if (fasteners.bolt_count && fasteners.bolt_spec) {
        try {
          const bolt = await this.db('parts_catalog')
            .where({ family: 'bolt' })
            .where('specification', 'like', `%${fasteners.bolt_spec}%`)
            .first()

          if (bolt) {
            parts.push({
              ...bolt,
              quantity: fasteners.bolt_count,
              role: 'fastener',
              reason: `连接紧固 ${fasteners.bolt_spec}`
            })
          } else {
            console.warn(`未找到螺栓: ${fasteners.bolt_spec}`)
          }
        } catch (err) {
          console.error('查询螺栓失败:', err)
        }
      }

      // 添加垫片
      if (fasteners.gasket) {
        try {
          const gasket = await this.db('parts_catalog')
            .where({ family: 'gasket' })
            .where(qb => {
              qb.where({ part_number: fasteners.gasket })
                .orWhere('part_number', 'like', `%${targetAttrs.dn}%RF%`)
            })
            .first()

          if (gasket) {
            parts.push({
              ...gasket,
              quantity: 1,
              role: 'seal',
              reason: `法兰密封 DN${targetAttrs.dn}`
            })
          } else {
            console.warn(`未找到垫片: ${fasteners.gasket}`)
          }
        } catch (err) {
          console.error('查询垫片失败:', err)
        }
      }
    }

    return parts
  }
}

module.exports = new PartsCatalogService()
