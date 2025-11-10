/**
 * 装配位置计算器
 * 根据连接约束和零件几何关系计算真实3D装配位置
 */
class AssemblyPositionCalculator {
  constructor() {
    // 零件标准长度(mm)
    this.partDimensions = {
      'valve': { length: 150, diameter: 50 },
      'flange': { length: 20, diameter: 150 },
      'pipe': { length: 200, diameter: 50 },
      'bolt': { length: 60, diameter: 16 },
      'gasket': { length: 3, diameter: 100 }
    }
  }

  /**
   * 计算整个装配体的位置
   * @param {Array} components - 零件列表
   * @param {Array} connections - 连接约束
   * @returns {Array} 带位置信息的零件
   */
  calculateAssemblyPositions(components, connections) {
    const positioned = []
    const partMap = new Map()

    // 找到主零件(优先无上游连接的零件)
    const basePart = this._findBasePart(components, connections)
    if (!basePart) return []

    positioned.push({
      ...basePart,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 }
    })
    partMap.set(basePart.tag || basePart.id, positioned[0])

    console.log(`[AssemblyCalc] 基准零件: ${basePart.family} (${basePart.tag})`)

    // 处理每个连接
    connections.forEach((conn, idx) => {
      const fromTag = conn.from_tag || conn.from
      const toTag = conn.to_tag || conn.to

      const partA = partMap.get(fromTag)
      if (!partA) {
        console.warn(`[AssemblyCalc] 未找到源零件: ${fromTag}`)
        return
      }

      const partB = components.find(c => (c.tag || c.id) === toTag)
      if (!partB) {
        console.warn(`[AssemblyCalc] 未找到目标零件: ${toTag}`)
        return
      }

      // 计算装配位置
      const assemblyData = this._calculateConnectionPosition(partA, partB, conn)

      const positionedPartB = {
        ...partB,
        position: assemblyData.position,
        rotation: assemblyData.rotation,
        connection_id: conn.id || `${fromTag}-${toTag}`
      }

      positioned.push(positionedPartB)
      partMap.set(toTag, positionedPartB)

      console.log(`[AssemblyCalc] 连接 #${idx + 1}: ${partA.family} → ${partB.family}`)
      console.log(`  位置: x=${assemblyData.position.x}, y=${assemblyData.position.y}, z=${assemblyData.position.z}`)

      // 添加紧固件
      if (conn.fasteners || (partA.family === 'flange' && partB.family === 'flange')) {
        const fasteners = this._addFasteners(partA, positionedPartB, conn, assemblyData)
        positioned.push(...fasteners)
        console.log(`  + ${fasteners.length} 个紧固件`)
      }
    })

    console.log(`[AssemblyCalc] 装配完成: ${positioned.length} 个零件`)
    return positioned
  }

  /**
   * 查找没有上游连接的基准零件
   */
  _findBasePart(components, connections) {
    if (!components?.length) return null

    const targetSet = new Set()
    connections?.forEach(conn => {
      if (conn.to_tag) targetSet.add(conn.to_tag)
      else if (conn.to) targetSet.add(conn.to)
    })

    const candidate = components.find(component => {
      const tag = component.tag || component.id
      return tag && !targetSet.has(tag)
    })

    return candidate || components[0]
  }

  /**
   * 计算两个零件的连接位置
   */
  _calculateConnectionPosition(partA, partB, connection) {
    const familyA = partA.family
    const familyB = partB.family

    // 获取零件A的端面位置
    const dimA = this.partDimensions[familyA] || { length: 100, diameter: 50 }
    const endPosA = {
      x: partA.position.x + dimA.length,
      y: partA.position.y,
      z: partA.position.z
    }

    // 根据零件类型计算装配位置
    if (familyA === 'valve' && familyB === 'flange') {
      // 法兰连接到阀门出口
      return {
        position: endPosA,
        rotation: { x: 0, y: 0, z: 0 }
      }
    } else if (familyA === 'flange' && familyB === 'pipe') {
      // 管道连接到法兰
      const dimFlange = this.partDimensions['flange']
      return {
        position: {
          x: partA.position.x + dimFlange.length,
          y: partA.position.y,
          z: partA.position.z
        },
        rotation: { x: 0, y: 0, z: 0 }
      }
    } else if (familyA === 'pipe' && familyB === 'flange') {
      // 法兰连接到管道端
      const dimPipe = this.partDimensions['pipe']
      return {
        position: {
          x: partA.position.x + dimPipe.length,
          y: partA.position.y,
          z: partA.position.z
        },
        rotation: { x: 0, y: 0, z: 0 }
      }
    } else if (familyB === 'flange') {
      // 默认法兰连接
      return {
        position: endPosA,
        rotation: { x: 0, y: 0, z: 0 }
      }
    }

    // 默认:轴向连接
    return {
      position: endPosA,
      rotation: partA.rotation
    }
  }

  /**
   * 添加紧固件(螺栓和垫片)
   */
  _addFasteners(partA, partB, connection, assemblyData) {
    const fasteners = []
    const fastenerSpec = connection.fasteners || {}

    // 确定法兰位置(用于螺栓环形分布)
    const flangePos = assemblyData.position
    const dn = partA.dn || partB.dn || 50
    const boltCircleDia = dn * 1.8 // 螺栓圆直径 = DN * 1.8

    // 添加螺栓
    const boltCount = fastenerSpec.bolt_count || 4
    const boltSpec = fastenerSpec.bolt_spec || 'M16'

    if (boltCount > 0) {
      for (let i = 0; i < boltCount; i++) {
        const angle = (i / boltCount) * 2 * Math.PI
        const boltY = boltCircleDia * Math.cos(angle)
        const boltZ = boltCircleDia * Math.sin(angle)

        fasteners.push({
          family: 'bolt',
          part_number: boltSpec,
          part_id: boltSpec,
          tag: `${connection.id || 'CONN'}-BOLT-${i + 1}`,
          quantity: 1,
          role: 'fastener',
          connection_id: connection.id,
          position: {
            x: flangePos.x + 5, // 法兰厚度中心
            y: flangePos.y + boltY,
            z: flangePos.z + boltZ
          },
          rotation: { x: 90, y: 0, z: 0 } // 螺栓沿X轴方向
        })
      }
    }

    // 添加垫片(位于两个法兰之间)
    const gasketSpec = fastenerSpec.gasket
    if (gasketSpec || (partA.family === 'flange' && partB.family === 'pipe')) {
      fasteners.push({
        family: 'gasket',
        part_number: gasketSpec || `DN${dn}-RF`,
        part_id: gasketSpec || `DN${dn}-RF`,
        tag: `${connection.id || 'CONN'}-GASKET`,
        quantity: 1,
        role: 'seal',
        connection_id: connection.id,
        position: {
          x: flangePos.x - 2, // 垫片在法兰前面2mm
          y: flangePos.y,
          z: flangePos.z
        },
        rotation: { x: 0, y: 0, z: 0 }
      })
    }

    return fasteners
  }

  /**
   * 获取零件的轴向长度
   */
  _getPartLength(part) {
    const dims = this.partDimensions[part.family]
    return dims ? dims.length : 100
  }
}

module.exports = AssemblyPositionCalculator
