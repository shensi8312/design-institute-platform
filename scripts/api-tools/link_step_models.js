/**
 * 关联STEP文件到零件库
 */
const db = require('./src/config/database')
const fs = require('fs')
const path = require('path')

async function linkSTEPModels() {
  const stepDir = path.join(__dirname, '../../docs/solidworks')
  const stepFiles = fs.readdirSync(stepDir).filter(f => f.endsWith('.STEP'))

  console.log(`找到 ${stepFiles.length} 个STEP文件`)

  // 示例映射 (简化版,实际需要分析STEP文件内容)
  const updates = []

  // 选择几个STEP文件作为示例零件
  const sampleMappings = [
    { part_id: 'FLANGE-DN25-PN16-RF', step_file: stepFiles[0] },
    { part_id: 'VALVE-BALL-DN25-PN16', step_file: stepFiles[1] },
    { part_id: 'PIPE-DN25-SCH40', step_file: stepFiles[2] },
    { part_id: 'FLANGE-DN50-PN16-RF', step_file: stepFiles[3] }
  ]

  for (const mapping of sampleMappings) {
    const modelPath = `/solidworks/${mapping.step_file}`
    await db('parts_catalog')
      .where({ part_id: mapping.part_id })
      .update({ model_path: modelPath })

    console.log(`✅ ${mapping.part_id} → ${modelPath}`)
    updates.push(mapping)
  }

  console.log(`\n✅ 更新了 ${updates.length} 个零件模型路径`)
  process.exit(0)
}

linkSTEPModels().catch(err => {
  console.error('❌ 失败:', err)
  process.exit(1)
})
