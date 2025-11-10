/**
 * 装配导出服务 - 导出为Three.js可用的JSON格式
 */
class AssemblyExporter {
  /**
   * 导出为Three.js JSON格式
   */
  static exportToThreeJS(placements, allParts) {
    const scene = {
      metadata: {
        version: 4.5,
        type: 'Object',
        generator: 'AssemblyExporter'
      },
      geometries: [],
      materials: [],
      object: {
        type: 'Scene',
        children: []
      }
    }

    placements.forEach((placement, index) => {
      const {family, tag, position, rotation} = placement

      // 创建简单几何体
      const geometry = this._createGeometry(family, index)
      const material = this._createMaterial(family, index)

      scene.geometries.push(geometry)
      scene.materials.push(material)

      // 创建对象
      const obj = {
        uuid: `obj-${index}`,
        type: 'Mesh',
        name: tag || `${family}-${index}`,
        geometry: geometry.uuid,
        material: material.uuid,
        matrix: this._createMatrix(position, rotation || {})
      }

      scene.object.children.push(obj)
    })

    return scene
  }

  static _createGeometry(family, index) {
    const uuid = `geo-${index}`

    switch (family) {
      case 'valve':
        return {
          uuid,
          type: 'BoxGeometry',
          width: 150,
          height: 100,
          depth: 100
        }
      case 'flange':
        return {
          uuid,
          type: 'CylinderGeometry',
          radiusTop: 75,
          radiusBottom: 75,
          height: 20,
          radialSegments: 32
        }
      case 'pipe':
        return {
          uuid,
          type: 'CylinderGeometry',
          radiusTop: 25,
          radiusBottom: 25,
          height: 200,
          radialSegments: 32
        }
      case 'bolt':
        return {
          uuid,
          type: 'CylinderGeometry',
          radiusTop: 8,
          radiusBottom: 8,
          height: 60,
          radialSegments: 16
        }
      case 'gasket':
        return {
          uuid,
          type: 'CylinderGeometry',
          radiusTop: 50,
          radiusBottom: 50,
          height: 3,
          radialSegments: 32
        }
      default:
        return {
          uuid,
          type: 'BoxGeometry',
          width: 50,
          height: 50,
          depth: 50
        }
    }
  }

  static _createMaterial(family, index) {
    const colorMap = {
      valve: 0x4a90e2,    // 蓝色
      flange: 0xf5a623,   // 橙色
      pipe: 0x7ed321,     // 绿色
      bolt: 0x9013fe,     // 紫色
      gasket: 0xd0021b    // 红色
    }

    return {
      uuid: `mat-${index}`,
      type: 'MeshStandardMaterial',
      color: colorMap[family] || 0xcccccc,
      metalness: 0.5,
      roughness: 0.5
    }
  }

  static _createMatrix(position, rotation) {
    const {x = 0, y = 0, z = 0} = position
    const {x: rx = 0, y: ry = 0, z: rz = 0} = rotation

    // 简化的4x4矩阵（只包含位移）
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      x, y, z, 1
    ]
  }
}

module.exports = AssemblyExporter
