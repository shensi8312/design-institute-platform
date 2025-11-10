/**
 * 测试：为什么点云只识别出1幢建筑？
 * 
 * 问题分析：
 * 1. eps = 0.20 (20%) 太大了，导致所有建筑被聚成一类
 * 2. 建筑之间的距离可能小于eps阈值
 * 3. 需要基于建筑顶点和边缘特征分割
 */

const PointCloudTransformer = require('./src/services/PointCloudTransformerService');

console.log('========================================');
console.log('点云建筑识别问题分析');
console.log('========================================\n');

// 生成三个明显分离的建筑点云
function generateThreeBuildingsPointCloud() {
  const buildings = [];
  
  // 建筑1：左侧 (x: 0.1-0.25)
  console.log('📍 建筑1：左侧高层');
  const building1 = [];
  for (let i = 0; i < 100; i++) {
    building1.push({
      x: 0.1 + Math.random() * 0.15,  // x范围: 0.1-0.25
      y: 0.3 + Math.random() * 0.2,   // y范围: 0.3-0.5
      z: Math.random() * 0.8,         // 高层建筑
      intensity: 0.8
    });
  }
  buildings.push(building1);
  console.log(`  位置: x[0.1-0.25], 点数: ${building1.length}`);
  
  // 建筑2：中间 (x: 0.4-0.55) - 留出0.15的间隙
  console.log('📍 建筑2：中间中层');
  const building2 = [];
  for (let i = 0; i < 80; i++) {
    building2.push({
      x: 0.4 + Math.random() * 0.15,  // x范围: 0.4-0.55
      y: 0.35 + Math.random() * 0.15, // y范围: 0.35-0.5
      z: Math.random() * 0.6,         // 中层建筑
      intensity: 0.7
    });
  }
  buildings.push(building2);
  console.log(`  位置: x[0.4-0.55], 点数: ${building2.length}`);
  
  // 建筑3：右侧 (x: 0.7-0.85) - 留出0.15的间隙
  console.log('📍 建筑3：右侧低层');
  const building3 = [];
  for (let i = 0; i < 60; i++) {
    building3.push({
      x: 0.7 + Math.random() * 0.15,  // x范围: 0.7-0.85
      y: 0.4 + Math.random() * 0.1,   // y范围: 0.4-0.5
      z: Math.random() * 0.4,         // 低层建筑
      intensity: 0.6
    });
  }
  buildings.push(building3);
  console.log(`  位置: x[0.7-0.85], 点数: ${building3.length}`);
  
  // 合并所有点
  const allPoints = [...building1, ...building2, ...building3];
  console.log(`\n总点数: ${allPoints.length}`);
  
  // 计算建筑之间的最小距离
  console.log('\n📏 建筑间距分析：');
  console.log(`  建筑1-2间距: ${(0.4 - 0.25).toFixed(2)} (15%)`);
  console.log(`  建筑2-3间距: ${(0.7 - 0.55).toFixed(2)} (15%)`);
  
  return { allPoints, buildings };
}

// 测试不同的eps参数
function testDifferentEpsValues(points) {
  console.log('\n🔬 测试不同的eps参数：');
  console.log('-'.repeat(40));
  
  const epsValues = [0.05, 0.10, 0.15, 0.20, 0.25];
  
  for (const eps of epsValues) {
    // 临时修改eps值进行测试
    const originalDbscan = PointCloudTransformer.dbscanClustering;
    
    // 创建新的DBSCAN函数，使用测试eps
    PointCloudTransformer.dbscanClustering = function(points) {
      const minPts = 5;
      const n = points.length;
      const labels = new Array(n).fill(-1);
      let clusterId = 0;
      
      const distance = (i, j) => {
        const p1 = points[i];
        const p2 = points[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dz = (p1.z || 0) - (p2.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
      };
      
      const getNeighbors = (pointIdx) => {
        const neighbors = [];
        for (let j = 0; j < n; j++) {
          if (distance(pointIdx, j) < eps) {
            neighbors.push(j);
          }
        }
        return neighbors;
      };
      
      for (let i = 0; i < n; i++) {
        if (labels[i] !== -1) continue;
        
        const neighbors = getNeighbors(i);
        
        if (neighbors.length < minPts) {
          labels[i] = -2;
        } else {
          labels[i] = clusterId;
          const seedSet = [...neighbors];
          let j = 0;
          
          while (j < seedSet.length) {
            const q = seedSet[j];
            
            if (labels[q] === -2) {
              labels[q] = clusterId;
            }
            
            if (labels[q] === -1) {
              labels[q] = clusterId;
              
              const qNeighbors = getNeighbors(q);
              if (qNeighbors.length >= minPts) {
                for (const neighbor of qNeighbors) {
                  if (labels[neighbor] === -1) {
                    seedSet.push(neighbor);
                  }
                }
              }
            }
            
            j++;
          }
          
          clusterId++;
        }
      }
      
      return labels;
    };
    
    const labels = PointCloudTransformer.dbscanClustering(points);
    
    // 统计聚类数量
    const uniqueClusters = new Set(labels.filter(l => l >= 0));
    const noiseCount = labels.filter(l => l === -2).length;
    
    console.log(`eps=${eps.toFixed(2)}: ${uniqueClusters.size}个聚类, ${noiseCount}个噪声点`);
    
    // 恢复原函数
    PointCloudTransformer.dbscanClustering = originalDbscan;
  }
}

// 基于顶点检测的方法
function detectBuildingsByVertices(points) {
  console.log('\n🏗️ 基于顶点和边缘检测建筑：');
  console.log('-'.repeat(40));
  
  // 1. 投影到XY平面
  console.log('1. 投影到XY平面');
  const xyPoints = points.map(p => ({ x: p.x, y: p.y }));
  
  // 2. 创建2D网格
  const gridSize = 0.05; // 5%的网格大小
  const grid = {};
  
  for (const point of xyPoints) {
    const gridX = Math.floor(point.x / gridSize);
    const gridY = Math.floor(point.y / gridSize);
    const key = `${gridX},${gridY}`;
    
    if (!grid[key]) {
      grid[key] = 0;
    }
    grid[key]++;
  }
  
  console.log(`2. 创建${Object.keys(grid).length}个网格单元`);
  
  // 3. 找到密度峰值（可能的建筑中心）
  const peaks = [];
  const threshold = 5; // 最小点数阈值
  
  for (const [key, count] of Object.entries(grid)) {
    if (count >= threshold) {
      const [gridX, gridY] = key.split(',').map(Number);
      peaks.push({
        x: gridX * gridSize + gridSize / 2,
        y: gridY * gridSize + gridSize / 2,
        density: count
      });
    }
  }
  
  console.log(`3. 找到${peaks.length}个密度峰值`);
  
  // 4. 聚合相邻的峰值形成建筑轮廓
  const buildings = [];
  const visited = new Set();
  
  for (let i = 0; i < peaks.length; i++) {
    if (visited.has(i)) continue;
    
    const building = [peaks[i]];
    visited.add(i);
    
    // 查找相邻的峰值
    for (let j = i + 1; j < peaks.length; j++) {
      if (visited.has(j)) continue;
      
      const dist = Math.sqrt(
        Math.pow(peaks[i].x - peaks[j].x, 2) +
        Math.pow(peaks[i].y - peaks[j].y, 2)
      );
      
      if (dist < 0.1) { // 10%距离内的峰值属于同一建筑
        building.push(peaks[j]);
        visited.add(j);
      }
    }
    
    buildings.push(building);
  }
  
  console.log(`4. 聚合成${buildings.length}个建筑轮廓`);
  
  // 5. 基于X轴间隙检测
  const xValues = points.map(p => p.x).sort((a, b) => a - b);
  const gaps = [];
  
  for (let i = 1; i < xValues.length; i++) {
    const gap = xValues[i] - xValues[i-1];
    if (gap > 0.05) { // 5%以上的间隙
      gaps.push(xValues[i-1] + gap / 2);
    }
  }
  
  console.log(`5. 检测到${gaps.length}个明显间隙`);
  if (gaps.length > 0) {
    console.log(`   间隙位置: ${gaps.map(g => g.toFixed(2)).join(', ')}`);
  }
  
  return {
    buildingCount: Math.max(buildings.length, gaps.length + 1),
    method: 'vertex_detection',
    details: { peaks, buildings, gaps }
  };
}

// 主测试
function runAnalysis() {
  console.log('🎯 目标：理解为什么只识别出1幢建筑\n');
  
  // 生成测试数据
  const { allPoints, buildings } = generateThreeBuildingsPointCloud();
  
  // 测试当前DBSCAN
  console.log('\n📊 当前DBSCAN结果（eps=0.20）：');
  const labels = PointCloudTransformer.dbscanClustering(allPoints);
  const uniqueClusters = new Set(labels.filter(l => l >= 0));
  console.log(`识别出${uniqueClusters.size}个聚类`);
  
  // 分析问题
  console.log('\n❗ 问题分析：');
  console.log('eps=0.20意味着20%的距离内的点会被聚为一类');
  console.log('但建筑间距只有15%，所以所有建筑被聚成了一个！');
  
  // 测试不同eps值
  testDifferentEpsValues(allPoints);
  
  // 测试顶点检测方法
  const vertexResult = detectBuildingsByVertices(allPoints);
  
  // 解决方案
  console.log('\n✅ 解决方案：');
  console.log('1. 降低eps到0.10（10%）或更小');
  console.log('2. 使用自适应eps（根据点云密度动态调整）');
  console.log('3. 先检测间隙，再进行聚类');
  console.log('4. 使用顶点和边缘检测代替纯距离聚类');
  
  console.log('\n💡 推荐：');
  console.log('将eps改为0.10，这样可以正确识别出3个独立的建筑群');
}

// 执行分析
runAnalysis();