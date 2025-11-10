/**
 * 创建组织表
 */
exports.up = function(knex) {
  return knex.schema.createTable('organizations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('name', 100).notNullable().comment('组织名称')
    table.string('code', 50).unique().notNullable().comment('组织编码')
    table.text('description').comment('组织描述')
    table.string('logo').comment('组织Logo')
    table.jsonb('settings').defaultTo('{}').comment('组织设置')
    table.enum('status', ['active', 'inactive']).defaultTo('active').comment('状态')
    table.timestamps(true, true)
    table.timestamp('deleted_at').comment('软删除时间')
    
    table.comment('组织表')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('organizations')
}