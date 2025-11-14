/**
 * Week 2: 成本数据库 + 标准件库
 *
 * 表设计：
 * 1. suppliers - 供应商信息表
 * 2. standard_parts_catalog - 标准件目录扩展表
 * 3. standard_parts_cost - 标准件成本表
 * 4. purchase_history - 采购历史表
 */

exports.up = async function(knex) {
  // 1. 供应商信息表
  await knex.schema.createTable('suppliers', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('supplier_code', 50).notNullable().unique()
    table.string('supplier_name', 200).notNullable()
    table.string('contact_person', 100)
    table.string('contact_phone', 50)
    table.string('contact_email', 100)
    table.text('address')
    table.string('rating', 10).defaultTo('B') // A/B/C
    table.boolean('is_preferred').defaultTo(false)
    table.string('payment_terms', 100) // 如: 30天账期, 货到付款
    table.integer('delivery_time_days').defaultTo(7) // 平均交货期(天)
    table.boolean('is_active').defaultTo(true)
    table.timestamps(true, true)

    table.index('supplier_code')
    table.index('is_active')
  })

  // 2. 标准件目录扩展表
  await knex.schema.createTable('standard_parts_catalog', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('part_code', 100).notNullable().unique() // 如: GB/T70.1-M8, ANSI-150#-DN50
    table.string('part_name', 200).notNullable()
    table.string('category', 50).notNullable() // bolt/nut/washer/flange/gasket/valve/fitting
    table.string('standard_system', 20).notNullable() // GB/ANSI/DIN/ISO
    table.jsonb('specifications').notNullable() // { thread_size, material, grade, dimensions }
    table.string('unit', 20).defaultTo('piece') // piece/set/kg/m
    table.text('description')
    table.boolean('is_active').defaultTo(true)
    table.timestamps(true, true)

    table.index('part_code')
    table.index('category')
    table.index('standard_system')
  })

  // 3. 标准件成本表
  await knex.schema.createTable('standard_parts_cost', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('part_id').references('id').inTable('standard_parts_catalog').onDelete('CASCADE')
    table.uuid('supplier_id').references('id').inTable('suppliers').onDelete('CASCADE')
    table.decimal('unit_price', 10, 4).notNullable() // 单价（4位小数精度）
    table.string('currency', 10).defaultTo('CNY') // CNY/USD/EUR
    table.integer('moq').defaultTo(1) // Minimum Order Quantity
    table.integer('lead_time_days').defaultTo(7) // 供应商承诺交货期
    table.date('valid_from').notNullable()
    table.date('valid_to')
    table.boolean('is_current').defaultTo(true) // 是否当前有效价格
    table.text('notes')
    table.timestamps(true, true)

    table.index('part_id')
    table.index('supplier_id')
    table.index(['is_current', 'valid_from'])
    table.unique(['part_id', 'supplier_id', 'valid_from']) // 同一供应商同一零件同一时间只有一个报价
  })

  // 4. 采购历史表
  await knex.schema.createTable('purchase_history', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('part_id').references('id').inTable('standard_parts_catalog').onDelete('CASCADE')
    table.uuid('supplier_id').references('id').inTable('suppliers').onDelete('CASCADE')
    table.date('purchase_date').notNullable()
    table.integer('quantity').notNullable()
    table.decimal('unit_price', 10, 4).notNullable()
    table.decimal('total_amount', 12, 2).notNullable()
    table.string('currency', 10).defaultTo('CNY')
    table.string('po_number', 100) // Purchase Order Number
    table.date('delivery_date')
    table.integer('quality_rating').checkBetween([1, 5]) // 1-5星评分
    table.string('created_by', 100)
    table.timestamps(true, true)

    table.index('part_id')
    table.index('supplier_id')
    table.index('purchase_date')
  })
}

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('purchase_history')
  await knex.schema.dropTableIfExists('standard_parts_cost')
  await knex.schema.dropTableIfExists('standard_parts_catalog')
  await knex.schema.dropTableIfExists('suppliers')
}
