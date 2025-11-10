const fs = require('fs');
const path = require('path');

/**
 * STEP装配文件解析器
 * 从STEP ISO-10303-21格式文件中提取装配结构
 */
class StepAssemblyParser {
  /**
   * 解析STEP装配文件
   * @param {string} stepFilePath - STEP文件路径
   * @returns {Object} 装配数据
   */
  static parseAssembly(stepFilePath) {
    if (!fs.existsSync(stepFilePath)) {
      throw new Error(`STEP文件不存在: ${stepFilePath}`);
    }

    const content = fs.readFileSync(stepFilePath, 'utf-8');

    const assembly = {
      filename: path.basename(stepFilePath),
      products: [],
      positions: {},
      directions: {},
      placements: {},
      relationships: []
    };

    // 提取PRODUCT
    const productRegex = /#(\d+)\s*=\s*PRODUCT\s*\(\s*'([^']+)'/g;
    let match;
    while ((match = productRegex.exec(content)) !== null) {
      assembly.products.push({
        id: match[1],
        name: match[2]
      });
    }

    // 提取CARTESIAN_POINT
    const pointRegex = /#(\d+)\s*=\s*CARTESIAN_POINT\s*\([^,]*,\s*\(\s*([-\d.E+]+)\s*,\s*([-\d.E+]+)\s*,\s*([-\d.E+]+)\s*\)/g;
    while ((match = pointRegex.exec(content)) !== null) {
      assembly.positions[match[1]] = [
        parseFloat(match[2]),
        parseFloat(match[3]),
        parseFloat(match[4])
      ];
    }

    // 提取DIRECTION
    const dirRegex = /#(\d+)\s*=\s*DIRECTION\s*\([^,]*,\s*\(\s*([-\d.E+]+)\s*,\s*([-\d.E+]+)\s*,\s*([-\d.E+]+)\s*\)/g;
    while ((match = dirRegex.exec(content)) !== null) {
      assembly.directions[match[1]] = [
        parseFloat(match[2]),
        parseFloat(match[3]),
        parseFloat(match[4])
      ];
    }

    // 提取AXIS2_PLACEMENT_3D
    const placementRegex = /#(\d+)\s*=\s*AXIS2_PLACEMENT_3D\s*\([^,]*,\s*#(\d+)\s*,\s*#(\d+)\s*,\s*#(\d+)\s*\)/g;
    while ((match = placementRegex.exec(content)) !== null) {
      const placement = {
        id: match[1],
        point_ref: match[2],
        z_dir_ref: match[3],
        x_dir_ref: match[4]
      };

      if (assembly.positions[match[2]]) {
        placement.position = assembly.positions[match[2]];
      }
      if (assembly.directions[match[3]]) {
        placement.z_direction = assembly.directions[match[3]];
      }
      if (assembly.directions[match[4]]) {
        placement.x_direction = assembly.directions[match[4]];
      }

      assembly.placements[match[1]] = placement;
    }

    // 提取NEXT_ASSEMBLY_USAGE_OCCURRENCE (父子关系)
    const nauoRegex = /#(\d+)\s*=\s*NEXT_ASSEMBLY_USAGE_OCCURRENCE\s*\([^,]*,\s*[^,]*,\s*'([^']*)',\s*[^,]*,\s*#(\d+)\s*,\s*#(\d+)/g;
    while ((match = nauoRegex.exec(content)) !== null) {
      assembly.relationships.push({
        id: match[1],
        name: match[2],
        parent_ref: match[3],
        child_ref: match[4]
      });
    }

    return assembly;
  }

  /**
   * 从装配数据生成零件实例列表
   * @param {Object} assemblyData - 解析的装配数据
   * @returns {Array} 零件实例列表
   */
  static extractPartInstances(assemblyData) {
    const instances = [];

    // 为每个产品创建实例
    assemblyData.products.forEach((product, index) => {
      // 尝试匹配到placement
      const placementId = Object.keys(assemblyData.placements)[index];
      const placement = assemblyData.placements[placementId];

      instances.push({
        part_id: product.name,
        instance_id: `${product.name}_${index}`,
        position: placement?.position || [0, 0, 0],
        rotation: this._extractRotation(placement),
        z_direction: placement?.z_direction || [0, 0, 1],
        x_direction: placement?.x_direction || [1, 0, 0]
      });
    });

    return instances;
  }

  /**
   * 从placement提取旋转信息
   * @private
   */
  static _extractRotation(placement) {
    if (!placement || !placement.z_direction || !placement.x_direction) {
      return [0, 0, 0];
    }

    // 使用Z轴和X轴向量计算欧拉角
    const zDir = placement.z_direction;
    const xDir = placement.x_direction;

    // 简化的旋转提取（实际应用可能需要更精确的算法）
    const rotX = Math.atan2(zDir[1], zDir[2]);
    const rotY = Math.atan2(-zDir[0], Math.sqrt(zDir[1] * zDir[1] + zDir[2] * zDir[2]));
    const rotZ = Math.atan2(xDir[1], xDir[0]);

    return [rotX, rotY, rotZ];
  }
}

module.exports = StepAssemblyParser;
