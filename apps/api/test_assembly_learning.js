const axios = require('axios');

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2FkbWluIiwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWUsInJvbGVJZCI6InJvbGVfYWRtaW4iLCJpYXQiOjE3NjI1MTU4NDYsImV4cCI6MTc2MzEyMDY0Nn0.MVLHU0UnFKIzJ10DPCpmmaTfww2zTOmmn-fjYdpa2UU";
const API_URL = "http://localhost:3000";

async function testLearning() {
  try {
    console.log('📤 触发装配规则学习（扫描整个solidworks目录）...');
    
    const response = await axios.post(
      `${API_URL}/api/assembly/learn-rules`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 300000
      }
    );
    
    console.log('✅ 学习成功:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ 学习失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误信息:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

testLearning();
