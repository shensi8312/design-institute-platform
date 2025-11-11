exports.up = function(knex) {
  return knex.schema
    .createTable('assembly_inference_tasks', table => {
      table.increments('id').primary();
      table.string('user_id').notNullable();
      table.string('bom_file_path');
      table.enum('status', ['pending', 'processing', 'completed', 'failed']).defaultTo('pending');
      table.integer('parts_count');
      table.integer('constraints_count');
      table.json('solver_result'); // scipy 求解结果
      table.timestamps(true, true);
      table.index(['user_id', 'created_at']);
    })
    .then(() => {
      return knex.schema.alterTable('assembly_constraints', table => {
        table.integer('task_id').unsigned();
        table.foreign('task_id').references('assembly_inference_tasks.id').onDelete('CASCADE');
      });
    });
};

exports.down = function(knex) {
  return knex.schema
    .alterTable('assembly_constraints', table => {
      table.dropForeign('task_id');
      table.dropColumn('task_id');
    })
    .then(() => {
      return knex.schema.dropTable('assembly_inference_tasks');
    });
};
