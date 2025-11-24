#!/usr/bin/env node

/**
 * 测试增量索引功能
 */

require('dotenv').config()
const SemanticLayerService = require('../src/services/semantic/SemanticLayerService')
const { SemanticDomain, SemanticType } = require('../src/types/SemanticChunk')

async function testIncrementalIndexing() {
  console.log('=== 增量索引测试 ===\n')

  try {
    await SemanticLayerService.initialize()

    // 第一次索引
    console.log('📝 第一次索引 - 3条数据')
    const batch1 = [
      {
        text: '第一章 项目概述\n本项目旨在建设现代化设计院平台。',
        metadata: { doc_id: 'doc1', section: '1' }
      },
      {
        text: '第二章 技术方案\n采用微服务架构设计。',
        metadata: { doc_id: 'doc1', section: '2' }
      },
      {
        text: '第三章 实施计划\n分三期实施,总工期18个月。',
        metadata: { doc_id: 'doc1', section: '3' }
      }
    ]

    const result1 = await SemanticLayerService.indexChunks(
      SemanticDomain.SPEC,
      SemanticType.SECTION,
      batch1,
      { immediate: true, incremental: true, projectId: 'test-incremental' }
    )

    console.log('✅ 第一次索引结果:', result1)
    console.log()

    // 第二次索引 - 无变化
    console.log('📝 第二次索引 - 相同数据 (应该跳过)')
    const result2 = await SemanticLayerService.indexChunks(
      SemanticDomain.SPEC,
      SemanticType.SECTION,
      batch1,
      { immediate: true, incremental: true, projectId: 'test-incremental' }
    )

    console.log('✅ 第二次索引结果:', result2)
    console.log(`   跳过了 ${result2.skipped} 条未变化数据`)
    console.log()

    // 第三次索引 - 部分修改
    console.log('📝 第三次索引 - 修改第2章内容')
    const batch3 = [
      batch1[0], // 未修改
      {
        text: '第二章 技术方案\n采用微服务架构设计,引入Kubernetes容器编排。', // 修改
        metadata: { doc_id: 'doc1', section: '2' }
      },
      batch1[2], // 未修改
      {
        text: '第四章 质量保证\n建立完善的质量管理体系。', // 新增
        metadata: { doc_id: 'doc1', section: '4' }
      }
    ]

    const result3 = await SemanticLayerService.indexChunks(
      SemanticDomain.SPEC,
      SemanticType.SECTION,
      batch3,
      { immediate: true, incremental: true, projectId: 'test-incremental' }
    )

    console.log('✅ 第三次索引结果:', result3)
    console.log(`   新增: ${result3.new} 条`)
    console.log(`   更新: ${result3.updated} 条`)
    console.log(`   跳过: ${result3.skipped} 条`)
    console.log()

    // 测试搜索
    console.log('🔍 测试搜索 - "容器编排"')
    const searchResults = await SemanticLayerService.search(
      '容器编排',
      { domain: SemanticDomain.SPEC, projectId: 'test-incremental' },
      3
    )

    console.log(`找到 ${searchResults.length} 条结果:`)
    searchResults.forEach((r, i) => {
      console.log(`\n${i + 1}. [Score: ${r.score.toFixed(3)}]`)
      console.log(`   ${r.text.substring(0, 100)}...`)
    })

    // 统计
    console.log('\n📊 统计信息:')
    const stats = await SemanticLayerService.getStats(SemanticDomain.SPEC)
    console.log(JSON.stringify(stats, null, 2))

    console.log('\n✅ 增量索引测试完成')

  } catch (error) {
    console.error('❌ 测试失败:', error)
    throw error
  } finally {
    await SemanticLayerService.close()
    process.exit(0)
  }
}

testIncrementalIndexing()
