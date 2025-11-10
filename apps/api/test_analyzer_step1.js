#!/usr/bin/env node
/**
 * 分步测试智能文档分析器 - 第一步：文档识别
 */

const IntelligentDocumentAnalyzer = require('./src/services/intelligence/IntelligentDocumentAnalyzer')

const sample = {
  title: 'CECS318-2012 轻质芯模混凝土叠合密肋楼板技术规程',
  content: `
1 总则
1.0.1 为规范轻质芯模混凝土叠合密肋楼板的设计、施工及验收，做到技术先进、安全适用、经济合理、确保质量，制定本规程。
3 材料
3.1 混凝土
3.1.1 预制底板混凝土强度等级不应低于C30；现浇层混凝土强度等级不应低于C25。
  `.trim()
}

async function test() {
  console.log('='.repeat(60))
  console.log('测试第一步：文档识别')
  console.log('='.repeat(60))

  const analyzer = new IntelligentDocumentAnalyzer()

  try {
    console.log('\n开始识别文档...')
    const result = await analyzer.analyzeDocument(sample)

    console.log('\n✅ 识别成功！')
    console.log(JSON.stringify(result, null, 2))

  } catch (error) {
    console.error('\n❌ 识别失败:', error.message)
    console.error(error.stack)
  }

  process.exit(0)
}

test()
