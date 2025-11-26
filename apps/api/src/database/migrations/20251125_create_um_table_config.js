/**
 * UM表配置迁移
 * 存储半导体行业的 UM 表（Utility Matrix）参数
 */

exports.up = async function(knex) {
  // 1. 创建 UM 表配置表 (跳过如果已存在)
  const exists = await knex.schema.hasTable('um_table_config')
  if (exists) {
    console.log('✅ um_table_config 表已存在，跳过创建')
    return
  }

  await knex.schema.createTable('um_table_config', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))

    // 配置类型
    table.string('config_type', 50).notNullable()  // tech_coefficient, cub_ratio, um_ratio
    table.string('config_key', 100).notNullable()  // 如 '28nm', 'logic', 'cleanroom_to_cub'
    table.string('config_name', 200)               // 显示名称

    // 配置值
    table.decimal('value', 10, 4).notNullable()    // 数值
    table.string('unit', 50)                       // 单位
    table.text('description')                      // 说明
    table.text('formula')                          // 计算公式

    // 适用范围
    table.string('scope', 100)                     // 适用范围
    table.jsonb('conditions')                      // 适用条件

    // 来源
    table.string('source', 200)                    // 数据来源
    table.string('standard', 100)                  // 参考标准

    // 状态
    table.boolean('is_active').defaultTo(true)
    table.integer('sort_order').defaultTo(0)

    // 时间戳
    table.timestamps(true, true)
  })

  // 创建索引
  await knex.schema.raw(`
    CREATE INDEX idx_um_config_type ON um_table_config(config_type);
    CREATE INDEX idx_um_config_key ON um_table_config(config_type, config_key);
  `)

  // 2. 插入默认数据 - 技术节点系数
  const techCoefficients = [
    { key: '3nm', name: '3纳米', value: 3.5, desc: '最先进制程，需要更大洁净室面积' },
    { key: '5nm', name: '5纳米', value: 3.2, desc: '先进制程' },
    { key: '7nm', name: '7纳米', value: 3.0, desc: '先进制程' },
    { key: '10nm', name: '10纳米', value: 2.8, desc: '' },
    { key: '14nm', name: '14纳米', value: 2.6, desc: '' },
    { key: '16nm', name: '16纳米', value: 2.5, desc: '' },
    { key: '22nm', name: '22纳米', value: 2.3, desc: '' },
    { key: '28nm', name: '28纳米', value: 2.5, desc: '成熟制程，最常见' },
    { key: '40nm', name: '40纳米', value: 2.2, desc: '' },
    { key: '55nm', name: '55纳米', value: 2.0, desc: '' },
    { key: '65nm', name: '65纳米', value: 1.8, desc: '' },
    { key: '90nm', name: '90纳米', value: 1.5, desc: '' },
    { key: '130nm', name: '130纳米', value: 1.3, desc: '' },
    { key: '180nm', name: '180纳米', value: 1.2, desc: '' },
    { key: '250nm', name: '250纳米', value: 1.0, desc: '传统制程' },
  ]

  for (let i = 0; i < techCoefficients.length; i++) {
    const tc = techCoefficients[i]
    await knex('um_table_config').insert({
      config_type: 'tech_coefficient',
      config_key: tc.key,
      config_name: tc.name,
      value: tc.value,
      unit: '㎡/片',
      description: tc.desc || `${tc.name}制程的洁净室面积系数`,
      formula: '洁净室面积 = 月产能 × 系数 + 1000',
      source: '行业经验值',
      is_active: true,
      sort_order: i
    })
  }

  // 3. 插入默认数据 - CUB比例（按工艺类型）
  const cubRatios = [
    { key: 'logic', name: '逻辑芯片', value: 0.45, desc: '工艺复杂，需要更多动力支持' },
    { key: 'memory', name: '存储器', value: 0.40, desc: '存储器制造相对简单' },
    { key: 'analog', name: '模拟芯片', value: 0.35, desc: '模拟芯片' },
    { key: 'mems', name: 'MEMS器件', value: 0.30, desc: 'MEMS相对简单' },
    { key: 'power', name: '功率器件', value: 0.35, desc: '功率器件' },
  ]

  for (let i = 0; i < cubRatios.length; i++) {
    const cr = cubRatios[i]
    await knex('um_table_config').insert({
      config_type: 'cub_ratio',
      config_key: cr.key,
      config_name: cr.name,
      value: cr.value,
      unit: '',
      description: cr.desc,
      formula: 'CUB面积 = 洁净室面积 × 比例 × 制程系数',
      source: '行业经验值',
      is_active: true,
      sort_order: i
    })
  }

  // 4. 插入默认数据 - 制程系数乘数
  const nodeMultipliers = [
    { key: '3nm', value: 1.30 },
    { key: '5nm', value: 1.25 },
    { key: '7nm', value: 1.20 },
    { key: '10nm', value: 1.15 },
    { key: '14nm', value: 1.10 },
    { key: '16nm', value: 1.08 },
    { key: '22nm', value: 1.05 },
    { key: '28nm', value: 1.00 },
    { key: '40nm', value: 0.95 },
    { key: 'default', value: 0.90 },
  ]

  for (let i = 0; i < nodeMultipliers.length; i++) {
    const nm = nodeMultipliers[i]
    await knex('um_table_config').insert({
      config_type: 'node_multiplier',
      config_key: nm.key,
      config_name: `${nm.key}制程CUB系数`,
      value: nm.value,
      unit: '',
      description: `${nm.key}制程对CUB需求的乘数`,
      formula: 'CUB比例 = 基础比例 × 制程乘数',
      source: '行业经验值',
      is_active: true,
      sort_order: i
    })
  }

  // 5. 插入默认数据 - UM表功能区比例
  const umRatios = [
    { key: 'cub', name: 'CUB动力站', value: 0.40, includes: '变电站,冷冻站,纯水站,废水站,特气站,压缩空气站' },
    { key: 'office', name: '办公区', value: 0.20, includes: '研发办公,行政办公,会议室,员工餐厅' },
    { key: 'warehouse', name: '仓库区', value: 0.15, includes: '原材料仓,成品仓,化学品仓,气体仓' },
    { key: 'parking', name: '停车区', value: 0.08, includes: '地面停车,自行车棚' },
    { key: 'amhs', name: 'AMHS物流区', value: 0.08, includes: '物流通道,装卸区,AMHS轨道' },
  ]

  for (let i = 0; i < umRatios.length; i++) {
    const ur = umRatios[i]
    await knex('um_table_config').insert({
      config_type: 'um_ratio',
      config_key: ur.key,
      config_name: ur.name,
      value: ur.value,
      unit: '',
      description: `${ur.name}占洁净室面积的比例`,
      formula: `${ur.name}面积 = 洁净室面积 × ${ur.value}`,
      conditions: JSON.stringify({ includes: ur.includes.split(',') }),
      source: '行业经验值',
      is_active: true,
      sort_order: i
    })
  }

  console.log('✅ UM表配置表创建成功，已插入默认数据')
}

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('um_table_config')
}
