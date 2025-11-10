/**
 * 为知识库表添加图谱相关字段
 */
exports.up = function(knex) {
  return knex.schema.alterTable('knowledge_bases', (table) => {
    table.boolean('graph_enabled').defaultTo(false).comment('是否启用知识图谱')
    table.jsonb('graph_config').comment('图谱配置')
    table.timestamp('graph_initialized_at').comment('图谱初始化时间')
    table.timestamp('graph_last_updated_at').comment('图谱最后更新时间')
    table.jsonb('graph_stats').comment('图谱统计信息')
  })
}

exports.down = function(knex) {
  return knex.schema.alterTable('knowledge_bases', (table) => {
    table.dropColumn('graph_enabled')
    table.dropColumn('graph_config')
    table.dropColumn('graph_initialized_at')
    table.dropColumn('graph_last_updated_at')
    table.dropColumn('graph_stats')
  })
}