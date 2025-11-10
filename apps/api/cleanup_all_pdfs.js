const { Client } = require('pg')

async function cleanupAllPDFs() {
  const client = new Client({
    host: 'localhost',
    port: 5433,
    database: 'design_platform',
    user: 'postgres',
    password: 'postgres'
  })

  await client.connect()

  // 删除所有失败记录
  const deleteResult = await client.query(`
    DELETE FROM knowledge_vectors
    WHERE chunk_text LIKE '文件%'
       OR chunk_text LIKE '%测试文档%'
       OR chunk_text LIKE '%解析失败%'
  `)

  console.log(`✅ 已删除 ${deleteResult.rowCount} 条失败记录\n`)

  // 统计所有文档的向量数
  const stats = await client.query(`
    SELECT
      d.name,
      COUNT(v.id) as vector_count,
      COUNT(DISTINCT v.chunk_index) as unique_chunks
    FROM knowledge_documents d
    LEFT JOIN knowledge_vectors v ON d.id = v.document_id
    WHERE d.file_type = 'application/pdf'
    GROUP BY d.name
    ORDER BY vector_count DESC
  `)

  console.log('=== 所有PDF文档向量统计 ===\n')

  let totalVectors = 0
  stats.rows.forEach(row => {
    const name = row.name.length > 50 ? row.name.substring(0, 47) + '...' : row.name
    console.log(`${name.padEnd(50)} | ${String(row.vector_count).padStart(6)} 向量`)
    totalVectors += parseInt(row.vector_count)
  })

  console.log('-'.repeat(65))
  console.log(`总计: ${stats.rows.length} 个PDF, ${totalVectors} 个向量块`)

  await client.end()
}

cleanupAllPDFs().catch(console.error).finally(() => process.exit(0))
