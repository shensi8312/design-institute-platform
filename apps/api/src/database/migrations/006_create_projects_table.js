/**
 * 创建项目表
 */
exports.up = function(knex) {
  return knex.schema.createTable('projects', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('name', 100).notNullable().comment('项目名称')
    table.string('code', 50).notNullable().comment('项目编码')
    table.text('description').comment('项目描述')
    table.uuid('organization_id').references('id').inTable('organizations').onDelete('CASCADE').notNullable().comment('组织ID')
    table.uuid('owner_id').references('id').inTable('users').onDelete('SET NULL').comment('项目负责人')
    table.uuid('department_id').references('id').inTable('departments').onDelete('SET NULL').comment('主要部门')
    table.enum('status', ['planning', 'active', 'suspended', 'completed', 'cancelled']).defaultTo('planning').comment('项目状态')
    table.enum('priority', ['low', 'medium', 'high', 'urgent']).defaultTo('medium').comment('优先级')
    table.date('start_date').comment('开始日期')
    table.date('end_date').comment('结束日期')
    table.decimal('budget', 12, 2).comment('预算')
    table.jsonb('metadata').defaultTo('{}').comment('扩展数据')
    table.timestamps(true, true)
    table.timestamp('deleted_at').comment('软删除时间')
    
    table.unique(['organization_id', 'code'], 'projects_org_code_unique')
    table.comment('项目表')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('projects')
}