/**
 * 创建知识库分类表
 */
exports.up = function(knex) {
  return knex.schema.createTable('knowledge_categories', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('name', 100).notNullable().comment('分类名称')
    table.string('code', 50).notNullable().comment('分类编码')
    table.uuid('parent_id').references('id').inTable('knowledge_categories').onDelete('CASCADE').comment('父分类ID')
    table.uuid('organization_id').references('id').inTable('organizations').onDelete('CASCADE').notNullable().comment('组织ID')
    table.text('description').comment('分类描述')
    table.string('icon', 50).comment('分类图标')
    table.string('color', 7).comment('分类颜色')
    table.integer('sort').defaultTo(0).comment('排序')
    table.enum('status', ['active', 'inactive']).defaultTo('active').comment('状态')
    table.jsonb('metadata').defaultTo('{}').comment('扩展数据')
    table.timestamps(true, true)
    table.timestamp('deleted_at').comment('软删除时间')
    
    table.unique(['organization_id', 'code'], 'knowledge_categories_org_code_unique')
    table.comment('知识库分类表')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('knowledge_categories')
}