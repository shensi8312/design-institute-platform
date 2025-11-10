/**
 * 创建角色表
 */
exports.up = function(knex) {
  return knex.schema.createTable('roles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('name', 50).notNullable().comment('角色名称')
    table.string('code', 50).notNullable().comment('角色编码')
    table.uuid('organization_id').references('id').inTable('organizations').onDelete('CASCADE').notNullable().comment('组织ID')
    table.text('description').comment('角色描述')
    table.jsonb('permissions').defaultTo('[]').comment('权限列表')
    table.enum('type', ['system', 'custom']).defaultTo('custom').comment('角色类型')
    table.boolean('is_default').defaultTo(false).comment('是否默认角色')
    table.enum('status', ['active', 'inactive']).defaultTo('active').comment('状态')
    table.timestamps(true, true)
    table.timestamp('deleted_at').comment('软删除时间')
    
    table.unique(['organization_id', 'code'], 'roles_org_code_unique')
    table.comment('角色表')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('roles')
}