const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2FkbWluIiwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWUsInJvbGVJZCI6InJvbGVfYWRtaW4iLCJpYXQiOjE3NjI1MTc2MjUsImV4cCI6MTc2MzEyMjQyNX0.zEX4kgHkGqmUS4aefyiWo4HdA1XKXsMboZwJ-bWJuI4";
const API_URL = "http://localhost:3000";

async function testStepUpload() {
  try {
    console.log('📤 测试STEP文件上传学习...\n');

    // 查找STEP文件
    const solidworksDir = path.join(__dirname, '../../docs/solidworks');
    const files = fs.readdirSync(solidworksDir);

    // 使用242文件
    const assemblyFile = 'A0000002632-242.STP';

    const testFilePath = path.join(solidworksDir, assemblyFile);
    if (!fs.existsSync(testFilePath)) {
      console.error(`❌ 文件不存在: ${testFilePath}`);
      return;
    }

    console.log(`✅ 找到装配文件: ${assemblyFile}`);

    const filePath = path.join(solidworksDir, assemblyFile);
    const fileStats = fs.statSync(filePath);
    console.log(`📦 文件大小: ${(fileStats.size / 1024).toFixed(2)} KB\n`);

    // 创建FormData
    const form = new FormData();
    form.append('drawings', fs.createReadStream(filePath), {
      filename: assemblyFile,
      contentType: 'application/octet-stream'
    });

    console.log('🚀 开始上传...');
    const startTime = Date.now();

    const response = await axios.post(
      `${API_URL}/api/assembly/infer`,
      form,
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          ...form.getHeaders()
        },
        timeout: 60000, // 60秒超时
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  用时: ${elapsed}秒\n`);

    console.log('✅ 上传成功!\n');
    console.log('📊 返回结果:');
    console.log(JSON.stringify(response.data, null, 2));

    // 检查metadata
    if (response.data.metadata) {
      const { partsCount, constraintsCount, rulesApplied, llmEnhanced } = response.data.metadata;
      console.log('\n📈 关键指标:');
      console.log(`  零件数量: ${partsCount}`);
      console.log(`  识别约束: ${constraintsCount}`);
      console.log(`  应用规则: ${rulesApplied}`);
      console.log(`  AI增强: ${llmEnhanced ? '是' : '否'}`);

      if (partsCount === 0) {
        console.log('\n⚠️  警告: 零件数量为0，可能STEP解析失败');
      }
      if (constraintsCount === 0) {
        console.log('\n⚠️  警告: 约束数量为0，可能规则匹配失败');
      }
    }

  } catch (error) {
    console.error('\n❌ 测试失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误信息:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

testStepUpload();
