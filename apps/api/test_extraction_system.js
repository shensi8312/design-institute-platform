const axios = require('axios')
const { Client } = require('pg')

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2FkbWluIiwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWUsInJvbGVJZCI6InJvbGVfYWRtaW4iLCJpYXQiOjE3NjE3MjgzMjIsImV4cCI6MTc2MjMzMzEyMn0.F3N5wkNpKrmww0a6jdqmZ0s3X_liLcadshnNgsPT_C4"

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: { 'Authorization': `Bearer ${TOKEN}` }
})

async function testExtractionSystem() {
  console.log('=== 测试动态提取系统 ===\n')

  try {
    // 1. 创建技术参数提取模板
    console.log('1. 创建技术参数提取模板...')
    const templateData = {
      name: '技术参数提取',
      description: '从技术规范文档中提取关键技术参数',
      category: 'technical_parameters',
      priority: 10,
      prompt_template: `请从以下文本中提取所有技术参数，包括参数名称、数值、单位等信息。

文本内容：
{{TEXT}}

请以JSON格式返回，包含一个parameters数组，每个参数包含name（参数名）、value（数值）、unit（单位）、description（说明）字段。`,
      output_schema: {
        type: 'object',
        properties: {
          parameters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                value: { type: 'string' },
                unit: { type: 'string' },
                description: { type: 'string' }
              },
              required: ['name']
            }
          }
        },
        required: ['parameters']
      }
    }

    const createRes = await api.post('/extraction/templates', templateData)
    const template = createRes.data.data
    console.log(`✅ 模板创建成功: ${template.id}`)
    console.log(`   名称: ${template.name}`)
    console.log(`   分类: ${template.category}\n`)

    // 2. 获取一个PDF文档进行测试
    console.log('2. 查找测试文档...')
    const client = new Client({
      host: 'localhost',
      port: 5433,
      database: 'design_platform',
      user: 'postgres',
      password: 'postgres'
    })
    await client.connect()

    const docResult = await client.query(`
      SELECT d.id, d.name, d.file_type
      FROM knowledge_documents d
      WHERE d.file_type = 'application/pdf'
        AND EXISTS (
          SELECT 1 FROM knowledge_vectors v
          WHERE v.document_id = d.id
          LIMIT 1
        )
      ORDER BY d.created_at DESC
      LIMIT 1
    `)

    if (docResult.rows.length === 0) {
      console.log('❌ 没有找到可用的PDF文档')
      await client.end()
      return
    }

    const doc = docResult.rows[0]
    console.log(`✅ 找到测试文档: ${doc.name}`)
    console.log(`   ID: ${doc.id}\n`)

    // 3. 测试模板提取
    console.log('3. 测试模板提取功能...')
    const vectorResult = await client.query(`
      SELECT chunk_text
      FROM knowledge_vectors
      WHERE document_id = $1
      ORDER BY chunk_index
      LIMIT 3
    `, [doc.id])

    const sampleText = vectorResult.rows.map(r => r.chunk_text).join('\n\n')
    console.log(`   样本文本长度: ${sampleText.length} 字符`)

    const testRes = await api.post(`/extraction/templates/${template.id}/test`, {
      text: sampleText.substring(0, 1000)
    })

    console.log(`✅ 提取测试成功:`)
    console.log(JSON.stringify(testRes.data.data, null, 2))
    console.log()

    // 4. 对文档执行提取
    console.log('4. 对文档执行完整提取...')
    const extractRes = await api.post(`/extraction/documents/${doc.id}/extract`, {
      templateIds: [template.id]
    })

    console.log(`✅ 文档提取完成:`)
    console.log(`   提取结果数: ${extractRes.data.data.length}`)
    console.log(JSON.stringify(extractRes.data.data[0], null, 2))
    console.log()

    // 5. 查询提取结果
    console.log('5. 查询文档的提取结果...')
    const resultsRes = await api.get(`/extraction/documents/${doc.id}/extractions`)

    console.log(`✅ 查询成功:`)
    console.log(`   结果总数: ${resultsRes.data.data.length}`)
    resultsRes.data.data.forEach((r, i) => {
      console.log(`   [${i+1}] ${r.template_name} (${r.extraction_type})`)
      console.log(`       置信度: ${r.confidence}`)
      console.log(`       创建时间: ${r.created_at}`)
    })
    console.log()

    // 6. 获取所有模板
    console.log('6. 获取所有模板列表...')
    const listRes = await api.get('/extraction/templates')
    console.log(`✅ 模板总数: ${listRes.data.data.length}`)
    listRes.data.data.forEach((t, i) => {
      console.log(`   [${i+1}] ${t.name} (${t.category || 'uncategorized'})`)
      console.log(`       启用: ${t.enabled ? '是' : '否'}, 优先级: ${t.priority}`)
    })

    await client.end()

    console.log('\n✅ 动态提取系统测试完成!')

  } catch (error) {
    console.error('\n❌ 测试失败:', error.response?.data || error.message)
    if (error.response?.data) {
      console.error('详细错误:', JSON.stringify(error.response.data, null, 2))
    }
  }
}

testExtractionSystem().catch(console.error).finally(() => process.exit(0))
