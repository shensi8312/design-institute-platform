/**
 * 修复assembly_rules表的rule_id字段长度
 * 原因: 学习功能生成的ID (如BOM_VCR_1763012338075_ztz37d) 超过20字符导致保存失败
 */
exports.up = function(knex) {
  return knex.schema.alterTable('assembly_rules', table => {
    table.string('rule_id', 100).notNullable().alter();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('assembly_rules', table => {
    table.string('rule_id', 20).notNullable().alter();
  });
};
