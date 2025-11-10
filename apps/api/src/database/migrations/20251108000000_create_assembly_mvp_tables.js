/**
 * 装配MVP核心表结构
 */
exports.up = async function(knex) {
  // 1. 零件目录表
  await knex.schema.createTable('parts_catalog', table => {
    table.increments('id').primary()
    table.string('part_id').unique().notNullable()
    table.string('family').notNullable()  // pipe | flange | valve | gasket | bolt
    table.integer('dn')
    table.integer('pn')
    table.string('end_type')   // weld | flanged | threaded
    table.string('face_type')  // rf | ff | rtj
    table.string('std')
    table.string('mat')
    table.string('unit_system').defaultTo('metric')
    table.jsonb('meta')        // {length, thickness, pcd, bolt_spec, ...}
    table.jsonb('geom_fingerprint')  // {bbox, holes, shafts, ...}
    table.integer('stock_qty').defaultTo(0)
    table.timestamps(true, true)

    table.index(['family', 'dn', 'pn'])
    table.index(['end_type', 'face_type'])
  })

  // 2. 零件端口表（ports显式化）
  await knex.schema.createTable('part_ports', table => {
    table.increments('id').primary()
    table.string('part_id').references('part_id').inTable('parts_catalog').onDelete('CASCADE')
    table.string('port_id').notNullable()
    table.string('port_type').notNullable()  // bore | face | thread
    table.jsonb('axis')       // [dx, dy, dz]
    table.jsonb('origin')     // [x, y, z]
    table.integer('dn')
    table.string('face_type')
    table.jsonb('meta')
    table.timestamps(true, true)

    table.index(['part_id'])
  })

  // 3. 连接模板表（参数化）
  await knex.schema.createTable('connection_templates', table => {
    table.increments('id').primary()
    table.string('template_id').unique().notNullable()
    table.string('family_a').notNullable()
    table.string('family_b').notNullable()
    table.integer('dn').nullable()  // null表示通用模板
    table.integer('pn').nullable()
    table.string('end_type')
    table.string('face_type')
    table.string('join_rule')  // coaxial+plane_coincident | threaded | welded
    table.jsonb('mate_schema')  // {axis_align, angle_tol_deg, gap_tol_mm, ...}
    table.jsonb('fasteners')    // {bolt_count, bolt_spec, pcd_mm, gasket}
    table.jsonb('formula')      // {"pcd_mm": "125+(dn-50)*2.5", ...}
    table.jsonb('selector')     // 选择器条件
    table.timestamps(true, true)

    table.index(['family_a', 'family_b'])
    table.index(['dn', 'pn'])
  })

  // 4. 标准映射表
  await knex.schema.createTable('standards_map', table => {
    table.increments('id').primary()
    table.string('line_class').unique().notNullable()
    table.jsonb('defaults')  // {std, face_type, mat, ...}
    table.string('project_id')
    table.timestamps(true, true)

    table.index(['line_class'])
  })

  // 5. 装配验证报告表
  await knex.schema.createTable('assembly_validation_reports', table => {
    table.increments('id').primary()
    table.uuid('task_id').references('id').inTable('assembly_inference_tasks').onDelete('CASCADE')
    table.string('overall_status')  // pass | warning | fail
    table.jsonb('checks')           // 五类检查结果
    table.jsonb('summary')
    table.timestamps(true, true)

    table.index(['task_id'])
  })
}

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('assembly_validation_reports')
  await knex.schema.dropTableIfExists('standards_map')
  await knex.schema.dropTableIfExists('connection_templates')
  await knex.schema.dropTableIfExists('part_ports')
  await knex.schema.dropTableIfExists('parts_catalog')
}
