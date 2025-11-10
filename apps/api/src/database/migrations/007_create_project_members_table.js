/**
 * 创建项目成员表
 */
exports.up = function(knex) {
  return knex.schema.createTable('project_members', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE').notNullable().comment('项目ID')
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable().comment('用户ID')
    table.uuid('role_id').references('id').inTable('roles').onDelete('SET NULL').comment('项目角色ID')
    table.string('role_name', 50).comment('项目角色名称')
    table.jsonb('knowledge_permissions').defaultTo('[]').comment('知识库权限')
    table.jsonb('custom_permissions').comment('自定义权限')
    table.uuid('invited_by').references('id').inTable('users').comment('邀请人')
    table.timestamp('joined_at').defaultTo(knex.fn.now()).comment('加入时间')
    table.timestamp('left_at').comment('离开时间')
    table.enum('status', ['active', 'inactive', 'left']).defaultTo('active').comment('成员状态')
    table.timestamps(true, true)
    
    table.unique(['project_id', 'user_id'], 'project_members_unique')
    table.comment('项目成员表')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('project_members')
}