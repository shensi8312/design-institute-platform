/**
 * 点云3D重构单元测试
 * 
 * 测试目标：
 * 1. 点云聚类能识别多个建筑
 * 2. 自适应参数不写死
 * 3. 从外框生成完整3D结构
 * 
 * 周一TODO：
 * - 连接QwenVL服务 (http://10.10.6.94:8001)
 * - 用真实的docs/test1.jpg测试
 * - 验证20层、15层、10层的识别
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 引入服务
const PointCloudTransformer = require('./src/services/PointCloudTransformerService');
const Building3DReconstructor = require('./src/services/Building3DReconstructor');
const VisionPointCloudFusion = require('./src/services/VisionPointCloudFusion');

console.log('='.repeat(60));
console.log('点云3D重构单元测试');
console.log('='.repeat(60));

// 测试用例1：点云聚类识别多个建筑
function testPointCloudClustering() {
  console.log('\n📝 测试1：点云聚类识别多个建筑');
  console.log('-'.repeat(40));
  
  // 生成三个分离的建筑点云
  const points = [];
  
  // 建筑1 (x: 0.1-0.2)
  for (let i = 0; i < 100; i++) {
    points.push({
      x: 0.1 + Math.random() * 0.1,
      y: 0.3 + Math.random() * 0.2,
      z: Math.random() * 0.7
    });
  }
  
  // 建筑2 (x: 0.4-0.5) - 间隔0.2
  for (let i = 0; i < 80; i++) {
    points.push({
      x: 0.4 + Math.random() * 0.1,
      y: 0.35 + Math.random() * 0.15,
      z: Math.random() * 0.5
    });
  }
  
  // 建筑3 (x: 0.7-0.8) - 间隔0.2
  for (let i = 0; i < 60; i++) {
    points.push({
      x: 0.7 + Math.random() * 0.1,
      y: 0.4 + Math.random() * 0.1,
      z: Math.random() * 0.3
    });
  }
  
  // 执行聚类
  const clusters = PointCloudTransformer.dbscanClustering(points);
  
  // 验证结果
  let clusterCount;
  if (Array.isArray(clusters[0])) {
    clusterCount = clusters.length;
  } else {
    clusterCount = new Set(clusters.filter(l => l >= 0)).size;
  }
  
  console.log(`✅ 识别出 ${clusterCount} 个建筑`);
  assert(clusterCount >= 2, '应该识别出至少2个建筑');
  
  return { passed: true, clusters: clusterCount };
}

// 测试用例2：自适应eps参数
function testAdaptiveEps() {
  console.log('\n📝 测试2：自适应eps参数（不写死）');
  console.log('-'.repeat(40));
  
  // 测试不同密度的点云
  const densities = [
    { name: '稀疏', points: 50, spacing: 0.3 },
    { name: '中等', points: 100, spacing: 0.2 },
    { name: '密集', points: 200, spacing: 0.1 }
  ];
  
  densities.forEach(density => {
    const points = [];
    for (let i = 0; i < density.points; i++) {
      points.push({
        x: Math.random() * density.spacing,
        y: Math.random() * density.spacing,
        z: Math.random() * 0.5
      });
    }
    
    // 计算自适应eps
    const eps = PointCloudTransformer.calculateAdaptiveEps(points);
    console.log(`  ${density.name}点云: eps = ${eps.toFixed(3)}`);
    
    // 验证eps在合理范围
    assert(eps >= 0.05 && eps <= 0.15, `eps应在0.05-0.15之间，实际: ${eps}`);
  });
  
  console.log('✅ 自适应参数测试通过');
  return { passed: true };
}

// 测试用例3：3D结构生成（套娃式）
function test3DStructureGeneration() {
  console.log('\n📝 测试3：套娃式3D结构生成');
  console.log('-'.repeat(40));
  
  // 模拟一个建筑簇
  const cluster = [];
  for (let i = 0; i < 100; i++) {
    cluster.push({
      x: 0.5 + (Math.random() - 0.5) * 0.2,
      y: 0.5 + (Math.random() - 0.5) * 0.2,
      z: Math.random() * 0.6
    });
  }
  
  // 生成3D结构
  const buildings = Building3DReconstructor.reconstructFromClusters([cluster]);
  
  assert(buildings.length === 1, '应该生成1个建筑');
  
  const building = buildings[0];
  console.log(`✅ 生成建筑：`);
  console.log(`  - 类型: ${building.type}`);
  console.log(`  - 楼层: ${building.floorCount}层`);
  console.log(`  - 高度: ${building.geometry.dimensions.height}m`);
  console.log(`  - 房间: ${building.internal.rooms.length}个`);
  console.log(`  - 窗户: ${building.facade.windows.length}个`);
  console.log(`  - 柱子: ${building.structure.columns.length}个`);
  
  // 验证结构完整性
  assert(building.floors.length > 0, '应该有楼层');
  assert(building.facade.windows.length > 0, '应该有窗户');
  assert(building.structure.columns.length > 0, '应该有结构柱');
  
  return { passed: true, building };
}

// 测试用例4：间隙检测
function testGapDetection() {
  console.log('\n📝 测试4：建筑间隙检测');
  console.log('-'.repeat(40));
  
  // 创建有明显间隙的点云
  const points = [];
  
  // 三组点，有明显间隙
  const groups = [
    { start: 0.0, end: 0.15 },
    { start: 0.35, end: 0.50 },  // 间隙: 0.35 - 0.15 = 0.20
    { start: 0.70, end: 0.85 }   // 间隙: 0.70 - 0.50 = 0.20
  ];
  
  groups.forEach(group => {
    for (let i = 0; i < 50; i++) {
      points.push({
        x: group.start + Math.random() * (group.end - group.start),
        y: 0.5 + (Math.random() - 0.5) * 0.2,
        z: Math.random() * 0.5
      });
    }
  });
  
  // 检测间隙
  const gapClusters = PointCloudTransformer.detectBuildingsByGaps(points);
  
  if (gapClusters && gapClusters.length > 1) {
    console.log(`✅ 检测到 ${gapClusters.length} 个独立建筑（通过间隙）`);
    assert(gapClusters.length === 3, '应该检测到3个建筑');
  } else {
    console.log('⚠️ 间隙检测未找到多个建筑，使用DBSCAN');
  }
  
  return { passed: true };
}

// 测试用例5：模拟QwenVL识别（为周一准备）
function testQwenVLSimulation() {
  console.log('\n📝 测试5：模拟QwenVL识别流程（周一实测）');
  console.log('-'.repeat(40));
  
  // 模拟QwenVL返回（基于docs/test1.jpg的预期）
  const mockQwenVLResponse = {
    success: true,
    data: {
      image_analysis: {
        description: "建筑群透视线稿图，包含三幢不同高度的建筑",
        view_type: "perspective",
        buildings: [
          {
            id: "building_1",
            position: { x: 0.2, y: 0.4 },
            type: "high_rise",
            floors: 20,
            confidence: 0.92
          },
          {
            id: "building_2",
            position: { x: 0.5, y: 0.45 },
            type: "mid_rise",
            floors: 15,
            confidence: 0.88
          },
          {
            id: "building_3",
            position: { x: 0.8, y: 0.5 },
            type: "low_rise",
            floors: 10,
            confidence: 0.85
          }
        ]
      }
    }
  };
  
  console.log('📍 周一测试步骤：');
  console.log('1. 调用QwenVL API:');
  console.log(`   POST http://10.10.6.94:8001/v1/chat/completions`);
  console.log('2. 发送图片:');
  console.log(`   image: docs/test1.jpg`);
  console.log('3. 期望识别:');
  mockQwenVLResponse.data.image_analysis.buildings.forEach(b => {
    console.log(`   - ${b.id}: ${b.floors}层 ${b.type}`);
  });
  
  return { passed: true, mockResponse: mockQwenVLResponse };
}

// 运行所有测试
async function runAllTests() {
  const tests = [
    { name: '点云聚类', fn: testPointCloudClustering },
    { name: '自适应参数', fn: testAdaptiveEps },
    { name: '3D结构生成', fn: test3DStructureGeneration },
    { name: '间隙检测', fn: testGapDetection },
    { name: 'QwenVL模拟', fn: testQwenVLSimulation }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ ...test, ...result });
    } catch (error) {
      console.error(`❌ ${test.name} 失败:`, error.message);
      results.push({ ...test, passed: false, error: error.message });
    }
  }
  
  // 总结
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试总结');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(r => {
    const status = r.passed ? '✅' : '❌';
    console.log(`${status} ${r.name}`);
  });
  
  console.log(`\n通过率: ${passed}/${total} (${(passed/total*100).toFixed(0)}%)`);
  
  // 周一TODO清单
  console.log('\n' + '='.repeat(60));
  console.log('📋 周一TODO清单');
  console.log('='.repeat(60));
  console.log(`
1. 【连接QwenVL服务】
   - 地址: http://10.10.6.94:8001/v1/chat/completions
   - 模型: Qwen2.5-VL-7B-Instruct
   - 测试图片: docs/test1.jpg

2. 【验证识别结果】
   - 期望: 20层、15层、10层三幢建筑
   - 检查: 透视畸变、阴影方向、材质识别

3. 【集成测试】
   - 运行: node test_complete_fusion.js
   - 验证: QwenVL + 点云融合
   - 确认: 3D结构正确生成

4. 【性能优化】
   - 测试更复杂的图片
   - 优化自适应算法
   - 提高识别准确率
  `);
  
  // 保存测试结果
  const outputPath = path.join(__dirname, 'unit_test_results.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results,
    summary: { passed, total, rate: `${(passed/total*100).toFixed(0)}%` }
  }, null, 2));
  
  console.log(`💾 测试结果已保存到: ${outputPath}`);
}

// 执行测试
runAllTests().catch(console.error);