/**
 * 透视标定模块
 * 基于标定矩形实现透视恢复，生成与Ruby插件兼容的JSON格式
 */

class PerspectiveCalibration {
  /**
   * 从QwenVL分析结果生成符合Ruby插件格式的JSON
   * @param {Object} qwenAnalysis - QwenVL的分析结果
   * @param {Object} imageInfo - 图片信息（宽高等）
   * @returns {Object} 符合mst_persp_massing.rb格式的JSON
   */
  static generateCalibrationJSON(qwenAnalysis, imageInfo) {
    console.log('\n🎯 生成标定JSON...');
    
    // 1. 确定标定矩形（优先使用识别的地面/道路，否则使用默认）
    const calibration = this.findCalibrationRectangle(qwenAnalysis, imageInfo);
    
    // 2. 转换建筑轮廓到像素坐标
    // 优先使用instances，如果没有则使用volumes
    const buildingData = qwenAnalysis.instances || qwenAnalysis.volumes || [];
    const buildings = this.convertBuildingsToPixels(
      buildingData,
      imageInfo
    );
    
    // 3. 生成符合Ruby插件的JSON格式
    const result = {
      mode: 'perspective_calibration',
      image_info: {
        width: imageInfo.width,
        height: imageInfo.height,
        source: imageInfo.filename || 'sketch.jpg'
      },
      calibration: {
        img_rect_px: calibration.pixels,  // [[x,y], [x,y], [x,y], [x,y]]
        real_size: calibration.realSize,   // {w: 10, d: 6} 米
        confidence: calibration.confidence
      },
      buildings: buildings.map((building, index) => ({
        name: building.id || `B${index + 1}`,
        footprint_px: building.footprint,  // 建筑轮廓像素坐标
        height: this.calculateBuildingHeight(building, qwenAnalysis),
        properties: {
          floors: building.floors || 3,
          type: building.type || 'residential',
          confidence: building.confidence || 0.8
        }
      })),
      spatial_relations: qwenAnalysis.spatial_relations || [],
      perspective_info: {
        vanishing_points: qwenAnalysis.vanishing_points || null,
        horizon_line: qwenAnalysis.horizon_y || imageInfo.height * 0.4
      }
    };
    
    console.log('✅ 标定JSON生成完成');
    return result;
  }
  
  /**
   * 查找或生成标定矩形
   */
  static findCalibrationRectangle(qwenAnalysis, imageInfo) {
    // 1. 优先：从QwenVL识别的地面/道路元素
    if (qwenAnalysis.ground_plane) {
      const ground = qwenAnalysis.ground_plane;
      return {
        pixels: this.normalizeRectangle(ground.vertices, imageInfo),
        realSize: { w: 20, d: 15 },  // 默认20m×15m的地面区域
        confidence: ground.confidence || 0.9,
        source: 'detected_ground'
      };
    }
    
    // 2. 次选：从建筑群的整体边界推算
    const buildingData = qwenAnalysis.instances || qwenAnalysis.volumes;
    if (buildingData && buildingData.length > 0) {
      const bounds = this.calculateBuildingsBounds(buildingData);
      return {
        pixels: this.boundsToRectangle(bounds, imageInfo),
        realSize: { w: 30, d: 20 },  // 建筑群占地30m×20m
        confidence: 0.7,
        source: 'buildings_bounds'
      };
    }
    
    // 3. 默认：使用图像下半部分作为标定区域
    const defaultRect = [
      [imageInfo.width * 0.2, imageInfo.height * 0.6],
      [imageInfo.width * 0.8, imageInfo.height * 0.6],
      [imageInfo.width * 0.8, imageInfo.height * 0.9],
      [imageInfo.width * 0.2, imageInfo.height * 0.9]
    ];
    
    return {
      pixels: defaultRect,
      realSize: { w: 25, d: 12 },  // 默认25m×12m
      confidence: 0.5,
      source: 'default'
    };
  }
  
  /**
   * 转换建筑到像素坐标
   */
  static convertBuildingsToPixels(instances, imageInfo) {
    return instances.map((instance, index) => {
      let footprint;
      
      // 1. 如果有顶点数据，直接使用
      if (instance.vertices && instance.vertices.length >= 4) {
        footprint = instance.vertices.map(v => [
          v[0] * imageInfo.width,
          v[1] * imageInfo.height
        ]);
      }
      // 2. 如果有轮廓数据
      else if (instance.contour && instance.contour.length >= 3) {
        footprint = instance.contour.map(p => [
          p[0] * imageInfo.width,
          p[1] * imageInfo.height
        ]);
      }
      // 3. 从边界框生成矩形轮廓
      else if (instance.bbox) {
        const [x1, y1, x2, y2] = instance.bbox;
        footprint = [
          [x1 * imageInfo.width, y1 * imageInfo.height],
          [x2 * imageInfo.width, y1 * imageInfo.height],
          [x2 * imageInfo.width, y2 * imageInfo.height],
          [x1 * imageInfo.width, y2 * imageInfo.height]
        ];
      }
      // 4. 从position和dimensions生成轮廓（用于volumes数据）
      else if (instance.position && instance.dimensions) {
        const cx = instance.position.x || 0.5;
        const cy = instance.position.y || 0.5;
        // 将dimensions的width/depth转换为相对尺寸
        const relWidth = (instance.dimensions.width || 20) / 100;  // 假设100米为最大宽度
        const relHeight = (instance.dimensions.depth || 15) / 100;
        footprint = [
          [(cx - relWidth/2) * imageInfo.width, (cy - relHeight/2) * imageInfo.height],
          [(cx + relWidth/2) * imageInfo.width, (cy - relHeight/2) * imageInfo.height],
          [(cx + relWidth/2) * imageInfo.width, (cy + relHeight/2) * imageInfo.height],
          [(cx - relWidth/2) * imageInfo.width, (cy + relHeight/2) * imageInfo.height]
        ];
      }
      // 5. 默认轮廓
      else {
        const cx = instance.center?.[0] || instance.position?.x || 0.5;
        const cy = instance.center?.[1] || instance.position?.y || 0.5;
        const size = 0.1;  // 默认大小
        footprint = [
          [(cx - size) * imageInfo.width, (cy - size) * imageInfo.height],
          [(cx + size) * imageInfo.width, (cy - size) * imageInfo.height],
          [(cx + size) * imageInfo.width, (cy + size) * imageInfo.height],
          [(cx - size) * imageInfo.width, (cy + size) * imageInfo.height]
        ];
      }
      
      return {
        id: instance.id || `B${index + 1}`,
        footprint: footprint,
        floors: instance.rough_floors || instance.floors || 3,
        type: instance.building_type || instance.type || 'residential',
        confidence: instance.confidence || 0.8
      };
    });
  }
  
  /**
   * 计算建筑高度
   */
  static calculateBuildingHeight(building, qwenAnalysis) {
    // 方式1：绝对高度（如果能推算）
    if (building.floors) {
      const floorHeight = 3.2;  // 标准层高3.2米
      return {
        abs: building.floors * floorHeight,
        floors: building.floors
      };
    }
    
    // 方式2：相对高度（基于轮廓对角线）
    return {
      ratio_h: 1.2,  // 高度是底面对角线的1.2倍
      ref: 'diag'    // 参考对角线
    };
  }
  
  /**
   * 规范化矩形（确保4个点按顺序）
   */
  static normalizeRectangle(vertices, imageInfo) {
    if (!vertices || vertices.length < 4) {
      return null;
    }
    
    // 转换为像素坐标
    const pixels = vertices.slice(0, 4).map(v => [
      v[0] * imageInfo.width,
      v[1] * imageInfo.height
    ]);
    
    // 按左上、右上、右下、左下顺序排列
    return this.sortRectanglePoints(pixels);
  }
  
  /**
   * 从边界生成矩形
   */
  static boundsToRectangle(bounds, imageInfo) {
    return [
      [bounds.minX * imageInfo.width, bounds.minY * imageInfo.height],
      [bounds.maxX * imageInfo.width, bounds.minY * imageInfo.height],
      [bounds.maxX * imageInfo.width, bounds.maxY * imageInfo.height],
      [bounds.minX * imageInfo.width, bounds.maxY * imageInfo.height]
    ];
  }
  
  /**
   * 计算建筑群边界
   */
  static calculateBuildingsBounds(instances) {
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    
    instances.forEach(instance => {
      if (instance.bbox) {
        minX = Math.min(minX, instance.bbox[0]);
        maxX = Math.max(maxX, instance.bbox[2]);
        minY = Math.min(minY, instance.bbox[1]);
        maxY = Math.max(maxY, instance.bbox[3]);
      } else if (instance.position) {
        // 处理volumes格式的数据
        const x = instance.position.x || 0.5;
        const y = instance.position.y || 0.5;
        const halfWidth = (instance.dimensions?.width || 20) / 200;  // 转换为相对值
        const halfHeight = (instance.dimensions?.depth || 15) / 200;
        
        minX = Math.min(minX, x - halfWidth);
        maxX = Math.max(maxX, x + halfWidth);
        minY = Math.min(minY, y - halfHeight);
        maxY = Math.max(maxY, y + halfHeight);
      }
    });
    
    // 确保边界在合理范围内
    minX = Math.max(0, Math.min(minX, 1));
    maxX = Math.max(0, Math.min(maxX, 1));
    minY = Math.max(0, Math.min(minY, 1));
    maxY = Math.max(0, Math.min(maxY, 1));
    
    return { minX, maxX, minY, maxY };
  }
  
  /**
   * 排序矩形点（左上开始，顺时针）
   */
  static sortRectanglePoints(points) {
    if (points.length !== 4) return points;
    
    // 计算中心点
    const cx = points.reduce((sum, p) => sum + p[0], 0) / 4;
    const cy = points.reduce((sum, p) => sum + p[1], 0) / 4;
    
    // 按角度排序
    const sorted = points.sort((a, b) => {
      const angleA = Math.atan2(a[1] - cy, a[0] - cx);
      const angleB = Math.atan2(b[1] - cy, b[0] - cx);
      return angleA - angleB;
    });
    
    // 找到左上角（最小x+y）
    let topLeftIdx = 0;
    let minSum = sorted[0][0] + sorted[0][1];
    for (let i = 1; i < 4; i++) {
      const sum = sorted[i][0] + sorted[i][1];
      if (sum < minSum) {
        minSum = sum;
        topLeftIdx = i;
      }
    }
    
    // 从左上角开始重新排列
    return [
      sorted[topLeftIdx],
      sorted[(topLeftIdx + 1) % 4],
      sorted[(topLeftIdx + 2) % 4],
      sorted[(topLeftIdx + 3) % 4]
    ];
  }
  
  /**
   * 验证生成的JSON格式
   */
  static validateJSON(json) {
    const errors = [];
    
    // 检查必需字段
    if (!json.calibration) {
      errors.push('缺少calibration字段');
    } else {
      if (!json.calibration.img_rect_px || json.calibration.img_rect_px.length !== 4) {
        errors.push('标定矩形需要4个点');
      }
      if (!json.calibration.real_size || !json.calibration.real_size.w || !json.calibration.real_size.d) {
        errors.push('缺少真实尺寸数据');
      }
    }
    
    if (!json.buildings || json.buildings.length === 0) {
      errors.push('缺少建筑数据');
    } else {
      json.buildings.forEach((b, i) => {
        if (!b.footprint_px || b.footprint_px.length < 3) {
          errors.push(`建筑${i+1}轮廓点不足`);
        }
        if (!b.height) {
          errors.push(`建筑${i+1}缺少高度信息`);
        }
      });
    }
    
    if (errors.length > 0) {
      console.warn('⚠️ JSON验证警告:', errors);
      return { valid: false, errors };
    }
    
    console.log('✅ JSON格式验证通过');
    return { valid: true };
  }
  
  /**
   * 导出为Ruby插件可用的JSON文件
   */
  static exportForRubyPlugin(json, outputPath) {
    const fs = require('fs');
    const path = require('path');
    
    // 验证JSON
    const validation = this.validateJSON(json);
    if (!validation.valid) {
      console.error('❌ JSON验证失败，无法导出');
      return false;
    }
    
    // 简化格式（去除非必需字段）
    const simplified = {
      calibration: json.calibration,
      buildings: json.buildings.map(b => ({
        name: b.name,
        footprint_px: b.footprint_px,
        height: b.height
      }))
    };
    
    // 写入文件
    try {
      fs.writeFileSync(
        outputPath,
        JSON.stringify(simplified, null, 2),
        'utf8'
      );
      console.log(`✅ 导出成功: ${outputPath}`);
      return true;
    } catch (error) {
      console.error('❌ 导出失败:', error.message);
      return false;
    }
  }
}

module.exports = PerspectiveCalibration;