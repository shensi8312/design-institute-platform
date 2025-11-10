const DocumentProcessorService = require('./src/services/document/DocumentProcessorService')

// 这些PDF已上传到Minio但向量为0
const failedPdfIds = [
  '410d36b3-be17-418b-a8b5-7903acf9bf42',  // 10SS411-建筑给水复合金属管道安装.pdf
  '8e835efc-e8c4-4d2e-b26e-5ba3e363becf',  // 1087263.pdf
  '4e562699-b337-4d74-a4b4-3e3616e13593',  // 09水利水电工程钻孔压水试验规程
  '6d28096e-b63e-4eeb-9fdb-9462d32b4b96',  // 06-09-12-18-SG432-1预应力溷凝土双T板.pdf
  'd0502d81-aef0-468c-aa55-936834f05363',  // 04K502热水集中采暖分户计量系统施工安装.pdf
  'fd593aff-e222-484a-ada4-a4e006e88891',  // 02D501-2等电位联结安装.pdf
  'dba97e93-732e-41c5-8075-cfa5f2f12006',  // 01K403风机盘管安装.pdf
  '55450414-7d1a-425b-a969-3c66b83ed8c1',  // (高清正版) GB T 9341-2008 塑料 弯曲性能的测定 标准.pdf
  '1019a718-b769-4ddd-a4e6-c7ef388b8b58',  // (正版） GJB 150.11A-2009 .pdf
  '1cb3cd19-00db-41da-b767-bfaeb1724dd0'   // (办公建筑设计规范)JGJ67-2006.pdf
]

async function testReprocessPdfs() {
  const processor = new DocumentProcessorService()

  console.log('=== 开始重新处理PDF文档 ===\n')
  console.log(`共${failedPdfIds.length}个PDF需要处理\n`)

  let successCount = 0
  let failCount = 0

  for (let idx = 0; idx < failedPdfIds.length; idx++) {
    const docId = failedPdfIds[idx]
    console.log(`\n[${idx + 1}/${failedPdfIds.length}] 处理文档 ${docId}`)

    try {
      const result = await processor.processDocument(docId)

      if (result.success) {
        successCount++
        console.log(`✅ 成功:`, {
          chunks: result.chunks_count,
          vectors: result.vectors_count,
          entities: result.graph_nodes_count,
          relations: result.graph_relationships_count
        })
      } else {
        failCount++
        console.log(`❌ 失败: ${result.error}`)
      }
    } catch (error) {
      failCount++
      console.error(`💥 异常: ${error.message}`)
    }

    // 等待2秒避免过载
    if (idx < failedPdfIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  console.log('\n=== 处理完成 ===')
  console.log(`✅ 成功: ${successCount}`)
  console.log(`❌ 失败: ${failCount}`)
  console.log(`📊 成功率: ${(successCount / failedPdfIds.length * 100).toFixed(1)}%`)

  process.exit(0)
}

testReprocessPdfs().catch(error => {
  console.error('测试失败:', error)
  process.exit(1)
})
