const fs = require('fs').promises
const path = require('path')

async function createFullAssembly() {
  const solidworksDir = path.join(__dirname, '../../docs/solidworks')

  // 读取装配结果（从test_full_flow.sh生成的）
  const assemblyResultFile = path.join(__dirname, '/tmp/assembly_result.json')

  let assemblyData
  try {
    const data = await fs.readFile(assemblyResultFile, 'utf-8')
    assemblyData = JSON.parse(data)
  } catch (err) {
    console.log('⚠️  无法读取装配结果，使用模拟数据')
    // 使用从test_full_flow.sh看到的138个零件
    assemblyData = {
      assembly: {
        parts: [
          { part_id: 'PART-100000000527' },
          { part_id: 'PART-100000000528' },
          { part_id: 'PART-100000000529' },
          { part_id: 'PART-100000051073' },
          { part_id: 'PART-100000060322' },
          { part_id: 'PART-100001020385' },
          { part_id: 'PART-100001020423' },
          { part_id: 'PART-100001020546' },
          { part_id: 'PART-100001020576' },
          { part_id: 'PART-100001020941' },
          { part_id: 'PART-100001020943' },
          { part_id: 'PART-100001020944' },
          { part_id: 'PART-100001020946' },
          { part_id: 'PART-100001060022' },
          { part_id: 'PART-100001060023' },
          { part_id: 'PART-100001060024' },
          { part_id: 'PART-100001060025' },
          { part_id: 'PART-100002130279' },
          { part_id: 'PART-100002140576' },
          { part_id: 'PART-100012001017' },
          { part_id: 'PART-101000022849' },
          { part_id: 'PART-101000035397' },
          { part_id: 'PART-101000036750' },
          { part_id: 'PART-101000036752' },
          { part_id: 'PART-101000036753' },
          { part_id: 'PART-101000036760' },
          { part_id: 'PART-101000046815' },
          { part_id: 'PART-101000050783' },
          { part_id: 'PART-101000051728' },
          { part_id: 'PART-101000092534' },
          { part_id: 'PART-101000092542' },
          { part_id: 'PART-101000092543' },
          { part_id: 'PART-101000092544' },
          { part_id: 'PART-101000092545' },
          { part_id: 'PART-101000092546' },
          { part_id: 'PART-101000092547' },
          { part_id: 'PART-101000092549' },
          { part_id: 'PART-101000092551' },
          { part_id: 'PART-101000092552' },
          { part_id: 'PART-101000092554' },
          { part_id: 'PART-101000092555' },
          { part_id: 'PART-101000092558' },
          { part_id: 'PART-101000092559' },
          { part_id: 'PART-101000092565' },
          { part_id: 'PART-301000038046' },
          { part_id: 'PART-301000050672' }
        ]
      }
    }
  }

  const parts = []
  let loadedCount = 0
  let skippedCount = 0

  for (let i = 0; i < assemblyData.assembly.parts.length; i++) {
    const part = assemblyData.assembly.parts[i]
    // 提取零件编号（去掉PART-前缀）
    const partNumber = part.part_id.replace('PART-', '')
    const stepFile = path.join(solidworksDir, `${partNumber}.STEP`)

    try {
      const stepData = await fs.readFile(stepFile, 'utf-8')
      console.log(`✅ [${i+1}/${assemblyData.assembly.parts.length}] ${partNumber}.STEP (${(stepData.length/1024).toFixed(1)}KB)`)

      const spacing = 50 // 零件间距
      const cols = 10 // 每行10个零件
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
      console.log(`⚠️  [${i+1}/${assemblyData.assembly.parts.length}] 跳过 ${partNumber}.STEP`)
      skippedCount++
    }
  }

  const assembly = {
    task_id: 'full-assembly',
    parts,
    metadata: {
      timestamp: new Date().toISOString(),
      total_parts: parts.length,
      loaded: loadedCount,
      skipped: skippedCount
    }
  }

  const outputFile = path.join(__dirname, 'uploads/assembly_output/test_with_step.json')
  await fs.writeFile(outputFile, JSON.stringify(assembly, null, 2))

  console.log(`\n✅ 生成完成: ${outputFile}`)
  console.log(`   已加载: ${loadedCount} 个零件`)
  console.log(`   已跳过: ${skippedCount} 个零件`)
  console.log(`   文件大小: ${((await fs.stat(outputFile)).size / 1024 / 1024).toFixed(1)}MB`)
  console.log(`\n🌐 在浏览器打开: http://localhost:5555/test_occt_real.html`)
}

createFullAssembly().catch(console.error)
