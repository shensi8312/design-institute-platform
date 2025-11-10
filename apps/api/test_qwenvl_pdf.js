const PIDRecognitionVLService = require('./src/services/pid/PIDRecognitionVLService');
const fs = require('fs');

async function test() {
  try {
    const service = new PIDRecognitionVLService();

    // 测试原始PDF
    const pdfPath = '../../docs/solidworks/其他-301000050672-PID-V1.0.pdf';
    const pdfBuffer = fs.readFileSync(pdfPath);

    console.log('============================================');
    console.log('测试原始PID图纸 (PDF)');
    console.log('============================================\n');

    const result = await service.recognizePID(pdfBuffer, '其他-301000050672-PID-V1.0.pdf');

    console.log('\n📊 识别结果:');
    console.log('  成功:', result.success);
    console.log('  方法:', result.method);
    console.log('  组件数:', result.components.length);
    console.log('  连接数:', result.connections.length);

    console.log('\n识别的组件（前10个）:');
    result.components.slice(0, 10).forEach(c => {
      console.log(`  [${c.tag}] ${c.type} - ${c.description}`);
    });

    console.log('\n连接关系（前5条）:');
    result.connections.slice(0, 5).forEach(conn => {
      console.log(`  ${conn.from} → ${conn.to} (${conn.type})`);
    });

    if (result.summary) {
      console.log('\n📝 流程摘要:');
      console.log('  ' + result.summary.substring(0, 200) + '...');
    }

    console.log('\n✅ 测试完成');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    if (error.stack) {
      console.error('\n堆栈:');
      console.error(error.stack.split('\n').slice(0, 5).join('\n'));
    }
  }
}

test();
