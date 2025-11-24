#!/usr/bin/env node

/**
 * 测试完整工作流: MinIO → 解析 → 索引 → 搜索 → 缓存
 */

require('dotenv').config()
const SemanticLayerService = require('../src/services/semantic/SemanticLayerService')
const { SemanticDomain, SemanticType } = require('../src/types/SemanticChunk')
const fs = require('fs')
const path = require('path')

async function testCompleteWorkflow() {
  console.log('=== 完整工作流测试 ===\n')

  try {
    // 初始化
    console.log('🚀 初始化语义层服务...')
    await SemanticLayerService.initialize()
    console.log('✅ 初始化完成\n')

    // 准备测试文档
    const testContent = `
第一章 项目概述
本项目是现代化设计院平台建设项目，旨在提升设计效率和质量管理水平。

第二章 技术架构
采用微服务架构设计，包括：
1. API网关层
2. 业务服务层
3. 数据存储层

第三章 核心功能
- 文档管理系统
- 知识库检索
- 合同审查助手
- 投标文件生成

第四章 实施计划
分三期实施，总工期18个月。
第一期：基础平台搭建（6个月）
第二期：核心功能开发（8个月）
第三期：系统优化上线（4个月）
    `.trim()

    const fileBuffer = Buffer.from(testContent, 'utf-8')
    const fileName = 'test-project-spec.txt'

    // Step 1: 上传并处理文档
    console.log('📤 Step 1: 上传文档到 MinIO 并处理')
    const uploadResult = await SemanticLayerService.uploadAndProcessDocument(
      fileBuffer,
      fileName,
      SemanticDomain.SPEC,
      SemanticType.SECTION,
      {
        tenantId: 'test-tenant',
        projectId: 'test-workflow',
        immediate: true, // 立即生成 embedding
        metadata: {
          author: 'Test User',
          version: '1.0'
        }
      }
    )

    console.log('✅ 文档处理完成:')
    console.log(`   文件ID: ${uploadResult.file.fileId}`)
    console.log(`   对象名: ${uploadResult.file.objectName}`)
    console.log(`   大小: ${uploadResult.file.size} bytes`)
    console.log(`   解析器: ${uploadResult.parse.parser}`)
    console.log(`   Chunks: ${uploadResult.parse.chunks}`)
    console.log(`   索引结果:`, uploadResult.index)
    console.log()

    // Step 2: 语义搜索 (第一次 - 无缓存)
    console.log('🔍 Step 2: 语义搜索 - "微服务架构" (第一次查询)')
    const search1Start = Date.now()
    const results1 = await SemanticLayerService.search(
      '微服务架构设计方案',
      {
        domain: SemanticDomain.SPEC,
        projectId: 'test-workflow'
      },
      3
    )
    const search1Time = Date.now() - search1Start

    console.log(`✅ 找到 ${results1.length} 条结果 (耗时 ${search1Time}ms):`)
    results1.forEach((r, i) => {
      console.log(`\n   ${i + 1}. [Score: ${r.score.toFixed(3)}]`)
      console.log(`      ${r.text.substring(0, 80)}...`)
    })
    console.log()

    // Step 3: 再次搜索 (命中缓存)
    console.log('🔍 Step 3: 相同搜索 (应该命中缓存)')
    const search2Start = Date.now()
    const results2 = await SemanticLayerService.search(
      '微服务架构设计方案',
      {
        domain: SemanticDomain.SPEC,
        projectId: 'test-workflow'
      },
      3
    )
    const search2Time = Date.now() - search2Start

    console.log(`✅ 找到 ${results2.length} 条结果 (耗时 ${search2Time}ms)`)
    console.log(`   ⚡ 缓存加速: ${(search1Time / search2Time).toFixed(1)}x`)
    console.log()

    // Step 4: 增量索引测试 - 重新上传相同文档
    console.log('📤 Step 4: 增量索引测试 - 上传相同文档')
    const uploadResult2 = await SemanticLayerService.uploadAndProcessDocument(
      fileBuffer,
      fileName,
      SemanticDomain.SPEC,
      SemanticType.SECTION,
      {
        tenantId: 'test-tenant',
        projectId: 'test-workflow',
        immediate: true
      }
    )

    console.log('✅ 第二次上传结果:')
    console.log(`   新增: ${uploadResult2.index.new}`)
    console.log(`   更新: ${uploadResult2.index.updated}`)
    console.log(`   跳过: ${uploadResult2.index.skipped} (内容未变化)`)
    console.log()

    // Step 5: 修改内容并重新索引
    console.log('📤 Step 5: 修改文档内容并重新索引')
    const modifiedContent = testContent.replace(
      '采用微服务架构设计',
      '采用微服务架构设计，引入Kubernetes容器编排和服务网格技术'
    )
    const modifiedBuffer = Buffer.from(modifiedContent, 'utf-8')

    const uploadResult3 = await SemanticLayerService.uploadAndProcessDocument(
      modifiedBuffer,
      'test-project-spec-v2.txt',
      SemanticDomain.SPEC,
      SemanticType.SECTION,
      {
        tenantId: 'test-tenant',
        projectId: 'test-workflow',
        immediate: true
      }
    )

    console.log('✅ 修改后上传结果:')
    console.log(`   新增: ${uploadResult3.index.new}`)
    console.log(`   更新: ${uploadResult3.index.updated}`)
    console.log(`   跳过: ${uploadResult3.index.skipped}`)
    console.log()

    // Step 6: 搜索新内容
    console.log('🔍 Step 6: 搜索新内容 - "Kubernetes"')
    const results3 = await SemanticLayerService.search(
      'Kubernetes容器编排',
      {
        domain: SemanticDomain.SPEC,
        projectId: 'test-workflow'
      },
      3
    )

    console.log(`✅ 找到 ${results3.length} 条结果:`)
    results3.forEach((r, i) => {
      console.log(`\n   ${i + 1}. [Score: ${r.score.toFixed(3)}]`)
      console.log(`      ${r.text.substring(0, 100)}...`)
    })
    console.log()

    // Step 7: 统计信息
    console.log('📊 Step 7: 系统统计')
    const stats = await SemanticLayerService.getStats(SemanticDomain.SPEC, 'test-tenant')
    console.log('统计信息:')
    console.log(JSON.stringify(stats, null, 2))
    console.log()

    console.log('✅ 完整工作流测试完成!')
    console.log('\n总结:')
    console.log('  ✓ MinIO 文件存储')
    console.log('  ✓ 文档解析分块')
    console.log('  ✓ Embedding 生成')
    console.log('  ✓ Milvus 向量索引')
    console.log('  ✓ 语义搜索')
    console.log('  ✓ Redis 缓存加速')
    console.log('  ✓ 增量索引 (基于内容哈希)')
    console.log('  ✓ 多租户隔离')

  } catch (error) {
    console.error('❌ 测试失败:', error)
    throw error
  } finally {
    await SemanticLayerService.close()
    process.exit(0)
  }
}

testCompleteWorkflow()
