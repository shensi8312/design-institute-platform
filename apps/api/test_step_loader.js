#!/usr/bin/env node
const axios = require('axios');

const TOKEN = process.env.TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2FkbWluIiwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWUsInJvbGVJZCI6InJvbGVfYWRtaW4iLCJpYXQiOjE3NjI3NDA4NDIsImV4cCI6MTc2MzM0NTY0Mn0.9YE6_G96703XIXLHTBq1d0r-Rs4j7NsCZXgWK4VHnIo';

async function testStepLoader() {
  console.log('测试服务端STEP加载API...\n');

  // 测试单个零件加载
  const testParts = ['P0000009449', '100001060023', 'A0000002655'];

  for (const partName of testParts) {
    try {
      console.log(`\n请求: GET /api/step-loader/${partName}`);
      const response = await axios.get(
        `http://localhost:3000/api/step-loader/${partName}`,
        {
          headers: { Authorization: `Bearer ${TOKEN}` }
        }
      );

      if (response.data.success) {
        const { data } = response.data;
        console.log(`✅ ${partName} 加载成功`);
        console.log(`   解析器: ${data.metadata?.parser || 'unknown'}`);
        console.log(`   顶点数: ${data.metadata?.vertexCount || 0}`);
        console.log(`   颜色: RGB(${data.color.r}, ${data.color.g}, ${data.color.b})`);
        console.log(`   包围盒: [${data.boundingBox.min.join(',')}] -> [${data.boundingBox.max.join(',')}]`);
      } else {
        console.log(`❌ ${partName} 加载失败: ${response.data.message}`);
      }
    } catch (error) {
      console.log(`❌ ${partName} 请求失败: ${error.message}`);
    }
  }
}

testStepLoader().catch(console.error);
