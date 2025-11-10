require('dotenv').config({ path: '.env.production' });
const { MilvusClient } = require('@zilliz/milvus2-sdk-node');

async function testMilvus() {
  console.log('=== 测试Milvus连接 ===');
  console.log('MILVUS_HOST:', process.env.MILVUS_HOST);
  console.log('MILVUS_USERNAME:', process.env.MILVUS_USERNAME || '(空)');
  console.log('MILVUS_PASSWORD:', process.env.MILVUS_PASSWORD || '(空)');
  
  const client = new MilvusClient({
    address: process.env.MILVUS_HOST || 'localhost:19530',
    username: process.env.MILVUS_USERNAME || '',
    password: process.env.MILVUS_PASSWORD || ''
  });
  
  try {
    console.log('\n检查连接...');
    const collections = await client.listCollections();
    console.log('✅ 连接成功！');
    console.log('现有集合:', collections.collection_names);
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
  }
}

testMilvus();
