const fs = require('fs').promises
const path = require('path')

async function createAllParts() {
  const solidworksDir = path.join(__dirname, '../../docs/solidworks')

  // 读取所有STEP文件
  const files = await fs.readdir(solidworksDir)
  const stepFiles = files.filter(f => f.endsWith('.STEP'))

  console.log(`📦 solidworks目录共有 ${stepFiles.length} 个STEP文件\n`)

  const parts = []
  let loadedCount = 0

  for (let i = 0; i < stepFiles.length; i++) {
    const filename = stepFiles[i]
    const partNumber = filename.replace('.STEP', '')
    const stepFile = path.join(solidworksDir, filename)

    try {
      const stepData = await fs.readFile(stepFile, 'utf-8')
      const sizeKB = (stepData.length / 1024).toFixed(1)

      console.log(`✅ [${i+1}/${stepFiles.length}] ${filename} (${sizeKB}KB)`)

      const spacing = 100
      const cols = 15
      const row = Math.floor(i / cols)
      const col = i % cols

      parts.push({
        id: `part_${i}`,
        part_number: partNumber,
        position: [col * spacing, row * spacing, 0],
        rotation: [[1,0,0],[0,1,0],[0,0,1]],
        step_data: stepData
      })
      loadedCount++
    } catch (err) {
      console.log(`⚠️  [${i+1}/${stepFiles.length}] 跳过 ${filename}: ${err.message}`)
    }
  }

  const assembly = {
    task_id: 'all-parts-assembly',
    parts,
    metadata: {
      timestamp: new Date().toISOString(),
      total_parts: parts.length
    }
  }

  const outputFile = path.join(__dirname, 'uploads/assembly_output/test_with_step.json')
  await fs.writeFile(outputFile, JSON.stringify(assembly, null, 2))

  const stat = await fs.stat(outputFile)
  const sizeMB = (stat.size / 1024 / 1024).toFixed(1)

  console.log(`\n✅ 生成完成: ${outputFile}`)
  console.log(`   零件总数: ${loadedCount}`)
  console.log(`   文件大小: ${sizeMB}MB`)
  console.log(`\n🌐 在浏览器打开: http://localhost:5555/test_occt_real.html`)
  console.log(`   （按 Ctrl+Shift+R 或 Cmd+Shift+R 强制刷新）`)
}

createAllParts().catch(console.error)
