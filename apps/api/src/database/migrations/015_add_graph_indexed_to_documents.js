/**
 * 为文档表添加图谱索引字段
 */
exports.up = function(knex) {
  return knex.schema.alterTable('documents', (table) => {
    table.timestamp('graph_indexed_at').comment('图谱索引时间')
    table.jsonb('graph_entities').comment('提取的实体')
    table.jsonb('graph_relationships').comment('提取的关系')
  })
}

exports.down = function(knex) {
  return knex.schema.alterTable('documents', (table) => {
    table.dropColumn('graph_indexed_at')
    table.dropColumn('graph_entities')
    table.dropColumn('graph_relationships')
  })
}