/**
 * 透视分析服务
 * 识别透视类型（一点/两点/三点透视）并提取建筑空间关系
 */

// 使用纯JavaScript实现，避免opencv依赖
class PerspectiveAnalysisService {
  
  /**
   * 分析透视类型和提取空间信息
   * 基于QwenVL返回的真实透视数据
   */
  async analyzePerspective(imageBuffer, visionData = {}) {
    console.log('\n🎯 透视分析开始...');
    
    try {
      // 优先使用QwenVL识别的透视信息
      let perspectiveType = '未知';
      let vanishingPoints = [];
      let perspectiveLines = [];
      
      // 1. 从visionData中提取透视分析结果
      if (visionData.perspective_analysis) {
        const pa = visionData.perspective_analysis;
        console.log('  使用QwenVL识别的透视信息');
        
        // 提取透视类型
        perspectiveType = pa.type || '未知';
        
        // 提取灭点（转换为像素坐标，假设图像1024x768）
        if (pa.vanishing_points && pa.vanishing_points.length > 0) {
          vanishingPoints = pa.vanishing_points.map(vp => ({
            x: vp.x * 1024,  // 将0-1坐标转换为像素
            y: vp.y * 768,
            type: vp.description || 'unknown',
            count: 10  // 假设权重
          }));
        }
        
        // 提取透视线
        if (pa.perspective_lines && pa.perspective_lines.length > 0) {
          perspectiveLines = pa.perspective_lines.map(line => ({
            direction: line.direction === '向左' ? 'perspective_left' : 
                      line.direction === '向右' ? 'perspective_right' : 'vertical',
            angle: line.angle || 0
          }));
        }
        
        console.log(`  透视类型: ${perspectiveType}`);
        console.log(`  灭点数量: ${vanishingPoints.length}`);
        
      } else {
        // 如果没有透视分析，尝试从基本信息推断
        console.log('  QwenVL未提供透视信息，使用默认分析');
        
        // 根据视角推断透视类型
        if (visionData.viewing_angle) {
          if (visionData.viewing_angle.includes('正视') || visionData.viewing_angle.includes('平行')) {
            perspectiveType = '平行投影';
          } else if (visionData.viewing_angle.includes('侧视') || visionData.viewing_angle.includes('斜视')) {
            perspectiveType = '两点透视';
            // 生成默认的两个灭点
            vanishingPoints = [
              { x: -200, y: 384, type: 'horizontal', count: 5 },  // 左灭点
              { x: 1224, y: 384, type: 'horizontal', count: 5 }   // 右灭点
            ];
          } else {
            perspectiveType = '一点透视';
            // 生成默认的中心灭点
            vanishingPoints = [
              { x: 512, y: 384, type: 'center', count: 10 }
            ];
          }
        }
      }
      
      // 2. 基于透视信息计算建筑深度关系
      const depthRelations = this.calculateDepthRelations(
        perspectiveLines, 
        vanishingPoints,
        visionData
      );
      
      // 3. 重建3D坐标（基于真实透视数据）
      const coordinates3D = this.reconstruct3DCoordinates(
        vanishingPoints,
        perspectiveType,
        depthRelations,
        visionData
      );
      
      console.log(`✅ 透视类型: ${perspectiveType}`);
      console.log(`✅ 灭点数量: ${vanishingPoints.length}`);
      console.log(`✅ 深度层次: ${depthRelations.layers}`);
      
      return {
        perspectiveType,
        vanishingPoints,
        depthRelations,
        coordinates3D,
        spatialRelations: this.extractSpatialRelations(coordinates3D)
      };
      
    } catch (error) {
      console.error('透视分析失败:', error);
      return this.getDefaultPerspective();
    }
  }
  
  /**
   * 从QwenVL数据提取透视线
   */
  extractPerspectiveLinesFromVision(visionData) {
    const perspectiveLines = [];
    
    // 如果有透视分析数据，使用它
    if (visionData.perspective_analysis && visionData.perspective_analysis.perspective_lines) {
      return visionData.perspective_analysis.perspective_lines.map(line => ({
        direction: line.direction === '向左' ? 'perspective_left' : 
                  line.direction === '向右' ? 'perspective_right' : 'vertical',
        angle: line.angle || 0
      }));
    }
    
    // 如果没有，返回空数组（不生成假数据）
    return perspectiveLines;
  }
  
  /**
   * 分类线条方向
   */
  classifyLineDirection(angle) {
    const normalizedAngle = ((angle % 360) + 360) % 360;
    
    if (Math.abs(normalizedAngle) < 10 || Math.abs(normalizedAngle - 180) < 10) {
      return 'horizontal';
    } else if (Math.abs(normalizedAngle - 90) < 10 || Math.abs(normalizedAngle - 270) < 10) {
      return 'vertical';
    } else if (normalizedAngle > 0 && normalizedAngle < 90) {
      return 'perspective_right';
    } else if (normalizedAngle > 90 && normalizedAngle < 180) {
      return 'perspective_left';
    } else if (normalizedAngle > 180 && normalizedAngle < 270) {
      return 'perspective_left';
    } else {
      return 'perspective_right';
    }
  }
  
  /**
   * 找到灭点（透视线的交点）
   */
  findVanishingPoints(perspectiveLines) {
    if (perspectiveLines.length < 2) return [];
    
    const intersections = [];
    
    // 计算所有线条对的交点
    for (let i = 0; i < perspectiveLines.length - 1; i++) {
      for (let j = i + 1; j < perspectiveLines.length; j++) {
        const intersection = this.lineIntersection(
          perspectiveLines[i],
          perspectiveLines[j]
        );
        
        if (intersection && this.isValidVanishingPoint(intersection)) {
          intersections.push(intersection);
        }
      }
    }
    
    // 聚类交点找到主要灭点
    const vanishingPoints = this.clusterVanishingPoints(intersections);
    
    // 分类灭点
    return vanishingPoints.map(vp => ({
      ...vp,
      type: this.classifyVanishingPoint(vp)
    }));
  }
  
  /**
   * 计算两条线的交点
   */
  lineIntersection(line1, line2) {
    const x1 = line1.start.x, y1 = line1.start.y;
    const x2 = line1.end.x, y2 = line1.end.y;
    const x3 = line2.start.x, y3 = line2.start.y;
    const x4 = line2.end.x, y4 = line2.end.y;
    
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    
    if (Math.abs(denom) < 0.001) return null; // 平行线
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
      confidence: 1.0 / (1 + Math.abs(t)) // 交点越远可信度越低
    };
  }
  
  /**
   * 判断是否为有效灭点
   */
  isValidVanishingPoint(point) {
    // 灭点通常在图像外或边缘
    return point.confidence > 0.3;
  }
  
  /**
   * 聚类灭点
   */
  clusterVanishingPoints(intersections) {
    if (intersections.length === 0) return [];
    
    // 简单的基于距离的聚类
    const clusters = [];
    const threshold = 50; // 像素距离阈值
    
    intersections.forEach(point => {
      let added = false;
      
      for (let cluster of clusters) {
        const dist = Math.sqrt(
          (cluster.x - point.x) ** 2 + 
          (cluster.y - point.y) ** 2
        );
        
        if (dist < threshold) {
          // 更新聚类中心
          cluster.x = (cluster.x * cluster.count + point.x) / (cluster.count + 1);
          cluster.y = (cluster.y * cluster.count + point.y) / (cluster.count + 1);
          cluster.count++;
          added = true;
          break;
        }
      }
      
      if (!added) {
        clusters.push({
          x: point.x,
          y: point.y,
          count: 1
        });
      }
    });
    
    // 只返回主要的灭点（出现次数多的）
    return clusters
      .filter(c => c.count > 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3); // 最多3个灭点
  }
  
  /**
   * 分类灭点类型
   */
  classifyVanishingPoint(vp) {
    // 根据位置判断灭点类型
    if (vp.x < -100 || vp.x > 2000) {
      return 'horizontal'; // 水平灭点
    } else if (vp.y < -100 || vp.y > 2000) {
      return 'vertical'; // 垂直灭点
    } else {
      return 'diagonal'; // 对角灭点
    }
  }
  
  /**
   * 判断透视类型
   */
  determinePerspectiveType(vanishingPoints) {
    const vpCount = vanishingPoints.length;
    
    if (vpCount === 0) {
      return '平行投影';
    } else if (vpCount === 1) {
      return '一点透视';
    } else if (vpCount === 2) {
      // 检查两个灭点是否都是水平方向
      const horizontalVPs = vanishingPoints.filter(vp => vp.type === 'horizontal');
      if (horizontalVPs.length === 2) {
        return '两点透视';
      }
      return '斜两点透视';
    } else {
      return '三点透视';
    }
  }
  
  /**
   * 计算深度关系
   */
  calculateDepthRelations(perspectiveLines, vanishingPoints, visionData) {
    // 基于透视线密度判断深度层次
    const depthLayers = this.analyzeDepthLayers(perspectiveLines);
    
    // 结合视觉识别的建筑信息
    const buildings = visionData.buildings || [];
    
    // 计算每个建筑的深度值
    const buildingDepths = buildings.map((building, idx) => {
      // 基于Y坐标和透视关系估算深度
      const relativeY = building.position?.relative_y || 0.5;
      const perspectiveFactor = this.calculatePerspectiveFactor(
        building.position,
        vanishingPoints
      );
      
      return {
        buildingId: building.id || `building_${idx}`,
        depth: relativeY * perspectiveFactor,
        layer: Math.floor(relativeY * depthLayers)
      };
    });
    
    return {
      layers: depthLayers,
      buildingDepths,
      perspectiveScale: this.calculatePerspectiveScale(vanishingPoints)
    };
  }
  
  /**
   * 分析深度层次
   */
  analyzeDepthLayers(perspectiveLines) {
    // 检查输入是否有效
    if (!perspectiveLines || !Array.isArray(perspectiveLines) || perspectiveLines.length === 0) {
      return 1; // 默认单层
    }
    
    // 根据透视线的分布判断深度层次
    const yPositions = perspectiveLines
      .filter(line => line && line.start && line.end) // 确保有有效的start和end
      .map(line => 
        (line.start.y + line.end.y) / 2
      );
    
    // 简单的层次划分
    if (yPositions.length === 0) return 1;
    
    const minY = Math.min(...yPositions);
    const maxY = Math.max(...yPositions);
    const range = maxY - minY;
    
    // 根据Y范围估算层次
    if (range < 100) return 1;
    if (range < 300) return 2;
    if (range < 500) return 3;
    return 4;
  }
  
  /**
   * 计算透视因子
   */
  calculatePerspectiveFactor(position, vanishingPoints) {
    if (!position || vanishingPoints.length === 0) return 1;
    
    // 计算到最近灭点的距离
    const distances = vanishingPoints.map(vp => {
      const dx = (position.relative_x || 0.5) * 1000 - vp.x;
      const dy = (position.relative_y || 0.5) * 1000 - vp.y;
      return Math.sqrt(dx * dx + dy * dy);
    });
    
    const minDistance = Math.min(...distances);
    
    // 距离越远，透视因子越小（物体越远）
    return 1 / (1 + minDistance / 1000);
  }
  
  /**
   * 计算透视缩放比例
   */
  calculatePerspectiveScale(vanishingPoints) {
    if (vanishingPoints.length < 2) return 1;
    
    // 基于灭点距离计算透视强度
    const vp1 = vanishingPoints[0];
    const vp2 = vanishingPoints[1];
    
    const distance = Math.sqrt(
      (vp2.x - vp1.x) ** 2 + 
      (vp2.y - vp1.y) ** 2
    );
    
    // 距离越大，透视越弱
    return Math.max(0.5, Math.min(2, 1000 / distance));
  }
  
  /**
   * 重建3D坐标
   */
  reconstruct3DCoordinates(vanishingPoints, perspectiveType, depthRelations, visionData) {
    const buildings = visionData.buildings || [];
    const coordinates = [];
    
    buildings.forEach((building, idx) => {
      const depth = depthRelations.buildingDepths[idx];
      
      // 基于透视类型重建坐标
      let coords;
      switch (perspectiveType) {
        case '一点透视':
          coords = this.reconstruct1PointPerspective(
            building, 
            vanishingPoints[0], 
            depth
          );
          break;
          
        case '两点透视':
          coords = this.reconstruct2PointPerspective(
            building,
            vanishingPoints,
            depth
          );
          break;
          
        case '三点透视':
          coords = this.reconstruct3PointPerspective(
            building,
            vanishingPoints,
            depth
          );
          break;
          
        default:
          coords = this.reconstructParallel(building);
      }
      
      coordinates.push({
        buildingId: building.id,
        ...coords,
        confidence: this.calculateConfidence(perspectiveType, depth)
      });
    });
    
    return coordinates;
  }
  
  /**
   * 一点透视重建
   */
  reconstruct1PointPerspective(building, vanishingPoint, depthInfo) {
    const baseX = (building.position?.relative_x || 0.5) * 30000 - 15000;
    const baseY = depthInfo.depth * 20000;
    const baseZ = 0;
    
    // 根据到灭点的距离调整位置
    const toVP = {
      x: vanishingPoint.x - baseX,
      y: vanishingPoint.y - baseY
    };
    
    const distance = Math.sqrt(toVP.x ** 2 + toVP.y ** 2);
    const scale = Math.max(0.5, Math.min(1.5, 1000 / distance));
    
    return {
      x: baseX * scale,
      y: baseY * scale,
      z: baseZ,
      width: (building.dimensions?.width || 10000) * scale,
      depth: (building.dimensions?.depth || 8000) * scale,
      height: building.dimensions?.height || 10000
    };
  }
  
  /**
   * 两点透视重建
   */
  reconstruct2PointPerspective(building, vanishingPoints, depthInfo) {
    // 找到左右两个灭点
    const leftVP = vanishingPoints.find(vp => vp.x < 500) || vanishingPoints[0];
    const rightVP = vanishingPoints.find(vp => vp.x > 500) || vanishingPoints[1];
    
    // 基础位置
    const baseX = (building.position?.relative_x || 0.5) * 30000 - 15000;
    const baseY = depthInfo.depth * 20000;
    
    // 根据两个灭点插值计算实际位置
    const leftWeight = Math.abs(rightVP.x - baseX) / Math.abs(rightVP.x - leftVP.x);
    const rightWeight = 1 - leftWeight;
    
    // 透视变形
    const perspectiveX = baseX * (1 + (leftWeight - rightWeight) * 0.3);
    const perspectiveY = baseY * (1 - Math.abs(leftWeight - rightWeight) * 0.2);
    
    return {
      x: perspectiveX,
      y: perspectiveY,
      z: 0,
      width: (building.dimensions?.width || 10000) * (1 - depthInfo.depth * 0.3),
      depth: (building.dimensions?.depth || 8000) * (1 - depthInfo.depth * 0.2),
      height: building.dimensions?.height || 10000,
      rotation: Math.atan2(rightVP.y - leftVP.y, rightVP.x - leftVP.x) * 180 / Math.PI
    };
  }
  
  /**
   * 三点透视重建
   */
  reconstruct3PointPerspective(building, vanishingPoints, depthInfo) {
    // 三点透视最复杂，需要考虑垂直灭点
    const horizontalVPs = vanishingPoints.filter(vp => vp.type === 'horizontal');
    const verticalVP = vanishingPoints.find(vp => vp.type === 'vertical');
    
    // 基础坐标
    let coords = this.reconstruct2PointPerspective(
      building, 
      horizontalVPs.length >= 2 ? horizontalVPs : vanishingPoints,
      depthInfo
    );
    
    // 添加垂直透视变形
    if (verticalVP) {
      const verticalFactor = Math.abs(verticalVP.y - 500) / 1000;
      coords.height *= (1 - verticalFactor * 0.2);
      coords.z = verticalFactor * 1000; // 基础高度偏移
    }
    
    return coords;
  }
  
  /**
   * 平行投影重建（无透视）
   */
  reconstructParallel(building) {
    return {
      x: (building.position?.relative_x || 0.5) * 30000 - 15000,
      y: (building.position?.relative_y || 0.5) * 20000 - 10000,
      z: 0,
      width: building.dimensions?.width || 10000,
      depth: building.dimensions?.depth || 8000,
      height: building.dimensions?.height || 10000
    };
  }
  
  /**
   * 计算置信度
   */
  calculateConfidence(perspectiveType, depthInfo) {
    let confidence = 0.5;
    
    // 透视类型越明确，置信度越高
    switch (perspectiveType) {
      case '一点透视':
        confidence = 0.8;
        break;
      case '两点透视':
        confidence = 0.7;
        break;
      case '三点透视':
        confidence = 0.6;
        break;
      default:
        confidence = 0.5;
    }
    
    // 深度信息越清晰，置信度越高
    if (depthInfo && depthInfo.layer) {
      confidence += 0.1 * Math.min(depthInfo.layer, 3) / 3;
    }
    
    return Math.min(confidence, 0.95);
  }
  
  /**
   * 提取空间关系
   */
  extractSpatialRelations(coordinates3D) {
    const relations = [];
    
    for (let i = 0; i < coordinates3D.length - 1; i++) {
      for (let j = i + 1; j < coordinates3D.length; j++) {
        const building1 = coordinates3D[i];
        const building2 = coordinates3D[j];
        
        // 计算相对位置关系
        const dx = building2.x - building1.x;
        const dy = building2.y - building1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        relations.push({
          from: building1.buildingId,
          to: building2.buildingId,
          relation: this.determineRelation(dx, dy),
          distance: distance,
          angle: Math.atan2(dy, dx) * 180 / Math.PI
        });
      }
    }
    
    return relations;
  }
  
  /**
   * 判断空间关系
   */
  determineRelation(dx, dy) {
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    
    if (Math.abs(angle) < 45) return '右侧';
    if (Math.abs(angle - 90) < 45) return '后方';
    if (Math.abs(angle + 90) < 45) return '前方';
    if (Math.abs(angle) > 135) return '左侧';
    
    return '斜向';
  }
  
  /**
   * 默认透视分析结果
   */
  getDefaultPerspective() {
    return {
      perspectiveType: '未知',
      vanishingPoints: [],
      depthRelations: {
        layers: 1,
        buildingDepths: [],
        perspectiveScale: 1
      },
      coordinates3D: [],
      spatialRelations: []
    };
  }
}

module.exports = PerspectiveAnalysisService;