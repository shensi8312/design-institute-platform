/**
 * 扩展 design_rules 表，支持统一规则系统
 * 将 design_rules 作为通用 rule_base，支持多种规则类型
 */

exports.up = async function(knex) {
  console.log('🔧 开始扩展 design_rules 表...');

  // 1. 添加规则类型字段（支持装配/PID/建筑/工艺）
  await knex.schema.table('design_rules', (table) => {
    table.string('rule_type', 50).defaultTo('building').comment('规则类型: building/assembly/pid/process');

    // 2. 添加应用统计字段（用于反馈学习）
    table.integer('usage_count').defaultTo(0).comment('使用次数');
    table.integer('success_count').defaultTo(0).comment('成功次数');
    table.timestamp('last_applied_at').comment('最后应用时间');

    // 3. 添加来源追溯字段
    table.string('source_type', 50).comment('来源类型: step_file/drawing/document/manual');
    table.jsonb('source_metadata').comment('来源元数据');

    // 4. 添加学习来源字段
    table.string('learned_from', 20).defaultTo('manual').comment('学习来源: manual/ai_learning/llm_extraction');

    // 5. 索引优化
    table.index('rule_type', 'idx_design_rules_rule_type');
    table.index('confidence_score', 'idx_design_rules_confidence');
    table.index(['rule_type', 'review_status'], 'idx_design_rules_type_status');
  });

  // 6. 更新表注释
  await knex.raw(`
    COMMENT ON TABLE design_rules IS '统一规则基表（支持装配/PID/建筑/工艺等多种规则类型）';
  `);

  await knex.raw(`
    COMMENT ON COLUMN design_rules.rule_type IS '规则类型: building=建筑规范, assembly=装配规则, pid=管道仪表, process=工艺规则';
  `);

  console.log('✅ design_rules 表扩展完成');
};

exports.down = async function(knex) {
  console.log('🔧 回滚 design_rules 表扩展...');

  await knex.schema.table('design_rules', (table) => {
    // 删除索引
    table.dropIndex('rule_type', 'idx_design_rules_rule_type');
    table.dropIndex('confidence_score', 'idx_design_rules_confidence');
    table.dropIndex(['rule_type', 'review_status'], 'idx_design_rules_type_status');

    // 删除字段
    table.dropColumn('rule_type');
    table.dropColumn('usage_count');
    table.dropColumn('success_count');
    table.dropColumn('last_applied_at');
    table.dropColumn('source_type');
    table.dropColumn('source_metadata');
    table.dropColumn('learned_from');
  });

  console.log('✅ 回滚完成');
};
