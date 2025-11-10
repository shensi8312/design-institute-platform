exports.up = function(knex) {
  return knex.schema
    .createTable('assembly_inference_tasks', table => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
      table.string('user_id', 50).notNullable()
      table.string('user_name', 100)
      table.string('bom_file_path', 500)
      table.jsonb('drawing_files')
      table.integer('parts_count')
      table.integer('constraints_count')
      table.string('status', 20).defaultTo('pending') // pending/completed/failed
      table.boolean('llm_enhanced').defaultTo(false)
      table.jsonb('metadata')
      table.timestamps(true, true)
      
      table.index('user_id')
      table.index('status')
      table.index('created_at')
    })
    .createTable('assembly_constraints', table => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
      table.uuid('task_id').notNullable().references('id').inTable('assembly_inference_tasks').onDelete('CASCADE')
      table.string('constraint_type', 50).notNullable() // CONCENTRIC/SCREW/etc
      table.string('entity_a', 200).notNullable()
      table.string('entity_b', 200).notNullable()
      table.jsonb('parameters')
      table.decimal('confidence', 3, 2)
      table.text('reasoning')
      table.string('rule_id', 20)
      table.string('review_status', 20).defaultTo('pending') // pending/approved/rejected
      table.timestamps(true, true)
      
      table.index('task_id')
      table.index('review_status')
      table.index('constraint_type')
    })
    .createTable('assembly_reviews', table => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
      table.uuid('constraint_id').notNullable().references('id').inTable('assembly_constraints').onDelete('CASCADE')
      table.string('reviewer_id', 50).notNullable()
      table.string('reviewer_name', 100)
      table.string('action', 20).notNullable() // approve/reject/modify
      table.text('comment')
      table.jsonb('modifications') // 如果是modify，记录修改内容
      table.timestamp('reviewed_at').defaultTo(knex.fn.now())
      
      table.index('constraint_id')
      table.index('reviewer_id')
      table.index('reviewed_at')
    })
}

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('assembly_reviews')
    .dropTableIfExists('assembly_constraints')
    .dropTableIfExists('assembly_inference_tasks')
}
