/**
 * 创建设计规则相关表
 */
exports.up = async function(knex) {
  // 规则类别表
  await knex.schema.createTable('rule_categories', (table) => {
    table.string('id', 50).primary()
    table.string('name', 100).notNullable() // Fab设计规范、国标、行标、地标
    table.string('code', 50).unique()
    table.text('description')
    table.string('level', 20) // national/industry/local/enterprise
    table.integer('sort_order').defaultTo(0)
    table.boolean('is_active').defaultTo(true)
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
  })

  // 设计规则表
  await knex.schema.createTable('design_rules', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'))
    table.string('category_id', 50).references('id').inTable('rule_categories').onDelete('SET NULL')
    table.string('rule_code', 100).notNullable() // GB50809-2023-4.2.1
    table.string('rule_name', 200).notNullable()
    table.text('rule_content').notNullable() // 规则原文
    table.jsonb('rule_structure') // 结构化数据
    table.string('source_document_id', 50).references('id').inTable('knowledge_documents').onDelete('SET NULL')
    table.string('extraction_method', 50) // llm/manual/hybrid
    table.float('confidence_score') // 0-1
    table.string('review_status', 20).defaultTo('pending') // pending/approved/rejected
    table.string('reviewed_by', 50).references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('reviewed_at')
    table.text('review_comment')
    table.jsonb('parameters') // 规则参数: {minHeight: 2.8, unit: 'm'}
    table.string('applicable_scope', 200) // 适用范围
    table.string('priority', 20).defaultTo('normal') // critical/high/normal/low
    table.boolean('is_active').defaultTo(true)
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
  })

  // 规则关联表 (规则之间的依赖关系)
  await knex.schema.createTable('rule_relationships', (table) => {
    table.increments('id').primary()
    table.string('source_rule_id', 50).references('id').inTable('design_rules').onDelete('CASCADE')
    table.string('target_rule_id', 50).references('id').inTable('design_rules').onDelete('CASCADE')
    table.string('relationship_type', 50) // depends_on/conflicts_with/related_to
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
  })

  // 规则应用记录
  await knex.schema.createTable('rule_applications', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'))
    table.string('rule_id', 50).references('id').inTable('design_rules').onDelete('CASCADE')
    table.string('project_id', 50)
    table.string('design_id', 50) // 设计图ID
    table.string('application_type', 50) // auto_design/compliance_check
    table.boolean('is_compliant')
    table.text('violation_details')
    table.jsonb('check_result')
    table.string('checked_by', 50).references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
  })

  // 初始化规则类别
  await knex('rule_categories').insert([
    { id: 'fab_design', name: 'Fab设计规范', code: 'FAB', level: 'enterprise', sort_order: 1, description: '企业内部Fab设计规范' },
    { id: 'national_standard', name: '国家标准', code: 'GB', level: 'national', sort_order: 2, description: '中华人民共和国国家标准' },
    { id: 'industry_standard', name: '行业标准', code: 'JGJ', level: 'industry', sort_order: 3, description: '建筑行业标准' },
    { id: 'local_standard', name: '地方标准', code: 'DB', level: 'local', sort_order: 4, description: '地方建筑标准' }
  ])

  console.log('✓ 规则表创建完成')
}

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('rule_applications')
  await knex.schema.dropTableIfExists('rule_relationships')
  await knex.schema.dropTableIfExists('design_rules')
  await knex.schema.dropTableIfExists('rule_categories')
}
