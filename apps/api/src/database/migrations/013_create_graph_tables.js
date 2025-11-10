/**
 * 创建知识图谱相关表
 */
exports.up = function(knex) {
  return knex.schema
    // 图谱构建任务表
    .createTable('graph_build_tasks', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('kb_id').references('id').inTable('knowledge_bases').onDelete('CASCADE').notNullable().comment('知识库ID')
      table.integer('document_count').notNullable().comment('文档数量')
      table.enum('status', ['pending', 'processing', 'completed', 'failed']).defaultTo('pending').comment('任务状态')
      table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL').comment('创建者')
      table.timestamps(true, true)
      table.timestamp('completed_at').comment('完成时间')
      table.jsonb('result').comment('构建结果')
      table.text('error_message').comment('错误信息')
      
      table.index(['kb_id', 'status'])
      table.index(['created_at'])
      table.comment('图谱构建任务表')
    })
    
    // 图谱索引批次表
    .createTable('graph_index_batches', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('project_id').notNullable().comment('项目ID')
      table.integer('document_count').notNullable().comment('文档数量')
      table.enum('status', ['processing', 'completed', 'failed']).defaultTo('processing').comment('状态')
      table.timestamps(true, true)
      table.timestamp('completed_at').comment('完成时间')
      table.jsonb('stats').comment('统计信息')
      table.text('error_message').comment('错误信息')
      
      table.index(['project_id'])
      table.comment('图谱索引批次表')
    })
    
    // 图谱查询历史表
    .createTable('graph_query_history', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('kb_id').references('id').inTable('knowledge_bases').onDelete('CASCADE').notNullable().comment('知识库ID')
      table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL').comment('查询用户')
      table.text('question').notNullable().comment('查询问题')
      table.enum('query_type', ['global', 'local']).defaultTo('global').comment('查询类型')
      table.text('answer').comment('答案')
      table.jsonb('sources').comment('来源')
      table.jsonb('entities').comment('相关实体')
      table.decimal('confidence', 3, 2).comment('置信度')
      table.integer('response_time').comment('响应时间(ms)')
      table.timestamps(true, true)
      
      table.index(['kb_id'])
      table.index(['user_id'])
      table.index(['created_at'])
      table.comment('图谱查询历史表')
    })
    
    // 图谱优化历史表
    .createTable('graph_optimization_history', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('kb_id').references('id').inTable('knowledge_bases').onDelete('CASCADE').notNullable().comment('知识库ID')
      table.uuid('optimized_by').references('id').inTable('users').onDelete('SET NULL').comment('优化者')
      table.timestamp('optimized_at').defaultTo(knex.fn.now()).comment('优化时间')
      table.jsonb('metrics_before').comment('优化前指标')
      table.jsonb('metrics_after').comment('优化后指标')
      
      table.index(['kb_id'])
      table.comment('图谱优化历史表')
    })
}

exports.down = function(knex) {
  return knex.schema
    .dropTable('graph_optimization_history')
    .dropTable('graph_query_history')
    .dropTable('graph_index_batches')
    .dropTable('graph_build_tasks')
}