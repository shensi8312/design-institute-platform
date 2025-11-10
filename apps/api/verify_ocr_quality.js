const { Client } = require('pg')

async function verifyOCRQuality() {
  const client = new Client({
    host: 'localhost',
    port: 5433,
    database: 'design_platform',
    user: 'postgres',
    password: 'postgres'
  })

  await client.connect()

  console.log('=== 检查并清理重复向量记录 ===\n')

  const docIds = [
    '410d36b3-be17-418b-a8b5-7903acf9bf42',
    '8e835efc-e8c4-4d2e-b26e-5ba3e363becf',
    '4e562699-b337-4d74-a4b4-3e3616e13593'
  ]

  for (const docId of docIds) {
    // 查看该文档的所有向量记录
    const result = await client.query(`
      SELECT
        d.name,
        COUNT(*) as total_vectors,
        COUNT(CASE WHEN v.chunk_text LIKE '文件%' OR v.chunk_text LIKE '%测试文档%' THEN 1 END) as failed_vectors,
        COUNT(CASE WHEN v.chunk_text NOT LIKE '文件%' AND v.chunk_text NOT LIKE '%测试文档%' THEN 1 END) as valid_vectors,
        MIN(v.created_at) as oldest,
        MAX(v.created_at) as newest
      FROM knowledge_documents d
      LEFT JOIN knowledge_vectors v ON d.id = v.document_id
      WHERE d.id = $1
      GROUP BY d.name
    `, [docId])

    if (result.rows.length > 0) {
      const row = result.rows[0]
      console.log(`文档: ${row.name}`)
      console.log(`  总向量数: ${row.total_vectors}`)
      console.log(`  失败向量: ${row.failed_vectors}`)
      console.log(`  有效向量: ${row.valid_vectors}`)
      console.log(`  最早: ${row.oldest}`)
      console.log(`  最新: ${row.newest}`)

      // 如果有失败向量，删除它们
      if (parseInt(row.failed_vectors) > 0) {
        const deleteResult = await client.query(`
          DELETE FROM knowledge_vectors
          WHERE document_id = $1
          AND (chunk_text LIKE '文件%' OR chunk_text LIKE '%测试文档%' OR chunk_text LIKE '%解析失败%')
        `, [docId])

        console.log(`  ✅ 已删除 ${deleteResult.rowCount} 条失败记录\n`)
      } else {
        console.log(`  ✅ 无需清理\n`)
      }
    }
  }

  // 验证清理后的结果
  console.log('\n=== 清理后验证前3个文档的OCR质量 ===\n')

  for (const docId of docIds) {
    const sample = await client.query(`
      SELECT
        d.name,
        LEFT(v.chunk_text, 150) as sample
      FROM knowledge_documents d
      JOIN knowledge_vectors v ON d.id = v.document_id
      WHERE d.id = $1
      ORDER BY v.chunk_index
      LIMIT 2
    `, [docId])

    if (sample.rows.length > 0) {
      console.log(`${sample.rows[0].name}:`)
      sample.rows.forEach((row, i) => {
        const text = row.sample.replace(/\n/g, ' ').substring(0, 120)
        console.log(`  [块${i+1}] ${text}...`)
      })
      console.log()
    }
  }

  await client.end()
  console.log('✅ 验证完成')
}

verifyOCRQuality().catch(console.error).finally(() => process.exit(0))
