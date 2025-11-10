const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2FkbWluIiwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWUsInJvbGVJZCI6InJvbGVfYWRtaW4iLCJpYXQiOjE3NjI3NDA4NDIsImV4cCI6MTc2MzM0NTY0Mn0.9YE6_G96703XIXLHTBq1d0r-Rs4j7NsCZXgWK4VHnIo";

async function testStepAssembly() {
  console.log('🚀 测试STEP装配生成...\n');

  const response = await fetch('http://localhost:3000/api/assembly/generate-from-step', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`
    },
    body: JSON.stringify({
      assembly_file: 'A0000002627.STEP'
    })
  });

  const result = await response.json();

  if (result.success) {
    console.log('✅ 装配生成成功!');
    console.log('📦 零件数:', result.data.assembly.parts.length);
    console.log('🔗 约束数:', result.data.assembly.constraints.length);
    console.log('👀 查看器:', 'http://localhost:3000' + result.data.viewer_url);
    console.log('\n🎉 打开浏览器访问: http://localhost:3000/test-viewer.html\n');
  } else {
    console.error('❌ 失败:', result.message);
  }
}

testStepAssembly().catch(console.error);
