/**
 * 批量导入STEP文件到零件库
 * 扫描solidworks文件夹，分析STEP文件，存入parts_catalog
 */

const db = require('../config/database')
const fs = require('fs')
const path = require('path')

async function importSTEPFiles() {
  const stepDir = path.join(__dirname, '../../../../docs/solidworks')

  if (!fs.existsSync(stepDir)) {
    console.error(`❌ 目录不存在: ${stepDir}`)
    process.exit(1)
  }

  const stepFiles = fs.readdirSync(stepDir).filter(f => f.endsWith('.STEP'))
  console.log(`\n📁 找到 ${stepFiles.length} 个STEP文件`)

  let imported = 0
  let skipped = 0
  let errors = 0

  for (const filename of stepFiles) {
    try {
      // 从文件名提取信息 (例如: 100000000527.STEP)
      const fileBaseName = filename.replace('.STEP', '')
      const partId = `PART-${fileBaseName}`

      // 检查是否已存在
      const existing = await db('parts_catalog')
        .where({ part_id: partId })
        .first()

      if (existing) {
        console.log(`  ⏭️  跳过已存在: ${partId}`)
        skipped++
        continue
      }

      // 分析STEP文件内容获取更多信息
      const stepPath = path.join(stepDir, filename)
      const partInfo = analyzeSTEPFile(stepPath, fileBaseName)

      // 插入数据库
      await db('parts_catalog').insert({
        part_id: partId,
        name: partInfo.name,
        family: partInfo.family,
        category: partInfo.category,
        dn: partInfo.dn,
        pn: partInfo.pn,
        material: partInfo.material || 'Stainless Steel',
        model_path: `/solidworks/${filename}`,
        meta: JSON.stringify({
          source: 'STEP_import',
          original_filename: filename,
          import_date: new Date().toISOString()
        }),
        created_at: new Date(),
        updated_at: new Date()
      })

      console.log(`  ✅ 导入: ${partId} (${partInfo.family})`)
      imported++

    } catch (error) {
      console.error(`  ❌ 导入失败 ${filename}: ${error.message}`)
      errors++
    }
  }

  console.log(`\n📊 导入统计:`)
  console.log(`  ✅ 成功导入: ${imported}`)
  console.log(`  ⏭️  跳过已存在: ${skipped}`)
  console.log(`  ❌ 失败: ${errors}`)

  process.exit(0)
}

/**
 * 分析STEP文件获取零件信息
 * 从文件内容或文件名推断零件类型
 */
function analyzeSTEPFile(stepPath, fileBaseName) {
  try {
    // 读取文件前几行获取描述信息
    const content = fs.readFileSync(stepPath, 'utf-8')
    const lines = content.split('\n').slice(0, 50) // 只读前50行

    let name = fileBaseName
    let family = 'unknown'
    let category = 'component'
    let dn = null
    let pn = null

    // 从STEP文件头部提取信息
    for (const line of lines) {
      // FILE_DESCRIPTION
      if (line.includes('FILE_DESCRIPTION')) {
        const match = line.match(/'([^']+)'/)
        if (match) name = match[1].substring(0, 100)
      }

      // 常见零件关键词识别
      const lowerLine = line.toLowerCase()
      if (lowerLine.includes('flange')) {
        family = 'flange'
        category = 'connection'
      } else if (lowerLine.includes('valve')) {
        family = 'valve'
        category = 'control'
      } else if (lowerLine.includes('pipe') || lowerLine.includes('tube')) {
        family = 'pipe'
        category = 'transmission'
      } else if (lowerLine.includes('elbow')) {
        family = 'elbow'
        category = 'connection'
      } else if (lowerLine.includes('tee')) {
        family = 'tee'
        category = 'connection'
      } else if (lowerLine.includes('bolt')) {
        family = 'bolt'
        category = 'fastener'
      } else if (lowerLine.includes('nut')) {
        family = 'nut'
        category = 'fastener'
      }

      // 提取DN (Nominal Diameter)
      const dnMatch = line.match(/DN\s*(\d+)/i)
      if (dnMatch) dn = parseInt(dnMatch[1])

      // 提取PN (Pressure Nominal)
      const pnMatch = line.match(/PN\s*(\d+)/i)
      if (pnMatch) pn = parseInt(pnMatch[1])
    }

    // 如果未识别，尝试从文件名推断
    if (family === 'unknown') {
      const nameLower = fileBaseName.toLowerCase()

      // 基于零件编号模式识别类型（匹配PID选型系统）
      if (/^100001060\d{3}$/.test(fileBaseName) || /^10000105\d{4}$/.test(fileBaseName)) {
        family = 'valve'
        category = 'valve'
      } else if (fileBaseName.startsWith('P') || /^10000236\d{3}$/.test(fileBaseName)) {
        family = 'pump'
        category = 'pump'
      } else if (fileBaseName.startsWith('A') || /^10000026\d{4}$/.test(fileBaseName)) {
        family = 'tank'
        category = 'tank'
      } else if (/^101000092\d{3}$/.test(fileBaseName) || /^101000093\d{3}$/.test(fileBaseName)) {
        family = 'instrument'
        category = 'instrument'
      } else if (/^100002\d{6}$/.test(fileBaseName) || fileBaseName.startsWith('F')) {
        family = 'fitting'
        category = 'fitting'
      } else if (nameLower.startsWith('1000000')) {
        // 其他10开头的标准件
        family = 'standard_part'
        category = 'component'
      }
    }

    return { name, family, category, dn, pn }

  } catch (error) {
    console.warn(`    ⚠️  无法读取STEP内容，使用默认值`)
    return {
      name: fileBaseName,
      family: 'component',
      category: 'general',
      dn: null,
      pn: null
    }
  }
}

// 执行导入
importSTEPFiles().catch(err => {
  console.error('❌ 导入失败:', err)
  process.exit(1)
})
