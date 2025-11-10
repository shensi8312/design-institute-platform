/**
 * 创建知识审核表
 */
exports.up = function(knex) {
  return knex.schema.createTable('knowledge_review', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('document_id').references('id').inTable('knowledge_documents').onDelete('CASCADE').notNullable().comment('文档ID')
    table.string('document_title', 200).notNullable().comment('文档标题')
    table.string('document_type', 20).comment('文档类型')
    table.uuid('upload_user_id').references('id').inTable('users').onDelete('SET NULL').comment('上传者ID')
    table.string('upload_user', 100).comment('上传者姓名')
    table.timestamp('upload_time').notNullable().defaultTo(knex.fn.now()).comment('上传时间')
    table.enum('status', ['pending', 'approved', 'rejected']).defaultTo('pending').comment('审核状态')
    table.uuid('reviewer_id').references('id').inTable('users').onDelete('SET NULL').comment('审核人ID')
    table.string('reviewer', 100).comment('审核人姓名')
    table.timestamp('review_time').comment('审核时间')
    table.text('review_comment').comment('审核意见')
    table.timestamps(true, true)

    table.index(['document_id'])
    table.index(['status'])
    table.index(['upload_user_id'])
    table.index(['reviewer_id'])
    table.comment('知识审核表')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('knowledge_review')
}
