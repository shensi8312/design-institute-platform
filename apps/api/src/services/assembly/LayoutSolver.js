/**
 * 装配布局求解器 - 处理位姿计算、elevation生成、碰撞校验
 */
class LayoutSolver {
  constructor() {
    this.ELEVATION_STEP = 250  // mm
    this.MIN_CLEARANCE = 50    // mm
    this.AUTO_FIX_ANGLES = true  // 自动修复非标准角度
  }

  /**
   * 从PID拓扑生成3D位姿
   * @param {Object} pidTopology - {nodes: [], edges: []}
   * @param {Object[]} components - 已选零件列表
   * @param {Object[]} templates - 连接模板列表
   */
  async solve(pidTopology, components, templates) {
    const placements = []
    const conflicts = []

    // 0. 建立node_id -> node 映射
    const nodeMap = new Map(pidTopology.nodes.map(n => [n.id, n]))

    // 1. 建立管段-零件映射
    const segmentMap = this._buildSegmentMap(pidTopology, components)

    // 2. 逐段放置（从起点开始）
    const visited = new Set()
    const queue = [pidTopology.nodes.find(n => n.type === 'start')]

    let currentZ = 0
    const zLayers = new Map()  // node_id -> z_level

    while (queue.length > 0) {
      const node = queue.shift()
      if (visited.has(node.id)) continue
      visited.add(node.id)

      // 获取进入该节点的边
      const inEdges = pidTopology.edges.filter(e => e.to === node.id)
      const outEdges = pidTopology.edges.filter(e => e.from === node.id)

      // 计算节点位置
      const position = this._calculateNodePosition(node, inEdges, nodeMap, zLayers)

      // 检查碰撞
      const collision = this._checkCollision(position, placements)
      if (collision) {
        // 抬升策略
        currentZ += this.ELEVATION_STEP
        position.z = currentZ
        zLayers.set(node.id, currentZ)
        console.log(`[LayoutSolver] 检测到碰撞，节点${node.id}抬升至Z=${currentZ}`)
      }

      // 放置内联元件（阀门、法兰等）
      const nodeComponents = components.filter(c => c.node_id === node.id)
      for (const comp of nodeComponents) {
        const template = templates.find(t =>
          t.family_a === comp.family || t.family_b === comp.family
        )

        const placement = this._placeComponent(comp, position, template)

        // 维修空间检查
        if (comp.family === 'valve') {
          const accessCheck = this._checkAccessEnvelope(placement, placements)
          if (!accessCheck.ok) {
            // 旋转手柄方向
            const clearRotation = this._findClearRotation(placement, placements)
            if (clearRotation !== null) {
              placement.rotation = clearRotation
              console.log(`[LayoutSolver] ✅ 阀门${comp.tag}旋转至${clearRotation}°以避开干涉`)
            } else {
              // 无法找到清晰旋转,尝试Y轴偏移
              placement.position.y += 200
              console.log(`[LayoutSolver] ⚠️ 阀门${comp.tag}无法通过旋转避开干涉,已Y轴偏移200mm`)
              conflicts.push({
                type: 'access_space',
                component: comp.part_number,
                resolution: `Y轴偏移200mm(无清晰旋转角度)`,
                status: 'resolved'
              })
            }
          }
        }

        placements.push(placement)
      }

      // 处理弯头/三通
      for (const edge of outEdges) {
        const angle = this._calculateBendAngle(node, edge, inEdges)

        // 跳过直线连接(0°±5°或180°±5°)
        if (Math.abs(angle) < 5 || Math.abs(angle - 180) < 5) {
          console.log(`[LayoutSolver] ⏭️ 跳过直线连接(${angle.toFixed(1)}°)于节点${node.id}`)
          // 直线连接,不需要弯头
          const nextNode = nodeMap.get(edge.to)
          if (nextNode && !visited.has(nextNode.id)) {
            queue.push(nextNode)
          }
          continue
        }

        if (Math.abs(angle - 90) < 5) {
          // 90°弯头
          const elbowPlacement = this._placeElbow(node, edge, position, 90, components)
          placements.push(elbowPlacement)
          console.log(`[LayoutSolver] ✅ 插入90°弯头于节点${node.id}`)
        } else if (Math.abs(angle - 45) < 5) {
          // 45°弯头
          const elbowPlacement = this._placeElbow(node, edge, position, 45, components)
          placements.push(elbowPlacement)
          console.log(`[LayoutSolver] ✅ 插入45°弯头于节点${node.id}`)
        } else {
          // 非标角度,尝试自动修复
          if (this.AUTO_FIX_ANGLES) {
            const fixed = this._autoFixNonStandardAngle(angle, node, edge, position, components, placements)
            if (fixed.success) {
              placements.push(...fixed.elbows)
              console.log(`[LayoutSolver] ✅ 自动修复${angle.toFixed(1)}°角度: ${fixed.solution}`)
              conflicts.push({
                type: 'non_standard_angle',
                angle,
                node_id: node.id,
                edge_id: edge.id,
                solution: fixed.solution,
                status: 'resolved'
              })
            } else {
              // 无法自动修复,标记待确认
              conflicts.push({
                type: 'non_standard_angle',
                angle,
                node_id: node.id,
                edge_id: edge.id,
                suggestion: '使用45°+45°组合或柔性软管',
                status: 'unresolved'
              })
              console.warn(`[LayoutSolver] ⚠️ 无法自动修复${angle.toFixed(1)}°角度于节点${node.id}`)
            }
          } else {
            // 非标角度,标记待确认
            conflicts.push({
              type: 'non_standard_angle',
              angle,
              node_id: node.id,
              edge_id: edge.id,
              suggestion: '使用45°+45°组合或柔性软管',
              status: 'unresolved'
            })
          }
        }

        const nextNode = nodeMap.get(edge.to)
        if (nextNode && !visited.has(nextNode.id)) {
          queue.push(nextNode)
        }
      }
    }

    return {
      placements,
      conflicts,
      elevation_layers: Array.from(zLayers.entries())
    }
  }

  /**
   * 自动修复非标准角度
   * 策略:
   * - 30°-60°: 使用45°弯头
   * - 60°-120°: 使用两个45°弯头组合
   * - 其他: 使用柔性软管
   */
  _autoFixNonStandardAngle(angle, node, edge, position, components, placements) {
    const dn = components[0]?.dn || 50
    const pn = components[0]?.pn || 16

    // 策略1: 单个45°弯头(适合30-60°)
    if (angle >= 30 && angle <= 60) {
      const elbowPlacement = this._placeElbow(node, edge, position, 45, components)
      return {
        success: true,
        solution: '使用单个45°弯头',
        elbows: [elbowPlacement]
      }
    }

    // 策略2: 两个45°弯头组合(适合60-120°)
    if (angle >= 60 && angle <= 120) {
      const elbow1 = this._placeElbow(node, edge, position, 45, components)
      const midPosition = {
        x: position.x + 100 * Math.cos(45 * Math.PI / 180),
        y: position.y + 100 * Math.sin(45 * Math.PI / 180),
        z: position.z
      }
      const elbow2 = this._placeElbow(node, edge, midPosition, 45, components)

      return {
        success: true,
        solution: '使用两个45°弯头组合(90°总转角)',
        elbows: [elbow1, elbow2]
      }
    }

    // 策略3: 柔性软管(其他角度)
    if (angle > 0 && angle < 180) {
      const flexHose = {
        type: 'flexible_hose',
        part_number: `FLEX_HOSE_DN${dn}_PN${pn}`,
        family: 'flexible_hose',
        position: { ...position },
        rotation: this._calculateRotation(edge),
        length: 500,  // 默认500mm
        bend_angle: angle,
        tag: `FLEX-${node.id}`,
        dn,
        pn
      }

      return {
        success: true,
        solution: `使用柔性软管(${angle.toFixed(1)}°弯曲)`,
        elbows: [flexHose]
      }
    }

    return {
      success: false,
      solution: null,
      elbows: []
    }
  }

  /**
   * 计算节点位置（考虑上游累积）
   */
  _calculateNodePosition(node, inEdges, nodeMap, zLayers) {
    if (node.type === 'start') {
      return { x: node.x || 0, y: node.y || 0, z: 0 }
    }

    // 从上游边推算
    if (inEdges.length > 0) {
      const inEdge = inEdges[0]
      const upstreamNode = nodeMap.get(inEdge.from)
      if (!upstreamNode) {
        console.warn(`[LayoutSolver] 找不到上游节点: ${inEdge.from}`)
        return { x: node.x || 0, y: node.y || 0, z: 0 }
      }
      const upstreamZ = zLayers.get(upstreamNode.id) || 0

      return {
        x: node.x || upstreamNode.x + 500,
        y: node.y || upstreamNode.y,
        z: upstreamZ
      }
    }

    return { x: node.x || 0, y: node.y || 0, z: 0 }
  }

  /**
   * 碰撞检测（AABB简化）
   */
  _checkCollision(position, existingPlacements) {
    for (const existing of existingPlacements) {
      const dx = Math.abs(position.x - existing.position.x)
      const dy = Math.abs(position.y - existing.position.y)
      const dz = Math.abs(position.z - existing.position.z)

      if (dx < this.MIN_CLEARANCE && dy < this.MIN_CLEARANCE && dz < this.MIN_CLEARANCE) {
        return existing
      }
    }
    return null
  }

  /**
   * 维修空间检查
   */
  _checkAccessEnvelope(placement, existingPlacements) {
    const envelope = {
      x: [placement.position.x - 300, placement.position.x + 300],
      y: [placement.position.y - 300, placement.position.y + 300],
      z: [placement.position.z - 200, placement.position.z + 200]
    }

    for (const existing of existingPlacements) {
      if (this._aabbOverlap(envelope, existing.envelope)) {
        return { ok: false, conflict: existing }
      }
    }

    return { ok: true }
  }

  /**
   * AABB重叠检测
   */
  _aabbOverlap(boxA, boxB) {
    if (!boxB) return false
    return (
      boxA.x[0] <= boxB.x[1] && boxA.x[1] >= boxB.x[0] &&
      boxA.y[0] <= boxB.y[1] && boxA.y[1] >= boxB.y[0] &&
      boxA.z[0] <= boxB.z[1] && boxA.z[1] >= boxB.z[0]
    )
  }

  /**
   * 计算弯头角度
   */
  _calculateBendAngle(node, outEdge, inEdges) {
    const inEdge = inEdges && inEdges[0]
    if (!inEdge) return 0

    const v1 = { x: inEdge.dx || 1, y: inEdge.dy || 0 }
    const v2 = { x: outEdge.dx || 1, y: outEdge.dy || 0 }

    const dot = v1.x * v2.x + v1.y * v2.y
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y)
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y)

    if (mag1 === 0 || mag2 === 0) return 0

    const cosAngle = dot / (mag1 * mag2)
    return Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180 / Math.PI
  }

  /**
   * 放置弯头
   */
  _placeElbow(node, edge, position, angle, components) {
    const dn = components[0]?.dn || 50
    const pn = components[0]?.pn || 16

    return {
      type: 'elbow',
      family: 'elbow',
      angle,
      position: { ...position },
      rotation: this._calculateRotation(edge),
      part_number: `ELBOW_${angle}DEG_DN${dn}_PN${pn}`,
      tag: `EL-${angle}-${node.id}`,
      dn,
      pn
    }
  }

  /**
   * 放置元件
   */
  _placeComponent(component, basePosition, template) {
    const offset = template?.face_offset_mm || 0

    return {
      type: component.family,
      part_number: component.part_number,
      position: {
        x: basePosition.x,
        y: basePosition.y,
        z: basePosition.z
      },
      rotation: 0,
      envelope: this._calculateEnvelope(component, basePosition),
      mate_constraints: template?.mate_schema || {},
      tag: component.tag,
      dn: component.dn,
      pn: component.pn
    }
  }

  /**
   * 计算包络盒
   */
  _calculateEnvelope(component, position) {
    const size = component.size || { w: 100, h: 100, d: 100 }
    return {
      x: [position.x - size.w / 2, position.x + size.w / 2],
      y: [position.y - size.h / 2, position.y + size.h / 2],
      z: [position.z - size.d / 2, position.z + size.d / 2]
    }
  }

  /**
   * 查找无碰撞旋转角度
   * 返回null表示找不到
   */
  _findClearRotation(placement, existingPlacements) {
    const testAngles = [0, 90, 180, 270, 45, 135, 225, 315]

    for (const angle of testAngles) {
      const testPlacement = { ...placement, rotation: angle }
      const collision = this._checkAccessEnvelope(testPlacement, existingPlacements)
      if (collision.ok) return angle
    }

    return null  // 找不到清晰角度
  }

  /**
   * 计算旋转角度
   */
  _calculateRotation(edge) {
    if (!edge.dx && !edge.dy) return 0
    return Math.atan2(edge.dy || 0, edge.dx || 1) * 180 / Math.PI
  }

  /**
   * 构建管段-零件映射
   */
  _buildSegmentMap(pidTopology, components) {
    const map = new Map()

    for (const comp of components) {
      const nodeId = comp.node_id
      if (!map.has(nodeId)) map.set(nodeId, [])
      map.get(nodeId).push(comp)
    }

    return map
  }
}

module.exports = new LayoutSolver()
