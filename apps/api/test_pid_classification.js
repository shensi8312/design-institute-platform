/**
 * 测试PID分类功能（使用已有识别结果）
 */
const PIDRuleProcessor = require('./src/services/rules/processors/PIDRuleProcessor');

async function testClassification() {
  console.log('🧪 测试PID分类规则引擎...\n');

  // 模拟识别结果（来自之前的tiling识别）
  const testComponents = [
    { tag: 'MV1', type: 'CHECK VALVE', bbox: [950,700,1050,780] },
    { tag: 'CV1', type: 'CHECK VALVE', bbox: [1360,890,1460,940] },
    { tag: 'PT1', type: 'PRESSURE TRANSDUCER', bbox: [1430,790,1590,860] },
    { tag: 'MFC1', type: 'MASS FLOW CONTROLLER', bbox: [1560,720,1670,820] },

    // 介质（应该被正确分类）
    { tag: 'Ar', type: 'LABEL', bbox: [140,520,200,580] },
    { tag: 'H2+He', type: 'LABEL', bbox: [800,520,900,580] },
    { tag: 'Ar-P', type: 'LABEL', bbox: [1390,520,1480,580] },
    { tag: 'H2', type: 'LABEL', bbox: [480,520,540,580] },

    // 规格（应该被正确分类）
    { tag: 'ADJUSTABLE PRESSURE REGULATOR 0~60 PSIG', type: 'LABEL', bbox: [560,110,800,150] },
    { tag: '-15~100PSIG', type: 'LABEL', bbox: [560,300,680,330] },
    { tag: 'MFC3 2000 SCCM', type: 'LABEL', bbox: [560,770,720,800] },
    { tag: '<700Torr', type: 'LABEL', bbox: [980,1340,1050,1370] },
    { tag: '1/4"', type: 'PIPE_SPEC', bbox: [500,560,550,590] },

    // 接口（应该被正确分类）
    { tag: 'TO VAC1', type: 'INTERFACE', bbox: [920,550,1000,580] },
    { tag: 'TO RPS', type: 'INTERFACE', bbox: [900,540,980,570] },
    { tag: 'BTM / Vent', type: 'LABEL', bbox: [950,550,1050,580] }
  ];

  try {
    const processor = new PIDRuleProcessor();

    console.log(`📊 输入: ${testComponents.length} 个组件\n`);

    const result = await processor.classifyComponents(testComponents, {});

    console.log('\n📈 分类结果统计:');
    console.log(`   设备 (devices): ${result.devices.length}`);
    console.log(`   接口 (interfaces): ${result.interfaces.length}`);
    console.log(`   介质 (mediums): ${result.mediums.length}`);
    console.log(`   规格 (specs): ${result.specs.length}`);

    console.log('\n✅ 设备列表:');
    result.devices.forEach(d => console.log(`   - ${d.tag} (${d.type})`));

    console.log('\n✅ 介质列表:');
    result.mediums.forEach(m => console.log(`   - ${m.tag}`));

    console.log('\n✅ 规格列表:');
    result.specs.forEach(s => console.log(`   - ${s.tag}`));

    console.log('\n✅ 接口列表:');
    result.interfaces.forEach(i => console.log(`   - ${i.tag}`));

    // 验证结果
    console.log('\n🔍 验证结果:');
    const expectedDevices = 4;
    const expectedMediums = 4;
    const expectedSpecs = 5;
    const expectedInterfaces = 3;

    const passDevice = result.devices.length === expectedDevices;
    const passMedium = result.mediums.length === expectedMediums;
    const passSpec = result.specs.length === expectedSpecs;
    const passInterface = result.interfaces.length === expectedInterfaces;

    console.log(`   设备数量: ${result.devices.length}/${expectedDevices} ${passDevice ? '✅' : '❌'}`);
    console.log(`   介质数量: ${result.mediums.length}/${expectedMediums} ${passMedium ? '✅' : '❌'}`);
    console.log(`   规格数量: ${result.specs.length}/${expectedSpecs} ${passSpec ? '✅' : '❌'}`);
    console.log(`   接口数量: ${result.interfaces.length}/${expectedInterfaces} ${passInterface ? '✅' : '❌'}`);

    if (passDevice && passMedium && passSpec && passInterface) {
      console.log('\n🎉 所有测试通过！');
    } else {
      console.log('\n❌ 部分测试失败');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

testClassification();
