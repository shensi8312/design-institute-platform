const DocumentProcessorService = require('./src/services/document/DocumentProcessorService')

const failedDocIds = [
  '07a4a9a8-d280-4571-a3cf-14375b89f8ac',  // test_upload.txt
  '79596626-88e0-404d-98ea-5e5d73d06120',  // test_location.txt
  '005b1752-1563-4698-9f09-f506e0c6cacc',  // test_graph.txt
  '2a834f81-7303-4fd2-9ed4-599f2ae9c676',  // test_graph.txt
  '95058eda-a52c-49e3-9c97-0c64319fa976'   // ai_doc.txt
]

async function testReprocessDocs() {
  const processor = new DocumentProcessorService()
  
  console.log('=== 开始重新处理失败的文档 ===\n')
  
  for (const docId of failedDocIds) {
    console.log(`\n--- 处理文档 ${docId} ---`)
    try {
      const result = await processor.processDocument(docId)
      
      if (result.success) {
        console.log(`✅ 成功:`, {
          chunks_count: result.chunks_count,
          vectors_count: result.vectors_count,
          graph_nodes_count: result.graph_nodes_count,
          graph_relationships_count: result.graph_relationships_count,
          rules_extracted: result.rules_extracted
        })
      } else {
        console.log(`❌ 失败: ${result.error}`)
      }
    } catch (error) {
      console.error(`💥 异常: ${error.message}`)
    }
    
    // 等待1秒避免过载
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  console.log('\n=== 处理完成 ===')
  process.exit(0)
}

testReprocessDocs().catch(error => {
  console.error('测试失败:', error)
  process.exit(1)
})
