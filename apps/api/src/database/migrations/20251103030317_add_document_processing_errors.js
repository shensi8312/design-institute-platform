/**
 * 文档处理错误记录表
 */
exports.up = function(knex) {
  return knex.schema.createTable('document_processing_errors', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
    table.uuid('document_id').notNullable().references('id').inTable('knowledge_documents').onDelete('CASCADE')
    table.string('error_stage', 50).notNullable() // 'parsing', 'ocr', 'vectorization', 'graph_extraction', 'rule_extraction', 'yolo'
    table.string('error_type', 100).notNullable() // 错误类型
    table.text('error_message').notNullable() // 错误消息
    table.jsonb('error_details') // 详细错误信息（堆栈、上下文等）
    table.integer('retry_count').defaultTo(0) // 重试次数
    table.integer('max_retries').defaultTo(3) // 最大重试次数
    table.string('retry_status', 20).defaultTo('pending') // 'pending', 'retrying', 'success', 'abandoned'
    table.timestamp('last_retry_at') // 最后重试时间
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())

    // 索引
    table.index('document_id')
    table.index('error_stage')
    table.index('retry_status')
    table.index('created_at')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('document_processing_errors')
}
