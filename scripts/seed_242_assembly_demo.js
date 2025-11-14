const db = require('../apps/api/src/config/database')

/**
 * Week 3 Demo: 创建242装配演示数据
 *
 * 模拟真实的BOM零件名称，用于演示语义匹配功能
 */

async function seed242AssemblyDemo() {
  console.log('📊 创建242装配演示数据...')

  try {
    // 1. 清空现有数据
    await db('assembly_dataset').where({ dataset_name: '242装配体' }).delete()
    console.log('  ✅ 清空旧数据')

    // 2. 准备242装配体的典型零件对
    const assemblyPairs = [
      // 螺栓-螺母配对
      {
        part_a: 'GB/T 70.1 M8×1.25 六角头螺栓',
        part_b: 'GB/T 6170 M8×1.25 六角螺母',
        constraint_type: 'SCREW',
        parameters: { threadSize: 'M8', pitch: 1.25, preload: 5000 },
        confidence: 0.95
      },
      {
        part_a: 'M8 六角螺栓',
        part_b: 'M8 六角螺母',
        constraint_type: 'SCREW',
        parameters: { threadSize: 'M8', pitch: 1.25 },
        confidence: 0.92
      },
      {
        part_a: 'DIN 933 M8 螺栓',
        part_b: 'DIN 934 M8 螺母',
        constraint_type: 'SCREW',
        parameters: { threadSize: 'M8' },
        confidence: 0.90
      },
      {
        part_a: 'GB/T 70.1 M10×1.5 六角头螺栓',
        part_b: 'GB/T 6170 M10×1.5 六角螺母',
        constraint_type: 'SCREW',
        parameters: { threadSize: 'M10', pitch: 1.5, preload: 8000 },
        confidence: 0.95
      },
      {
        part_a: 'M10 内六角螺钉',
        part_b: 'M10 六角螺母',
        constraint_type: 'SCREW',
        parameters: { threadSize: 'M10', pitch: 1.5 },
        confidence: 0.88
      },

      // 法兰-垫片配对
      {
        part_a: 'ANSI B16.5 150# DN50 法兰',
        part_b: 'ANSI B16.20 DN50 垫片',
        constraint_type: 'COINCIDENT',
        parameters: { nominalSize: 'DN50', pressureRating: '150#', offset: 0 },
        confidence: 0.93
      },
      {
        part_a: 'ANSI 150# 2英寸 法兰',
        part_b: 'DN50 金属垫片',
        constraint_type: 'COINCIDENT',
        parameters: { nominalSize: 'DN50', offset: 0 },
        confidence: 0.87
      },
      {
        part_a: 'DIN PN16 DN100 法兰',
        part_b: 'DIN DN100 垫片',
        constraint_type: 'COINCIDENT',
        parameters: { nominalSize: 'DN100', pressureRating: 'PN16', offset: 0 },
        confidence: 0.90
      },

      // VCR接头配对
      {
        part_a: 'Swagelok VCR 1/4" 接头体',
        part_b: 'Swagelok VCR 1/4" 垫圈',
        constraint_type: 'COINCIDENT',
        parameters: { nominalSize: '1/4"', offset: 0 },
        confidence: 0.96
      },
      {
        part_a: 'VCR 6.35mm 接头',
        part_b: 'VCR 6.35mm 金属垫圈',
        constraint_type: 'COINCIDENT',
        parameters: { nominalSize: '1/4"', offset: 0 },
        confidence: 0.91
      },

      // 阀门-法兰配对
      {
        part_a: 'DN50 球阀',
        part_b: 'ANSI 150# DN50 法兰',
        constraint_type: 'COINCIDENT',
        parameters: { nominalSize: 'DN50', offset: 0 },
        confidence: 0.89
      },
      {
        part_a: 'Swagelok SS-4UW 超高纯度波纹管密封阀',
        part_b: 'VCR 1/4" 接头体',
        constraint_type: 'CONCENTRIC',
        parameters: { nominalSize: '1/4"' },
        confidence: 0.88
      },

      // 管道-管件配对
      {
        part_a: 'DN50 不锈钢管道',
        part_b: 'DN50 三通',
        constraint_type: 'CONCENTRIC',
        parameters: { nominalSize: 'DN50' },
        confidence: 0.90
      },
      {
        part_a: '1/4" 不锈钢管',
        part_b: '1/4" 弯头',
        constraint_type: 'CONCENTRIC',
        parameters: { nominalSize: '1/4"' },
        confidence: 0.87
      },

      // 传感器-支架配对
      {
        part_a: '压力传感器 PT-100',
        part_b: '传感器支架 S-01',
        constraint_type: 'COINCIDENT',
        parameters: { offset: 0 },
        confidence: 0.85
      },
      {
        part_a: '温度传感器 TT-200',
        part_b: '传感器安装座',
        constraint_type: 'COINCIDENT',
        parameters: { offset: 0 },
        confidence: 0.82
      }
    ]

    // 3. 插入到数据库
    const records = assemblyPairs.map(pair => ({
      dataset_name: '242装配体',
      part_a: pair.part_a,
      part_b: pair.part_b,
      constraint_type: pair.constraint_type,
      parameters: pair.parameters,
      source: 'demo_seed',
      source_file: '242_assembly_demo',
      confidence: pair.confidence
    }))

    await db('assembly_dataset').insert(records)

    console.log(`✅ 插入 ${records.length} 条装配数据`)

    // 4. 统计信息
    const stats = await getStats()
    console.log('\n📈 数据集统计:')
    console.log(`  总零件对数: ${stats.totalPairs}`)
    console.log(`  唯一零件数: ${stats.uniqueParts}`)
    console.log(`  约束类型分布:`)
    stats.constraintTypes.forEach(ct => {
      console.log(`    - ${ct.constraint_type}: ${ct.count} 条`)
    })

  } catch (error) {
    console.error('❌ 创建演示数据失败:', error)
    throw error
  } finally {
    await db.destroy()
  }
}

async function getStats() {
  const totalPairs = await db('assembly_dataset')
    .where({ dataset_name: '242装配体' })
    .count('* as count')

  const parts = await db('assembly_dataset')
    .where({ dataset_name: '242装配体' })
    .select('part_a', 'part_b')

  const uniqueParts = new Set()
  parts.forEach(p => {
    uniqueParts.add(p.part_a)
    uniqueParts.add(p.part_b)
  })

  const constraintTypes = await db('assembly_dataset')
    .where({ dataset_name: '242装配体' })
    .select('constraint_type')
    .count('* as count')
    .groupBy('constraint_type')

  return {
    totalPairs: parseInt(totalPairs[0].count),
    uniqueParts: uniqueParts.size,
    constraintTypes
  }
}

// 执行
seed242AssemblyDemo()
  .then(() => {
    console.log('\n🎉 演示数据创建成功！')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n💥 失败:', err)
    process.exit(1)
  })
