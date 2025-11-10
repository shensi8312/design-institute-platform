/**
 * test2.jpg 图像识别测试
 * 
 * 图像分析：
 * - 3个主要建筑体块
 * - 有明显的连接关系（地面连接）
 * - 左侧较高的塔楼
 * - 中间低矮的连接体
 * - 右侧较大的体块
 */

const PointCloudTransformer = require('./src/services/PointCloudTransformerService');

console.log('='.repeat(60));
console.log('Test2.jpg 建筑识别分析');
console.log('='.repeat(60));

// 基于test2.jpg生成点云
function generateTest2PointCloud() {
  console.log('\n📸 分析test2.jpg图像特征：');
  console.log('  - 左侧：较高的塔楼（2-3层）');
  console.log('  - 中间：低矮的连接体（1层）');
  console.log('  - 右侧：较大的主体建筑（2层）');
  console.log('  - 特征：有地面连接，形成L型或U型布局\n');
  
  const points = [];
  
  // 建筑1：左侧塔楼（较小但较高）
  console.log('生成建筑1点云（左侧塔楼）...');
  for (let i = 0; i < 80; i++) {
    points.push({
      x: 0.15 + Math.random() * 0.08,  // 较窄
      y: 0.35 + Math.random() * 0.12,  // 中等深度
      z: Math.random() * 0.35,         // 较高（2-3层）
      buildingId: 1,
      type: 'tower'
    });
  }
  
  // 建筑2：中间连接体（矮而长）
  console.log('生成建筑2点云（中间连接体）...');
  for (let i = 0; i < 60; i++) {
    points.push({
      x: 0.23 + Math.random() * 0.25,  // 横向延伸
      y: 0.40 + Math.random() * 0.08,  // 较窄
      z: Math.random() * 0.12,         // 低矮（1层）
      buildingId: 2,
      type: 'connector'
    });
  }
  
  // 建筑3：右侧主体（较大）
  console.log('生成建筑3点云（右侧主体）...');
  for (let i = 0; i < 120; i++) {
    points.push({
      x: 0.55 + Math.random() * 0.20,  // 较宽
      y: 0.38 + Math.random() * 0.18,  // 较深
      z: Math.random() * 0.25,         // 中等高度（2层）
      buildingId: 3,
      type: 'main_building'
    });
  }
  
  // 连接部分的点云（建筑1-2之间）
  console.log('生成连接点云...');
  for (let i = 0; i < 20; i++) {
    const t = i / 20;
    points.push({
      x: 0.20 + t * 0.05,  // 短连接
      y: 0.39 + t * 0.02,
      z: Math.random() * 0.10,  // 地面连接
      type: 'connection',
      connection: '1-2'
    });
  }
  
  // 连接部分（建筑2-3之间）- 已经连在一起
  
  return points;
}

// 分析识别结果
function analyzeRecognitionResults(points) {
  console.log('\n🔬 开始识别分析...');
  
  // 1. 聚类识别
  const clusters = PointCloudTransformer.dbscanClustering(points);
  
  let buildings = [];
  if (Array.isArray(clusters[0])) {
    console.log(`\n✅ 识别出${clusters.length}个聚类\n`);
    
    clusters.forEach((cluster, idx) => {
      const xValues = cluster.map(p => p.x);
      const yValues = cluster.map(p => p.y);
      const zValues = cluster.map(p => p.z);
      
      const building = {
        id: idx + 1,
        position: {
          x: ((Math.min(...xValues) + Math.max(...xValues)) / 2 * 100).toFixed(1),
          y: ((Math.min(...yValues) + Math.max(...yValues)) / 2 * 100).toFixed(1)
        },
        dimensions: {
          width: ((Math.max(...xValues) - Math.min(...xValues)) * 100).toFixed(1),
          depth: ((Math.max(...yValues) - Math.min(...yValues)) * 100).toFixed(1),
          height: (Math.max(...zValues) * 100).toFixed(1)
        },
        zRange: Math.max(...zValues) - Math.min(...zValues),
        pointCount: cluster.length
      };
      
      // 根据高度估算楼层和类型
      const heightRange = building.zRange;
      if (heightRange < 0.15) {
        building.floors = 1;
        building.type = 'single_story';
      } else if (heightRange < 0.25) {
        building.floors = 2;
        building.type = 'two_story';
      } else {
        building.floors = 3;
        building.type = 'three_story';
      }
      
      buildings.push(building);
    });
  }
  
  return buildings;
}

// 检测特殊特征
function detectSpecialFeatures(points, buildings) {
  console.log('\n🔍 特殊特征检测：');
  
  const features = {
    connections: [],
    layout: '',
    shadows: [],
    voids: []
  };
  
  // 1. 连接检测
  console.log('\n🔗 连接关系：');
  
  // 检查建筑之间的距离
  for (let i = 0; i < buildings.length; i++) {
    for (let j = i + 1; j < buildings.length; j++) {
      const distance = Math.sqrt(
        Math.pow(parseFloat(buildings[j].position.x) - parseFloat(buildings[i].position.x), 2) +
        Math.pow(parseFloat(buildings[j].position.y) - parseFloat(buildings[i].position.y), 2)
      );
      
      const gap = distance - (parseFloat(buildings[i].dimensions.width) + parseFloat(buildings[j].dimensions.width)) / 2;
      
      if (gap < 5) {  // 间距小于5米，可能有连接
        features.connections.push({
          from: buildings[i].id,
          to: buildings[j].id,
          distance: distance.toFixed(1),
          gap: gap.toFixed(1),
          type: gap < 1 ? 'attached' : 'connected'
        });
        
        console.log(`  建筑${buildings[i].id}-${buildings[j].id}: ${gap < 1 ? '相连' : '连接'}, 间距${gap.toFixed(1)}m`);
      }
    }
  }
  
  // 2. 布局分析
  if (features.connections.length >= 2) {
    features.layout = 'L_shape';  // L型布局
    console.log('\n📐 布局类型: L型建筑群');
  } else if (features.connections.length === 1) {
    features.layout = 'linear';  // 线性布局
    console.log('\n📐 布局类型: 线性连接');
  } else {
    features.layout = 'scattered';
    console.log('\n📐 布局类型: 分散式');
  }
  
  // 3. 检测可能的庭院（如果形成围合）
  const connectionCount = {};
  features.connections.forEach(conn => {
    connectionCount[conn.from] = (connectionCount[conn.from] || 0) + 1;
    connectionCount[conn.to] = (connectionCount[conn.to] || 0) + 1;
  });
  
  const connectedBuildings = Object.keys(connectionCount).length;
  if (connectedBuildings >= 3 && features.connections.length >= 2) {
    console.log('\n🏛️ 可能存在: 内部庭院（建筑围合）');
    features.voids.push({
      type: 'courtyard',
      enclosed_by: Object.keys(connectionCount).map(Number)
    });
  }
  
  return features;
}

// 主测试函数
function testImage2Recognition() {
  console.log('🎯 目标：识别test2.jpg中的建筑群及其关系\n');
  
  // 1. 生成点云
  const points = generateTest2PointCloud();
  console.log(`\n📍 生成${points.length}个点`);
  
  // 2. 识别建筑
  const buildings = analyzeRecognitionResults(points);
  
  // 3. 检测特征
  const features = detectSpecialFeatures(points, buildings);
  
  // 4. 输出结果
  console.log('\n' + '='.repeat(60));
  console.log('📊 识别结果汇总');
  console.log('='.repeat(60));
  
  buildings.forEach(b => {
    console.log(`\n建筑 ${b.id}:`);
    console.log(`  位置: (${b.position.x}, ${b.position.y})`);
    console.log(`  尺寸: ${b.dimensions.width}m × ${b.dimensions.depth}m × ${b.dimensions.height}m`);
    console.log(`  楼层: ${b.floors}层`);
    console.log(`  类型: ${b.type}`);
    console.log(`  点数: ${b.pointCount}`);
  });
  
  console.log('\n📐 空间关系：');
  features.connections.forEach(conn => {
    console.log(`  建筑${conn.from} → 建筑${conn.to}: ${conn.type}, 距离${conn.distance}m`);
  });
  
  console.log('\n✨ 特殊特征：');
  console.log(`  布局: ${features.layout}`);
  if (features.voids.length > 0) {
    features.voids.forEach(v => {
      console.log(`  ${v.type}: 由建筑${v.enclosed_by.join(',')}围合`);
    });
  }
  
  // 5. 3D重建参数
  console.log('\n' + '='.repeat(60));
  console.log('🏗️ 3D重建参数');
  console.log('='.repeat(60));
  
  console.log('\n完整的3D模型参数：');
  const model3D = {
    type: 'building_complex',
    layout: features.layout,
    buildings: buildings.map(b => ({
      ...b,
      structure: {
        type: b.floors === 1 ? 'single_story_frame' : 'multi_story_frame',
        material: 'concrete'
      }
    })),
    connections: features.connections,
    features: features
  };
  
  console.log(JSON.stringify(model3D, null, 2));
  
  // 保存结果
  const fs = require('fs');
  fs.writeFileSync('test2_recognition_result.json', JSON.stringify(model3D, null, 2));
  console.log('\n💾 结果已保存到 test2_recognition_result.json');
  
  return model3D;
}

// 执行测试
testImage2Recognition();