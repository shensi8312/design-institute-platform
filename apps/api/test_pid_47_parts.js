#!/usr/bin/env node
/**
 * 模拟47个零件的PID装配测试
 * 展示约束求解和完整流程
 */

const fs = require('fs');
const { spawn } = require('child_process');

// 模拟识别到的47个PID组件（基于真实PID图纸结构）
const MOCK_47_COMPONENTS = [
  // 阀门类 (10个)
  ...Array.from({length: 10}, (_, i) => ({
    id: `valve_${i}`,
    type: 'valve',
    number: `100001060${String(i).padStart(3, '0')}`,
    position: [i * 150, 0]
  })),
  // 泵类 (5个)
  ...Array.from({length: 5}, (_, i) => ({
    id: `pump_${i}`,
    type: 'pump',
    number: `P00000536${i}0`,
    position: [i * 200, 150]
  })),
  // 容器类 (15个)
  ...Array.from({length: 15}, (_, i) => ({
    id: `tank_${i}`,
    type: 'tank',
    number: `A000000265${i}`,
    position: [i * 100, 300]
  })),
  // 仪表类 (10个)
  ...Array.from({length: 10}, (_, i) => ({
    id: `instrument_${i}`,
    type: 'instrument',
    number: `101000092${String(i).padStart(3, '0')}`,
    position: [i * 120, 450]
  })),
  // 管件类 (7个)
  ...Array.from({length: 7}, (_, i) => ({
    id: `fitting_${i}`,
    type: 'fitting',
    number: `F10000${i}000`,
    position: [i * 180, 600]
  }))
];

// 连接关系（管道）
const CONNECTIONS = [];
for (let i = 0; i < MOCK_47_COMPONENTS.length - 1; i++) {
  if (Math.random() > 0.3) { // 70%概率连接到下一个
    CONNECTIONS.push({
      from: MOCK_47_COMPONENTS[i].id,
      to: MOCK_47_COMPONENTS[i + 1].id,
      type: 'pipe'
    });
  }
}

console.log('='.repeat(60));
console.log('47零件PID自动装配测试');
console.log('='.repeat(60));

console.log(`\n📊 PID识别结果（模拟）:`);
console.log(`  - 组件总数: ${MOCK_47_COMPONENTS.length}`);
console.log(`  - 阀门: 10个`);
console.log(`  - 泵: 5个`);
console.log(`  - 容器: 15个`);
console.log(`  - 仪表: 10个`);
console.log(`  - 管件: 7个`);
console.log(`  - 连接数: ${CONNECTIONS.length}`);

// 加载学习规则
const learnedRules = JSON.parse(
  fs.readFileSync('uploads/assembly_output/242_learned_rules.json', 'utf-8')
).learned_rules;

console.log(`\n🧠 装配规则:`);
console.log(`  - close_fit: ${learnedRules.connection_statistics.close_fit}`);
console.log(`  - adjacent: ${learnedRules.connection_statistics.adjacent}`);
console.log(`  - mounting: ${learnedRules.connection_statistics.mounting}`);
console.log(`  - tight_fit: ${learnedRules.connection_statistics.tight_fit}`);

// 匹配3D模型
console.log(`\n🔗 匹配3D模型...`);
const solidworksDir = '/Users/shenguoli/Documents/projects/design-institute-platform/docs/solidworks';
const availableModels = fs.readdirSync(solidworksDir)
  .filter(f => f.endsWith('.STEP') || f.endsWith('.STP'))
  .map(f => {
    const match = f.match(/([AP]?\d{10,})/);
    return match ? match[1] : null;
  })
  .filter(Boolean);

console.log(`  零件库: ${availableModels.length} 个3D模型`);

const matchedParts = [];
let matchedCount = 0;

for (const comp of MOCK_47_COMPONENTS) {
  if (availableModels.includes(comp.number)) {
    matchedParts.push({
      ...comp,
      model_file: `${solidworksDir}/${comp.number}.STEP`,
      matched: true
    });
    matchedCount++;
  } else {
    matchedParts.push({
      ...comp,
      model_file: null,
      matched: false
    });
  }
}

console.log(`  ✓ 匹配成功: ${matchedCount}/${MOCK_47_COMPONENTS.length}`);
console.log(`  ⊗ 未匹配: ${MOCK_47_COMPONENTS.length - matchedCount}`);

// 应用约束求解
console.log(`\n🎯 约束求解引擎...`);
console.log(`  阶段1: 初始化零件位置`);

const assembly = {
  parts: [],
  constraints: [],
  unmatched_parts: []
};

// 初始布局
let xOffset = 0;
const spacing = 100;

for (const part of matchedParts) {
  if (part.matched) {
    assembly.parts.push({
      id: part.id,
      part_number: part.number,
      type: part.type,
      model_file: part.model_file,
      position: [xOffset, 0, 0],
      rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
      pid_position: part.position
    });
    xOffset += spacing;
  } else {
    assembly.unmatched_parts.push(part);
  }
}

console.log(`    ✓ ${assembly.parts.length} 个零件初始化完成`);

// 应用连接约束
console.log(`  阶段2: 应用连接约束`);
let constraintsApplied = 0;

for (const conn of CONNECTIONS) {
  const part1 = assembly.parts.find(p => p.id === conn.from);
  const part2 = assembly.parts.find(p => p.id === conn.to);

  if (!part1 || !part2) continue;

  // 选择约束规则
  const closePatterns = learnedRules.connection_patterns.close_fit;
  if (closePatterns && closePatterns.length > 0) {
    const avgRelPos = [0, 0, 0];
    const samples = closePatterns.slice(0, 5);

    for (const s of samples) {
      for (let i = 0; i < 3; i++) {
        avgRelPos[i] += s.relative_pos[i];
      }
    }

    for (let i = 0; i < 3; i++) {
      avgRelPos[i] /= samples.length;
    }

    // 应用约束
    part2.position = [
      part1.position[0] + avgRelPos[0],
      part1.position[1] + avgRelPos[1],
      part1.position[2] + avgRelPos[2]
    ];

    assembly.constraints.push({
      type: 'connection',
      part1: part1.id,
      part2: part2.id,
      relative_position: avgRelPos
    });

    constraintsApplied++;
  }
}

console.log(`    ✓ 应用了 ${constraintsApplied} 个连接约束`);

// 碰撞检测和布局优化
console.log(`  阶段3: 碰撞检测和优化`);
const collisionThreshold = 50;
let collisionsResolved = 0;

for (let i = 0; i < assembly.parts.length; i++) {
  for (let j = i + 1; j < assembly.parts.length; j++) {
    const p1 = assembly.parts[i].position;
    const p2 = assembly.parts[j].position;

    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const dist2d = Math.sqrt(dx * dx + dy * dy);

    if (dist2d < collisionThreshold) {
      assembly.parts[j].position[2] += collisionThreshold;
      collisionsResolved++;
    }
  }
}

console.log(`    ✓ 解决了 ${collisionsResolved} 个碰撞`);

// 保存结果
const outputFile = 'uploads/assembly_output/pid_47_parts_assembly.json';
fs.writeFileSync(outputFile, JSON.stringify(assembly, null, 2));

console.log(`\n✅ 装配完成!`);
console.log(`  - 总零件数: 47`);
console.log(`  - 匹配成功: ${assembly.parts.length}`);
console.log(`  - 未匹配: ${assembly.unmatched_parts.length}`);
console.log(`  - 约束数: ${assembly.constraints.length}`);
console.log(`  - 碰撞解决: ${collisionsResolved}`);
console.log(`\n💾 装配定义已保存: ${outputFile}`);

// 显示统计
console.log(`\n📈 装配统计:`);
const typeCount = {};
for (const part of assembly.parts) {
  typeCount[part.type] = (typeCount[part.type] || 0) + 1;
}

for (const [type, count] of Object.entries(typeCount)) {
  console.log(`  - ${type}: ${count}个`);
}

console.log(`\n📝 未匹配零件列表:`);
assembly.unmatched_parts.slice(0, 10).forEach(p => {
  console.log(`  ⊗ ${p.number} (${p.type})`);
});

if (assembly.unmatched_parts.length > 10) {
  console.log(`  ... 还有 ${assembly.unmatched_parts.length - 10} 个`);
}
