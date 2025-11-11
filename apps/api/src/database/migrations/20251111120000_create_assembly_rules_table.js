/**
 * 创建装配规则表
 * 修复问题：代码中使用了assembly_rules表但从未创建
 */
exports.up = async function(knex) {
  console.log('🔧 创建 assembly_rules 表...')

  await knex.schema.createTable('assembly_rules', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('rule_id', 100).unique().notNullable().comment('规则ID，如: R1, R2')
    table.string('name', 200).notNullable().comment('规则名称')
    table.text('description').comment('规则描述')
    table.integer('priority').notNullable().defaultTo(5).comment('优先级，数字越大越优先')

    // 约束类型
    table.string('constraint_type', 50).notNullable().comment('约束类型: CONCENTRIC, SCREW, COINCIDENT等')

    // 规则条件和动作 (JSON格式)
    table.jsonb('condition_logic').notNullable().comment('条件逻辑，JSON格式')
    table.jsonb('action_template').notNullable().comment('动作模板，JSON格式')

    // 规则来源和置信度
    table.string('source', 100).defaultTo('manual').comment('规则来源: manual, learned')
    table.float('confidence').defaultTo(1.0).comment('置信度 0-1，手动规则为1.0，学习规则<1.0')
    table.integer('sample_count').defaultTo(0).comment('学习样本数量')

    // 使用统计
    table.integer('usage_count').defaultTo(0).comment('应用次数')
    table.integer('success_count').defaultTo(0).comment('成功次数')

    // 状态
    table.boolean('is_active').defaultTo(true).comment('是否启用')

    // 元数据
    table.string('created_by', 50).references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())

    // 索引
    table.index('rule_id')
    table.index('constraint_type')
    table.index('priority')
    table.index('is_active')
    table.index('source')
  })

  console.log('✓ assembly_rules 表创建完成')

  // 插入一些默认规则
  await knex('assembly_rules').insert([
    {
      rule_id: 'R1',
      name: 'VCR接头同轴约束',
      description: 'VCR接头之间需要同轴配合以确保金属密封面接触',
      priority: 10,
      constraint_type: 'CONCENTRIC',
      condition_logic: JSON.stringify({
        type: 'both',
        field: 'type',
        value: 'VCR接头'
      }),
      action_template: JSON.stringify({
        type: 'CONCENTRIC',
        parameters: { alignment: 'ALIGNED' }
      }),
      source: 'manual',
      confidence: 1.0,
      is_active: true
    },
    {
      rule_id: 'R2',
      name: '螺纹连接约束',
      description: '螺纹规格匹配的零件自动生成螺纹配合约束',
      priority: 9,
      constraint_type: 'SCREW',
      condition_logic: JSON.stringify({
        type: 'thread_compatible',
        field: 'thread'
      }),
      action_template: JSON.stringify({
        type: 'SCREW',
        parameters: {
          direction: 'RIGHT_HAND',
          revolutions: 5
        }
      }),
      source: 'manual',
      confidence: 1.0,
      is_active: true
    },
    {
      rule_id: 'R3',
      name: '法兰面接触约束',
      description: '法兰面需要重合接触',
      priority: 8,
      constraint_type: 'COINCIDENT',
      condition_logic: JSON.stringify({
        type: 'both',
        field: 'name',
        contains: '法兰'
      }),
      action_template: JSON.stringify({
        type: 'COINCIDENT',
        parameters: { alignment: 'ALIGNED', flip: false }
      }),
      source: 'manual',
      confidence: 1.0,
      is_active: true
    },
    {
      rule_id: 'R4',
      name: '螺栓-螺母配对',
      description: '螺栓与螺母螺纹规格匹配时生成螺纹副约束',
      priority: 10,
      constraint_type: 'SCREW',
      condition_logic: JSON.stringify({
        type: 'bolt_nut_pair',
        field: 'thread'
      }),
      action_template: JSON.stringify({
        type: 'SCREW',
        parameters: {
          revolutions: 8
        }
      }),
      source: 'manual',
      confidence: 1.0,
      is_active: true
    }
  ])

  console.log('✓ 插入默认装配规则')
}

exports.down = async function(knex) {
  console.log('🔧 删除 assembly_rules 表...')
  await knex.schema.dropTableIfExists('assembly_rules')
  console.log('✓ assembly_rules 表已删除')
}
