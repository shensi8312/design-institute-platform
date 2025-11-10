/**
 * 创建知识文档表
 */
exports.up = function(knex) {
  return knex.schema.createTable('knowledge_documents', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('title', 200).notNullable().comment('文档标题')
    table.text('content').comment('文档内容')
    table.text('summary').comment('文档摘要')
    table.uuid('category_id').references('id').inTable('knowledge_categories').onDelete('SET NULL').comment('分类ID')
    table.uuid('owner_id').references('id').inTable('users').onDelete('SET NULL').notNullable().comment('作者ID')
    table.uuid('project_id').references('id').inTable('projects').onDelete('SET NULL').comment('项目ID')
    table.uuid('department_id').references('id').inTable('departments').onDelete('SET NULL').comment('部门ID')
    table.uuid('organization_id').references('id').inTable('organizations').onDelete('CASCADE').notNullable().comment('组织ID')
    table.enum('permission_level', ['personal', 'project', 'department', 'organization']).defaultTo('personal').comment('权限级别')
    table.jsonb('tags').defaultTo('[]').comment('标签')
    table.string('version', 20).defaultTo('1.0').comment('版本号')
    table.enum('status', ['draft', 'published', 'archived']).defaultTo('draft').comment('状态')
    table.string('file_path').comment('文件路径')
    table.string('file_type', 20).comment('文件类型')
    table.bigInteger('file_size').comment('文件大小')
    table.integer('view_count').defaultTo(0).comment('查看次数')
    table.integer('download_count').defaultTo(0).comment('下载次数')
    table.integer('like_count').defaultTo(0).comment('点赞次数')
    table.jsonb('metadata').defaultTo('{}').comment('扩展数据')
    table.timestamp('published_at').comment('发布时间')
    table.timestamps(true, true)
    table.timestamp('deleted_at').comment('软删除时间')
    
    table.index(['category_id'])
    table.index(['owner_id'])
    table.index(['project_id'])
    table.index(['department_id'])
    table.index(['organization_id'])
    table.index(['permission_level'])
    table.index(['status'])
    table.comment('知识文档表')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('knowledge_documents')
}