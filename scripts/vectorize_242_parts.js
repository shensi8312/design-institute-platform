const SemanticMatchingService = require('../apps/api/src/services/semantic/SemanticMatchingService')

/**
 * 向量化242装配体所有零件
 */
async function vectorize242Parts() {
  console.log('🔄 Vectorizing 242 assembly parts...')

  const semanticService = new SemanticMatchingService()

  // 1. 初始化Milvus集合
  await semanticService.initCollection()

  // 2. 向量化数据集
  const results = await semanticService.vectorizeDataset('242装配体')
  console.log(`✅ Vectorized ${results.length} parts`)

  // 3. 测试语义搜索
  console.log('\n🔍 Testing semantic search...')
  const testQueries = ['M8 螺栓', '法兰 DN50', 'VCR接头', '球阀']
  for (const query of testQueries) {
    const similar = await semanticService.findSimilarParts(query, 3)
    console.log(`\nQuery: ${query}`)
    similar.forEach(result => {
      console.log(`  - ${result.part_name} (similarity: ${result.similarity}, category: ${result.category})`)
    })
  }

  // 4. 测试约束推荐
  console.log('\n💡 Testing constraint recommendations...')
  const testPairs = [
    ['M8 螺栓', 'M8 螺母'],
    ['DN50 法兰', 'DN50 垫片']
  ]
  for (const [partA, partB] of testPairs) {
    const recommendations = await semanticService.recommendConstraints(partA, partB)
    console.log(`\nPair: ${partA} ↔ ${partB}`)
    recommendations.forEach(rec => {
      console.log(`  - ${rec.constraint_type} (confidence: ${rec.confidence})`)
      console.log(`    ${rec.reason}`)
    })
  }

  console.log('\n✅ Vectorization and testing complete!')
  process.exit(0)
}

vectorize242Parts().catch(err => {
  console.error('❌ Vectorization failed:', err)
  process.exit(1)
})
