/**
 * 装配验证服务 - 五类校验报告
 */
class ValidationService {
  /**
   * 综合验证
   * @param {Object[]} placements - 位姿列表
   * @param {Object[]} constraints - 约束列表
   * @param {Object[]} components - 零件列表
   * @param {Object} pidContext - PID上下文
   */
  async validate(placements, constraints, components, pidContext) {
    const report = {
      timestamp: new Date().toISOString(),
      overall_status: 'pass',
      checks: []
    }

    // 1. 规则满足度检查
    const ruleCheck = this._checkRuleSatisfaction(placements, constraints)
    report.checks.push(ruleCheck)

    // 2. 一致性检查
    const consistencyCheck = this._checkConsistency(components, pidContext)
    report.checks.push(consistencyCheck)

    // 3. 可达性检查
    const accessCheck = this._checkAccessibility(placements)
    report.checks.push(accessCheck)

    // 4. BOM对账检查
    const bomCheck = this._checkBOMAlignment(components, constraints)
    report.checks.push(bomCheck)

    // 5. 不确定性检查
    const uncertaintyCheck = this._checkUncertainty(components)
    report.checks.push(uncertaintyCheck)

    // 汇总状态
    const failures = report.checks.filter(c => c.status === 'fail')
    const warnings = report.checks.filter(c => c.status === 'warning')

    if (failures.length > 0) {
      report.overall_status = 'fail'
    } else if (warnings.length > 0) {
      report.overall_status = 'warning'
    }

    report.summary = {
      total_checks: report.checks.length,
      passed: report.checks.filter(c => c.status === 'pass').length,
      warnings: warnings.length,
      failures: failures.length
    }

    return report
  }

  /**
   * 1. 规则满足度检查
   */
  _checkRuleSatisfaction(placements, constraints) {
    const violations = []

    for (const constraint of constraints) {
      const placementA = placements.find(p => p.part_number === constraint.entity_a)
      const placementB = placements.find(p => p.part_number === constraint.entity_b)

      if (!placementA || !placementB) continue

      const schema = constraint.mate_constraints || {}

      // 同轴检查
      if (schema.axis_align) {
        const aligned = this._checkAxisAlignment(placementA, placementB, schema.angle_tol_deg || 2)
        if (!aligned) {
          violations.push({
            constraint_id: constraint.id,
            type: 'axis_misalignment',
            parts: [placementA.part_number, placementB.part_number],
            tolerance: schema.angle_tol_deg
          })
        }
      }

      // 面间隙检查
      if (schema.gap_tol_mm !== undefined) {
        const gap = this._calculateGap(placementA, placementB)
        const maxGap = schema.gap_tol_mm
        if (gap > maxGap) {
          violations.push({
            constraint_id: constraint.id,
            type: 'gap_exceeded',
            parts: [placementA.part_number, placementB.part_number],
            actual: gap,
            tolerance: maxGap
          })
        }
      }
    }

    return {
      name: '规则满足度',
      status: violations.length === 0 ? 'pass' : 'fail',
      violations,
      passed: constraints.length - violations.length,
      total: constraints.length
    }
  }

  /**
   * 2. 一致性检查（DN/PN/face_type）
   */
  _checkConsistency(components, pidContext) {
    const inconsistencies = []

    for (const comp of components) {
      // 检查上下游DN一致性
      const upstream = components.find(c => c.connects_to === comp.id)
      if (upstream && upstream.dn !== comp.dn) {
        inconsistencies.push({
          type: 'dn_mismatch',
          part_a: upstream.part_number,
          part_b: comp.part_number,
          value_a: upstream.dn,
          value_b: comp.dn
        })
      }

      // 检查PN等级
      if (upstream && upstream.pn > comp.pn) {
        inconsistencies.push({
          type: 'pn_downgrade',
          part_a: upstream.part_number,
          part_b: comp.part_number,
          value_a: upstream.pn,
          value_b: comp.pn,
          severity: 'warning'
        })
      }

      // 检查法兰面型
      if (comp.family === 'flange' && upstream?.family === 'flange') {
        if (comp.face_type !== upstream.face_type) {
          inconsistencies.push({
            type: 'face_type_mismatch',
            part_a: upstream.part_number,
            part_b: comp.part_number,
            value_a: upstream.face_type,
            value_b: comp.face_type
          })
        }
      }
    }

    return {
      name: '一致性',
      status: inconsistencies.length === 0 ? 'pass' : 'fail',
      inconsistencies,
      passed: components.length - inconsistencies.length,
      total: components.length
    }
  }

  /**
   * 3. 可达性检查
   */
  _checkAccessibility(placements) {
    const accessIssues = []

    const valves = placements.filter(p => p.type === 'valve')

    for (const valve of valves) {
      if (!valve.envelope) continue

      const conflicts = placements.filter(p =>
        p.part_number !== valve.part_number &&
        this._envelopeOverlap(valve.envelope, p.envelope)
      )

      if (conflicts.length > 0) {
        accessIssues.push({
          valve: valve.part_number,
          blocked_by: conflicts.map(c => c.part_number),
          suggested_rotation: valve.rotation
        })
      }
    }

    return {
      name: '维修可达性',
      status: accessIssues.length === 0 ? 'pass' : 'warning',
      access_issues: accessIssues,
      valves_checked: valves.length
    }
  }

  /**
   * 4. BOM对账检查
   */
  _checkBOMAlignment(components, constraints) {
    const discrepancies = []

    // 检查法兰-螺栓配对
    const flanges = components.filter(c => c.family === 'flange')

    console.log('[BOM检查] 所有零件:', JSON.stringify(components.map(c => ({
      family: c.family,
      id: c.id,
      tag: c.tag,
      part_number: c.part_number,
      connection_id: c.connection_id
    })), null, 2))

    for (const flange of flanges) {
      // 优先使用tag作为唯一标识符（id可能重复）
      const flangeId = flange.tag || flange.id || flange.part_number
      console.log(`[BOM检查] 检查法兰: tag=${flange.tag}, id=${flange.id}, part_number=${flange.part_number}, flangeId=${flangeId}`)

      const requiredBolts = flange.bolt_count || 4

      // 修改：通过 connection_id 或 flange_id 查找螺栓，使用更精确的匹配
      const actualBolts = components.filter(c => {
        if (c.family !== 'bolt') return false

        console.log(`[BOM检查] 检查螺栓 connection_id=${c.connection_id}, flange_id=${c.flange_id}`)

        // 支持新的connection_id格式 - 直接字符串匹配
        if (c.connection_id && c.connection_id.includes(flangeId)) {
          console.log(`[BOM检查] connection_id=${c.connection_id} 包含 flangeId=${flangeId}, matched=true`)
          return true
        }
        // 兼容旧的flange_id格式
        if (c.flange_id === flange.id) return true
        return false
      }).reduce((sum, bolt) => sum + (bolt.quantity || 1), 0)

      console.log(`[BOM检查] 法兰${flangeId}螺栓数: actual=${actualBolts}, required=${requiredBolts}`)

      if (actualBolts !== requiredBolts) {
        discrepancies.push({
          type: 'bolt_count_mismatch',
          flange: flange.part_number,
          required: requiredBolts,
          actual: actualBolts
        })
      }

      // 检查垫片：通过 connection_id 或 flange_id
      const gasket = components.find(c => {
        if (c.family !== 'gasket') return false
        // 直接字符串匹配
        if (c.connection_id && c.connection_id.includes(flangeId)) {
          return true
        }
        if (c.flange_id === flange.id) return true
        return false
      })

      if (!gasket) {
        discrepancies.push({
          type: 'missing_gasket',
          flange: flange.part_number
        })
      }
    }

    return {
      name: 'BOM对账',
      status: discrepancies.length === 0 ? 'pass' : 'fail',
      discrepancies,
      flanges_checked: flanges.length
    }
  }

  /**
   * 5. 不确定性检查
   */
  _checkUncertainty(components) {
    const uncertainItems = components.filter(c => c.selection_uncertain)

    const suggestions = uncertainItems.map(item => ({
      part_number: item.part_number,
      selected_score: item.selection_score,
      alternatives: item.alternatives || [],
      reason: '多个候选零件得分接近，建议人工确认'
    }))

    return {
      name: '不确定性',
      status: uncertainItems.length === 0 ? 'pass' : 'warning',
      uncertain_items: uncertainItems.length,
      suggestions
    }
  }

  /**
   * 辅助函数：轴对齐检查
   */
  _checkAxisAlignment(placementA, placementB, toleranceDeg) {
    // 简化实现：假设轴向为z轴
    const axisA = placementA.axis || { x: 0, y: 0, z: 1 }
    const axisB = placementB.axis || { x: 0, y: 0, z: 1 }

    const dot = axisA.x * axisB.x + axisA.y * axisB.y + axisA.z * axisB.z
    const angle = Math.acos(Math.abs(dot)) * 180 / Math.PI

    return angle <= toleranceDeg
  }

  /**
   * 辅助函数：计算间隙
   */
  _calculateGap(placementA, placementB) {
    const dx = placementB.position.x - placementA.position.x
    const dy = placementB.position.y - placementA.position.y
    const dz = placementB.position.z - placementA.position.z

    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  /**
   * 辅助函数：包络重叠检查
   */
  _envelopeOverlap(envA, envB) {
    if (!envA || !envB) return false

    return (
      envA.x[0] <= envB.x[1] && envA.x[1] >= envB.x[0] &&
      envA.y[0] <= envB.y[1] && envA.y[1] >= envB.y[0] &&
      envA.z[0] <= envB.z[1] && envA.z[1] >= envB.z[0]
    )
  }
}

module.exports = new ValidationService()
