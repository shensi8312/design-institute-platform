const DocumentProcessorService = require('./src/services/document/DocumentProcessorService')

// 测试一个扫描PDF的OCR识别
const testPdfId = '410d36b3-be17-418b-a8b5-7903acf9bf42'  // 10SS411-建筑给水复合金属管道安装.pdf

async function testOcrPdf() {
  const processor = new DocumentProcessorService()

  console.log('=== 测试PDF OCR识别 ===\n')
  console.log(`测试文档: ${testPdfId}`)
  console.log('预期: 从Minio读取 -> PDF解析 -> 触发OCR -> 提取大量文本\n')

  try {
    const result = await processor.processDocument(testPdfId)

    if (result.success) {
      console.log('\n✅ 处理成功!')
      console.log(`- 文本分块数: ${result.chunks_count}`)
      console.log(`- 向量数: ${result.vectors_count}`)
      console.log(`- 图谱节点: ${result.graph_nodes_count}`)
      console.log(`- 知识关系: ${result.graph_relationships_count}`)

      if (result.chunks_count > 10) {
        console.log('\n🎉 OCR识别成功! 提取到大量文本内容')
      } else {
        console.log('\n⚠️  可能OCR未触发或识别失败，分块数太少')
      }
    } else {
      console.log('\n❌ 处理失败:', result.error)
    }
  } catch (error) {
    console.error('\n💥 异常:', error.message)
    console.error(error.stack)
  }

  process.exit(0)
}

testOcrPdf()
