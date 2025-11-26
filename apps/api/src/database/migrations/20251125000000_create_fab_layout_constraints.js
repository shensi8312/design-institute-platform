/**
 * FAB 布局约束规则表
 * 存储震动、风向、间距、危险品、动线等布局约束
 * 所有约束从数据库读取，不硬编码
 */

exports.up = async function(knex) {
  console.log('🏭 创建 FAB 布局约束表...')

  // 1. 创建布局约束规则表
  await knex.schema.createTable('fab_layout_constraints', (table) => {
    table.string('id', 50).primary()
    table.string('constraint_type', 50).notNullable().comment('约束类型: vibration/wind/spacing/hazard/traffic/adjacency')
    table.string('name', 200).notNullable().comment('约束名称')
    table.string('name_en', 200).comment('英文名称')
    table.text('description').comment('描述')

    // 约束主体
    table.string('source_zone', 50).comment('源功能区类型')
    table.string('target_zone', 50).comment('目标功能区类型')

    // 约束规则
    table.string('rule_type', 50).notNullable().comment('规则类型: min_distance/max_distance/prohibited/required/preferred/downwind/upwind')
    table.decimal('value', 10, 2).comment('约束值（如距离）')
    table.string('unit', 20).comment('单位')
    table.string('operator', 20).comment('运算符: >=, <=, ==, !=')

    // 条件和优先级
    table.jsonb('conditions').comment('附加条件（JSON格式）')
    table.integer('priority').defaultTo(100).comment('优先级（数值越小越高）')
    table.string('severity', 20).defaultTo('warning').comment('严重程度: error/warning/info')

    // 来源
    table.string('standard_code', 100).comment('规范编号（如GB50016-2014）')
    table.string('standard_section', 50).comment('规范章节')
    table.text('reference').comment('参考资料')

    // 元数据
    table.boolean('is_active').defaultTo(true)
    table.integer('sort_order').defaultTo(0)
    table.timestamps(true, true)

    // 索引
    table.index('constraint_type')
    table.index('source_zone')
    table.index('target_zone')
    table.index('is_active')
    table.index(['source_zone', 'target_zone'])
  })

  // 2. 创建功能区邻接关系表（哪些区可以/不可以相邻）
  await knex.schema.createTable('fab_zone_adjacency', (table) => {
    table.string('id', 50).primary()
    table.string('zone_a', 50).notNullable()
    table.string('zone_b', 50).notNullable()
    table.string('relation', 30).notNullable().comment('关系: required/preferred/allowed/discouraged/prohibited')
    table.decimal('min_distance', 10, 2).comment('最小距离')
    table.decimal('preferred_distance', 10, 2).comment('推荐距离')
    table.decimal('max_distance', 10, 2).comment('最大距离')
    table.text('reason').comment('原因说明')
    table.boolean('is_active').defaultTo(true)
    table.integer('priority').defaultTo(100)
    table.timestamps(true, true)

    table.unique(['zone_a', 'zone_b'])
    table.index('relation')
  })

  // 3. 创建动线规则表
  await knex.schema.createTable('fab_traffic_rules', (table) => {
    table.string('id', 50).primary()
    table.string('traffic_type', 50).notNullable().comment('动线类型: people/material/chemical/waste/emergency')
    table.string('name', 200).notNullable()
    table.text('description')

    // 路径规则
    table.specificType('path_zones', 'text[]').comment('途经功能区顺序')
    table.specificType('avoid_zones', 'text[]').comment('需要避开的功能区')
    table.specificType('required_zones', 'text[]').comment('必须经过的功能区')

    // 约束
    table.decimal('min_width', 10, 2).comment('最小通道宽度')
    table.decimal('max_distance', 10, 2).comment('最大距离限制')
    table.boolean('must_separate').defaultTo(false).comment('是否必须与其他动线分离')

    table.jsonb('properties').comment('其他属性')
    table.boolean('is_active').defaultTo(true)
    table.integer('priority').defaultTo(100)
    table.timestamps(true, true)

    table.index('traffic_type')
  })

  console.log('✅ 布局约束表创建完成')

  // 4. 插入震动约束规则
  console.log('📥 插入震动约束规则...')
  await knex('fab_layout_constraints').insert([
    {
      id: 'vib_cleanroom_chiller',
      constraint_type: 'vibration',
      name: '洁净室与冷冻站震动隔离',
      name_en: 'Cleanroom-Chiller Vibration Isolation',
      description: '冷冻站有大型压缩机，产生震动，需远离洁净室',
      source_zone: 'cleanroom',
      target_zone: 'chiller',
      rule_type: 'min_distance',
      value: 30,
      unit: 'm',
      operator: '>=',
      priority: 10,
      severity: 'error',
      standard_code: 'GB50472-2008',
      reference: '电子工业洁净厂房设计规范'
    },
    {
      id: 'vib_cleanroom_substation',
      constraint_type: 'vibration',
      name: '洁净室与变电站震动隔离',
      name_en: 'Cleanroom-Substation Vibration Isolation',
      description: '变压器产生电磁干扰和微震动',
      source_zone: 'cleanroom',
      target_zone: 'substation',
      rule_type: 'min_distance',
      value: 25,
      unit: 'm',
      operator: '>=',
      priority: 15,
      severity: 'error'
    },
    {
      id: 'vib_cleanroom_loadingdock',
      constraint_type: 'vibration',
      name: '洁净室与装卸区震动隔离',
      name_en: 'Cleanroom-Loading Dock Vibration Isolation',
      description: '货车进出产生震动',
      source_zone: 'cleanroom',
      target_zone: 'loadingdock',
      rule_type: 'min_distance',
      value: 40,
      unit: 'm',
      operator: '>=',
      priority: 20,
      severity: 'warning'
    }
  ])

  // 5. 插入风向约束规则
  console.log('📥 插入风向约束规则...')
  await knex('fab_layout_constraints').insert([
    {
      id: 'wind_gasyard_office',
      constraint_type: 'wind',
      name: '特气站应在办公区下风向',
      name_en: 'Bulk Gas Yard Downwind from Office',
      description: '特气站可能发生泄漏，应放置在主风向下风向',
      source_zone: 'gasyard',
      target_zone: 'office',
      rule_type: 'downwind',
      priority: 5,
      severity: 'error',
      standard_code: 'GB50160-2008',
      reference: '石油化工企业设计防火规范'
    },
    {
      id: 'wind_wastewater_office',
      constraint_type: 'wind',
      name: '废水站应在办公区下风向',
      name_en: 'Wastewater Treatment Downwind from Office',
      description: '废水处理有异味，应在下风向',
      source_zone: 'wastewater',
      target_zone: 'office',
      rule_type: 'downwind',
      priority: 20,
      severity: 'warning'
    },
    {
      id: 'wind_chemical_cleanroom',
      constraint_type: 'wind',
      name: '化学品库应在洁净室下风向',
      name_en: 'Chemical Storage Downwind from Cleanroom',
      description: '防止化学品泄漏影响洁净室',
      source_zone: 'chemical',
      target_zone: 'cleanroom',
      rule_type: 'downwind',
      priority: 10,
      severity: 'error'
    }
  ])

  // 6. 插入危险品约束规则
  console.log('📥 插入危险品约束规则...')
  await knex('fab_layout_constraints').insert([
    {
      id: 'haz_gasyard_office',
      constraint_type: 'hazard',
      name: '特气站与办公区安全距离',
      name_en: 'Bulk Gas Yard Safety Distance from Office',
      description: '甲类危险品仓库与民用建筑最小距离',
      source_zone: 'gasyard',
      target_zone: 'office',
      rule_type: 'min_distance',
      value: 50,
      unit: 'm',
      operator: '>=',
      priority: 1,
      severity: 'error',
      standard_code: 'GB50016-2014',
      standard_section: '3.4.1',
      reference: '建筑设计防火规范'
    },
    {
      id: 'haz_chemical_office',
      constraint_type: 'hazard',
      name: '化学品库与办公区安全距离',
      name_en: 'Chemical Storage Safety Distance from Office',
      description: '甲类仓库与办公建筑防火间距',
      source_zone: 'chemical',
      target_zone: 'office',
      rule_type: 'min_distance',
      value: 40,
      unit: 'm',
      operator: '>=',
      priority: 2,
      severity: 'error',
      standard_code: 'GB50016-2014'
    },
    {
      id: 'haz_hazwaste_canteen',
      constraint_type: 'hazard',
      name: '危废暂存与食堂安全距离',
      name_en: 'Hazardous Waste Safety Distance from Canteen',
      description: '危废区域远离餐饮区',
      source_zone: 'hazwaste',
      target_zone: 'canteen',
      rule_type: 'min_distance',
      value: 60,
      unit: 'm',
      operator: '>=',
      priority: 3,
      severity: 'error'
    },
    {
      id: 'haz_gasyard_cleanroom',
      constraint_type: 'hazard',
      name: '特气站与洁净室安全距离',
      name_en: 'Bulk Gas Yard Safety Distance from Cleanroom',
      description: '防止气体泄漏影响生产',
      source_zone: 'gasyard',
      target_zone: 'cleanroom',
      rule_type: 'min_distance',
      value: 35,
      unit: 'm',
      operator: '>=',
      priority: 5,
      severity: 'error'
    }
  ])

  // 7. 插入建筑间距约束
  console.log('📥 插入建筑间距约束规则...')
  await knex('fab_layout_constraints').insert([
    {
      id: 'space_fire_general',
      constraint_type: 'spacing',
      name: '一般建筑防火间距',
      name_en: 'General Fire Safety Spacing',
      description: '耐火等级一二级建筑之间最小间距',
      source_zone: null,
      target_zone: null,
      rule_type: 'min_distance',
      value: 10,
      unit: 'm',
      operator: '>=',
      conditions: JSON.stringify({ fire_rating: [1, 2], building_height: { max: 24 } }),
      priority: 50,
      severity: 'error',
      standard_code: 'GB50016-2014',
      standard_section: '5.2.2'
    },
    {
      id: 'space_fire_highrise',
      constraint_type: 'spacing',
      name: '高层建筑防火间距',
      name_en: 'High-rise Fire Safety Spacing',
      description: '高层建筑（>24m）之间最小间距',
      source_zone: null,
      target_zone: null,
      rule_type: 'min_distance',
      value: 13,
      unit: 'm',
      operator: '>=',
      conditions: JSON.stringify({ building_height: { min: 24 } }),
      priority: 45,
      severity: 'error',
      standard_code: 'GB50016-2014'
    },
    {
      id: 'space_road_main',
      constraint_type: 'spacing',
      name: '主干道宽度',
      name_en: 'Main Road Width',
      description: '厂区主干道最小宽度',
      source_zone: 'road',
      target_zone: null,
      rule_type: 'min_distance',
      value: 7,
      unit: 'm',
      operator: '>=',
      priority: 60,
      severity: 'warning'
    },
    {
      id: 'space_road_fire',
      constraint_type: 'spacing',
      name: '消防通道宽度',
      name_en: 'Fire Lane Width',
      description: '环形消防通道最小宽度',
      source_zone: 'road',
      target_zone: null,
      rule_type: 'min_distance',
      value: 6,
      unit: 'm',
      operator: '>=',
      priority: 55,
      severity: 'error',
      standard_code: 'GB50016-2014',
      standard_section: '7.1.8'
    }
  ])

  // 8. 插入邻接关系规则
  console.log('📥 插入功能区邻接关系...')
  await knex('fab_zone_adjacency').insert([
    // 必须邻接
    { id: 'adj_cleanroom_subfab', zone_a: 'cleanroom', zone_b: 'subfab', relation: 'required', min_distance: 0, max_distance: 0, reason: 'Sub-FAB是洁净室的管道夹层' },
    { id: 'adj_cleanroom_cub', zone_a: 'cleanroom', zone_b: 'cub', relation: 'preferred', min_distance: 5, preferred_distance: 15, max_distance: 50, reason: 'CUB为洁净室提供动力，管线越短越好' },

    // 推荐邻接
    { id: 'adj_warehouse_loadingdock', zone_a: 'warehouse', zone_b: 'loadingdock', relation: 'preferred', min_distance: 0, preferred_distance: 10, max_distance: 30, reason: '便于物料装卸' },
    { id: 'adj_office_gatehouse', zone_a: 'office', zone_b: 'gatehouse', relation: 'preferred', min_distance: 10, preferred_distance: 30, reason: '便于人员进出' },
    { id: 'adj_diwater_wastewater', zone_a: 'diwater', zone_b: 'wastewater', relation: 'preferred', min_distance: 10, preferred_distance: 20, max_distance: 50, reason: '水系统集中管理' },

    // 不推荐邻接
    { id: 'adj_cleanroom_gasyard', zone_a: 'cleanroom', zone_b: 'gasyard', relation: 'discouraged', min_distance: 35, reason: '气体泄漏风险' },
    { id: 'adj_office_wastewater', zone_a: 'office', zone_b: 'wastewater', relation: 'discouraged', min_distance: 30, reason: '异味影响' },

    // 禁止邻接
    { id: 'adj_canteen_hazwaste', zone_a: 'canteen', zone_b: 'hazwaste', relation: 'prohibited', min_distance: 60, reason: '食品安全' },
    { id: 'adj_canteen_chemical', zone_a: 'canteen', zone_b: 'chemical', relation: 'prohibited', min_distance: 50, reason: '食品安全' }
  ])

  // 9. 插入动线规则
  console.log('📥 插入动线规则...')
  await knex('fab_traffic_rules').insert([
    {
      id: 'traffic_people',
      traffic_type: 'people',
      name: '人员动线',
      description: '员工从入口到工作区的路径',
      path_zones: ['gatehouse', 'office', 'cleanroom'],
      avoid_zones: ['chemical', 'gasyard', 'hazwaste'],
      min_width: 2,
      must_separate: true,
      properties: JSON.stringify({ need_gowning: true })
    },
    {
      id: 'traffic_material',
      traffic_type: 'material',
      name: '物料动线',
      description: '原材料从入口到仓库到生产区',
      path_zones: ['loadingdock', 'warehouse', 'cleanroom'],
      avoid_zones: ['office', 'canteen'],
      min_width: 3,
      must_separate: true
    },
    {
      id: 'traffic_chemical',
      traffic_type: 'chemical',
      name: '化学品动线',
      description: '化学品从入口到储存到使用点',
      path_zones: ['loadingdock', 'chemical', 'cleanroom'],
      avoid_zones: ['office', 'canteen', 'gatehouse'],
      min_width: 4,
      must_separate: true,
      properties: JSON.stringify({ need_spill_containment: true, need_emergency_shower: true })
    },
    {
      id: 'traffic_waste',
      traffic_type: 'waste',
      name: '废弃物动线',
      description: '废弃物从生产区到处理区到外运',
      path_zones: ['cleanroom', 'wastewater', 'hazwaste', 'loadingdock'],
      avoid_zones: ['office', 'canteen', 'gatehouse'],
      min_width: 3,
      must_separate: true
    },
    {
      id: 'traffic_emergency',
      traffic_type: 'emergency',
      name: '应急疏散动线',
      description: '紧急疏散路径',
      required_zones: ['firepump', 'firewater'],
      min_width: 6,
      max_distance: 60,
      properties: JSON.stringify({ need_exit_signs: true, need_emergency_lighting: true })
    }
  ])

  console.log('✅ FAB布局约束规则插入完成')
  console.log('   - 10条震动/风向/危险品约束')
  console.log('   - 4条建筑间距约束')
  console.log('   - 9条邻接关系')
  console.log('   - 5条动线规则')
}

exports.down = async function(knex) {
  console.log('🔧 回滚 FAB 布局约束表...')

  await knex.schema.dropTableIfExists('fab_traffic_rules')
  await knex.schema.dropTableIfExists('fab_zone_adjacency')
  await knex.schema.dropTableIfExists('fab_layout_constraints')

  console.log('✅ 回滚完成')
}
