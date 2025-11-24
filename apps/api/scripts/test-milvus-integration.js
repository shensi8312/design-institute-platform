#!/usr/bin/env node

/**
 * 测试 Milvus 向量库集成
 */

require('dotenv').config()
const MilvusClient = require('../src/services/utils/MilvusClient')

async function testMilvusIntegration() {
  console.log('=== Milvus 向量库集成测试 ===\n')

  const client = new MilvusClient()

  try {
    // 1. 初始化
    console.log('1️⃣ 初始化 Milvus 客户端')
    await client.initialize()
    console.log()

    // 2. 健康检查
    console.log('2️⃣ 健康检查')
    const health = await client.healthCheck()
    console.log('健康状态:', health)
    console.log()

    // 3. 插入测试数据
    console.log('3️⃣ 插入测试向量')
    const testChunks = [
      {
        id: 'contract:clause:test001',
        domain: 'contract',
        type: 'clause',
        text: '甲方应在合同签订后30个工作日内支付定金。',
        metadata: { clause_type: 'payment', risk_level: 'medium' },
        embedding: Array(768).fill(0).map(() => Math.random())
      },
      {
        id: 'contract:clause:test002',
        domain: 'contract',
        type: 'clause',
        text: '项目知识产权归甲方所有。',
        metadata: { clause_type: 'ip', risk_level: 'high' },
        embedding: Array(768).fill(0).map(() => Math.random())
      }
    ]

    const insertResult = await client.upsert(testChunks)
    console.log('插入结果:', insertResult)
    console.log()

    // 4. 搜索测试
    console.log('4️⃣ 语义搜索测试')
    const query = '知识产权条款'
    console.log(`查询: "${query}"`)

    const searchResults = await client.search(
      query,
      { domain: 'contract', type: 'clause' },
      2
    )

    console.log(`\n找到 ${searchResults.length} 条结果:`)
    searchResults.forEach((result, i) => {
      console.log(`\n${i + 1}. [Score: ${result.score.toFixed(3)}] ${result.id}`)
      console.log(`   文本: ${result.text}`)
      console.log(`   元数据:`, result.metadata)
    })
    console.log()

    // 5. 过滤搜索测试
    console.log('5️⃣ 过滤搜索测试 (domain=contract)')
    const filteredResults = await client.search(
      '条款',
      { domain: 'contract' },
      5
    )

    console.log(`找到 ${filteredResults.length} 条结果`)
    console.log()

    // 6. 删除测试
    console.log('6️⃣ 删除测试')
    const deleteResult = await client.delete(['contract:clause:test001'])
    console.log('删除结果:', deleteResult)
    console.log()

    console.log('✅ Milvus 集成测试完成')

  } catch (error) {
    console.error('❌ 测试失败:', error)
    throw error
  } finally {
    await client.close()
    process.exit(0)
  }
}

testMilvusIntegration()
