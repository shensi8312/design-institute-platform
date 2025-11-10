exports.up = function(knex) {
  return knex.schema
    // 装配设计表
    .createTable('assembly_designs', table => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
      table.integer('task_id').unsigned().notNullable()
      table.string('user_id', 50).notNullable()
      table.string('user_name', 100)
      table.enum('status', ['draft', 'pending_review', 'approved', 'rejected']).defaultTo('draft')
      table.integer('steps_count').defaultTo(0)
      table.text('review_comment')
      table.string('reviewed_by', 50)
      table.timestamp('reviewed_at')
      table.jsonb('metadata')
      table.timestamps(true, true)

      table.foreign('task_id').references('assembly_inference_tasks.id').onDelete('CASCADE')
      table.index(['user_id', 'status'])
      table.index('task_id')
    })
    // 装配步骤表
    .createTable('assembly_design_steps', table => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
      table.uuid('design_id').notNullable()
      table.integer('step_number').notNullable()
      table.text('description').notNullable()
      table.string('operation_type', 50) // SCREW, ALIGN, INSERT等
      table.string('part_a', 200)
      table.string('part_b', 200)
      table.jsonb('parameters')
      table.text('notes')
      table.boolean('is_modified').defaultTo(false)
      table.timestamps(true, true)

      table.foreign('design_id').references('assembly_designs.id').onDelete('CASCADE')
      table.index('design_id')
      table.unique(['design_id', 'step_number'])
    })
}

exports.down = function(knex) {
  return knex.schema
    .dropTable('assembly_design_steps')
    .dropTable('assembly_designs')
}
