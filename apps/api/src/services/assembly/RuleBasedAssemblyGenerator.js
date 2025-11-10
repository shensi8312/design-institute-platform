/**
 * 基于规则的装配生成器
 * 从装配规则重建装配体,验证规则提取的准确性
 */

const db = require('../../config/database')
const StepAssemblyParser = require('./StepAssemblyParser')
const path = require('path')

class RuleBasedAssemblyGenerator {
  constructor() {
    this.rules = []
    this.parts = []
    this.constraints = []
    this.placements = []
    this.generatedAssembly = null
  }

  async loadRules() {
    const result = await db.raw(`
      SELECT rule_id, name, description, condition_logic, action_template, priority
      FROM assembly_rules
      WHERE is_active = true
      ORDER BY priority DESC
    `)

    this.rules = result.rows
    console.log(`[RuleBasedGen] 加载了 ${this.rules.length} 条装配规则`)
    return this.rules
  }

  async loadParts(partIds = null) {
    let query = db('parts_catalog')
      .select('part_id', 'family', 'dn', 'pn', 'end_type', 'face_type', 'meta', 'model_path')

    if (partIds && partIds.length > 0) {
      query = query.whereIn('part_id', partIds)
    }

    this.parts = await query
    console.log(`[RuleBasedGen] 加载了 ${this.parts.length} 个零件`)
    return this.parts
  }

  async generateFromStepAssembly(assemblyStepPath) {
    console.log('[装配生成] 📂 从STEP文件生成:', assemblyStepPath)

    const assemblyData = StepAssemblyParser.parseAssembly(assemblyStepPath)
    console.log(`[装配生成] 📦 提取到${assemblyData.products.length}个零件`)

    const instances = StepAssemblyParser.extractPartInstances(assemblyData)

    await this.loadRules()

    this.generatedAssembly = {
      assembly_id: `asm_${Date.now()}`,
      name: path.basename(assemblyStepPath, '.STEP'),
      source_file: assemblyStepPath,
      parts: instances,
      constraints: this._generateConstraintsFromInstances(instances),
      metadata: {
        generated_at: new Date().toISOString(),
        part_count: instances.length,
        source_type: 'step_assembly'
      }
    }

    console.log(`[装配生成] ✅ 装配生成完成: ${instances.length}个零件, ${this.generatedAssembly.constraints.length}个约束`)
    return this.generatedAssembly
  }

  _generateConstraintsFromInstances(instances) {
    const constraints = []

    for (let i = 0; i < instances.length - 1; i++) {
      const partA = instances[i]
      const partB = instances[i + 1]

      for (const rule of this.rules) {
        if (this._ruleAppliesToInstances(rule, partA, partB)) {
          const constraint = this._applyRuleToInstances(rule, partA, partB)
          if (constraint) {
            constraints.push(constraint)
          }
        }
      }
    }

    return constraints
  }

  _ruleAppliesToInstances(rule, partA, partB) {
    if (!rule.condition_logic) return false

    const condition = rule.condition_logic

    if (condition.mate_type) {
      return true
    }

    if (condition.distance_range) {
      const distance = this._calculateDistanceArray(partA.position, partB.position)
      return distance >= condition.distance_range.min &&
             distance <= condition.distance_range.max
    }

    return false
  }

  _applyRuleToInstances(rule, partA, partB) {
    if (!rule.action_template) return null

    const action = rule.action_template

    return {
      constraint_id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: action.constraint_type || rule.constraint_type,
      part_a: partA.instance_id,
      part_b: partB.instance_id,
      parameters: action.parameters || {},
      rule_id: rule.rule_id,
      confidence: 0.8 + (rule.confidence_boost || 0)
    }
  }

  _calculateDistanceArray(posA, posB) {
    const dx = posA[0] - posB[0]
    const dy = posA[1] - posB[1]
    const dz = posA[2] - posB[2]
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  matchPartsWithRules(partA, partB) {
    const matches = []

    for (const rule of this.rules) {
      const condition = rule.condition_logic
      let isMatch = false

      if (condition.type === 'both') {
        isMatch = this._checkCondition(partA, condition) &&
                  this._checkCondition(partB, condition)
      } else if (condition.type === 'name_contains') {
        isMatch = (partA.part_id && partA.part_id.includes(condition.value)) ||
                  (partB.part_id && partB.part_id.includes(condition.value))
      } else if (condition.type === 'thread_match') {
        const threadA = partA.meta?.thread || partA.end_type
        const threadB = partB.meta?.thread || partB.end_type
        isMatch = threadA && threadB && threadA === threadB
      } else if (condition.type === 'bolt_nut_pair') {
        const isBoltNut = (partA.family === 'bolt' && partB.family === 'nut') ||
                          (partA.family === 'nut' && partB.family === 'bolt')
        const threadMatch = partA.meta?.thread === partB.meta?.thread
        isMatch = isBoltNut && threadMatch
      }

      if (isMatch) {
        matches.push({
          rule_id: rule.rule_id,
          rule_name: rule.name,
          action: rule.action_template,
          confidence: this._calculateConfidence(rule, partA, partB)
        })
      }
    }

    return matches
  }

  _checkCondition(part, condition) {
    const field = condition.field
    const value = condition.value

    if (condition.contains) {
      const fieldValue = part.meta?.[field] || part[field] || ''
      return String(fieldValue).includes(value || condition.contains)
    }

    if (field && value) {
      const fieldValue = part.meta?.[field] || part[field]
      return fieldValue === value
    }

    return false
  }

  _calculateConfidence(rule, partA, partB) {
    let confidence = 0.7
    if (rule.priority >= 10) confidence += 0.2
    else if (rule.priority >= 9) confidence += 0.1
    if (partA.dn === partB.dn) confidence += 0.05
    if (partA.pn === partB.pn) confidence += 0.05
    return Math.min(confidence, 1.0)
  }

  async generateAssembly(options = {}) {
    const { partIds, assemblyName = 'Generated Assembly' } = options

    console.log(`\n[RuleBasedGen] ===== 开始生成装配体: ${assemblyName} =====`)

    await this.loadRules()
    await this.loadParts(partIds)

    if (this.parts.length < 2) {
      throw new Error('至少需要2个零件才能生成装配体')
    }

    console.log(`\n[RuleBasedGen] Step 1: 匹配零件对...`)
    const n = this.parts.length
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const partA = this.parts[i]
        const partB = this.parts[j]

        const matches = this.matchPartsWithRules(partA, partB)

        if (matches.length > 0) {
          const bestMatch = matches.reduce((a, b) =>
            a.confidence > b.confidence ? a : b
          )

          this.constraints.push({
            entity_a: partA.part_id,
            entity_b: partB.part_id,
            constraint_type: bestMatch.action.type,
            parameters: bestMatch.action.parameters,
            rule_id: bestMatch.rule_id,
            rule_name: bestMatch.rule_name,
            confidence: bestMatch.confidence
          })

          console.log(`  ✅ ${partA.part_id} <-> ${partB.part_id}: ${bestMatch.action.type} (${bestMatch.rule_name}, 置信度 ${bestMatch.confidence.toFixed(2)})`)
        }
      }
    }

    console.log(`\n  共生成 ${this.constraints.length} 个装配约束`)

    console.log(`\n[RuleBasedGen] Step 2: 计算零件位置...`)
    this.placements = this._calculatePlacements()

    const assembly = {
      name: assemblyName,
      parts: this.parts.map(p => ({
        part_id: p.part_id,
        family: p.family,
        dn: p.dn,
        pn: p.pn
      })),
      constraints: this.constraints,
      placements: this.placements,
      statistics: {
        total_parts: this.parts.length,
        total_constraints: this.constraints.length,
        rules_applied: [...new Set(this.constraints.map(c => c.rule_id))].length
      }
    }

    console.log(`\n[RuleBasedGen] ===== 装配生成完成 =====`)
    console.log(`  零件数: ${assembly.statistics.total_parts}`)
    console.log(`  约束数: ${assembly.statistics.total_constraints}`)
    console.log(`  应用规则: ${assembly.statistics.rules_applied}`)

    return assembly
  }

  _calculatePlacements() {
    const placements = []
    const placed = new Map()

    if (this.parts.length > 0) {
      const firstPart = this.parts[0]
      placements.push({
        part_id: firstPart.part_id,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 }
      })
      placed.set(firstPart.part_id, { x: 0, y: 0, z: 0 })
    }

    let iterations = 0
    const maxIterations = this.parts.length * 2

    while (placed.size < this.parts.length && iterations < maxIterations) {
      iterations++

      for (const constraint of this.constraints) {
        const hasA = placed.has(constraint.entity_a)
        const hasB = placed.has(constraint.entity_b)

        if (hasA && !hasB) {
          const posA = placed.get(constraint.entity_a)
          const posB = this._calculateRelativePosition(posA, constraint)

          placements.push({
            part_id: constraint.entity_b,
            position: posB,
            rotation: this._calculateRotation(constraint)
          })
          placed.set(constraint.entity_b, posB)
          console.log(`  ✅ 放置 ${constraint.entity_b} 于 (${posB.x}, ${posB.y}, ${posB.z})`)
        } else if (hasB && !hasA) {
          const posB = placed.get(constraint.entity_b)
          const posA = this._calculateRelativePosition(posB, constraint, true)

          placements.push({
            part_id: constraint.entity_a,
            position: posA,
            rotation: this._calculateRotation(constraint)
          })
          placed.set(constraint.entity_a, posA)
          console.log(`  ✅ 放置 ${constraint.entity_a} 于 (${posA.x}, ${posA.y}, ${posA.z})`)
        }
      }
    }

    let unplacedIndex = 0
    for (const part of this.parts) {
      if (!placed.has(part.part_id)) {
        const pos = {
          x: (unplacedIndex % 5) * 200,
          y: Math.floor(unplacedIndex / 5) * 200,
          z: 0
        }
        placements.push({
          part_id: part.part_id,
          position: pos,
          rotation: { x: 0, y: 0, z: 0 }
        })
        console.log(`  ⚠️  ${part.part_id} 未约束,放置于 (${pos.x}, ${pos.y}, ${pos.z})`)
        unplacedIndex++
      }
    }

    return placements
  }

  _calculateRelativePosition(basePos, constraint, reverse = false) {
    const type = constraint.constraint_type
    const params = constraint.parameters || {}

    let offset = { x: 0, y: 0, z: 0 }

    if (type === 'CONCENTRIC' || type === 'COINCIDENT') {
      offset.x = params.distance || 100
    } else if (type === 'SCREW') {
      offset.z = (params.revolutions || 5) * 2
      offset.x = 50
    }

    if (reverse) {
      return {
        x: basePos.x - offset.x,
        y: basePos.y - offset.y,
        z: basePos.z - offset.z
      }
    }

    return {
      x: basePos.x + offset.x,
      y: basePos.y + offset.y,
      z: basePos.z + offset.z
    }
  }

  _calculateRotation(constraint) {
    const params = constraint.parameters || {}
    return { x: 0, y: params.angle || 0, z: 0 }
  }

  exportToThreeJS() {
    const geometries = []
    const materials = []
    const objects = []

    const partsToExport = this.generatedAssembly ? this.generatedAssembly.parts : this.placements

    partsToExport.forEach((part, index) => {
      const partId = part.part_id || part.instance_id
      const position = part.position
      const rotation = part.rotation

      const geom = this._createThreeGeometryForPart(partId, index)
      geometries.push(geom)

      const mat = this._createThreeMaterialForPart(partId, index)
      materials.push(mat)

      const matrixArray = Array.isArray(position) ?
        this._createMatrixFromArray(position, rotation) :
        this._createMatrix(position, rotation)

      objects.push({
        uuid: `obj-${index}`,
        type: 'Mesh',
        name: partId,
        geometry: `geo-${index}`,
        material: `mat-${index}`,
        matrix: matrixArray
      })
    })

    return {
      metadata: { version: 4.5, type: 'Object', generator: 'RuleBasedAssemblyGenerator' },
      geometries,
      materials,
      object: { type: 'Scene', children: objects }
    }
  }

  _createThreeGeometryForPart(partId, index) {
    const uuid = `geo-${index}`
    if (partId.includes('VALVE')) {
      return { uuid, type: 'BoxGeometry', width: 150, height: 100, depth: 100 }
    } else if (partId.includes('FLANGE')) {
      return { uuid, type: 'CylinderGeometry', radiusTop: 50, radiusBottom: 50, height: 20, radialSegments: 32 }
    } else if (partId.includes('PIPE')) {
      return { uuid, type: 'CylinderGeometry', radiusTop: 25, radiusBottom: 25, height: 100, radialSegments: 32 }
    }
    return { uuid, type: 'BoxGeometry', width: 50, height: 50, depth: 50 }
  }

  _createThreeMaterialForPart(partId, index) {
    const hash = partId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const hue = (hash * 137.5) % 360
    const color = parseInt(`0x${this._hslToHex(hue, 70, 60)}`, 16)

    return {
      uuid: `mat-${index}`,
      type: 'MeshStandardMaterial',
      color: color,
      metalness: 0.5,
      roughness: 0.5
    }
  }

  _createMatrixFromArray(position, rotation) {
    const pos = position || [0, 0, 0]
    const rot = rotation || [0, 0, 0]
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, pos[0], pos[1], pos[2], 1]
  }

  _hslToHex(h, s, l) {
    s /= 100
    l /= 100
    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs((h / 60) % 2 - 1))
    const m = l - c / 2
    let r = 0, g = 0, b = 0
    if (h < 60) { r = c; g = x }
    else if (h < 120) { r = x; g = c }
    else if (h < 180) { g = c; b = x }
    else if (h < 240) { g = x; b = c }
    else if (h < 300) { r = x; b = c }
    else { r = c; b = x }
    const toHex = (n) => {
      const hex = Math.round((n + m) * 255).toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }
    return toHex(r) + toHex(g) + toHex(b)
  }

  _createThreeGeometry(part, index) {
    const uuid = `geo-${index}`
    switch (part.family) {
      case 'valve':
        return { uuid, type: 'BoxGeometry', width: 150, height: 100, depth: 100 }
      case 'flange':
        return { uuid, type: 'CylinderGeometry', radiusTop: part.dn || 50, radiusBottom: part.dn || 50, height: 20, radialSegments: 32 }
      default:
        return { uuid, type: 'BoxGeometry', width: 50, height: 50, depth: 50 }
    }
  }

  _createThreeMaterial(part, index) {
    const colors = { valve: 0x4a7c9e, flange: 0xf5a623, default: 0x999999 }
    return {
      uuid: `mat-${index}`,
      type: 'MeshStandardMaterial',
      color: colors[part.family] || colors.default,
      metalness: 0.5,
      roughness: 0.5
    }
  }

  _createMatrix(position, rotation) {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, position.x, position.y, position.z, 1]
  }
}

module.exports = new RuleBasedAssemblyGenerator()
