const fs = require('fs').promises
const path = require('path')

async function createTestAssembly() {
  const solidworksDir = path.join(__dirname, '../../docs/solidworks')

  // 选择几个零件
  const partNumbers = [
    '100001060023',
    '101000092542',
    '101000092543',
    '100001020944',
    '100001020946'
  ]

  const parts = []

  for (let i = 0; i < partNumbers.length; i++) {
    const partNumber = partNumbers[i]
    const stepFile = path.join(solidworksDir, `${partNumber}.STEP`)

    try {
      const stepData = await fs.readFile(stepFile, 'utf-8')
      console.log(`✅ 读取 ${partNumber}.STEP (${(stepData.length/1024).toFixed(1)}KB)`)

      parts.push({
        id: `part_${i}`,
        part_number: partNumber,
        position: [i * 200, 0, 0],
        rotation: [[1,0,0],[0,1,0],[0,0,1]],
        step_data: stepData
      })
    } catch (err) {
      console.error(`❌ 无法读取 ${partNumber}.STEP:`, err.message)
    }
  }

  const assembly = {
    task_id: 'test-assembly',
    parts,
    metadata: {
      timestamp: new Date().toISOString(),
      total_parts: parts.length
    }
  }

  const outputFile = path.join(__dirname, 'uploads/assembly_output/test_with_step.json')
  await fs.writeFile(outputFile, JSON.stringify(assembly, null, 2))

  console.log(`\n✅ 生成完成: ${outputFile}`)
  console.log(`   零件数: ${parts.length}`)
  console.log(`   文件大小: ${((await fs.stat(outputFile)).size / 1024 / 1024).toFixed(1)}MB`)
}

createTestAssembly().catch(console.error)
