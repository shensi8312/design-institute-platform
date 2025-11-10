/**
 * 测试两阶段识别流程
 * 阶段1: QwenVL语义识别
 * 阶段2: 点云精细化增强
 */

const fs = require('fs');
const path = require('path');
const perspectiveAnalyzer = require('../../src/services/perspectiveSketchAnalyzer');

console.log('='.repeat(60));
console.log('🚀 测试两阶段建筑识别流程');
console.log('='.repeat(60));

/**
 * 模拟测试（不依赖QwenVL服务）
 */
async function testOfflineRecognition() {
  console.log('\n📋 离线测试模式（模拟数据）\n');
  
  // 模拟QwenVL识别结果
  const mockVisionResult = {
    volumes: [
      {
        id: "v1",
        type: "主体",
        position: { relative_x: 0.28, relative_y: 0.41 },
        dimensions: { width: "26", height: "35", depth: "13" },
        features: ["3层", "主楼"]
      },
      {
        id: "v2",
        type: "连接",
        position: { relative_x: 0.46, relative_y: 0.44 },
        dimensions: { width: "3", height: "9", depth: "7" },
        features: ["1层", "连廊"]
      },
      {
        id: "v3",
        type: "主体",
        position: { relative_x: 0.65, relative_y: 0.47 },
        dimensions: { width: "20", height: "25", depth: "18" },
        features: ["2层", "副楼"]
      }
    ]
  };
  
  // 手动调用提取建筑信息
  const buildings = perspectiveAnalyzer.extractBuildingsFromVision(mockVisionResult);
  
  console.log('📸 阶段1: 模拟QwenVL识别结果');
  console.log(`  ✅ 识别出${buildings.length}个建筑:`);
  buildings.forEach(b => {
    console.log(`    - 建筑${b.id}: ${b.position}, ${b.floors_range}`);
  });
  
  // 生成引导式点云
  console.log('\n🔬 阶段2: 点云精细化增强');
  const pointCloud = await perspectiveAnalyzer.generateGuidedPointCloud({
    buildings: buildings
  });
  
  console.log(`  ✅ 生成${pointCloud.length}个点`);
  
  // 点云聚类分析
  const PointCloudTransformer = require('../../src/services/PointCloudTransformerService');
  const clusters = PointCloudTransformer.dbscanClustering(pointCloud);
  
  console.log(`  ✅ 聚类分析: ${clusters.length}个聚类`);
  
  // 融合结果
  console.log('\n🏗️ 阶段3: 生成最终3D参数');
  
  const finalBuildings = buildings.map((building, idx) => {
    const cluster = clusters[idx] || [];
    
    // 计算精确尺寸
    const xValues = cluster.map(p => p.x);
    const yValues = cluster.map(p => p.y);
    const zValues = cluster.map(p => p.z);
    
    const dimensions = cluster.length > 0 ? {
      width: ((Math.max(...xValues) - Math.min(...xValues)) * 100).toFixed(1),
      depth: ((Math.max(...yValues) - Math.min(...yValues)) * 100).toFixed(1),
      height: (Math.max(...zValues) * 100).toFixed(1)
    } : {
      width: "20",
      depth: "15",
      height: "10"
    };
    
    return {
      id: building.id,
      semantic: {
        position: building.position,
        floors: perspectiveAnalyzer.parseFloorRange(building.floors_range),
        features: building.features
      },
      geometric: {
        dimensions: dimensions,
        pointCount: cluster.length
      }
    };
  });
  
  // 输出结果
  console.log('\n📊 最终识别结果:');
  finalBuildings.forEach(b => {
    console.log(`\n建筑 ${b.id}:`);
    console.log(`  位置: ${b.semantic.position}`);
    console.log(`  楼层: ${b.semantic.floors}层`);
    console.log(`  尺寸: ${b.geometric.dimensions.width} × ${b.geometric.dimensions.depth} × ${b.geometric.dimensions.height}m`);
    console.log(`  特征: ${b.semantic.features.join(', ')}`);
    console.log(`  点数: ${b.geometric.pointCount}`);
  });
  
  // 生成SketchUp JSON
  const sketchupData = generateSketchUpJSON(finalBuildings);
  
  // 保存结果
  const outputPath = path.join(__dirname, 'two_stage_result.json');
  fs.writeFileSync(outputPath, JSON.stringify(sketchupData, null, 2));
  console.log(`\n💾 结果已保存到: ${outputPath}`);
  
  return sketchupData;
}

/**
 * 生成SketchUp JSON
 */
function generateSketchUpJSON(buildings) {
  return {
    metadata: {
      version: "2.0",
      generator: "Two-Stage Recognition System",
      timestamp: new Date().toISOString(),
      method: "QwenVL + Point Cloud"
    },
    
    buildings: buildings.map(b => ({
      id: `building_${b.id}`,
      semantic: b.semantic,
      geometric: b.geometric,
      
      // SketchUp几何数据
      geometry: {
        dimensions: b.geometric.dimensions,
        vertices: generateVertices(b.geometric.dimensions),
        faces: [
          [0, 1, 2, 3],  // 底面
          [4, 5, 6, 7],  // 顶面
          [0, 1, 5, 4],  // 前面
          [2, 3, 7, 6],  // 后面
          [0, 3, 7, 4],  // 左面
          [1, 2, 6, 5]   // 右面
        ]
      },
      
      // Ruby代码
      ruby_code: generateRubyCode(b)
    }))
  };
}

/**
 * 生成顶点
 */
function generateVertices(dimensions) {
  const w = parseFloat(dimensions.width) / 2;
  const d = parseFloat(dimensions.depth) / 2;
  const h = parseFloat(dimensions.height);
  
  return [
    [-w, -d, 0],
    [w, -d, 0],
    [w, d, 0],
    [-w, d, 0],
    [-w, -d, h],
    [w, -d, h],
    [w, d, h],
    [-w, d, h]
  ];
}

/**
 * 生成Ruby代码
 */
function generateRubyCode(building) {
  const d = building.geometric.dimensions;
  
  return `
# Building ${building.id} - ${building.semantic.position}
group = entities.add_group
group.name = "Building_${building.id}"

# Create base
pts = []
pts[0] = [-${d.width/2}.m, -${d.depth/2}.m, 0]
pts[1] = [${d.width/2}.m, -${d.depth/2}.m, 0]
pts[2] = [${d.width/2}.m, ${d.depth/2}.m, 0]
pts[3] = [-${d.width/2}.m, ${d.depth/2}.m, 0]

face = group.entities.add_face(pts)
face.pushpull(${d.height}.m)

# Add floors
${building.semantic.floors}.times do |i|
  z = (i + 1) * 3.5.m
  group.entities.add_cline(
    [-${d.width/2}.m, -${d.depth/2}.m, z],
    [${d.width/2}.m, -${d.depth/2}.m, z]
  )
end`;
}

/**
 * 测试真实图片（需要QwenVL服务）
 */
async function testRealImage() {
  console.log('\n📷 测试真实图片识别\n');
  
  const imagePath = path.join(__dirname, '../../docs/test2.jpg');
  
  if (!fs.existsSync(imagePath)) {
    console.log('⚠️ 测试图片不存在:', imagePath);
    return;
  }
  
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    console.log('✅ 加载图片成功');
    
    // 调用完整的两阶段识别
    const result = await perspectiveAnalyzer.analyzePerspectiveSketch(imageBuffer);
    
    console.log('\n📊 完整识别结果:');
    console.log(JSON.stringify(result, null, 2));
    
    // 保存结果
    const outputPath = path.join(__dirname, 'real_image_result.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n💾 结果已保存到: ${outputPath}`);
    
  } catch (error) {
    console.error('识别失败:', error.message);
    console.log('\n💡 提示: QwenVL服务可能不可用，请使用离线测试模式');
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('\n选择测试模式:');
  console.log('1. 离线测试（模拟数据）');
  console.log('2. 真实图片测试（需要QwenVL服务）');
  
  const mode = process.argv[2] || '1';
  
  if (mode === '2') {
    await testRealImage();
  } else {
    await testOfflineRecognition();
  }
  
  console.log('\n✅ 测试完成！');
}

// 执行测试
main().catch(console.error);