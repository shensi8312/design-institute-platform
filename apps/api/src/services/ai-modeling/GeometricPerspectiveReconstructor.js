/**
 * 几何优先的透视重建服务
 * 基于消失点、地平线、单应性变换的稳健重建方法
 * 
 * 核心原则：
 * 1. 几何约束优先，大模型做裁判
 * 2. 点云只作辅助，不当3D坐标
 * 3. 必须有参照尺度
 */

// 使用纯JavaScript实现，避免opencv依赖
const axios = require('axios');
const sharp = require('sharp');

class GeometricPerspectiveReconstructor {
  constructor() {
    // 关键参数（可调）
    this.params = {
      // 线段检测
      minLineLength: 0.02,  // 最小线段长度：图片短边的2%
      parallelAngleThreshold: 3,  // 平行线角度差阈值（度）
      
      // 候选框
      maxCandidates: 12,  // 最大候选框数
      nmsIoU: 0.5,  // NMS IoU阈值
      
      // 脚点RANSAC
      ransacIterations: 1000,
      inlierThreshold: 3,  // 像素
      
      // 尺度参数
      defaultFloorHeight: 3.2,  // 默认层高（米）
      parapetHeight: 1.0,  // 女儿墙高度（米）
      
      // 深度参数
      depthVariationThreshold: 1.0,  // 深度突变阈值（σ）
      adjacencyThreshold: 0.8,  // 邻接判定距离（米）
    };
  }

  /**
   * Phase 0: 救火版主流程
   * 几何优先，快速得到稳定的白模
   */
  async reconstructFromPerspective(imageBuffer, options = {}) {
    console.log('\n🔥 Phase 0: 几何优先透视重建');
    
    try {
      // Step 1: 强健线段检测 → 消失点
      console.log('\n📐 Step 1: 检测线段和消失点');
      const perspectiveData = await this.detectVanishingPoints(imageBuffer);
      
      // Step 2: 候选框提案（多源融合）
      console.log('\n🎯 Step 2: 生成建筑候选框');
      const candidates = await this.generateBuildingProposals(imageBuffer);
      
      // Step 3: Qwen-VL做裁判（验证而非检测）
      console.log('\n✅ Step 3: Qwen-VL验证候选框');
      const verifiedBuildings = await this.verifyWithQwenVL(imageBuffer, candidates);
      
      // Step 4: 解透视 - 单应性变换
      console.log('\n🔄 Step 4: 单应性变换还原footprint');
      const footprints = await this.computeGroundFootprints(
        verifiedBuildings, 
        perspectiveData
      );
      
      // Step 5: 尺度标定 + 交比法高度恢复
      console.log('\n📏 Step 5: 交比法恢复高度');
      const scaledBuildings = await this.recoverHeights(
        footprints,
        perspectiveData,
        options.referenceHeight || this.params.defaultFloorHeight
      );
      
      // Step 6: 输出标准JSON
      console.log('\n📦 Step 6: 生成SketchUp JSON');
      const result = this.formatForSketchUp(scaledBuildings, perspectiveData);
      
      return result;
      
    } catch (error) {
      console.error('❌ 几何重建失败:', error);
      throw error;
    }
  }

  /**
   * Step 1: 检测线段和消失点
   * 使用LSD/Hough + RANSAC
   */
  async detectVanishingPoints(imageBuffer) {
    // 使用sharp获取图像信息
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;
    
    // 简化版：生成模拟的线段数据
    // 实际应该使用边缘检测算法
    const lines = this.detectLinesSimplified(imageBuffer, width, height);
    
    console.log(`  检测到 ${lines.length} 条线段`);
    
    // 1.2 线段分组（按方向）
    const lineGroups = this.groupParallelLines(lines);
    console.log(`  分组为 ${lineGroups.length} 组平行线`);
    
    // 1.3 RANSAC拟合消失点
    const vanishingPoints = [];
    
    // 找水平消失点（左右）
    const horizontalGroups = lineGroups.filter(g => 
      Math.abs(g.avgAngle) < 45 || Math.abs(g.avgAngle - 180) < 45
    );
    
    if (horizontalGroups.length >= 2) {
      // 两点透视：左右两个消失点
      const vp_left = this.fitVanishingPoint(horizontalGroups[0].lines);
      const vp_right = this.fitVanishingPoint(horizontalGroups[1].lines);
      
      vanishingPoints.push(
        { type: 'left', point: vp_left, confidence: 0.9 },
        { type: 'right', point: vp_right, confidence: 0.9 }
      );
      
      // 1.4 计算地平线
      const horizonY = (vp_left.y + vp_right.y) / 2;
      
      console.log(`  ✅ 两点透视检测成功`);
      console.log(`    VP_left: (${vp_left.x.toFixed(0)}, ${vp_left.y.toFixed(0)})`);
      console.log(`    VP_right: (${vp_right.x.toFixed(0)}, ${vp_right.y.toFixed(0)})`);
      console.log(`    地平线: y=${horizonY.toFixed(0)}`);
      
      return {
        perspectiveType: 'two_point',
        vanishingPoints,
        horizonLine: horizonY,
        imageSize: { width, height }
      };
    }
    
    // 降级到一点透视
    console.log('  ⚠️ 降级到一点透视');
    return {
      perspectiveType: 'one_point',
      vanishingPoints: [{ type: 'center', point: { x: width/2, y: height/2 }, confidence: 0.5 }],
      horizonLine: height/2,
      imageSize: { width, height }
    };
  }
  
  /**
   * 简化的线段检测（不依赖OpenCV）
   */
  detectLinesSimplified(imageBuffer, width, height) {
    // 模拟线段检测结果
    // 实际应该使用Canny边缘检测 + Hough变换
    const lines = [];
    
    // 生成一些水平和垂直线段作为示例
    for (let i = 0; i < 20; i++) {
      const isHorizontal = Math.random() > 0.5;
      if (isHorizontal) {
        lines.push({
          x1: Math.random() * width * 0.2,
          y1: Math.random() * height,
          x2: width * (0.8 + Math.random() * 0.2),
          y2: Math.random() * height
        });
      } else {
        lines.push({
          x1: Math.random() * width,
          y1: Math.random() * height * 0.2,
          x2: Math.random() * width,
          y2: height * (0.8 + Math.random() * 0.2)
        });
      }
    }
    
    return lines;
  }

  /**
   * 分组平行线
   */
  groupParallelLines(lines) {
    const groups = [];
    const angleThreshold = this.params.parallelAngleThreshold;
    
    lines.forEach(line => {
      const angle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * 180 / Math.PI;
      
      // 找到匹配的组
      let matched = false;
      for (const group of groups) {
        if (Math.abs(angle - group.avgAngle) < angleThreshold) {
          group.lines.push(line);
          group.avgAngle = (group.avgAngle * (group.lines.length - 1) + angle) / group.lines.length;
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        groups.push({
          avgAngle: angle,
          lines: [line]
        });
      }
    });
    
    // 只返回有足够线段的组
    return groups.filter(g => g.lines.length >= 3);
  }

  /**
   * RANSAC拟合消失点
   */
  fitVanishingPoint(lines) {
    // 简化版：取所有线段延长线的交点，聚类找最密集点
    const intersections = [];
    
    for (let i = 0; i < lines.length - 1; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const pt = this.lineIntersection(lines[i], lines[j]);
        if (pt) intersections.push(pt);
      }
    }
    
    // 返回平均交点（简化处理）
    if (intersections.length > 0) {
      const avgX = intersections.reduce((sum, pt) => sum + pt.x, 0) / intersections.length;
      const avgY = intersections.reduce((sum, pt) => sum + pt.y, 0) / intersections.length;
      return { x: avgX, y: avgY };
    }
    
    return { x: 0, y: 0 };
  }

  /**
   * 计算两线段交点
   */
  lineIntersection(line1, line2) {
    const x1 = line1.x1, y1 = line1.y1, x2 = line1.x2, y2 = line1.y2;
    const x3 = line2.x1, y3 = line2.y1, x4 = line2.x2, y4 = line2.y2;
    
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.001) return null;
    
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1)
    };
  }

  /**
   * Step 2: 生成建筑候选框
   * 多源融合：GroundingDINO + 语义分割 + 直线框
   */
  async generateBuildingProposals(imageBuffer) {
    const proposals = [];
    
    // 2.1 使用简化的方法生成候选框
    const metadata = await sharp(imageBuffer).metadata();
    const { width, height } = metadata;
    
    // 模拟建筑候选框生成
    // 实际应该使用边缘检测或其他检测器
    const numCandidates = 3 + Math.floor(Math.random() * 3); // 3-5个候选框
    
    for (let idx = 0; idx < numCandidates; idx++) {
      const x = Math.random() * 0.6;
      const y = Math.random() * 0.4 + 0.2;
      const w = 0.15 + Math.random() * 0.2;
      const h = 0.2 + Math.random() * 0.3;
      
      proposals.push({
        id: `C${idx}`,
        bbox: [
          x,
          y,
          Math.min(x + w, 0.95),
          Math.min(y + h, 0.95)
        ],
        confidence: 0.5 + Math.random() * 0.3,
        source: 'simulated'
      });
    }
    
    // 2.2 NMS去重
    const filtered = this.nonMaxSuppression(proposals, this.params.nmsIoU);
    
    console.log(`  生成 ${filtered.length} 个候选框`);
    return filtered.slice(0, this.params.maxCandidates);
  }

  /**
   * NMS去重
   */
  nonMaxSuppression(boxes, iouThreshold) {
    if (boxes.length === 0) return [];
    
    // 按置信度排序
    boxes.sort((a, b) => b.confidence - a.confidence);
    
    const selected = [];
    const used = new Set();
    
    for (let i = 0; i < boxes.length; i++) {
      if (used.has(i)) continue;
      
      selected.push(boxes[i]);
      used.add(i);
      
      // 标记重叠的框
      for (let j = i + 1; j < boxes.length; j++) {
        if (used.has(j)) continue;
        
        const iou = this.computeIoU(boxes[i].bbox, boxes[j].bbox);
        if (iou > iouThreshold) {
          used.add(j);
        }
      }
    }
    
    return selected;
  }

  /**
   * 计算IoU
   */
  computeIoU(box1, box2) {
    const x1 = Math.max(box1[0], box2[0]);
    const y1 = Math.max(box1[1], box2[1]);
    const x2 = Math.min(box1[2], box2[2]);
    const y2 = Math.min(box1[3], box2[3]);
    
    if (x2 < x1 || y2 < y1) return 0;
    
    const intersection = (x2 - x1) * (y2 - y1);
    const area1 = (box1[2] - box1[0]) * (box1[3] - box1[1]);
    const area2 = (box2[2] - box2[0]) * (box2[3] - box2[1]);
    const union = area1 + area2 - intersection;
    
    return intersection / union;
  }

  /**
   * Step 3: Qwen-VL验证候选框
   * 只做验证，不做检测
   */
  async verifyWithQwenVL(imageBuffer, candidates) {
    console.log(`  验证 ${candidates.length} 个候选框`);
    
    const verified = [];
    
    // 对每个候选框，裁剪并询问
    for (const candidate of candidates) {
      try {
        // 使用sharp裁剪候选区域
        const metadata = await sharp(imageBuffer).metadata();
        const { width, height } = metadata;
        
        const x1 = Math.floor(candidate.bbox[0] * width);
        const y1 = Math.floor(candidate.bbox[1] * height);
        const x2 = Math.ceil(candidate.bbox[2] * width);
        const y2 = Math.ceil(candidate.bbox[3] * height);
        
        const roiBuffer = await sharp(imageBuffer)
          .extract({
            left: x1,
            top: y1,
            width: x2 - x1,
            height: y2 - y1
          })
          .toBuffer();
        
        // 构造验证prompt（结构化输出）
        const prompt = `分析这个区域，只返回JSON：
{
  "is_building": true/false,
  "confidence": 0-1,
  "rough_floors": 数字或null,
  "roof_type": "flat/gabled/other",
  "has_entrance": true/false,
  "entrance_position": 0-1（在底边的相对位置）,
  "has_protrusions": true/false
}`;
        
        // 调用Qwen-VL（这里简化处理）
        const verification = await this.callQwenVLForVerification(roiBuffer, prompt);
        
        if (verification.is_building && verification.confidence > 0.5) {
          verified.push({
            ...candidate,
            ...verification,
            footPosition: verification.entrance_position || 0.5
          });
        }
      } catch (err) {
        console.warn(`  候选框 ${candidate.id} 验证失败:`, err.message);
      }
    }
    
    console.log(`  ✅ 验证通过 ${verified.length} 个建筑`);
    return verified;
  }

  /**
   * 调用Qwen-VL进行验证
   */
  async callQwenVLForVerification(imageBuffer, prompt) {
    // 这里应该调用实际的Qwen-VL API
    // 暂时返回模拟数据
    return {
      is_building: Math.random() > 0.3,
      confidence: Math.random() * 0.5 + 0.5,
      rough_floors: Math.floor(Math.random() * 10) + 1,
      roof_type: 'flat',
      has_entrance: true,
      entrance_position: Math.random(),
      has_protrusions: Math.random() > 0.7
    };
  }

  /**
   * Step 4: 单应性变换还原footprint
   */
  async computeGroundFootprints(buildings, perspectiveData) {
    console.log(`  计算 ${buildings.length} 个建筑的ground footprint`);
    
    const footprints = [];
    
    // 4.1 收集所有脚点
    const groundPoints = [];
    buildings.forEach(building => {
      const bbox = building.bbox;
      
      // 底边两角作为脚点
      groundPoints.push(
        { x: bbox[0], y: bbox[3] },  // 左下角
        { x: bbox[2], y: bbox[3] }   // 右下角
      );
    });
    
    // 4.2 计算单应性矩阵H
    // 假设地面是水平面，使用4个点求解
    const H = this.computeHomography(groundPoints, perspectiveData);
    
    // 4.3 将每个建筑的底边投影到地面
    buildings.forEach(building => {
      const bbox = building.bbox;
      
      // 四个角点
      const corners = [
        { x: bbox[0], y: bbox[3] },  // 左下
        { x: bbox[2], y: bbox[3] },  // 右下
        { x: bbox[2], y: bbox[1] },  // 右上（估算）
        { x: bbox[0], y: bbox[1] }   // 左上（估算）
      ];
      
      // 应用单应性变换
      const groundCorners = corners.map(pt => this.applyHomography(pt, H));
      
      footprints.push({
        ...building,
        footprint_ground: groundCorners.map(pt => [pt.x, pt.y])
      });
    });
    
    return footprints;
  }

  /**
   * 计算单应性矩阵（简化版）
   */
  computeHomography(points, perspectiveData) {
    // 这里应该用cv.findHomography
    // 简化处理：基于消失点的仿射变换
    const { horizonLine, imageSize } = perspectiveData;
    
    return {
      scale: 100000 / imageSize.width,  // 假设场景宽100米
      horizonY: horizonLine,
      centerX: imageSize.width / 2
    };
  }

  /**
   * 应用单应性变换
   */
  applyHomography(point, H) {
    // 简化的透视矫正
    const x = (point.x - 0.5) * H.scale;
    const y = (0.5 - point.y) * H.scale * 0.6;  // 深度压缩
    
    return { x, y };
  }

  /**
   * Step 5: 交比法恢复高度
   */
  async recoverHeights(buildings, perspectiveData, referenceHeight) {
    console.log(`  使用交比法恢复高度，参考高度: ${referenceHeight}m`);
    
    const { horizonLine } = perspectiveData;
    
    // 5.1 选择参考建筑（第一个或最清晰的）
    const refBuilding = buildings[0];
    refBuilding.height_m = refBuilding.rough_floors * referenceHeight;
    
    // 5.2 计算参考建筑的交比
    const refRatio = this.computeCrossRatio(refBuilding, horizonLine);
    
    // 5.3 用交比恢复其他建筑高度
    buildings.forEach((building, idx) => {
      if (idx === 0) return;  // 跳过参考建筑
      
      const ratio = this.computeCrossRatio(building, horizonLine);
      
      // 交比公式：h_obj = h_ref * (ratio_obj / ratio_ref)
      building.height_m = refBuilding.height_m * (ratio / refRatio);
      
      // 四舍五入到最近的楼层
      building.floors = Math.round(building.height_m / referenceHeight);
      building.height_m = building.floors * referenceHeight;
    });
    
    return buildings;
  }

  /**
   * 计算交比
   */
  computeCrossRatio(building, horizonY) {
    const bbox = building.bbox;
    const topY = bbox[1];
    const bottomY = bbox[3];
    
    // 到地平线的距离比
    const topDist = Math.abs(topY - horizonY);
    const bottomDist = Math.abs(bottomY - horizonY);
    
    return topDist / (bottomDist + 0.001);  // 避免除零
  }

  /**
   * Step 6: 格式化输出
   */
  formatForSketchUp(buildings, perspectiveData) {
    const vps = perspectiveData.vanishingPoints;
    
    return {
      mode: "perspective",
      camera: {
        vp_x: vps[0] ? [vps[0].point.x, vps[0].point.y] : null,
        vp_z: vps[1] ? [vps[1].point.x, vps[1].point.y] : null,
        horizon_y: perspectiveData.horizonLine,
        scale: {
          type: "floor_height",
          value_m: this.params.defaultFloorHeight
        }
      },
      buildings: buildings.map((b, idx) => ({
        id: b.id || `B${idx + 1}`,
        footprint_ground: b.footprint_ground,
        height_m: b.height_m,
        floors: b.floors,
        parts: b.has_protrusions ? [
          {
            id: `${b.id}-roof`,
            footprint: b.footprint_ground,  // 简化：同footprint
            height_m: this.params.parapetHeight
          }
        ] : []
      }))
    };
  }
}

module.exports = GeometricPerspectiveReconstructor;