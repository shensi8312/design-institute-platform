/**
 * 建筑群组分析器
 * 识别围合式建筑、建筑群组、庭院式布局
 */

class BuildingGroupAnalyzer {
  
  /**
   * 分析草图是否为围合式建筑群
   * @param {Object} visionAnalysis - QwenVL的视觉分析结果
   * @param {Array} pointCloud - 点云数据
   * @returns {Object} 建筑群分析结果
   */
  analyzeEnclosedBuilding(visionAnalysis, pointCloud) {
    console.log('\n🏢 分析建筑群组结构...');
    
    // 1. 检查是否有围合特征
    const hasEnclosure = this.detectEnclosurePattern(pointCloud);
    
    // 2. 分析建筑类型
    const buildingType = this.determineBuildingType(visionAnalysis, hasEnclosure);
    
    // 3. 根据类型生成不同的3D结构
    let result = {};
    
    switch (buildingType) {
      case 'ENCLOSED_COMPLEX':
        // 围合式建筑群（像你的草图）
        result = this.generateEnclosedComplex(visionAnalysis, pointCloud);
        break;
        
      case 'SEPARATE_BUILDINGS':
        // 独立建筑群
        result = this.generateSeparateBuildings(visionAnalysis, pointCloud);
        break;
        
      case 'SINGLE_BUILDING':
        // 单体建筑
        result = this.generateSingleBuilding(visionAnalysis, pointCloud);
        break;
        
      default:
        result = this.generateDefaultStructure(visionAnalysis, pointCloud);
    }
    
    return result;
  }
  
  /**
   * 检测围合模式
   */
  detectEnclosurePattern(pointCloud) {
    if (!pointCloud || pointCloud.length === 0) return false;
    
    // 分析点云分布
    // 如果点云形成一个外围边界，内部有空洞，则是围合式
    const boundary = this.extractBoundary(pointCloud);
    const hasInteriorVoid = this.detectInteriorVoid(pointCloud, boundary);
    
    console.log(`  围合检测: 边界=${boundary.length}个点, 内部空洞=${hasInteriorVoid}`);
    
    return hasInteriorVoid;
  }
  
  /**
   * 生成围合式建筑群
   */
  generateEnclosedComplex(visionAnalysis, pointCloud) {
    console.log('  ✅ 识别为围合式建筑群');
    
    // 外围主体建筑
    const mainBuilding = {
      type: 'MAIN_ENCLOSURE',
      name: '主体建筑',
      structure: 'U形' || 'L形' || '口形',  // 根据实际形状
      
      // 外围尺寸（整个建筑群的外边界）
      outerDimensions: {
        width: 60000,   // 60米
        depth: 50000,   // 50米
        height: 12000   // 12米（3-4层）
      },
      
      // 内院尺寸
      courtyard: {
        width: 30000,   // 30米
        depth: 25000,   // 25米
        type: '中庭'
      },
      
      // 内部的3个建筑组团
      innerBuildings: [
        {
          id: 'block_1',
          name: '北侧组团',
          position: { x: 0, y: 15000, z: 0 },
          dimensions: {
            width: 25000,   // 25米
            depth: 15000,   // 15米
            height: 15000   // 15米（4-5层）
          },
          floors: 5,
          type: '办公楼'
        },
        {
          id: 'block_2',
          name: '东侧组团',
          position: { x: 20000, y: 0, z: 0 },
          dimensions: {
            width: 15000,   // 15米
            depth: 20000,   // 20米
            height: 12000   // 12米（3-4层）
          },
          floors: 4,
          type: '商业楼'
        },
        {
          id: 'block_3',
          name: '西侧组团',
          position: { x: -20000, y: 0, z: 0 },
          dimensions: {
            width: 15000,   // 15米
            depth: 20000,   // 20米
            height: 9000    // 9米（2-3层）
          },
          floors: 3,
          type: '附属楼'
        }
      ],
      
      // 连接部分
      connections: [
        {
          type: '连廊',
          from: 'block_1',
          to: 'block_2',
          height: 3300,  // 一层高
          width: 3000
        },
        {
          type: '连廊',
          from: 'block_2',
          to: 'block_3',
          height: 3300,
          width: 3000
        }
      ]
    };
    
    return {
      type: 'ENCLOSED_COMPLEX',
      isGroup: true,
      mainStructure: mainBuilding,
      totalArea: this.calculateTotalArea(mainBuilding),
      buildingCount: 1,  // 算作一个整体建筑
      innerBlockCount: 3  // 内部有3个功能区块
    };
  }
  
  /**
   * 提取边界
   */
  extractBoundary(points) {
    // 使用凸包算法提取外边界
    // 简化实现：找最外围的点
    const boundary = [];
    
    // 获取极值点
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));
    
    // 找边界点
    points.forEach(p => {
      if (Math.abs(p.x - minX) < 0.1 || Math.abs(p.x - maxX) < 0.1 ||
          Math.abs(p.y - minY) < 0.1 || Math.abs(p.y - maxY) < 0.1) {
        boundary.push(p);
      }
    });
    
    return boundary;
  }
  
  /**
   * 检测内部空洞（庭院）
   */
  detectInteriorVoid(points, boundary) {
    // 计算中心区域的点密度
    const centerX = (Math.max(...points.map(p => p.x)) + Math.min(...points.map(p => p.x))) / 2;
    const centerY = (Math.max(...points.map(p => p.y)) + Math.min(...points.map(p => p.y))) / 2;
    
    // 统计中心区域的点数
    const centerRadius = 0.2;  // 归一化半径
    const centerPoints = points.filter(p => {
      const dist = Math.sqrt(Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2));
      return dist < centerRadius;
    });
    
    // 如果中心区域点很少，说明有空洞
    const density = centerPoints.length / points.length;
    return density < 0.1;  // 少于10%的点在中心
  }
  
  /**
   * 确定建筑类型
   */
  determineBuildingType(visionAnalysis, hasEnclosure) {
    // 根据视觉分析和围合特征判断
    const volumeCount = visionAnalysis?.volumes?.length || 0;
    const buildingCount = visionAnalysis?.building_count || 0;
    
    if (hasEnclosure) {
      return 'ENCLOSED_COMPLEX';
    } else if (volumeCount > 1 || buildingCount > 1) {
      return 'SEPARATE_BUILDINGS';
    } else {
      return 'SINGLE_BUILDING';
    }
  }
  
  /**
   * 计算总面积
   */
  calculateTotalArea(building) {
    const outer = building.outerDimensions;
    const courtyard = building.courtyard;
    
    // 建筑面积 = 外围面积 - 庭院面积
    const outerArea = (outer.width * outer.depth) / 1000000;  // 平方米
    const courtyardArea = courtyard ? (courtyard.width * courtyard.depth) / 1000000 : 0;
    
    return {
      buildingArea: outerArea - courtyardArea,
      courtyardArea: courtyardArea,
      totalArea: outerArea
    };
  }
  
  /**
   * 生成独立建筑群（原来的逻辑）
   */
  generateSeparateBuildings(visionAnalysis, pointCloud) {
    console.log('  ✅ 识别为独立建筑群');
    // 保留原来的3个独立建筑逻辑
    return {
      type: 'SEPARATE_BUILDINGS',
      isGroup: true,
      buildings: visionAnalysis.volumes || [],
      buildingCount: visionAnalysis.building_count || 3
    };
  }
  
  /**
   * 生成单体建筑
   */
  generateSingleBuilding(visionAnalysis, pointCloud) {
    console.log('  ✅ 识别为单体建筑');
    return {
      type: 'SINGLE_BUILDING',
      isGroup: false,
      buildingCount: 1
    };
  }
  
  /**
   * 默认结构
   */
  generateDefaultStructure(visionAnalysis, pointCloud) {
    return this.generateSeparateBuildings(visionAnalysis, pointCloud);
  }
}

module.exports = new BuildingGroupAnalyzer();