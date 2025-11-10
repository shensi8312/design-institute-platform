/**
 * 创建部门表
 */
exports.up = function(knex) {
  return knex.schema.createTable('departments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('name', 100).notNullable().comment('部门名称')
    table.string('code', 50).notNullable().comment('部门编码')
    table.uuid('parent_id').references('id').inTable('departments').onDelete('SET NULL').comment('父部门ID')
    table.uuid('organization_id').references('id').inTable('organizations').onDelete('CASCADE').notNullable().comment('组织ID')
    table.uuid('leader_id').comment('部门负责人ID')
    table.text('description').comment('部门描述')
    table.integer('sort').defaultTo(0).comment('排序')
    table.enum('status', ['active', 'inactive']).defaultTo('active').comment('状态')
    table.timestamps(true, true)
    table.timestamp('deleted_at').comment('软删除时间')
    
    table.unique(['organization_id', 'code'], 'departments_org_code_unique')
    table.comment('部门表')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('departments')
}