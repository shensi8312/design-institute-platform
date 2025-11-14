const db = require('../apps/api/src/config/database')

/**
 * Week 3/4 演示数据
 * 242装配体 - 16个装配对
 */
async function seed242AssemblyDemo() {
  console.log('🌱 Seeding 242 assembly demo data...')

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
      part_a: 'GB/T 5782 M10×1.5 六角头螺栓',
      part_b: 'GB/T 6170 M10×1.5 六角螺母',
      constraint_type: 'SCREW',
      parameters: { threadSize: 'M10', pitch: 1.5, preload: 8000 },
      confidence: 0.94
    },
    {
      part_a: 'ISO 4017 M6×1.0 六角头螺栓',
      part_b: 'ISO 4032 M6×1.0 六角螺母',
      constraint_type: 'SCREW',
      parameters: { threadSize: 'M6', pitch: 1.0, preload: 3000 },
      confidence: 0.93
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
      part_a: 'ANSI B16.5 150# DN100 法兰',
      part_b: 'ANSI B16.20 DN100 垫片',
      constraint_type: 'COINCIDENT',
      parameters: { nominalSize: 'DN100', pressureRating: '150#', offset: 0 },
      confidence: 0.92
    },

    // VCR接头组件
    {
      part_a: 'VCR 1/4" 接头主体',
      part_b: 'VCR 1/4" 垫圈',
      constraint_type: 'COINCIDENT',
      parameters: { size: '1/4"', offset: 0 },
      confidence: 0.96
    },
    {
      part_a: 'VCR 1/4" 接头主体',
      part_b: 'VCR 1/4" 螺帽',
      constraint_type: 'SCREW',
      parameters: { threadSize: 'UNF 7/16"-20', pitch: 1.27, preload: 4000 },
      confidence: 0.95
    },
    {
      part_a: 'VCR 3/8" 接头主体',
      part_b: 'VCR 3/8" 垫圈',
      constraint_type: 'COINCIDENT',
      parameters: { size: '3/8"', offset: 0 },
      confidence: 0.95
    },

    // 阀门-执行器组件
    {
      part_a: 'DN50 球阀阀体',
      part_b: 'DN50 球阀阀芯',
      constraint_type: 'CONCENTRIC',
      parameters: { nominalSize: 'DN50', clearance: 0.05 },
      confidence: 0.97
    },
    {
      part_a: 'DN50 球阀阀体',
      part_b: 'DN50 气动执行器',
      constraint_type: 'PARALLEL',
      parameters: { offset: 0, angle: 0 },
      confidence: 0.90
    },
    {
      part_a: 'DN100 球阀阀体',
      part_b: 'DN100 球阀阀芯',
      constraint_type: 'CONCENTRIC',
      parameters: { nominalSize: 'DN100', clearance: 0.08 },
      confidence: 0.96
    },

    // 传感器-接头
    {
      part_a: 'PT100 温度传感器',
      part_b: 'M20×1.5 传感器接头',
      constraint_type: 'SCREW',
      parameters: { threadSize: 'M20', pitch: 1.5, preload: 2000 },
      confidence: 0.88
    },
    {
      part_a: 'PT100 温度传感器',
      part_b: 'DN25 T型接头',
      constraint_type: 'PERPENDICULAR',
      parameters: { angle: 90, offset: 0 },
      confidence: 0.85
    },

    // 法兰-阀门
    {
      part_a: 'ANSI B16.5 150# DN50 法兰',
      part_b: 'DN50 球阀阀体',
      constraint_type: 'COINCIDENT',
      parameters: { nominalSize: 'DN50', pressureRating: '150#', offset: 0 },
      confidence: 0.91
    },
    {
      part_a: 'ANSI B16.5 150# DN100 法兰',
      part_b: 'DN100 球阀阀体',
      constraint_type: 'COINCIDENT',
      parameters: { nominalSize: 'DN100', pressureRating: '150#', offset: 0 },
      confidence: 0.90
    },

    // 执行器-传感器
    {
      part_a: 'DN50 气动执行器',
      part_b: 'PT100 温度传感器',
      constraint_type: 'PARALLEL',
      parameters: { offset: 50, angle: 0 },
      confidence: 0.80
    }
  ]

  const records = assemblyPairs.map(pair => ({
    dataset_name: '242装配体',
    part_a: pair.part_a,
    part_b: pair.part_b,
    constraint_type: pair.constraint_type,
    parameters: pair.parameters,
    source: 'demo_seed',
    confidence: pair.confidence
  }))

  await db('assembly_dataset').insert(records)

  const uniqueParts = new Set()
  assemblyPairs.forEach(pair => {
    uniqueParts.add(pair.part_a)
    uniqueParts.add(pair.part_b)
  })

  console.log(`✅ Created ${records.length} assembly pairs with ${uniqueParts.size} unique parts`)
  process.exit(0)
}

seed242AssemblyDemo().catch(err => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
