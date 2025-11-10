/**
 * 创建菜单表
 */
exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('menus')
  if (exists) {
    return
  }

  await knex.schema.createTable('menus', (table) => {
    table.string('id', 64).primary().comment('菜单ID')
    table.string('name', 100).notNullable().comment('菜单名称')
    table.string('path', 200).comment('路由路径')
    table.string('component', 100).comment('前端组件名称')
    table.string('icon', 100).comment('图标')
    table.string('type', 20).defaultTo('menu').comment('菜单类型 directory/menu/button/link')
    table.string('permission_code', 100).comment('关联权限编码')
    table.boolean('visible').defaultTo(true).comment('是否可见')
    table.enum('status', ['active', 'inactive', 'deleted']).defaultTo('active').comment('状态')
    table.integer('sort_order').defaultTo(0).comment('排序')
    table.jsonb('meta').defaultTo('{}').comment('扩展配置')
    table.string('parent_id', 64).references('id').inTable('menus').onDelete('SET NULL').comment('父菜单ID')
    table.string('created_by', 64).comment('创建人')
    table.string('updated_by', 64).comment('更新人')
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间')
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间')
    table.timestamp('deleted_at').comment('软删除时间')

    table.unique(['path'])
    table.index(['parent_id'])
    table.index(['status'])
    table.index(['permission_code'])
    table.comment('系统菜单表')
  })
}

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('menus')
}
