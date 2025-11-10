exports.up = async function(knex) {
  // 实体类型配置表
  await knex.schema.createTable('graph_entity_types', (table) => {
    table.string('id', 50).primary()
    table.string('name', 100).notNullable().comment('类型名称，如：人物、组织、地点')
    table.string('color', 20).comment('显示颜色')
    table.string('icon', 50).comment('图标')
    table.text('description').comment('描述')
    table.boolean('is_active').defaultTo(true)
    table.integer('sort_order').defaultTo(0)
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
  })

  // 关系类型配置表
  await knex.schema.createTable('graph_relationship_types', (table) => {
    table.string('id', 50).primary()
    table.string('name', 100).notNullable().comment('关系名称，如：属于、位于、开发')
    table.string('color', 20).comment('线条颜色')
    table.text('description').comment('描述')
    table.boolean('is_active').defaultTo(true)
    table.boolean('is_directed').defaultTo(true).comment('是否有方向')
    table.integer('sort_order').defaultTo(0)
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
  })

  // 插入默认配置
  await knex('graph_entity_types').insert([
    { id: 'person', name: '人物', color: '#1890ff', icon: 'user', description: '人名' },
    { id: 'org', name: '组织', color: '#52c41a', icon: 'team', description: '机构、公司、组织' },
    { id: 'location', name: '地点', color: '#faad14', icon: 'environment', description: '地理位置' },
    { id: 'concept', name: '概念', color: '#722ed1', icon: 'bulb', description: '抽象概念' },
    { id: 'tech', name: '技术', color: '#eb2f96', icon: 'rocket', description: '技术、工具、框架' },
    { id: 'product', name: '产品', color: '#13c2c2', icon: 'appstore', description: '产品、服务' },
    { id: 'other', name: '其他', color: '#8c8c8c', icon: 'question', description: '其他类型' }
  ])

  await knex('graph_relationship_types').insert([
    { id: 'is', name: '是', color: '#1890ff', description: 'A是B', is_directed: true },
    { id: 'has', name: '包含', color: '#52c41a', description: 'A包含B', is_directed: true },
    { id: 'uses', name: '使用', color: '#faad14', description: 'A使用B', is_directed: true },
    { id: 'belongs_to', name: '属于', color: '#722ed1', description: 'A属于B', is_directed: true },
    { id: 'located_in', name: '位于', color: '#eb2f96', description: 'A位于B', is_directed: true },
    { id: 'develops', name: '开发', color: '#13c2c2', description: 'A开发B', is_directed: true },
    { id: 'related', name: '相关', color: '#8c8c8c', description: 'A与B相关', is_directed: false }
  ])
}

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('graph_relationship_types')
  await knex.schema.dropTableIfExists('graph_entity_types')
}
