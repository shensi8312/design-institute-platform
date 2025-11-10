/**
 * 创建知识库表
 */
exports.up = function(knex) {
  return knex.schema.createTable('knowledge_bases', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('name', 200).notNullable().comment('知识库名称')
    table.text('description').comment('知识库描述')
    table.uuid('category_id').references('id').inTable('knowledge_categories').onDelete('SET NULL').comment('分类ID')
    table.uuid('owner_id').references('id').inTable('users').onDelete('SET NULL').notNullable().comment('创建者ID')
    table.uuid('project_id').references('id').inTable('projects').onDelete('SET NULL').comment('项目ID')
    table.uuid('department_id').references('id').inTable('departments').onDelete('SET NULL').comment('部门ID')
    table.uuid('organization_id').references('id').inTable('organizations').onDelete('CASCADE').notNullable().comment('组织ID')
    table.enum('permission_level', ['personal', 'project', 'department', 'organization']).defaultTo('personal').comment('权限级别')
    table.string('ragflow_kb_id', 100).comment('RAGFlow知识库ID')
    table.jsonb('settings').defaultTo('{}').comment('知识库设置')
    table.jsonb('statistics').defaultTo('{}').comment('统计信息')
    table.enum('status', ['active', 'inactive', 'processing']).defaultTo('active').comment('状态')
    table.timestamps(true, true)
    table.timestamp('deleted_at').comment('软删除时间')
    
    table.index(['category_id'])
    table.index(['owner_id'])
    table.index(['project_id'])
    table.index(['department_id'])
    table.index(['organization_id'])
    table.index(['permission_level'])
    table.index(['ragflow_kb_id'])
    table.comment('知识库表')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('knowledge_bases')
}