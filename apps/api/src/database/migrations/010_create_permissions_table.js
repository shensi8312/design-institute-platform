/**
 * 创建权限表
 */
exports.up = function(knex) {
  return knex.schema.createTable('permissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('name', 100).notNullable().comment('权限名称')
    table.string('code', 100).unique().notNullable().comment('权限编码')
    table.string('module', 50).notNullable().comment('所属模块')
    table.text('description').comment('权限描述')
    table.enum('type', ['menu', 'button', 'api', 'data']).defaultTo('api').comment('权限类型')
    table.string('resource').comment('资源标识')
    table.jsonb('metadata').defaultTo('{}').comment('扩展数据')
    table.integer('sort').defaultTo(0).comment('排序')
    table.enum('status', ['active', 'inactive']).defaultTo('active').comment('状态')
    table.timestamps(true, true)
    
    table.index(['module'])
    table.index(['type'])
    table.comment('权限表')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('permissions')
}