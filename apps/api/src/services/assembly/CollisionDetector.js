/**
 * 碰撞检测与防干涉服务
 * 支持AABB、OBB、精确几何检测
 */
class CollisionDetector {
  constructor() {
    this.MIN_CLEARANCE = 50 // mm - 最小间隙
    this.MAINTENANCE_CLEARANCE = 300 // mm - 维修空间
  }

  /**
   * AABB碰撞检测（Axis-Aligned Bounding Box）
   * 最快速，适合初筛
   */
  checkAABBCollision(box1, box2, clearance = this.MIN_CLEARANCE) {
    if (!box1 || !box2) return false

    return (
      Math.abs(box1.center.x - box2.center.x) < (box1.halfSize.x + box2.halfSize.x + clearance) &&
      Math.abs(box1.center.y - box2.center.y) < (box1.halfSize.y + box2.halfSize.y + clearance) &&
      Math.abs(box1.center.z - box2.center.z) < (box1.halfSize.z + box2.halfSize.z + clearance)
    )
  }

  /**
   * OBB碰撞检测（Oriented Bounding Box）
   * 考虑旋转，更精确
   */
  checkOBBCollision(obb1, obb2) {
    // SAT (Separating Axis Theorem)
    // TODO: 实现完整OBB检测
    return this.checkAABBCollision(
      this._obbToAABB(obb1),
      this._obbToAABB(obb2)
    )
  }

  /**
   * 批量碰撞检测
   * 检测所有零件对之间的碰撞
   */
  detectAllCollisions(placements) {
    const collisions = []

    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++) {
        const p1 = placements[i]
        const p2 = placements[j]

        // 转换为AABB
        const box1 = this._placementToAABB(p1)
        const box2 = this._placementToAABB(p2)

        if (this.checkAABBCollision(box1, box2)) {
          const distance = this._calculateDistance(p1.position, p2.position)

          collisions.push({
            part1: p1.part_number || p1.tag,
            part2: p2.part_number || p2.tag,
            type: 'collision',
            distance,
            severity: distance < 10 ? 'critical' : 'high',
            position: {
              x: (p1.position.x + p2.position.x) / 2,
              y: (p1.position.y + p2.position.y) / 2,
              z: (p1.position.z + p2.position.z) / 2
            }
          })
        }
      }
    }

    return collisions
  }

  /**
   * 维修空间检查
   * 确保关键零件周围有足够空间
   */
  checkMaintenanceAccess(placement, allPlacements) {
    const issues = []

    // 关键零件需要维修空间
    const needsAccess = ['valve', 'sensor', 'filter', 'mfc']
    if (!needsAccess.includes(placement.type) &&
        !needsAccess.some(type => placement.part_number?.toLowerCase().includes(type))) {
      return [] // 不需要检查
    }

    // 计算维修包络
    const envelope = this._calculateMaintenanceEnvelope(placement)

    // 检查是否被其他零件阻挡
    for (const other of allPlacements) {
      if (other === placement) continue

      const otherBox = this._placementToAABB(other)
      if (this._envelopeOverlap(envelope, otherBox)) {
        issues.push({
          part: placement.part_number || placement.tag,
          blockedBy: other.part_number || other.tag,
          type: 'maintenance_access',
          severity: 'medium',
          reason: `维修空间被${other.part_number}阻挡`
        })
      }
    }

    return issues
  }

  /**
   * 管路干涉检查
   * 检查管路是否与零件碰撞
   */
  checkPipeInterference(pipe, placements) {
    const conflicts = []

    // 将管路离散化为线段
    const segments = this._discretizePipe(pipe)

    for (const placement of placements) {
      const box = this._placementToAABB(placement)

      for (const segment of segments) {
        if (this._lineBoxIntersection(segment.start, segment.end, box)) {
          conflicts.push({
            pipe: pipe.id,
            obstaclePart: placement.part_number,
            type: 'pipe_interference',
            severity: 'high',
            position: segment.start
          })
          break
        }
      }
    }

    return conflicts
  }

  /**
   * 自动避障优化
   * 尝试移动零件以消除碰撞
   */
  resolveCollisions(placements, maxIterations = 100) {
    let iterations = 0
    let resolved = []

    while (iterations < maxIterations) {
      const collisions = this.detectAllCollisions(placements)

      if (collisions.length === 0) {
        console.log(`✅ [CollisionDetector] 所有碰撞已解决（${iterations}次迭代）`)
        break
      }

      // 选择最严重的碰撞
      const worstCollision = collisions.sort((a, b) => a.distance - b.distance)[0]

      // 尝试移动策略
      const strategy = this._selectResolutionStrategy(worstCollision, placements)

      if (strategy.success) {
        resolved.push({
          iteration: iterations,
          collision: worstCollision,
          strategy: strategy.method,
          moved: strategy.movedParts
        })
      } else {
        console.warn(`⚠️  无法自动解决碰撞: ${worstCollision.part1} ↔ ${worstCollision.part2}`)
        break
      }

      iterations++
    }

    return {
      success: this.detectAllCollisions(placements).length === 0,
      iterations,
      resolved,
      remaining: this.detectAllCollisions(placements)
    }
  }

  /**
   * 选择碰撞解决策略
   */
  _selectResolutionStrategy(collision, placements) {
    const part1 = placements.find(p => (p.part_number || p.tag) === collision.part1)
    const part2 = placements.find(p => (p.part_number || p.tag) === collision.part2)

    // 策略1: 垂直抬升（最简单）
    if (this._canMoveVertically(part1)) {
      part1.position.z += 250
      return { success: true, method: 'vertical_lift', movedParts: [collision.part1] }
    }

    // 策略2: 水平偏移
    if (this._canMoveHorizontally(part1)) {
      part1.position.y += 200
      return { success: true, method: 'horizontal_shift', movedParts: [collision.part1] }
    }

    // 策略3: 旋转
    if (part1.rotation !== undefined) {
      part1.rotation += 90
      return { success: true, method: 'rotation', movedParts: [collision.part1] }
    }

    return { success: false, method: 'none', movedParts: [] }
  }

  _canMoveVertically(placement) {
    // 固定零件（如法兰、接口）不能移动
    const fixed = ['flange', 'interface', 'port']
    return !fixed.some(type => placement.type?.includes(type))
  }

  _canMoveHorizontally(placement) {
    return this._canMoveVertically(placement)
  }

  _placementToAABB(placement) {
    const size = placement.size || placement.envelope || { x: 100, y: 100, z: 100 }

    return {
      center: placement.position,
      halfSize: {
        x: (size.width || size.x || 100) / 2,
        y: (size.height || size.y || 100) / 2,
        z: (size.depth || size.z || 100) / 2
      }
    }
  }

  _calculateMaintenanceEnvelope(placement) {
    const base = this._placementToAABB(placement)
    const clearance = this.MAINTENANCE_CLEARANCE

    return {
      center: base.center,
      halfSize: {
        x: base.halfSize.x + clearance,
        y: base.halfSize.y + clearance,
        z: base.halfSize.z + clearance
      }
    }
  }

  _envelopeOverlap(envelope, box) {
    return this.checkAABBCollision(envelope, box, 0)
  }

  _calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x
    const dy = pos1.y - pos2.y
    const dz = pos1.z - pos2.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  _discretizePipe(pipe) {
    // 将管路分解为多个线段
    const segments = []
    if (!pipe.path || pipe.path.length < 2) return segments

    for (let i = 0; i < pipe.path.length - 1; i++) {
      segments.push({
        start: pipe.path[i],
        end: pipe.path[i + 1]
      })
    }

    return segments
  }

  _lineBoxIntersection(lineStart, lineEnd, box) {
    // 简化：检查线段是否穿过AABB
    // TODO: 实现精确的线-盒相交算法
    const midPoint = {
      x: (lineStart.x + lineEnd.x) / 2,
      y: (lineStart.y + lineEnd.y) / 2,
      z: (lineStart.z + lineEnd.z) / 2
    }

    return (
      Math.abs(midPoint.x - box.center.x) < box.halfSize.x &&
      Math.abs(midPoint.y - box.center.y) < box.halfSize.y &&
      Math.abs(midPoint.z - box.center.z) < box.halfSize.z
    )
  }

  _obbToAABB(obb) {
    // 将OBB转换为保守的AABB
    // TODO: 实现精确转换
    return obb
  }
}

module.exports = CollisionDetector
