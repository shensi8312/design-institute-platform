#!/usr/bin/env node

/**
 * 测试缓存服务
 */

require('dotenv').config()
const CacheService = require('../src/services/semantic/CacheService')

async function testCacheService() {
  console.log('=== 缓存服务测试 ===\n')

  try {
    // 1. 初始化
    console.log('1️⃣ 初始化 Redis 缓存')
    await CacheService.initialize()
    console.log()

    // 2. 设置缓存
    console.log('2️⃣ 设置缓存')
    const testData = {
      query: '合同条款',
      results: [
        { id: 1, text: '甲方支付条款' },
        { id: 2, text: '乙方责任条款' }
      ]
    }

    await CacheService.set(
      'search',
      { query: '合同条款', domain: 'contract' },
      testData,
      300 // 5分钟TTL
    )
    console.log('✅ 缓存已设置')
    console.log()

    // 3. 获取缓存
    console.log('3️⃣ 获取缓存')
    const cached = await CacheService.get(
      'search',
      { query: '合同条款', domain: 'contract' }
    )

    if (cached) {
      console.log('✅ 缓存命中:', cached)
    } else {
      console.log('❌ 缓存未命中')
    }
    console.log()

    // 4. 缓存未命中测试
    console.log('4️⃣ 测试缓存未命中')
    const notCached = await CacheService.get(
      'search',
      { query: '不存在的查询', domain: 'contract' }
    )

    if (!notCached) {
      console.log('✅ 正确返回 null (缓存未命中)')
    }
    console.log()

    // 5. 模拟搜索场景
    console.log('5️⃣ 模拟搜索场景 (第一次查询 → 缓存 → 第二次查询)')

    const query1Start = Date.now()
    const firstQuery = await simulateSearch('技术规范', false)
    const query1Time = Date.now() - query1Start
    console.log(`   第一次查询耗时: ${query1Time}ms (无缓存)`)

    const query2Start = Date.now()
    const secondQuery = await simulateSearch('技术规范', true)
    const query2Time = Date.now() - query2Start
    console.log(`   第二次查询耗时: ${query2Time}ms (有缓存)`)
    console.log(`   ⚡ 加速比: ${(query1Time / query2Time).toFixed(2)}x`)
    console.log()

    // 6. 清除缓存
    console.log('6️⃣ 清除缓存')
    await CacheService.del('search', { query: '合同条款', domain: 'contract' })
    console.log('✅ 缓存已清除')
    console.log()

    // 7. 批量失效
    console.log('7️⃣ 批量失效测试')
    await CacheService.set('search', { query: 'test1' }, { data: 1 })
    await CacheService.set('search', { query: 'test2' }, { data: 2 })
    await CacheService.set('search', { query: 'test3' }, { data: 3 })

    await CacheService.invalidatePattern('search:*')
    console.log('✅ 已批量失效所有 search: 前缀的缓存')
    console.log()

    // 8. 统计信息
    console.log('8️⃣ 缓存统计')
    const stats = await CacheService.getStats()
    console.log('统计信息:', JSON.stringify(stats, null, 2))
    console.log()

    console.log('✅ 缓存服务测试完成')

  } catch (error) {
    console.error('❌ 测试失败:', error)
    throw error
  } finally {
    await CacheService.close()
    process.exit(0)
  }
}

async function simulateSearch(query, useCache) {
  if (useCache) {
    const cached = await CacheService.get('search', { query })
    if (cached) return cached
  }

  // 模拟数据库/向量库查询 (100ms)
  await new Promise(resolve => setTimeout(resolve, 100))

  const results = [
    { id: 1, text: `结果1 for ${query}` },
    { id: 2, text: `结果2 for ${query}` }
  ]

  if (useCache) {
    await CacheService.set('search', { query }, results, 300)
  }

  return results
}

testCacheService()
