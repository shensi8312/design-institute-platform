/**
 * 完整的视觉-点云融合测试
 * 展示如何综合考虑QwenVL、点云、透视、阴影等所有因素
 */

const fs = require('fs');
const path = require('path');

// 引入所有相关服务
const VisionPointCloudFusion = require('./src/services/VisionPointCloudFusion');
const Building3DReconstructor = require('./src/services/Building3DReconstructor');
const PointCloudTransformer = require('./src/services/PointCloudTransformerService');

console.log('='.repeat(60));
console.log('完整的建筑3D重构流程测试');
console.log('='.repeat(60));

/**
 * 模拟完整的处理流程
 */
async function testCompleteFusion() {
  console.log('\n📝 测试场景：docs/test1.jpg - 三幢建筑群透视图');
  console.log('目标：展示QwenVL和点云如何相互作用，考虑透视、阴影、缩放等因素\n');
  
  // ========== 第1步：QwenVL视觉分析 ==========
  console.log('━'.repeat(50));
  console.log('📸 第1步：QwenVL视觉语义分析');
  console.log('━'.repeat(50));
  
  const qwenVLResult = {
    image: 'docs/test1.jpg',
    view_type: 'perspective',  // 透视图
    
    // 识别的建筑
    buildings: [
      {
        id: 'v1',
        type: 'high_rise',
        position_pixels: { x: 150, y: 200 },
        width_pixels: 120,
        height_pixels: 280,
        depth_pixels: 80,  // 透视深度
        floors: 20,
        confidence: 0.92,
        
        // 透视信息
        perspective_distortion: 0.15,
        vanishing_lines: [
          { start: { x: 150, y: 200 }, end: { x: 400, y: 150 } },
          { start: { x: 270, y: 200 }, end: { x: 400, y: 150 } }
        ],
        
        // 材质和颜色
        material: 'glass_curtain_wall',
        color: '#4A90E2',
        
        // 阴影信息
        shadow: {
          visible: true,
          length_pixels: 60,
          direction: { x: 1, y: -0.5 }
        }
      },
      {
        id: 'v2',
        type: 'mid_rise',
        position_pixels: { x: 350, y: 250 },
        width_pixels: 100,
        height_pixels: 200,
        depth_pixels: 70,
        floors: 15,
        confidence: 0.88,
        perspective_distortion: 0.12,
        material: 'concrete',
        color: '#B0B0B0',
        shadow: {
          visible: true,
          length_pixels: 45,
          direction: { x: 1, y: -0.5 }
        }
      },
      {
        id: 'v3',
        type: 'low_rise',
        position_pixels: { x: 500, y: 300 },
        width_pixels: 80,
        height_pixels: 120,
        depth_pixels: 60,
        floors: 10,
        confidence: 0.85,
        perspective_distortion: 0.08,
        material: 'brick',
        color: '#8B4513',
        shadow: {
          visible: true,
          length_pixels: 30,
          direction: { x: 1, y: -0.5 }
        }
      }
    ],
    
    // 场景信息
    scene: {
      lighting: 'afternoon',
      weather: 'sunny',
      shadows_visible: true,
      horizon_line: { y: 180 },
      vanishing_point: { x: 400, y: 150 }
    }
  };
  
  console.log('✅ QwenVL识别结果：');
  console.log(`  - 建筑数量: ${qwenVLResult.buildings.length}`);
  console.log(`  - 视图类型: ${qwenVLResult.view_type}`);
  console.log(`  - 光照条件: ${qwenVLResult.scene.lighting}`);
  qwenVLResult.buildings.forEach(b => {
    console.log(`  - ${b.id}: ${b.type}, ${b.floors}层, 材质:${b.material}`);
  });
  
  // ========== 第2步：点云生成与聚类 ==========
  console.log('\n' + '━'.repeat(50));
  console.log('🔵 第2步：深度估计与点云生成');
  console.log('━'.repeat(50));
  
  // 生成考虑透视的点云
  const pointCloud = generatePerspectiveAwarePointCloud(qwenVLResult);
  console.log(`✅ 生成${pointCloud.length}个点，考虑了透视畸变`);
  
  // 自适应聚类
  const clusters = PointCloudTransformer.dbscanClustering(pointCloud);
  const clusterCount = Array.isArray(clusters[0]) ? clusters.length : 
                       new Set(clusters.filter(l => l >= 0)).size;
  console.log(`✅ 点云聚类识别: ${clusterCount}个建筑`);
  
  // ========== 第3步：透视和阴影分析 ==========
  console.log('\n' + '━'.repeat(50));
  console.log('🔍 第3步：透视关系和阴影分析');
  console.log('━'.repeat(50));
  
  const imageInfo = {
    width: 800,
    height: 600,
    focalLength: 35,
    sensorSize: 36
  };
  
  // 分析透视
  const perspectiveAnalysis = analyzePerspectiveRelations(qwenVLResult, imageInfo);
  console.log('📐 透视分析：');
  console.log(`  - 消失点: (${perspectiveAnalysis.vanishingPoint.x}, ${perspectiveAnalysis.vanishingPoint.y})`);
  console.log(`  - 视角: ${perspectiveAnalysis.viewAngle}°`);
  console.log(`  - 相机高度估计: ${perspectiveAnalysis.cameraHeight}m`);
  
  // 分析阴影
  const shadowAnalysis = analyzeShadowInformation(qwenVLResult);
  console.log('☀️ 阴影分析：');
  console.log(`  - 太阳角度: ${shadowAnalysis.sunAngle}°`);
  console.log(`  - 阴影方向: (${shadowAnalysis.direction.x}, ${shadowAnalysis.direction.y})`);
  console.log(`  - 时间估计: ${shadowAnalysis.timeOfDay}`);
  
  // ========== 第4步：深度融合重构 ==========
  console.log('\n' + '━'.repeat(50));
  console.log('🔮 第4步：视觉-点云深度融合');
  console.log('━'.repeat(50));
  
  // 执行融合
  const fusedBuildings = await VisionPointCloudFusion.fusionReconstruct(
    qwenVLResult,
    pointCloud,
    imageInfo
  );
  
  console.log(`\n✅ 融合重构完成: ${fusedBuildings.length}个建筑`);
  
  // ========== 第5步：生成完整3D结构 ==========
  console.log('\n' + '━'.repeat(50));
  console.log('🏗️ 第5步：生成完整3D结构（套娃式）');
  console.log('━'.repeat(50));
  
  // 重构3D建筑
  const buildings3D = Building3DReconstructor.reconstructFromClusters(
    Array.isArray(clusters[0]) ? clusters : [pointCloud]
  );
  
  console.log(`\n✅ 3D结构生成完成:`);
  buildings3D.forEach((b, idx) => {
    console.log(`\n建筑 ${idx + 1} - ${b.type}:`);
    console.log(`  📏 尺寸: ${b.geometry.dimensions.width.toFixed(1)} × ${b.geometry.dimensions.depth.toFixed(1)} × ${b.geometry.dimensions.height.toFixed(1)}m`);
    console.log(`  🏢 楼层: ${b.floorCount}层，层高${b.floorHeight}m`);
    console.log(`  🏠 内部: ${b.internal.rooms.length}个房间，${b.internal.corridors.length}条走廊`);
    console.log(`  🪟 立面: ${b.facade.windows.length}个窗户，${b.facade.doors.length}个门`);
    console.log(`  🏗️ 结构: ${b.structure.columns.length}根柱子，${b.structure.type}结构体系`);
    console.log(`  📊 参数:`);
    console.log(`     - 总建筑面积: ${b.parameters.grossFloorArea.toFixed(0)}㎡`);
    console.log(`     - 建筑占地: ${b.parameters.buildingFootprint.toFixed(0)}㎡`);
    console.log(`     - 容积率: ${b.parameters.volumeRatio.toFixed(1)}`);
  });
  
  // ========== 第6步：综合分析 ==========
  console.log('\n' + '='.repeat(60));
  console.log('📊 综合分析：QwenVL与点云的相互作用');
  console.log('='.repeat(60));
  
  console.log(`
1. 【语义理解 vs 几何测量】
   - QwenVL提供: 建筑类型、楼层数、材质、功能
   - 点云提供: 精确尺寸、空间位置、体积形态
   - 融合结果: 语义指导几何，几何验证语义

2. 【透视矫正】
   - 问题: 透视图中远处建筑显得更小
   - QwenVL: 识别透视畸变程度(${qwenVLResult.buildings[0].perspective_distortion})
   - 解决: 根据消失点和地平线矫正尺寸
   - 结果: 恢复真实的建筑比例

3. 【阴影利用】
   - 阴影长度: 反推建筑高度
   - 阴影方向: 确定太阳位置和时间
   - 多重验证: 阴影高度 vs 语义高度 vs 点云高度
   - 置信度: 通过交叉验证提高准确性

4. 【缩放恢复】
   - 挑战: 单张图片无法确定绝对尺寸
   - 方法1: 建筑类型→典型尺寸（高层约80m）
   - 方法2: 透视关系→相对尺寸
   - 方法3: 阴影比例→绝对尺寸
   - 融合: 加权平均得到最可能的尺度

5. 【套娃式结构生成】
   - 外框: 从点云轮廓提取
   - 楼层: 均匀分割，每层${Building3DReconstructor.standards.floorHeight}m
   - 房间: 基于结构网格(${Building3DReconstructor.standards.structuralGrid}m)
   - 立面: 规律排布窗户和门
   - 结构: 柱网+核心筒系统

6. 【数据源优先级】
   - 建筑识别: QwenVL > 点云（语义理解更准确）
   - 尺寸测量: 点云 > QwenVL（几何测量更精确）
   - 高度估算: 多源融合（提高可靠性）
   - 材质纹理: QwenVL独有（视觉信息）
   - 内部结构: 规范推导（建筑设计标准）
  `);
  
  // 保存结果
  const result = {
    timestamp: new Date().toISOString(),
    input: 'docs/test1.jpg',
    qwenvl: qwenVLResult,
    pointCloud: {
      totalPoints: pointCloud.length,
      clusters: clusterCount
    },
    perspective: perspectiveAnalysis,
    shadow: shadowAnalysis,
    buildings: buildings3D,
    fusion: {
      method: 'deep_fusion',
      confidence: 0.89
    }
  };
  
  const outputPath = path.join(__dirname, 'complete_fusion_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\n💾 完整结果已保存到: ${outputPath}`);
}

/**
 * 生成考虑透视的点云
 */
function generatePerspectiveAwarePointCloud(qwenVLResult) {
  const points = [];
  
  qwenVLResult.buildings.forEach((building, idx) => {
    // 考虑透视畸变的缩放因子
    const perspectiveScale = 1 - building.perspective_distortion;
    
    // 根据建筑位置和类型生成点云
    const baseX = building.position_pixels.x / 800;  // 归一化
    const baseY = building.position_pixels.y / 600;
    
    // 点云密度与建筑大小成正比
    const pointCount = Math.floor(100 * (building.floors / 10));
    
    for (let i = 0; i < pointCount; i++) {
      points.push({
        x: baseX + (Math.random() - 0.5) * 0.15 * perspectiveScale,
        y: baseY + (Math.random() - 0.5) * 0.1 * perspectiveScale,
        z: Math.random() * (building.floors * 3.5 / 100) * perspectiveScale,
        intensity: 0.8 - idx * 0.1,
        buildingId: building.id
      });
    }
  });
  
  return points;
}

/**
 * 分析透视关系
 */
function analyzePerspectiveRelations(qwenVLResult, imageInfo) {
  const vp = qwenVLResult.scene.vanishing_point;
  
  // 根据消失点位置估算视角
  const viewAngle = Math.atan2(vp.y - imageInfo.height/2, imageInfo.width/2) * 180 / Math.PI;
  
  // 估算相机高度（基于地平线）
  const horizonY = qwenVLResult.scene.horizon_line.y;
  const cameraHeight = (imageInfo.height/2 - horizonY) / imageInfo.height * 10; // 估算值
  
  return {
    vanishingPoint: vp,
    viewAngle: Math.abs(viewAngle),
    cameraHeight: Math.max(1.5, cameraHeight),
    perspectiveStrength: qwenVLResult.buildings[0].perspective_distortion
  };
}

/**
 * 分析阴影信息
 */
function analyzeShadowInformation(qwenVLResult) {
  // 根据阴影长度和建筑高度估算太阳角度
  const building = qwenVLResult.buildings[0];
  const shadowLength = building.shadow.length_pixels;
  const buildingHeight = building.height_pixels;
  
  const sunAngle = Math.atan(buildingHeight / shadowLength) * 180 / Math.PI;
  
  // 根据阴影方向和角度估算时间
  let timeOfDay = 'noon';
  if (sunAngle < 30) timeOfDay = 'morning';
  else if (sunAngle < 60) timeOfDay = 'afternoon';
  
  return {
    sunAngle: sunAngle,
    direction: building.shadow.direction,
    timeOfDay: timeOfDay,
    reliability: building.shadow.visible ? 0.8 : 0.3
  };
}

// 执行测试
testCompleteFusion().catch(console.error);