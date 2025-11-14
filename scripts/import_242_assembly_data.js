const db = require('../apps/api/src/config/database')

/**
 * Week 3: 导入242装配历史数据
 *
 * 从assembly_rules表中提取已学习的装配约束，导入到assembly_dataset表中
 * 这样SemanticMatchingService就可以基于历史数据进行语义匹配
 */

async function import242AssemblyData() {
  console.log('📊 开始导入242装配历史数据...')

  try {
    // 1. 查询所有已学习的装配规则
    const rules = await db('assembly_rules')
      .select('*')
      .where('is_active', true)

    console.log(`  找到 ${rules.length} 条装配规则`)

    if (rules.length === 0) {
      console.log('⚠️  没有找到装配规则，请先运行BOM+STEP学习')
      return
    }

    // 2. 转换规则为assembly_dataset格式
    const datasetRecords = []

    for (const rule of rules) {
      // 提取零件A和零件B的名称
      const partA = extractPartName(rule.part_a_pattern)
      const partB = extractPartName(rule.part_b_pattern)

      if (!partA || !partB) {
        console.log(`  ⏭️  跳过规则 ${rule.rule_id}: 无法提取零件名称`)
        continue
      }

      // 提取约束类型和参数
      const constraintType = mapConstraintType(rule.constraint_type)
      const parameters = extractParameters(rule)

      datasetRecords.push({
        dataset_name: '242装配体',
        part_a: partA,
        part_b: partB,
        constraint_type: constraintType,
        parameters: parameters,
        source: rule.source || 'bom_step_learned',
        source_file: rule.rule_id,
        confidence: rule.confidence || 0.85
      })
    }

    console.log(`  准备导入 ${datasetRecords.length} 条装配数据`)

    // 3. 批量插入到assembly_dataset（去重）
    let insertedCount = 0
    let skippedCount = 0

    for (const record of datasetRecords) {
      // 检查是否已存在
      const existing = await db('assembly_dataset')
        .where({
          dataset_name: record.dataset_name,
          part_a: record.part_a,
          part_b: record.part_b,
          constraint_type: record.constraint_type
        })
        .first()

      if (existing) {
        skippedCount++
        continue
      }

      await db('assembly_dataset').insert(record)
      insertedCount++
    }

    console.log(`✅ 导入完成: ${insertedCount} 条新数据, ${skippedCount} 条已存在`)

    // 4. 统计导入结果
    const stats = await getImportStats()
    console.log('\n📈 导入统计:')
    console.log(`  总零件对数: ${stats.totalPairs}`)
    console.log(`  约束类型分布:`)
    stats.constraintTypes.forEach(ct => {
      console.log(`    - ${ct.constraint_type}: ${ct.count} 条`)
    })
    console.log(`  置信度范围: ${stats.minConfidence} ~ ${stats.maxConfidence}`)

  } catch (error) {
    console.error('❌ 导入失败:', error)
    throw error
  } finally {
    await db.destroy()
  }
}

/**
 * 从pattern中提取零件名称
 */
function extractPartName(pattern) {
  if (!pattern) return null

  // pattern格式: {"type":"bolt","threadSize":"M8"} 或 "螺栓 M8" 等
  if (typeof pattern === 'object') {
    // JSON格式
    const type = pattern.type || ''
    const threadSize = pattern.threadSize || pattern.thread_size || ''
    const nominalSize = pattern.nominalSize || pattern.nominal_size || ''
    const rating = pattern.rating || pattern.pressure_rating || ''

    // 组合成名称
    if (type === 'bolt' || type === 'screw') {
      return `${threadSize} 螺栓`.trim()
    } else if (type === 'nut') {
      return `${threadSize} 螺母`.trim()
    } else if (type === 'flange') {
      return `${rating} ${nominalSize} 法兰`.trim()
    } else if (type === 'gasket') {
      return `${nominalSize} 垫片`.trim()
    } else if (type === 'valve') {
      return `${nominalSize} 阀门`.trim()
    } else {
      return JSON.stringify(pattern)
    }
  } else if (typeof pattern === 'string') {
    // 字符串格式直接返回
    return pattern
  }

  return null
}

/**
 * 映射约束类型（从assembly_rules到标准约束类型）
 */
function mapConstraintType(ruleType) {
  const mapping = {
    'BOLT_NUT': 'SCREW',
    'FLANGE_GASKET': 'COINCIDENT',
    'VCR': 'COINCIDENT',
    'VALVE_GASKET': 'COINCIDENT',
    'SENSOR_SUPPORT': 'COINCIDENT',
    'PIPE_FITTING': 'CONCENTRIC',
    'STEP_CONCENTRIC': 'CONCENTRIC',
    'STEP_COINCIDENT': 'COINCIDENT',
    'STEP_PARALLEL': 'PARALLEL',
    'STEP_PERPENDICULAR': 'PERPENDICULAR'
  }

  return mapping[ruleType] || ruleType
}

/**
 * 提取约束参数
 */
function extractParameters(rule) {
  const params = {}

  if (rule.thread_size) {
    params.threadSize = rule.thread_size
  }

  if (rule.pitch) {
    params.pitch = parseFloat(rule.pitch)
  }

  if (rule.nominal_size) {
    params.nominalSize = rule.nominal_size
  }

  if (rule.pressure_rating) {
    params.pressureRating = rule.pressure_rating
  }

  if (rule.material) {
    params.material = rule.material
  }

  // 从metadata中提取其他参数
  if (rule.metadata && typeof rule.metadata === 'object') {
    Object.assign(params, rule.metadata)
  }

  return params
}

/**
 * 获取导入统计信息
 */
async function getImportStats() {
  const totalPairs = await db('assembly_dataset')
    .where({ dataset_name: '242装配体' })
    .count('* as count')

  const constraintTypes = await db('assembly_dataset')
    .where({ dataset_name: '242装配体' })
    .select('constraint_type')
    .count('* as count')
    .groupBy('constraint_type')

  const confidenceRange = await db('assembly_dataset')
    .where({ dataset_name: '242装配体' })
    .min('confidence as minConfidence')
    .max('confidence as maxConfidence')
    .first()

  return {
    totalPairs: parseInt(totalPairs[0].count),
    constraintTypes,
    minConfidence: parseFloat(confidenceRange.minConfidence || 0),
    maxConfidence: parseFloat(confidenceRange.maxConfidence || 0)
  }
}

// 执行导入
import242AssemblyData()
  .then(() => {
    console.log('\n🎉 导入成功！')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n💥 导入失败:', err)
    process.exit(1)
  })
