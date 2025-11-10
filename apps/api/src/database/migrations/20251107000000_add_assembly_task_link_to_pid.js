/**
 * 为PID识别结果添加装配任务关联字段
 */
exports.up = function(knex) {
  return knex.schema.table('pid_recognition_results', table => {
    table.uuid('assembly_task_id')
      .references('id')
      .inTable('assembly_inference_tasks')
      .onDelete('SET NULL')
      .comment('关联的装配任务ID')

    table.index('assembly_task_id')
  })
}

exports.down = function(knex) {
  return knex.schema.table('pid_recognition_results', table => {
    table.dropIndex('assembly_task_id')
    table.dropColumn('assembly_task_id')
  })
}
