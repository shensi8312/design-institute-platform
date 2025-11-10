#!/usr/bin/env node
/**
 * 使用OpenCV识别PID + 智能匹配115个STEP文件
 */

const fs = require('fs');
const PIDRecognitionService = require('./src/services/pid/PIDRecognitionService');

const PID_PDF_PATH = '/Users/shenguoli/Documents/projects/design-institute-platform/docs/solidworks/其他-301000050672-PID-V1.0.pdf';
const SOLIDWORKS_DIR = '/Users/shenguoli/Documents/projects/design-institute-platform/docs/solidworks';

async function main() {
  console.log('='.repeat(60));
  console.log('OpenCV PID识别 + 智能匹配');
  console.log('='.repeat(60));

  try {
    // 1. 读取所有STEP文件
    console.log('\n📦 扫描零件库...');
    const stepFiles = fs.readdirSync(SOLIDWORKS_DIR)
      .filter(f => f.endsWith('.STEP') || f.endsWith('.STP'))
      .map(f => {
        const match = f.match(/([A-Z]?\d+)/);
        return {
          filename: f,
          number: match ? match[1] : null,
          fullPath: `${SOLIDWORKS_DIR}/${f}`
        };
      })
      .filter(f => f.number);

    console.log(`  ✓ 找到 ${stepFiles.length} 个STEP模型`);
    console.log(`  示例: ${stepFiles.slice(0, 5).map(f => f.number).join(', ')}`);

    // 2. 使用OpenCV识别PID
    console.log('\n🔍 使用OpenCV识别PID图纸...');
    const pidService = new PIDRecognitionService();
    const pdfBuffer = fs.readFileSync(PID_PDF_PATH);

    let result;
    try {
      result = await pidService.recognizePID(pdfBuffer, 'PID-301000050672.pdf');
      console.log(`  ✓ 识别完成`);
      console.log(`    - 组件数: ${result.components ? result.components.length : 0}`);
      console.log(`    - 连接数: ${result.connections ? result.connections.length : 0}`);
    } catch (error) {
      console.log(`  ⚠️  OpenCV识别失败: ${error.message}`);
      console.log(`  使用模拟数据演示智能匹配...`);

      // 模拟PID组件（基于零件库实际编号）
      result = {
        components: [
          { id: 'comp_1', type: 'valve', label: '阀门1', bbox: [100, 100, 200, 200] },
          { id: 'comp_2', type: 'pump', label: '泵1', bbox: [300, 100, 400, 200] },
          { id: 'comp_3', type: 'tank', label: '容器1', bbox: [500, 100, 600, 200] },
          { id: 'comp_4', type: 'instrument', label: '仪表1', bbox: [100, 300, 200, 400] },
          { id: 'comp_5', type: 'valve', label: '阀门2', bbox: [300, 300, 400, 400] },
        ],
        connections: [
          { from: 'comp_1', to: 'comp_2' },
          { from: 'comp_2', to: 'comp_3' },
          { from: 'comp_3', to: 'comp_4' },
          { from: 'comp_4', to: 'comp_5' },
        ]
      };
    }

    // 3. 智能匹配算法
    console.log('\n🧠 智能匹配算法...');
    const matched = intelligentMatching(result.components, stepFiles);

    console.log(`\n✅ 匹配结果:`);
    console.log(`  - PID组件: ${result.components.length}`);
    console.log(`  - 匹配成功: ${matched.matched.length}`);
    console.log(`  - 候选建议: ${matched.suggestions.length}`);
    console.log(`  - 需手动选型: ${matched.needsManualSelection.length}`);

    // 4. 显示匹配详情
    console.log('\n📋 匹配详情:');
    matched.matched.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.component.type} → ${m.stepFile.number} (置信度: ${m.confidence.toFixed(2)})`);
    });

    console.log('\n💡 候选建议:');
    matched.suggestions.slice(0, 10).forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.component.type} - 候选: ${s.candidates.slice(0, 3).map(c => c.number).join(', ')}`);
    });

    // 5. 保存结果
    const outputFile = 'uploads/assembly_output/pid_matched_result.json';
    fs.writeFileSync(outputFile, JSON.stringify({
      pid_recognition: result,
      matching: matched,
      step_library: stepFiles.length
    }, null, 2));

    console.log(`\n💾 结果已保存: ${outputFile}`);

  } catch (error) {
    console.error('❌ 错误:', error);
  }
}

/**
 * 智能匹配算法
 * 根据组件类型、位置、连接关系推荐合适的STEP模型
 */
function intelligentMatching(components, stepFiles) {
  const matched = [];
  const suggestions = [];
  const needsManualSelection = [];

  // 按类型分类STEP文件
  const typePatterns = {
    valve: /^(10000[01]|V)/i,      // 阀门通常1开头
    pump: /^(P|10001)/i,            // 泵P开头或特定编号
    tank: /^(A|T)/i,                // 容器A或T开头
    instrument: /^(101|I)/i,        // 仪表101开头
    fitting: /^(F|100002)/i,        // 管件F开头
  };

  for (const comp of components) {
    const compType = comp.type || 'unknown';

    // 如果组件有明确编号，直接匹配
    if (comp.number || comp.part_number) {
      const number = comp.number || comp.part_number;
      const exactMatch = stepFiles.find(s => s.number === number);

      if (exactMatch) {
        matched.push({
          component: comp,
          stepFile: exactMatch,
          confidence: 1.0,
          matchType: 'exact'
        });
        continue;
      }
    }

    // 按类型模糊匹配
    if (typePatterns[compType]) {
      const pattern = typePatterns[compType];
      const candidates = stepFiles.filter(s => pattern.test(s.number));

      if (candidates.length > 0) {
        // 取前3个候选
        suggestions.push({
          component: comp,
          candidates: candidates.slice(0, 5),
          reason: `类型匹配: ${compType}`
        });

        // 自动选择第一个作为默认匹配
        matched.push({
          component: comp,
          stepFile: candidates[0],
          confidence: 0.7,
          matchType: 'type_based'
        });
      } else {
        needsManualSelection.push(comp);
      }
    } else {
      needsManualSelection.push(comp);
    }
  }

  return {
    matched,
    suggestions,
    needsManualSelection
  };
}

main();
