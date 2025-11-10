/**
 * 创建用户角色关联表
 */
exports.up = function(knex) {
  return knex.schema.createTable('user_roles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable().comment('用户ID')
    table.uuid('role_id').references('id').inTable('roles').onDelete('CASCADE').notNullable().comment('角色ID')
    table.uuid('assigned_by').references('id').inTable('users').comment('分配人')
    table.timestamp('assigned_at').defaultTo(knex.fn.now()).comment('分配时间')
    table.timestamp('expires_at').comment('过期时间')
    table.timestamps(true, true)
    
    table.unique(['user_id', 'role_id'], 'user_roles_unique')
    table.comment('用户角色关联表')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('user_roles')
}