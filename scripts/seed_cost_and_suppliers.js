const db = require('../apps/api/src/config/database')

/**
 * Week 2: 成本数据库 + 标准件库 - Seed数据
 */
async function seedCostAndSuppliers() {
  console.log('📦 开始导入Week 2数据...')

  // 1. 供应商数据
  const suppliers = [
    {
      supplier_code: 'SUP001',
      supplier_name: '上海标准件有限公司',
      contact_person: '张工',
      contact_phone: '021-12345678',
      contact_email: 'zhang@standard-parts.com',
      address: '上海市浦东新区XX路123号',
      rating: 'A',
      is_preferred: true,
      payment_terms: '30天账期',
      delivery_time_days: 3
    },
    {
      supplier_code: 'SUP002',
      supplier_name: '北京五金制造厂',
      contact_person: '李经理',
      contact_phone: '010-87654321',
      contact_email: 'li@bjhardware.com',
      address: '北京市海淀区XX大街456号',
      rating: 'B',
      is_preferred: false,
      payment_terms: '货到付款',
      delivery_time_days: 5
    },
    {
      supplier_code: 'SUP003',
      supplier_name: 'Swagelok中国',
      contact_person: 'Wang Manager',
      contact_phone: '0512-88990011',
      contact_email: 'wang@swagelok.cn',
      address: '江苏省苏州市工业园区XX路789号',
      rating: 'A',
      is_preferred: true,
      payment_terms: '60天账期',
      delivery_time_days: 7
    },
    {
      supplier_code: 'SUP004',
      supplier_name: '广州紧固件贸易公司',
      contact_person: '陈总',
      contact_phone: '020-33221100',
      contact_email: 'chen@gzfastener.com',
      address: '广东省广州市天河区XX路101号',
      rating: 'B',
      is_preferred: false,
      payment_terms: '15天账期',
      delivery_time_days: 4
    }
  ]

  for (const supplier of suppliers) {
    await db('suppliers').insert(supplier).onConflict('supplier_code').merge()
  }
  console.log(`✅ 导入 ${suppliers.length} 个供应商`)

  // 2. 标准件目录扩展（螺栓、螺母、垫片、法兰）
  const standardParts = [
    // 螺栓 (Bolts)
    {
      part_code: 'GB/T70.1-M3',
      part_name: '六角头螺栓 M3x0.5',
      category: 'bolt',
      standard_system: 'GB',
      specifications: { thread_size: 'M3', pitch: 0.5, material: '45钢', grade: '4.8', length_range: '5-30mm' }
    },
    {
      part_code: 'GB/T70.1-M4',
      part_name: '六角头螺栓 M4x0.7',
      category: 'bolt',
      standard_system: 'GB',
      specifications: { thread_size: 'M4', pitch: 0.7, material: '45钢', grade: '4.8', length_range: '8-40mm' }
    },
    {
      part_code: 'GB/T70.1-M5',
      part_name: '六角头螺栓 M5x0.8',
      category: 'bolt',
      standard_system: 'GB',
      specifications: { thread_size: 'M5', pitch: 0.8, material: '45钢', grade: '4.8', length_range: '10-50mm' }
    },
    {
      part_code: 'GB/T70.1-M6',
      part_name: '六角头螺栓 M6x1.0',
      category: 'bolt',
      standard_system: 'GB',
      specifications: { thread_size: 'M6', pitch: 1.0, material: '45钢', grade: '4.8', length_range: '12-60mm' }
    },
    {
      part_code: 'GB/T70.1-M8',
      part_name: '六角头螺栓 M8x1.25',
      category: 'bolt',
      standard_system: 'GB',
      specifications: { thread_size: 'M8', pitch: 1.25, material: '45钢', grade: '8.8', length_range: '16-100mm' }
    },
    {
      part_code: 'GB/T70.1-M10',
      part_name: '六角头螺栓 M10x1.5',
      category: 'bolt',
      standard_system: 'GB',
      specifications: { thread_size: 'M10', pitch: 1.5, material: '45钢', grade: '8.8', length_range: '20-150mm' }
    },
    {
      part_code: 'GB/T70.1-M12',
      part_name: '六角头螺栓 M12x1.75',
      category: 'bolt',
      standard_system: 'GB',
      specifications: { thread_size: 'M12', pitch: 1.75, material: '40Cr', grade: '10.9', length_range: '25-200mm' }
    },
    {
      part_code: 'GB/T70.1-M16',
      part_name: '六角头螺栓 M16x2.0',
      category: 'bolt',
      standard_system: 'GB',
      specifications: { thread_size: 'M16', pitch: 2.0, material: '40Cr', grade: '10.9', length_range: '30-250mm' }
    },
    {
      part_code: 'GB/T70.1-M20',
      part_name: '六角头螺栓 M20x2.5',
      category: 'bolt',
      standard_system: 'GB',
      specifications: { thread_size: 'M20', pitch: 2.5, material: '40Cr', grade: '10.9', length_range: '40-300mm' }
    },

    // 螺母 (Nuts)
    {
      part_code: 'GB/T6170-M3',
      part_name: '六角螺母 M3',
      category: 'nut',
      standard_system: 'GB',
      specifications: { thread_size: 'M3', pitch: 0.5, material: '45钢', grade: '8' }
    },
    {
      part_code: 'GB/T6170-M4',
      part_name: '六角螺母 M4',
      category: 'nut',
      standard_system: 'GB',
      specifications: { thread_size: 'M4', pitch: 0.7, material: '45钢', grade: '8' }
    },
    {
      part_code: 'GB/T6170-M5',
      part_name: '六角螺母 M5',
      category: 'nut',
      standard_system: 'GB',
      specifications: { thread_size: 'M5', pitch: 0.8, material: '45钢', grade: '8' }
    },
    {
      part_code: 'GB/T6170-M6',
      part_name: '六角螺母 M6',
      category: 'nut',
      standard_system: 'GB',
      specifications: { thread_size: 'M6', pitch: 1.0, material: '45钢', grade: '8' }
    },
    {
      part_code: 'GB/T6170-M8',
      part_name: '六角螺母 M8',
      category: 'nut',
      standard_system: 'GB',
      specifications: { thread_size: 'M8', pitch: 1.25, material: '45钢', grade: '8' }
    },
    {
      part_code: 'GB/T6170-M10',
      part_name: '六角螺母 M10',
      category: 'nut',
      standard_system: 'GB',
      specifications: { thread_size: 'M10', pitch: 1.5, material: '45钢', grade: '8' }
    },
    {
      part_code: 'GB/T6170-M12',
      part_name: '六角螺母 M12',
      category: 'nut',
      standard_system: 'GB',
      specifications: { thread_size: 'M12', pitch: 1.75, material: '45钢', grade: '10' }
    },
    {
      part_code: 'GB/T6170-M16',
      part_name: '六角螺母 M16',
      category: 'nut',
      standard_system: 'GB',
      specifications: { thread_size: 'M16', pitch: 2.0, material: '40Cr', grade: '10' }
    },
    {
      part_code: 'GB/T6170-M20',
      part_name: '六角螺母 M20',
      category: 'nut',
      standard_system: 'GB',
      specifications: { thread_size: 'M20', pitch: 2.5, material: '40Cr', grade: '10' }
    },

    // 垫片 (Washers)
    {
      part_code: 'GB/T97.1-M8',
      part_name: '平垫圈 M8',
      category: 'washer',
      standard_system: 'GB',
      specifications: { inner_diameter: 8.4, outer_diameter: 17, thickness: 1.6, material: '65Mn' }
    },
    {
      part_code: 'GB/T97.1-M10',
      part_name: '平垫圈 M10',
      category: 'washer',
      standard_system: 'GB',
      specifications: { inner_diameter: 10.5, outer_diameter: 21, thickness: 2.0, material: '65Mn' }
    },
    {
      part_code: 'GB/T97.1-M12',
      part_name: '平垫圈 M12',
      category: 'washer',
      standard_system: 'GB',
      specifications: { inner_diameter: 13.0, outer_diameter: 24, thickness: 2.5, material: '65Mn' }
    },
    {
      part_code: 'GB/T97.1-M16',
      part_name: '平垫圈 M16',
      category: 'washer',
      standard_system: 'GB',
      specifications: { inner_diameter: 17.0, outer_diameter: 30, thickness: 3.0, material: '65Mn' }
    },

    // 法兰 (Flanges) - ANSI
    {
      part_code: 'ANSI-150#-DN15',
      part_name: 'ANSI B16.5 对焊法兰 150# DN15',
      category: 'flange',
      standard_system: 'ANSI',
      specifications: { pressure_rating: '150#', nominal_size: 'DN15', outer_diameter: 88.9, bolt_holes: 4, bolt_size: 'M12' }
    },
    {
      part_code: 'ANSI-150#-DN20',
      part_name: 'ANSI B16.5 对焊法兰 150# DN20',
      category: 'flange',
      standard_system: 'ANSI',
      specifications: { pressure_rating: '150#', nominal_size: 'DN20', outer_diameter: 98.4, bolt_holes: 4, bolt_size: 'M12' }
    },
    {
      part_code: 'ANSI-150#-DN25',
      part_name: 'ANSI B16.5 对焊法兰 150# DN25',
      category: 'flange',
      standard_system: 'ANSI',
      specifications: { pressure_rating: '150#', nominal_size: 'DN25', outer_diameter: 123.8, bolt_holes: 4, bolt_size: 'M16' }
    },
    {
      part_code: 'ANSI-150#-DN50',
      part_name: 'ANSI B16.5 对焊法兰 150# DN50',
      category: 'flange',
      standard_system: 'ANSI',
      specifications: { pressure_rating: '150#', nominal_size: 'DN50', outer_diameter: 152.4, bolt_holes: 4, bolt_size: 'M16' }
    },
    {
      part_code: 'ANSI-150#-DN80',
      part_name: 'ANSI B16.5 对焊法兰 150# DN80',
      category: 'flange',
      standard_system: 'ANSI',
      specifications: { pressure_rating: '150#', nominal_size: 'DN80', outer_diameter: 190.5, bolt_holes: 4, bolt_size: 'M16' }
    },
    {
      part_code: 'ANSI-150#-DN100',
      part_name: 'ANSI B16.5 对焊法兰 150# DN100',
      category: 'flange',
      standard_system: 'ANSI',
      specifications: { pressure_rating: '150#', nominal_size: 'DN100', outer_diameter: 228.6, bolt_holes: 8, bolt_size: 'M16' }
    },
    {
      part_code: 'ANSI-300#-DN50',
      part_name: 'ANSI B16.5 对焊法兰 300# DN50',
      category: 'flange',
      standard_system: 'ANSI',
      specifications: { pressure_rating: '300#', nominal_size: 'DN50', outer_diameter: 165.1, bolt_holes: 4, bolt_size: 'M20' }
    },
    {
      part_code: 'ANSI-300#-DN80',
      part_name: 'ANSI B16.5 对焊法兰 300# DN80',
      category: 'flange',
      standard_system: 'ANSI',
      specifications: { pressure_rating: '300#', nominal_size: 'DN80', outer_diameter: 200.0, bolt_holes: 8, bolt_size: 'M20' }
    },

    // 法兰 (Flanges) - DIN
    {
      part_code: 'DIN-PN16-DN50',
      part_name: 'DIN 2501 对焊法兰 PN16 DN50',
      category: 'flange',
      standard_system: 'DIN',
      specifications: { pressure_rating: 'PN16', nominal_size: 'DN50', outer_diameter: 165, bolt_holes: 4, bolt_size: 'M16' }
    },
    {
      part_code: 'DIN-PN16-DN80',
      part_name: 'DIN 2501 对焊法兰 PN16 DN80',
      category: 'flange',
      standard_system: 'DIN',
      specifications: { pressure_rating: 'PN16', nominal_size: 'DN80', outer_diameter: 200, bolt_holes: 8, bolt_size: 'M16' }
    },
    {
      part_code: 'DIN-PN40-DN50',
      part_name: 'DIN 2501 对焊法兰 PN40 DN50',
      category: 'flange',
      standard_system: 'DIN',
      specifications: { pressure_rating: 'PN40', nominal_size: 'DN50', outer_diameter: 165, bolt_holes: 4, bolt_size: 'M16' }
    },

    // 密封垫片 (Gaskets)
    {
      part_code: 'GASKET-DN50-RF',
      part_name: '金属缠绕垫片 DN50 RF',
      category: 'gasket',
      standard_system: 'ANSI',
      specifications: { nominal_size: 'DN50', face_type: 'RF', material: '304不锈钢+石墨', thickness: 4.5 }
    },
    {
      part_code: 'GASKET-DN80-RF',
      part_name: '金属缠绕垫片 DN80 RF',
      category: 'gasket',
      standard_system: 'ANSI',
      specifications: { nominal_size: 'DN80', face_type: 'RF', material: '304不锈钢+石墨', thickness: 4.5 }
    },
    {
      part_code: 'GASKET-DN100-RF',
      part_name: '金属缠绕垫片 DN100 RF',
      category: 'gasket',
      standard_system: 'ANSI',
      specifications: { nominal_size: 'DN100', face_type: 'RF', material: '316不锈钢+石墨', thickness: 4.5 }
    }
  ]

  const partIds = {}
  for (const part of standardParts) {
    const result = await db('standard_parts_catalog')
      .insert(part)
      .onConflict('part_code')
      .merge()
      .returning('id')
    partIds[part.part_code] = typeof result[0] === 'object' ? result[0].id : result[0]
  }
  console.log(`✅ 导入 ${standardParts.length} 个标准件`)

  // 3. 成本数据（部分零件）
  const supplierIds = await db('suppliers').select('id', 'supplier_code')
  const supplierMap = {}
  supplierIds.forEach(s => { supplierMap[s.supplier_code] = s.id })

  const costData = [
    // M8螺栓的多个供应商报价
    { part_code: 'GB/T70.1-M8', supplier_code: 'SUP001', unit_price: 0.15, moq: 100, lead_time_days: 3, valid_from: '2025-01-01', is_current: true },
    { part_code: 'GB/T70.1-M8', supplier_code: 'SUP002', unit_price: 0.12, moq: 500, lead_time_days: 5, valid_from: '2025-01-01', is_current: true },
    { part_code: 'GB/T70.1-M8', supplier_code: 'SUP004', unit_price: 0.14, moq: 200, lead_time_days: 4, valid_from: '2025-01-01', is_current: true },

    // M10螺栓
    { part_code: 'GB/T70.1-M10', supplier_code: 'SUP001', unit_price: 0.25, moq: 100, lead_time_days: 3, valid_from: '2025-01-01', is_current: true },
    { part_code: 'GB/T70.1-M10', supplier_code: 'SUP002', unit_price: 0.22, moq: 500, lead_time_days: 5, valid_from: '2025-01-01', is_current: true },

    // M12螺栓
    { part_code: 'GB/T70.1-M12', supplier_code: 'SUP001', unit_price: 0.35, moq: 100, lead_time_days: 3, valid_from: '2025-01-01', is_current: true },
    { part_code: 'GB/T70.1-M12', supplier_code: 'SUP002', unit_price: 0.30, moq: 500, lead_time_days: 5, valid_from: '2025-01-01', is_current: true },

    // 螺母
    { part_code: 'GB/T6170-M8', supplier_code: 'SUP001', unit_price: 0.08, moq: 100, lead_time_days: 3, valid_from: '2025-01-01', is_current: true },
    { part_code: 'GB/T6170-M10', supplier_code: 'SUP001', unit_price: 0.12, moq: 100, lead_time_days: 3, valid_from: '2025-01-01', is_current: true },
    { part_code: 'GB/T6170-M12', supplier_code: 'SUP001', unit_price: 0.18, moq: 100, lead_time_days: 3, valid_from: '2025-01-01', is_current: true },

    // 法兰（Swagelok供应商）
    { part_code: 'ANSI-150#-DN50', supplier_code: 'SUP003', unit_price: 120.0, moq: 1, lead_time_days: 7, valid_from: '2025-01-01', is_current: true },
    { part_code: 'ANSI-150#-DN80', supplier_code: 'SUP003', unit_price: 180.0, moq: 1, lead_time_days: 7, valid_from: '2025-01-01', is_current: true },
    { part_code: 'ANSI-300#-DN50', supplier_code: 'SUP003', unit_price: 200.0, moq: 1, lead_time_days: 10, valid_from: '2025-01-01', is_current: true },

    // DIN法兰
    { part_code: 'DIN-PN16-DN50', supplier_code: 'SUP001', unit_price: 95.0, moq: 2, lead_time_days: 5, valid_from: '2025-01-01', is_current: true },
    { part_code: 'DIN-PN16-DN80', supplier_code: 'SUP001', unit_price: 140.0, moq: 2, lead_time_days: 5, valid_from: '2025-01-01', is_current: true },

    // 垫片
    { part_code: 'GASKET-DN50-RF', supplier_code: 'SUP003', unit_price: 45.0, moq: 10, lead_time_days: 7, valid_from: '2025-01-01', is_current: true },
    { part_code: 'GASKET-DN80-RF', supplier_code: 'SUP003', unit_price: 65.0, moq: 10, lead_time_days: 7, valid_from: '2025-01-01', is_current: true }
  ]

  for (const cost of costData) {
    await db('standard_parts_cost').insert({
      part_id: partIds[cost.part_code],
      supplier_id: supplierMap[cost.supplier_code],
      unit_price: cost.unit_price,
      currency: 'CNY',
      moq: cost.moq,
      lead_time_days: cost.lead_time_days,
      valid_from: cost.valid_from,
      is_current: cost.is_current
    }).onConflict(['part_id', 'supplier_id', 'valid_from']).merge()
  }
  console.log(`✅ 导入 ${costData.length} 条成本数据`)

  // 4. 采购历史数据（示例）
  const purchaseHistory = [
    {
      part_code: 'GB/T70.1-M8',
      supplier_code: 'SUP001',
      purchase_date: '2024-10-15',
      quantity: 1000,
      unit_price: 0.15,
      total_amount: 150.0,
      po_number: 'PO-2024-1001',
      delivery_date: '2024-10-18',
      quality_rating: 5,
      created_by: 'admin'
    },
    {
      part_code: 'GB/T70.1-M8',
      supplier_code: 'SUP002',
      purchase_date: '2024-11-05',
      quantity: 2000,
      unit_price: 0.12,
      total_amount: 240.0,
      po_number: 'PO-2024-1015',
      delivery_date: '2024-11-10',
      quality_rating: 4,
      created_by: 'admin'
    },
    {
      part_code: 'GB/T70.1-M10',
      supplier_code: 'SUP001',
      purchase_date: '2024-09-20',
      quantity: 500,
      unit_price: 0.25,
      total_amount: 125.0,
      po_number: 'PO-2024-0955',
      delivery_date: '2024-09-23',
      quality_rating: 5,
      created_by: 'admin'
    },
    {
      part_code: 'ANSI-150#-DN50',
      supplier_code: 'SUP003',
      purchase_date: '2024-08-10',
      quantity: 10,
      unit_price: 120.0,
      total_amount: 1200.0,
      po_number: 'PO-2024-0820',
      delivery_date: '2024-08-17',
      quality_rating: 5,
      created_by: 'admin'
    },
    {
      part_code: 'DIN-PN16-DN50',
      supplier_code: 'SUP001',
      purchase_date: '2024-07-25',
      quantity: 5,
      unit_price: 95.0,
      total_amount: 475.0,
      po_number: 'PO-2024-0780',
      delivery_date: '2024-07-30',
      quality_rating: 4,
      created_by: 'admin'
    }
  ]

  for (const purchase of purchaseHistory) {
    await db('purchase_history').insert({
      part_id: partIds[purchase.part_code],
      supplier_id: supplierMap[purchase.supplier_code],
      purchase_date: purchase.purchase_date,
      quantity: purchase.quantity,
      unit_price: purchase.unit_price,
      total_amount: purchase.total_amount,
      currency: 'CNY',
      po_number: purchase.po_number,
      delivery_date: purchase.delivery_date,
      quality_rating: purchase.quality_rating,
      created_by: purchase.created_by
    })
  }
  console.log(`✅ 导入 ${purchaseHistory.length} 条采购历史`)

  console.log('✅ Week 2 数据导入完成')
}

if (require.main === module) {
  seedCostAndSuppliers()
    .then(() => {
      console.log('\n✅ 所有数据导入成功')
      process.exit(0)
    })
    .catch(err => {
      console.error('❌ 导入失败:', err)
      process.exit(1)
    })
}

module.exports = { seedCostAndSuppliers }
