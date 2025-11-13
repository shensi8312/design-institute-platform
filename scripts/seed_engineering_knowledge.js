const db = require('../apps/api/src/config/database')

async function seedEngineeringKnowledge() {
  console.log('📚 开始导入工程知识数据...')

  // 1. 螺纹标准
  const threadData = [
    { standard_system: 'metric', thread_size: 'M3', pitch: 0.5, minor_diameter: 2.459, major_diameter: 3.0,
      torque_specs: { steel: 0.5, stainless: 0.4 }, standard_ref: 'GB/T 196-2003' },
    { standard_system: 'metric', thread_size: 'M4', pitch: 0.7, minor_diameter: 3.242, major_diameter: 4.0,
      torque_specs: { steel: 1.2, stainless: 1.0 }, standard_ref: 'GB/T 196-2003' },
    { standard_system: 'metric', thread_size: 'M5', pitch: 0.8, minor_diameter: 4.134, major_diameter: 5.0,
      torque_specs: { steel: 2.5, stainless: 2.0 }, standard_ref: 'GB/T 196-2003' },
    { standard_system: 'metric', thread_size: 'M6', pitch: 1.0, minor_diameter: 4.917, major_diameter: 6.0,
      torque_specs: { steel: 5.0, stainless: 4.0 }, standard_ref: 'GB/T 196-2003' },
    { standard_system: 'metric', thread_size: 'M8', pitch: 1.25, minor_diameter: 6.647, major_diameter: 8.0,
      torque_specs: { steel: 10, stainless: 8 }, standard_ref: 'GB/T 196-2003' },
    { standard_system: 'metric', thread_size: 'M10', pitch: 1.5, minor_diameter: 8.376, major_diameter: 10.0,
      torque_specs: { steel: 20, stainless: 16 }, standard_ref: 'GB/T 196-2003' },
    { standard_system: 'metric', thread_size: 'M12', pitch: 1.75, minor_diameter: 10.106, major_diameter: 12.0,
      torque_specs: { steel: 35, stainless: 28 }, standard_ref: 'GB/T 196-2003' },
    { standard_system: 'metric', thread_size: 'M16', pitch: 2.0, minor_diameter: 13.835, major_diameter: 16.0,
      torque_specs: { steel: 85, stainless: 68 }, standard_ref: 'GB/T 196-2003' },
    { standard_system: 'metric', thread_size: 'M20', pitch: 2.5, minor_diameter: 17.294, major_diameter: 20.0,
      torque_specs: { steel: 165, stainless: 132 }, standard_ref: 'GB/T 196-2003' }
  ]

  for (const thread of threadData) {
    await db('thread_standards').insert(thread).onConflict(['standard_system', 'thread_size']).merge()
  }
  console.log(`✅ 导入 ${threadData.length} 条螺纹标准`)

  // 2. 法兰标准
  const flangeData = [
    { standard_system: 'ANSI', pressure_rating: '150#', nominal_size: 'DN50', max_pressure: 19.6,
      outer_diameter: 152.4, thickness: 11.2, bolt_circle_diameter: 120.7, bolt_holes: 4, bolt_size: 'M16',
      standard_ref: 'ASME B16.5' },
    { standard_system: 'ANSI', pressure_rating: '150#', nominal_size: 'DN80', max_pressure: 19.6,
      outer_diameter: 190.5, thickness: 12.7, bolt_circle_diameter: 152.4, bolt_holes: 4, bolt_size: 'M16',
      standard_ref: 'ASME B16.5' },
    { standard_system: 'DIN', pressure_rating: 'PN16', nominal_size: 'DN50', max_pressure: 16,
      outer_diameter: 165, thickness: 14, bolt_circle_diameter: 125, bolt_holes: 4, bolt_size: 'M16',
      standard_ref: 'DIN 2501' },
    { standard_system: 'DIN', pressure_rating: 'PN40', nominal_size: 'DN50', max_pressure: 40,
      outer_diameter: 165, thickness: 18, bolt_circle_diameter: 125, bolt_holes: 4, bolt_size: 'M16',
      standard_ref: 'DIN 2501' }
  ]

  for (const flange of flangeData) {
    await db('flange_standards').insert(flange).onConflict(['standard_system', 'pressure_rating', 'nominal_size']).merge()
  }
  console.log(`✅ 导入 ${flangeData.length} 条法兰标准`)

  // 3. 危险品隔离距离
  const hazardData = [
    { fluid_type_1: 'H2', fluid_type_2: 'O2', min_distance: 3000, risk_level: 'critical',
      reason: '氢氧混合极度危险', standard_ref: 'GB 50016' },
    { fluid_type_1: 'H2', fluid_type_2: 'H2', min_distance: 1000, risk_level: 'low',
      reason: '同种气体' },
    { fluid_type_1: 'H2', fluid_type_2: 'Cl2', min_distance: 2000, risk_level: 'high',
      reason: '氢气与氯气反应' },
    { fluid_type_1: 'O2', fluid_type_2: 'O2', min_distance: 1000, risk_level: 'low',
      reason: '同种气体' },
    { fluid_type_1: 'Cl2', fluid_type_2: 'NH3', min_distance: 3000, risk_level: 'critical',
      reason: '氯气与氨气反应剧烈' },
    { fluid_type_1: 'N2', fluid_type_2: 'N2', min_distance: 500, risk_level: 'low',
      reason: '惰性气体' }
  ]

  for (const hazard of hazardData) {
    await db('hazard_isolation_distances').insert(hazard).onConflict(['fluid_type_1', 'fluid_type_2']).merge()
  }
  console.log(`✅ 导入 ${hazardData.length} 条隔离距离规则`)

  console.log('✅ 工程知识数据导入完成')
}

if (require.main === module) {
  seedEngineeringKnowledge()
    .then(() => {
      console.log('\n✅ 所有数据导入成功')
      process.exit(0)
    })
    .catch(err => {
      console.error('❌ 导入失败:', err)
      process.exit(1)
    })
}

module.exports = { seedEngineeringKnowledge }
