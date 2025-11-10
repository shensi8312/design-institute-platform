/**
 * 深度估计服务
 * 从建筑立面图估计2.5D深度信息，生成结构化点云
 * 
 * 架构设计：
 * 1. 使用深度学习模型（Depth Anything V2）估计深度图
 * 2. 应用建筑立面先验知识优化深度
 * 3. 生成结构化点云（不是密集点云）
 * 4. 为vLLM推理提供几何约束
 */

const axios = require('axios');
const sharp = require('sharp');

class DepthEstimationService {
  constructor() {
    // 深度估计服务配置
    this.config = {
      // Depth Anything服务（需要单独部署）
      depthAnything: {
        endpoint: process.env.DEPTH_ESTIMATION_ENDPOINT || 'http://localhost:8087/estimate',
        timeout: 30000
      },
      // 建筑立面深度先验
      facadeDepthPriors: {
        mainWall: 0,          // 主立面深度（基准）
        windowRecess: -500,   // 窗户内凹深度（mm）
        balconyProtrusion: 800, // 阳台外凸深度（mm）
        entranceRecess: -300, // 入口内凹深度（mm）
        roofOverhang: 600,    // 屋檐外凸深度（mm）
        decorativeElements: 200 // 装饰线条深度（mm）
      }
    };
    
    // 建筑规则库
    this.architecturalRules = {
      // 标准层高范围（mm）
      floorHeights: {
        residential: { min: 2800, max: 3300, default: 3000 },
        office: { min: 3300, max: 4200, default: 3600 },
        commercial: { min: 4500, max: 5500, default: 5000 },
        industrial: { min: 6000, max: 12000, default: 8000 }
      },
      // 窗户网格对齐
      windowGrid: {
        horizontalSpacing: 3000,  // 水平间距（mm）
        verticalAlignment: true,  // 垂直对齐
        sillHeight: 900,          // 窗台高度（mm）
        headerHeight: 2400        // 窗头高度（mm）
      }
    };
  }

  /**
   * 主处理方法：图像 → 深度图 → 结构化点云
   */
  async processImage(imageBuffer, semanticData = {}) {
    console.log('\n🌊 ========== 深度估计处理 ==========');
    
    try {
      // 获取深度估计服务的完整响应
      console.log('1️⃣ 调用深度估计服务...');
      const depthResult = await this.estimateDepth(imageBuffer);
      
      console.log('✅ 深度估计完成');
      console.log('   - 深度层次:', depthResult.depth_layers?.length || 0);
      console.log('   - 点云点数:', depthResult.point_cloud?.length || 0);
      console.log('   - 检测模式:', Object.keys(depthResult.patterns || {}));
      
      // 重要：添加depth_map.data字段，插件需要这个字段
      if (!depthResult.depth_map) {
        depthResult.depth_map = {};
      }
      
      // 为插件生成必需的data字段
      depthResult.depth_map.data = depthResult.depth_layers || [];
      
      // 转换为我们的格式
      return {
        success: true,
        enabled: true,
        depth_map: depthResult.depth_map,  // 包含data字段
        pointCloud: {
          points: depthResult.point_cloud || [],
          semantics: [],
          structures: depthResult.patterns?.floor_lines || []
        },
        features: {
          depthLayers: depthResult.depth_layers || [],
          mainFacade: {
            plane: { a: 0, b: 0, c: 1, d: 0 },
            width: depthResult.depth_map?.width || 512,
            height: depthResult.depth_map?.height || 512
          },
          patterns: {
            windowGrid: depthResult.patterns?.grid || null,
            floorPattern: depthResult.patterns?.floors || null
          },
          volumetric: {
            baseArea: 4096000,
            protrusionRatio: 1,
            symmetry: depthResult.patterns?.symmetry || { isSymmetric: false, axis: null, confidence: 0 }
          }
        },
        confidence: depthResult.confidence || 0.8
      };
      
    } catch (error) {
      console.error('❌ 深度估计失败:', error.message);
      console.error('   错误详情:', error.response?.data || error);
      // 不降级，直接抛出错误让上层处理！
      throw new Error(`深度估计服务错误: ${error.message}`);
    }
  }

  /**
   * 调用深度估计模型
   */
  async estimateDepth(imageBuffer) {
    // 调用真实的深度估计服务 - 不降级！
    const axios = require('axios');
    
    // 将Buffer转为base64
    const base64Image = imageBuffer.toString('base64');
    
    console.log('   调用深度估计服务...');
    console.log('   - 图片大小:', imageBuffer.length, '字节');
    console.log('   - Base64长度:', base64Image.length, '字符');
    
    const response = await axios.post(
      this.config.depthAnything.endpoint,
      {
        image_base64: base64Image,
        is_facade: true,
        depth_levels: 5,
        include_raw: false  // 不需要原始深度图，只要结构化数据
      },
      {
        timeout: this.config.depthAnything.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.data.success) {
      console.error('   ❌ 深度估计失败:', response.data.error);
      throw new Error(`深度估计失败: ${response.data.error}`);
    }
    
    console.log('   ✅ 深度估计成功');
    console.log('   - 返回数据:', Object.keys(response.data));
    
    // 深度估计服务返回的是完整的结构化数据，不需要原始depth_map
    // 直接返回整个响应，包含depth_layers, point_cloud, patterns等
    return response.data;
  }

  /**
   * 模拟深度估计（用于测试）
   */
  simulateDepthEstimation(imageBuffer) {
    // 创建一个简单的深度图
    // 实际应该通过深度学习模型生成
    const width = 512;
    const height = 512;
    const depthMap = [];
    
    for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < width; x++) {
        // 简单的深度模拟：中心深，边缘浅
        const centerX = width / 2;
        const centerY = height / 2;
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        const maxDistance = Math.sqrt(centerX ** 2 + centerY ** 2);
        const depth = 1.0 - (distance / maxDistance) * 0.3;
        row.push(depth);
      }
      depthMap.push(row);
    }
    
    return depthMap;
  }

  /**
   * 应用建筑立面约束优化深度
   */
  applyFacadeConstraints(rawDepthMap, semanticData) {
    const constrainedDepth = JSON.parse(JSON.stringify(rawDepthMap));
    
    // 1. 主墙面对齐
    this.alignMainWallPlane(constrainedDepth);
    
    // 2. 窗户统一深度
    if (semanticData.objects) {
      semanticData.objects.forEach(obj => {
        if (obj.class === 'window' || obj.chinese_name === '窗户') {
          this.applyUniformDepth(
            constrainedDepth, 
            obj.bbox, 
            this.config.facadeDepthPriors.windowRecess
          );
        } else if (obj.class === 'balcony' || obj.chinese_name === '阳台') {
          this.applyUniformDepth(
            constrainedDepth,
            obj.bbox,
            this.config.facadeDepthPriors.balconyProtrusion
          );
        }
      });
    }
    
    // 3. 楼层线水平对齐
    this.alignFloorLines(constrainedDepth, semanticData);
    
    return constrainedDepth;
  }

  /**
   * 生成结构化点云（关键点而非密集点云）
   */
  generateStructuredPointCloud(depthMap, semanticData) {
    const pointCloud = {
      points: [],
      semantics: [],
      structures: []
    };
    
    // 1. 提取墙面角点
    const wallCorners = this.extractWallCorners(depthMap);
    wallCorners.forEach(corner => {
      pointCloud.points.push({
        x: corner.x,
        y: corner.y,
        z: corner.depth * 1000, // 转换为mm
        type: 'wall_corner',
        confidence: 0.9
      });
    });
    
    // 2. 提取窗户关键点
    if (semanticData.objects) {
      semanticData.objects.forEach(obj => {
        if (obj.class === 'window') {
          const windowPoints = this.extractWindowKeyPoints(obj, depthMap);
          windowPoints.forEach(pt => {
            pointCloud.points.push({
              ...pt,
              type: 'window',
              id: obj.id
            });
          });
        }
      });
    }
    
    // 3. 提取楼层分割线
    const floorLines = this.extractFloorLines(depthMap, semanticData);
    pointCloud.structures.push(...floorLines);
    
    return pointCloud;
  }

  /**
   * 提取几何特征供vLLM使用
   */
  extractGeometricFeatures(pointCloud) {
    return {
      // 深度层次统计
      depthLayers: this.analyzeDepthLayers(pointCloud),
      
      // 主立面参数
      mainFacade: {
        plane: this.fitMainPlane(pointCloud),
        width: this.estimateWidth(pointCloud),
        height: this.estimateHeight(pointCloud)
      },
      
      // 重复模式（窗户网格等）
      patterns: {
        windowGrid: this.detectWindowGrid(pointCloud),
        floorPattern: this.detectFloorPattern(pointCloud)
      },
      
      // 建筑体量关系
      volumetric: {
        baseArea: this.calculateBaseArea(pointCloud),
        protrusionRatio: this.calculateProtrusionRatio(pointCloud),
        symmetry: this.detectSymmetry(pointCloud)
      }
    };
  }

  /**
   * 分析深度层次
   */
  analyzeDepthLayers(pointCloud) {
    const depthHistogram = {};
    
    pointCloud.points.forEach(pt => {
      const depth = Math.round(pt.z / 100) * 100; // 四舍五入到100mm
      depthHistogram[depth] = (depthHistogram[depth] || 0) + 1;
    });
    
    // 找出主要深度层
    const layers = Object.entries(depthHistogram)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([depth, count]) => ({
        depth: parseInt(depth),
        count: count,
        percentage: count / pointCloud.points.length
      }));
    
    return layers;
  }

  /**
   * 检测窗户网格模式
   */
  detectWindowGrid(pointCloud) {
    const windowPoints = pointCloud.points.filter(pt => pt.type === 'window');
    
    if (windowPoints.length < 4) return null;
    
    // 分析水平和垂直间距
    const xPositions = [...new Set(windowPoints.map(pt => pt.x))].sort();
    const yPositions = [...new Set(windowPoints.map(pt => pt.y))].sort();
    
    // 计算间距
    const horizontalSpacings = [];
    for (let i = 1; i < xPositions.length; i++) {
      horizontalSpacings.push(xPositions[i] - xPositions[i-1]);
    }
    
    const verticalSpacings = [];
    for (let i = 1; i < yPositions.length; i++) {
      verticalSpacings.push(yPositions[i] - yPositions[i-1]);
    }
    
    return {
      columns: xPositions.length,
      rows: yPositions.length,
      avgHorizontalSpacing: horizontalSpacings.reduce((a,b) => a+b, 0) / horizontalSpacings.length || 0,
      avgVerticalSpacing: verticalSpacings.reduce((a,b) => a+b, 0) / verticalSpacings.length || 0,
      isRegular: this.checkGridRegularity(horizontalSpacings, verticalSpacings)
    };
  }

  /**
   * 检测楼层模式
   */
  detectFloorPattern(pointCloud) {
    const floorLines = pointCloud.structures.filter(s => s.type === 'floor_line');
    
    if (floorLines.length < 2) return null;
    
    const heights = floorLines.map(line => line.y).sort();
    const floorHeights = [];
    
    for (let i = 1; i < heights.length; i++) {
      floorHeights.push(heights[i] - heights[i-1]);
    }
    
    const avgFloorHeight = floorHeights.reduce((a,b) => a+b, 0) / floorHeights.length || 3000;
    const isUniform = floorHeights.every(h => Math.abs(h - avgFloorHeight) < 200);
    
    return {
      floorCount: heights.length,
      avgFloorHeight: avgFloorHeight,
      isUniform: isUniform,
      totalHeight: heights[heights.length - 1] - heights[0]
    };
  }

  /**
   * 辅助方法：对齐主墙面
   */
  alignMainWallPlane(depthMap) {
    // 使用RANSAC拟合主平面
    // 这里简化处理：将大部分点对齐到同一深度
    const baseDepth = 0.5;
    
    for (let y = 0; y < depthMap.length; y++) {
      for (let x = 0; x < depthMap[y].length; x++) {
        // 保持一定的深度变化，但对齐主体
        if (Math.abs(depthMap[y][x] - baseDepth) < 0.2) {
          depthMap[y][x] = baseDepth;
        }
      }
    }
  }

  /**
   * 应用统一深度到指定区域
   */
  applyUniformDepth(depthMap, bbox, depth) {
    if (!bbox) return;
    
    const [x1, y1, x2, y2] = bbox;
    const normalizedDepth = 0.5 + depth / 10000; // 标准化深度值
    
    for (let y = y1; y < y2 && y < depthMap.length; y++) {
      for (let x = x1; x < x2 && x < depthMap[y].length; x++) {
        depthMap[y][x] = normalizedDepth;
      }
    }
  }

  /**
   * 提取墙面角点
   */
  extractWallCorners(depthMap) {
    // 简化版：提取图像四角作为墙面角点
    const height = depthMap.length;
    const width = depthMap[0].length;
    
    return [
      { x: 0, y: 0, depth: depthMap[0][0] },
      { x: width, y: 0, depth: depthMap[0][width-1] },
      { x: width, y: height, depth: depthMap[height-1][width-1] },
      { x: 0, y: height, depth: depthMap[height-1][0] }
    ];
  }

  /**
   * 提取窗户关键点
   */
  extractWindowKeyPoints(window, depthMap) {
    const [x1, y1, x2, y2] = window.bbox || [0, 0, 100, 100];
    const depth = this.config.facadeDepthPriors.windowRecess / 1000;
    
    return [
      { x: x1, y: y1, z: depth },
      { x: x2, y: y1, z: depth },
      { x: x2, y: y2, z: depth },
      { x: x1, y: y2, z: depth }
    ];
  }

  /**
   * 提取楼层线
   */
  extractFloorLines(depthMap, semanticData) {
    const lines = [];
    const floorCount = semanticData.floors || 1;
    const buildingHeight = depthMap.length;
    const floorHeight = buildingHeight / floorCount;
    
    for (let i = 1; i < floorCount; i++) {
      lines.push({
        type: 'floor_line',
        y: i * floorHeight,
        confidence: 0.8
      });
    }
    
    return lines;
  }

  /**
   * 计算置信度
   */
  calculateConfidence(pointCloud) {
    let confidence = 0.5;
    
    // 点数量
    if (pointCloud.points.length > 20) confidence += 0.1;
    if (pointCloud.points.length > 50) confidence += 0.1;
    
    // 结构检测
    if (pointCloud.structures.length > 0) confidence += 0.15;
    
    // 语义标注
    const hasSemantics = pointCloud.points.some(pt => pt.type);
    if (hasSemantics) confidence += 0.15;
    
    return Math.min(confidence, 0.95);
  }

  /**
   * 返回默认深度信息
   */
  getDefaultDepth(semanticData) {
    return {
      success: false,
      depthMap: null,
      pointCloud: {
        points: [],
        semantics: [],
        structures: []
      },
      features: {
        depthLayers: [
          { depth: 0, count: 1, percentage: 0.7 },
          { depth: -500, count: 1, percentage: 0.2 },
          { depth: 800, count: 1, percentage: 0.1 }
        ],
        mainFacade: {
          width: 12000,
          height: 9000
        },
        patterns: {
          windowGrid: { columns: 4, rows: 3, isRegular: true },
          floorPattern: { floorCount: 3, avgFloorHeight: 3000, isUniform: true }
        }
      },
      confidence: 0.3
    };
  }

  /**
   * 辅助方法
   */
  alignFloorLines(depthMap, semanticData) {
    // 检测并对齐水平楼层线
    // 简化实现
  }

  checkGridRegularity(horizontalSpacings, verticalSpacings) {
    if (horizontalSpacings.length === 0 || verticalSpacings.length === 0) return false;
    
    const hAvg = horizontalSpacings.reduce((a,b) => a+b, 0) / horizontalSpacings.length;
    const vAvg = verticalSpacings.reduce((a,b) => a+b, 0) / verticalSpacings.length;
    
    const hRegular = horizontalSpacings.every(s => Math.abs(s - hAvg) < hAvg * 0.2);
    const vRegular = verticalSpacings.every(s => Math.abs(s - vAvg) < vAvg * 0.2);
    
    return hRegular && vRegular;
  }

  fitMainPlane(pointCloud) {
    // RANSAC平面拟合
    // 简化返回
    return { a: 0, b: 0, c: 1, d: 0 };
  }

  estimateWidth(pointCloud) {
    const xValues = pointCloud.points.map(pt => pt.x);
    return Math.max(...xValues) - Math.min(...xValues);
  }

  estimateHeight(pointCloud) {
    const yValues = pointCloud.points.map(pt => pt.y);
    return Math.max(...yValues) - Math.min(...yValues);
  }

  calculateBaseArea(pointCloud) {
    // 简化计算
    return this.estimateWidth(pointCloud) * 8000; // 假设深度8米
  }

  calculateProtrusionRatio(pointCloud) {
    // 计算凸出部分占比
    const depths = pointCloud.points.map(pt => pt.z);
    const positive = depths.filter(d => d > 0).length;
    return positive / depths.length;
  }

  detectSymmetry(pointCloud) {
    // 检测对称性
    // 简化返回
    return { isSymmetric: true, axis: 'vertical', confidence: 0.8 };
  }
}

module.exports = new DepthEstimationService();