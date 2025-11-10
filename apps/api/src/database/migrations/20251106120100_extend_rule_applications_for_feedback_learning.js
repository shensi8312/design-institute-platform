/**
 * 扩展 rule_applications 表，支持反馈学习闭环
 */

exports.up = async function(knex) {
  console.log('🔧 开始扩展 rule_applications 表...');

  await knex.schema.table('rule_applications', (table) => {
    // 1. 应用上下文
    table.jsonb('context').comment('应用上下文数据（如零件信息、图纸特征等）');

    // 2. 应用方式
    table.string('applied_method', 50).comment('应用方式: auto=自动应用, suggested=建议选择, manual_selected=手动选择');

    // 3. 结果评估
    table.string('result_status', 20).comment('结果状态: success/failed/corrected/rejected');

    // 4. 人工反馈
    table.string('user_feedback', 20).comment('用户反馈: correct/incorrect/partially_correct');
    table.jsonb('user_correction').comment('用户修正的正确答案');
    table.text('feedback_comment').comment('反馈备注');

    // 5. 置信度调整
    table.decimal('original_confidence', 3, 2).comment('原始置信度');
    table.decimal('adjusted_confidence', 3, 2).comment('调整后置信度');

    // 6. 应用人和时间
    table.string('applied_by', 50).comment('应用人ID');
    table.timestamp('applied_at').defaultTo(knex.fn.now()).comment('应用时间');

    // 7. 外键约束
    table.foreign('applied_by').references('users.id').onDelete('SET NULL');

    // 8. 索引
    table.index('result_status', 'idx_rule_applications_result_status');
    table.index('applied_at', 'idx_rule_applications_applied_at');
    table.index(['rule_id', 'result_status'], 'idx_rule_applications_rule_status');
  });

  // 更新表注释
  await knex.raw(`
    COMMENT ON TABLE rule_applications IS '规则应用记录表（用于反馈学习和持续优化）';
  `);

  console.log('✅ rule_applications 表扩展完成');
};

exports.down = async function(knex) {
  console.log('🔧 回滚 rule_applications 表扩展...');

  await knex.schema.table('rule_applications', (table) => {
    // 删除外键
    table.dropForeign('applied_by');

    // 删除索引
    table.dropIndex('result_status', 'idx_rule_applications_result_status');
    table.dropIndex('applied_at', 'idx_rule_applications_applied_at');
    table.dropIndex(['rule_id', 'result_status'], 'idx_rule_applications_rule_status');

    // 删除字段
    table.dropColumn('context');
    table.dropColumn('applied_method');
    table.dropColumn('result_status');
    table.dropColumn('user_feedback');
    table.dropColumn('user_correction');
    table.dropColumn('feedback_comment');
    table.dropColumn('original_confidence');
    table.dropColumn('adjusted_confidence');
    table.dropColumn('applied_by');
    table.dropColumn('applied_at');
  });

  console.log('✅ 回滚完成');
};
