const MinioService = require('./src/services/utils/MinioService')
const DocumentParserService = require('./src/services/document/DocumentParserService')

async function testMinioRead() {
  try {
    console.log('=== 测试从Minio读取PDF ===\n')

    const testDoc = {
      id: '410d36b3-be17-418b-a8b5-7903acf9bf42',
      name: '10SS411-建筑给水复合金属管道安装.pdf',
      minio_path: '10SS411-建筑给水复合金属管道安装.pdf',
      file_type: 'application/pdf'
    }

    console.log('文档信息:', testDoc)
    console.log('\n1. 尝试从design-platform bucket读取...')

    try {
      const fileBuffer = await MinioService.getFile('design-platform', testDoc.minio_path)
      console.log(`✅ 成功读取文件，大小: ${fileBuffer.length} bytes`)

      console.log('\n2. 解析PDF内容...')
      const parser = new DocumentParserService()
      const textContent = await parser.parseDocument(fileBuffer, testDoc.file_type, testDoc.name)

      console.log(`✅ PDF解析成功`)
      console.log(`文本长度: ${textContent.length} 字符`)
      console.log(`前500字符预览:`)
      console.log(textContent.substring(0, 500))
      console.log('...')

    } catch (error) {
      console.error('❌ 从design-platform读取失败:', error.message)

      console.log('\n尝试其他bucket...')
      try {
        const fileBuffer = await MinioService.getFile('knowledge-documents', testDoc.minio_path)
        console.log(`✅ 从knowledge-documents读取成功，大小: ${fileBuffer.length} bytes`)

        const parser = new DocumentParserService()
        const textContent = await parser.parseDocument(fileBuffer, testDoc.file_type, testDoc.name)
        console.log(`✅ PDF解析成功，文本长度: ${textContent.length}`)
        console.log(`前500字符:`, textContent.substring(0, 500))
      } catch (err2) {
        console.error('❌ 从knowledge-documents也失败:', err2.message)
      }
    }

  } catch (error) {
    console.error('测试失败:', error)
  }

  process.exit(0)
}

testMinioRead()
