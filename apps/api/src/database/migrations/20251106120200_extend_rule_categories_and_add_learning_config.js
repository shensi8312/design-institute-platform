/**
 * 扩展规则分类并创建学习配置表
 */

exports.up = async function(knex) {
  console.log('🔧 开始扩展 rule_categories 并创建配置表...');

  // 1. 添加新的规则分类（装配/PID/工艺）
  const newCategories = [
    {
      id: 'assembly_rules',
      name: '装配规则',
      code: 'ASM',
      level: 'business',
      sort_order: 10,
      description: '从STEP文件学习的装配约束规则（零件配合、同轴、间距等）',
      is_active: true
    },
    {
      id: 'pid_rules',
      name: 'PID规则',
      code: 'PID',
      level: 'business',
      sort_order: 11,
      description: '从P&ID图纸学习的管道仪表规则（符号识别、连接规则、规格参数）',
      is_active: true
    },
    {
      id: 'process_rules',
      name: '工艺规则',
      code: 'PROC',
      level: 'business',
      sort_order: 12,
      description: '制造工艺相关规则（材料选择、加工参数、成本优化）',
      is_active: true
    }
  ];

  for (const category of newCategories) {
    // 检查是否已存在
    const exists = await knex('rule_categories').where('id', category.id).first();
    if (!exists) {
      await knex('rule_categories').insert(category);
      console.log(`  ✓ 添加分类: ${category.name}`);
    }
  }

  // 2. 创建规则学习配置表
  await knex.schema.createTable('rule_learning_config', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('rule_type', 50).notNullable().unique().comment('规则类型');

    // 学习触发方式
    table.string('trigger_mode', 50).comment('触发方式: auto/manual/batch/scheduled');

    // 自动学习配置
    table.boolean('auto_learn_enabled').defaultTo(false).comment('启用自动学习');
    table.decimal('auto_approve_threshold', 3, 2).comment('自动批准的置信度阈值');

    // 批量处理配置
    table.integer('batch_size').comment('批量大小');
    table.integer('batch_interval_hours').comment('批量间隔（小时）');

    // 质量控制
    table.decimal('min_confidence_threshold', 3, 2).defaultTo(0.5).comment('最低置信度要求');
    table.boolean('require_human_review').defaultTo(true).comment('需要人工审核');

    // 反馈学习配置
    table.boolean('enable_feedback_learning').defaultTo(true).comment('启用反馈学习');
    table.decimal('feedback_weight', 3, 2).defaultTo(0.3).comment('反馈对置信度的影响权重');

    // 冲突处理
    table.string('conflict_resolution_strategy', 50).comment('冲突解决策略');

    // 创建信息
    table.string('created_by', 50).references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // 3. 插入默认配置
  await knex('rule_learning_config').insert([
    {
      rule_type: 'assembly',
      trigger_mode: 'manual',
      auto_learn_enabled: false,
      auto_approve_threshold: 0.9,
      min_confidence_threshold: 0.5,
      require_human_review: true,
      enable_feedback_learning: true,
      feedback_weight: 0.3,
      conflict_resolution_strategy: 'highest_confidence'
    },
    {
      rule_type: 'pid',
      trigger_mode: 'auto',
      auto_learn_enabled: false,
      auto_approve_threshold: 0.85,
      min_confidence_threshold: 0.5,
      require_human_review: true,
      enable_feedback_learning: true,
      feedback_weight: 0.3
    },
    {
      rule_type: 'building',
      trigger_mode: 'scheduled',
      auto_learn_enabled: false,
      batch_interval_hours: 24,
      min_confidence_threshold: 0.7,
      require_human_review: true,
      enable_feedback_learning: true,
      feedback_weight: 0.2
    }
  ]);

  console.log('✅ rule_categories 扩展和配置表创建完成');
};

exports.down = async function(knex) {
  console.log('🔧 回滚规则分类和配置表...');

  // 删除配置表
  await knex.schema.dropTableIfExists('rule_learning_config');

  // 删除新增的分类
  await knex('rule_categories')
    .whereIn('id', ['assembly_rules', 'pid_rules', 'process_rules'])
    .delete();

  console.log('✅ 回滚完成');
};
