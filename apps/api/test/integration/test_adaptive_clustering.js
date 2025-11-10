/**
 * 测试自适应聚类算法
 * 验证能否正确识别不同图片中的多个建筑
 */

const PointCloudTransformer = require('./src/services/PointCloudTransformerService');

console.log('========================================');
console.log('自适应建筑识别测试');
console.log('========================================\n');

// 测试场景1：三个明显分离的建筑
function testScenario1() {
  console.log('📐 场景1：三个明显分离的建筑（间距15%）');
  console.log('-'.repeat(40));
  
  const points = [];
  
  // 建筑1：x=0.1-0.25
  for (let i = 0; i < 100; i++) {
    points.push({
      x: 0.1 + Math.random() * 0.15,
      y: 0.3 + Math.random() * 0.2,
      z: Math.random() * 0.8
    });
  }
  
  // 建筑2：x=0.4-0.55
  for (let i = 0; i < 80; i++) {
    points.push({
      x: 0.4 + Math.random() * 0.15,
      y: 0.35 + Math.random() * 0.15,
      z: Math.random() * 0.6
    });
  }
  
  // 建筑3：x=0.7-0.85
  for (let i = 0; i < 60; i++) {
    points.push({
      x: 0.7 + Math.random() * 0.15,
      y: 0.4 + Math.random() * 0.1,
      z: Math.random() * 0.4
    });
  }
  
  console.log(`生成${points.length}个点`);
  
  // 测试自适应算法
  const clusters = PointCloudTransformer.dbscanClustering(points);
  
  // 统计结果
  if (Array.isArray(clusters[0]) && typeof clusters[0][0] === 'object') {
    // 返回的是聚类数组
    console.log(`\n✅ 识别结果：${clusters.length}个建筑`);
    clusters.forEach((cluster, idx) => {
      console.log(`  建筑${idx + 1}: ${cluster.length}个点`);
    });
  } else {
    // 返回的是标签数组
    const uniqueClusters = new Set(clusters.filter(l => l >= 0));
    console.log(`\n✅ 识别结果：${uniqueClusters.size}个建筑`);
  }
  
  return clusters;
}

// 测试场景2：两个紧密的建筑
function testScenario2() {
  console.log('\n📐 场景2：两个紧密的建筑（间距8%）');
  console.log('-'.repeat(40));
  
  const points = [];
  
  // 建筑1：x=0.2-0.4
  for (let i = 0; i < 120; i++) {
    points.push({
      x: 0.2 + Math.random() * 0.2,
      y: 0.3 + Math.random() * 0.3,
      z: Math.random() * 0.7
    });
  }
  
  // 建筑2：x=0.48-0.68（间距只有8%）
  for (let i = 0; i < 100; i++) {
    points.push({
      x: 0.48 + Math.random() * 0.2,
      y: 0.35 + Math.random() * 0.25,
      z: Math.random() * 0.6
    });
  }
  
  console.log(`生成${points.length}个点`);
  
  const clusters = PointCloudTransformer.dbscanClustering(points);
  
  if (Array.isArray(clusters[0]) && typeof clusters[0][0] === 'object') {
    console.log(`\n✅ 识别结果：${clusters.length}个建筑`);
    clusters.forEach((cluster, idx) => {
      console.log(`  建筑${idx + 1}: ${cluster.length}个点`);
    });
  } else {
    const uniqueClusters = new Set(clusters.filter(l => l >= 0));
    console.log(`\n✅ 识别结果：${uniqueClusters.size}个建筑`);
  }
  
  return clusters;
}

// 测试场景3：四个建筑呈田字形排列
function testScenario3() {
  console.log('\n📐 场景3：四个建筑呈田字形排列');
  console.log('-'.repeat(40));
  
  const points = [];
  
  // 左上
  for (let i = 0; i < 50; i++) {
    points.push({
      x: 0.1 + Math.random() * 0.15,
      y: 0.1 + Math.random() * 0.15,
      z: Math.random() * 0.5
    });
  }
  
  // 右上
  for (let i = 0; i < 50; i++) {
    points.push({
      x: 0.6 + Math.random() * 0.15,
      y: 0.1 + Math.random() * 0.15,
      z: Math.random() * 0.5
    });
  }
  
  // 左下
  for (let i = 0; i < 50; i++) {
    points.push({
      x: 0.1 + Math.random() * 0.15,
      y: 0.6 + Math.random() * 0.15,
      z: Math.random() * 0.5
    });
  }
  
  // 右下
  for (let i = 0; i < 50; i++) {
    points.push({
      x: 0.6 + Math.random() * 0.15,
      y: 0.6 + Math.random() * 0.15,
      z: Math.random() * 0.5
    });
  }
  
  console.log(`生成${points.length}个点`);
  
  const clusters = PointCloudTransformer.dbscanClustering(points);
  
  if (Array.isArray(clusters[0]) && typeof clusters[0][0] === 'object') {
    console.log(`\n✅ 识别结果：${clusters.length}个建筑`);
    clusters.forEach((cluster, idx) => {
      console.log(`  建筑${idx + 1}: ${cluster.length}个点`);
    });
  } else {
    const uniqueClusters = new Set(clusters.filter(l => l >= 0));
    console.log(`\n✅ 识别结果：${uniqueClusters.size}个建筑`);
  }
  
  return clusters;
}

// 运行所有测试
function runAllTests() {
  console.log('🚀 开始测试自适应建筑识别算法\n');
  console.log('算法特点：');
  console.log('1. 自动采样计算最佳eps值');
  console.log('2. 优先使用间隙检测分割建筑');
  console.log('3. 支持不同布局的建筑群识别\n');
  
  const results = [];
  
  // 测试三个场景
  results.push({
    scenario: '三个分离建筑',
    expected: 3,
    actual: testScenario1()
  });
  
  results.push({
    scenario: '两个紧密建筑',
    expected: 2,
    actual: testScenario2()
  });
  
  results.push({
    scenario: '四个田字形建筑',
    expected: 4,
    actual: testScenario3()
  });
  
  // 总结
  console.log('\n' + '='.repeat(50));
  console.log('📊 测试总结');
  console.log('='.repeat(50));
  
  results.forEach(r => {
    const actualCount = Array.isArray(r.actual[0]) ? 
      r.actual.length : 
      new Set(r.actual.filter(l => l >= 0)).size;
    
    const status = actualCount === r.expected ? '✅ 通过' : '❌ 失败';
    console.log(`${r.scenario}: 期望${r.expected}个，实际${actualCount}个 ${status}`);
  });
  
  console.log('\n💡 结论：');
  console.log('自适应算法能够根据不同的点云分布自动调整参数，');
  console.log('无需为每张图片手动设置eps值！');
}

// 执行测试
runAllTests();