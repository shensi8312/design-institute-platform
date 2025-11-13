exports.up = async function(knex) {
  // 1. 领域分类表
  await knex.schema.createTable('domains', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('domain_code', 50).notNullable().unique()
    table.string('domain_name', 100).notNullable()
    table.text('description')
    table.jsonb('config')
    table.boolean('is_active').defaultTo(true)
    table.timestamps(true, true)
  })

  // 2. 引擎/求解器注册表
  await knex.schema.createTable('solver_engines', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('engine_code', 50).notNullable().unique()
    table.string('engine_name', 100).notNullable()
    table.string('engine_type', 50)
    table.text('description')
    table.string('implementation_class', 200)
    table.jsonb('parameters_schema')
    table.boolean('is_active').defaultTo(true)
    table.timestamps(true, true)
  })

  // 3. 领域-引擎映射
  await knex.schema.createTable('domain_engines', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('domain_id').references('id').inTable('domains').onDelete('CASCADE')
    table.uuid('engine_id').references('id').inTable('solver_engines').onDelete('CASCADE')
    table.integer('priority').defaultTo(100)
    table.jsonb('engine_config')
    table.boolean('is_required').defaultTo(false)
    table.timestamps(true, true)
    table.unique(['domain_id', 'engine_id'])
  })

  // 4. 知识库分类
  await knex.schema.createTable('knowledge_bases', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('kb_code', 50).notNullable().unique()
    table.string('kb_name', 100).notNullable()
    table.string('kb_type', 50)
    table.string('implementation_class', 200)
    table.text('description')
    table.string('data_source', 100)
    table.timestamps(true, true)
  })

  // 5. 领域-知识库映射
  await knex.schema.createTable('domain_knowledge_bases', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('domain_id').references('id').inTable('domains').onDelete('CASCADE')
    table.uuid('kb_id').references('id').inTable('knowledge_bases').onDelete('CASCADE')
    table.boolean('is_required').defaultTo(false)
    table.timestamps(true, true)
    table.unique(['domain_id', 'kb_id'])
  })

  // 6. 螺纹标准表
  await knex.schema.createTable('thread_standards', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('standard_system', 20).notNullable()
    table.string('thread_size', 50).notNullable()
    table.decimal('pitch', 8, 3)
    table.decimal('minor_diameter', 8, 3)
    table.decimal('major_diameter', 8, 3)
    table.jsonb('torque_specs')
    table.string('standard_ref', 100)
    table.timestamps(true, true)
    table.unique(['standard_system', 'thread_size'])
  })

  // 7. 法兰标准表
  await knex.schema.createTable('flange_standards', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('standard_system', 20).notNullable()
    table.string('pressure_rating', 20).notNullable()
    table.string('nominal_size', 20).notNullable()
    table.decimal('max_pressure', 8, 2)
    table.decimal('outer_diameter', 8, 2)
    table.decimal('thickness', 8, 2)
    table.decimal('bolt_circle_diameter', 8, 2)
    table.integer('bolt_holes')
    table.string('bolt_size', 20)
    table.string('standard_ref', 100)
    table.timestamps(true, true)
    table.unique(['standard_system', 'pressure_rating', 'nominal_size'])
  })

  // 8. 危险品隔离距离表
  await knex.schema.createTable('hazard_isolation_distances', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('fluid_type_1', 50).notNullable()
    table.string('fluid_type_2', 50).notNullable()
    table.integer('min_distance').notNullable()
    table.string('risk_level', 20)
    table.text('reason')
    table.string('standard_ref', 100)
    table.timestamps(true, true)
    table.unique(['fluid_type_1', 'fluid_type_2'])
  })
}

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('hazard_isolation_distances')
  await knex.schema.dropTableIfExists('flange_standards')
  await knex.schema.dropTableIfExists('thread_standards')
  await knex.schema.dropTableIfExists('domain_knowledge_bases')
  await knex.schema.dropTableIfExists('knowledge_bases')
  await knex.schema.dropTableIfExists('domain_engines')
  await knex.schema.dropTableIfExists('solver_engines')
  await knex.schema.dropTableIfExists('domains')
}
