const SemanticMatchingService = require('../apps/api/src/services/semantic/SemanticMatchingService')

/**
 * Week 3: 向量化242装配零件名称到Milvus
 */

async function vectorize242Parts() {
  console.log('🔄 开始向量化242装配零件...')

  const semanticService = new SemanticMatchingService()

  try {
    // 1. 初始化Milvus集合
    console.log('\n📦 初始化Milvus集合...')
    await semanticService.initCollection()

    // 2. 向量化数据集
    console.log('\n📊 开始向量化数据集...')
    const results = await semanticService.vectorizeDataset('242装配体')

    console.log(`\n✅ 向量化完成！`)
    console.log(`  成功向量化: ${results.length} 个零件`)

    // 3. 测试语义搜索
    console.log('\n🔍 测试语义搜索...')

    const testQueries = [
      'M8 螺栓',
      '法兰 DN50',
      'VCR接头',
      '球阀'
    ]

    for (const query of testQueries) {
      console.log(`\n查询: "${query}"`)
      const similar = await semanticService.findSimilarParts(query, 3)

      if (similar.length > 0) {
        similar.forEach((s, i) => {
          console.log(`  ${i + 1}. ${s.part_name} (相似度: ${s.similarity.toFixed(3)}, 类别: ${s.category})`)
        })
      } else {
        console.log('  未找到相似零件')
      }
    }

    // 4. 测试约束推荐
    console.log('\n\n🎯 测试约束推荐...')

    const testPairs = [
      ['M8 螺栓', 'M8 螺母'],
      ['DN50 法兰', 'DN50 垫片'],
      ['VCR 接头', 'VCR 垫圈']
    ]

    for (const [partA, partB] of testPairs) {
      console.log(`\n零件对: "${partA}" ↔ "${partB}"`)
      const recommendations = await semanticService.recommendConstraints(partA, partB)

      if (recommendations.length > 0) {
        recommendations.forEach((rec, i) => {
          console.log(`  ${i + 1}. ${rec.constraint_type} (置信度: ${rec.confidence.toFixed(3)})`)
          console.log(`     理由: ${rec.reason}`)
        })
      } else {
        console.log('  未找到推荐约束')
      }
    }

  } catch (error) {
    console.error('❌ 向量化失败:', error)
    throw error
  } finally {
    // 关闭数据库连接
    const db = require('../apps/api/src/config/database')
    await db.destroy()
  }
}

// 执行
vectorize242Parts()
  .then(() => {
    console.log('\n\n🎉 Week 3演示完成！')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n💥 失败:', err)
    process.exit(1)
  })
