exports.up = function(knex) {
  return knex.schema.createTable('drawing_comparison_tasks', function(table) {
    table.increments('id').primary();
    table.string('task_id', 50).notNullable().unique();
    table.string('user_id', 50).notNullable();
    table.string('project_id', 50);
    table.text('description');

    // 文件URL
    table.text('v1_file_url').notNullable();
    table.text('v2_file_url').notNullable();
    table.text('annotated_image_url');

    // 任务状态
    table.string('status', 20).notNullable().defaultTo('pending');
    table.integer('progress').defaultTo(0);
    table.string('current_step', 100);
    table.text('error_message');

    // 结果数据（JSON格式）
    table.jsonb('differences_json');

    // 时间戳
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('completed_at');

    // 索引
    table.index('task_id');
    table.index('user_id');
    table.index('status');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('drawing_comparison_tasks');
};
