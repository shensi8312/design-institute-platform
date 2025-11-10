#!/usr/bin/env node
const xlsx = require('xlsx')
const fs = require('fs')

// 测试BOM解析
const bomBuffer = fs.readFileSync('/tmp/test_bom.csv')
const workbook = xlsx.read(bomBuffer, { type: 'buffer' })
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const data = xlsx.utils.sheet_to_json(sheet)

console.log('📋 BOM解析结果:')
console.log('列名:', Object.keys(data[0]))
console.log('\n零件列表:')
data.forEach((row, i) => {
  console.log(`\n零件 ${i + 1}:`)
  console.log('  原始行:', JSON.stringify(row, null, 2))
  console.log('  零件号:', row['零件号'] || row['Part Number'] || row['partNumber'] || row['编号'])
})

// 测试标准件匹配
const standardParts = {
  'VCR-4-VS-2': { type: 'VCR接头', thread: 'M12x1.5' },
  'GB/T 70.1-M8': { type: '六角头螺栓', thread: 'M8x1.25' },
  'GB/T 6170-M8': { type: '六角螺母', thread: 'M8x1.25' }
}

console.log('\n🔍 标准件匹配测试:')
data.forEach((row, i) => {
  const partNumber = row['零件号'] || row['Part Number'] || row['partNumber'] || row['编号']
  console.log(`\n零件 ${i + 1}: "${partNumber}"`)

  if (standardParts[partNumber]) {
    console.log('  ✅ 精确匹配:', standardParts[partNumber])
  } else {
    console.log('  ❌ 未匹配')

    // 尝试模糊匹配
    for (const [key, value] of Object.entries(standardParts)) {
      if (partNumber && partNumber.startsWith(key.split('-')[0])) {
        console.log(`  🔍 模糊匹配 ${key}:`, value)
      }
    }
  }
})
