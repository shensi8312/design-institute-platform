/**
 * 批量导入STEP文件到零件库（简化版 - 无Python依赖）
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

  const stepFiles = fs.readdirSync(stepDir).filter(f =>
    f.endsWith('.STEP') || f.endsWith('.step') || f.endsWith('.STP') || f.endsWith('.stp')
  )
  console.log(`\n📁 找到 ${stepFiles.length} 个STEP文件\n`)

  let imported = 0
  let skipped = 0
  let errors = 0

  for (const filename of stepFiles) {
    try {
      const fileBaseName = filename.replace(/\.(STEP|step|STP|stp)$/, '')
      const partId = `PART-${fileBaseName}`

      // 检查是否已存在
      const existing = await db('parts_catalog')
        .where({ part_id: partId })
        .first()

      if (existing) {
        console.log(`  ⏭️  跳过: ${partId}`)
        skipped++
        continue
      }

      // 简单推断零件属性
      const partInfo = inferPartInfo(fileBaseName)

      // ✅ 只使用表中实际存在的字段
      await db('parts_catalog').insert({
        part_id: partId,
        family: partInfo.family,
        dn: partInfo.dn,
        pn: partInfo.pn,
        end_type: partInfo.end_type,
        face_type: partInfo.face_type,
        std: partInfo.std,
        mat: partInfo.mat,
        model_path: `/solidworks/${filename}`,
        meta: JSON.stringify({
          source: 'STEP_import',
          original_filename: filename,
          import_date: new Date().toISOString()
        })
      })

      console.log(`  ✅ ${partId} (${partInfo.family})`)
      imported++

    } catch (error) {
      console.error(`  ❌ ${filename}: ${error.message}`)
      errors++
    }
  }

  console.log(`\n📊 统计:`)
  console.log(`  ✅ 导入: ${imported}`)
  console.log(`  ⏭️  跳过: ${skipped}`)
  console.log(`  ❌ 失败: ${errors}`)

  process.exit(0)
}

function inferPartInfo(fileBaseName) {
  const name = fileBaseName.toLowerCase()

  // 装配体
  if (name.startsWith('a') && /^a\d+$/.test(name)) {
    return {
      family: 'assembly',
      dn: null,
      pn: 16,
      end_type: null,
      face_type: null,
      std: null,
      mat: 'Unknown'
    }
  }

  // 管道系列
  if (/^1000000\d+/.test(name)) {
    return {
      family: 'pipe',
      dn: 50,
      pn: 16,
      end_type: 'weld',
      face_type: null,
      std: 'ASME B36.10',
      mat: '304'
    }
  }

  // 法兰系列
  if (/^1000010\d+/.test(name)) {
    return {
      family: 'flange',
      dn: 50,
      pn: 16,
      end_type: 'flanged',
      face_type: 'rf',
      std: 'ASME B16.5',
      mat: 'A105'
    }
  }

  // 阀门系列
  if (/^1000020\d+/.test(name) || /^301/.test(name)) {
    return {
      family: 'valve',
      dn: 50,
      pn: 16,
      end_type: 'flanged',
      face_type: 'rf',
      std: 'API 6D',
      mat: '316'
    }
  }

  // 螺栓系列
  if (/^1010/.test(name) || /^401/.test(name)) {
    return {
      family: 'bolt',
      dn: null,
      pn: null,
      end_type: null,
      face_type: null,
      std: 'GB/T 70.1',
      mat: 'B7'
    }
  }

  // 零件系列（P开头）
  if (name.startsWith('p')) {
    return {
      family: 'component',
      dn: null,
      pn: 16,
      end_type: null,
      face_type: null,
      std: null,
      mat: 'Unknown'
    }
  }

  // 默认
  return {
    family: 'component',
    dn: null,
    pn: 16,
    end_type: null,
    face_type: null,
    std: null,
    mat: 'Unknown'
  }
}

// 执行
importSTEPFiles().catch(err => {
  console.error('❌ 失败:', err)
  process.exit(1)
})
