/**
 * 迁移: 创建知识文档版本管理和知识图谱相关表
 * 用于支持文档版本控制、向量索引和知识图谱存储
 */

exports.up = async function(knex) {
  // 1. 创建文档版本表
  await knex.schema.createTable('knowledge_document_versions', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'))
    table.string('document_id', 50).notNullable()
    table.integer('version_number').notNullable()
    table.text('file_path')
    table.text('minio_path')
    table.bigInteger('file_size')
    table.string('file_hash', 64).comment('文件MD5哈希，用于检测重复')
    table.text('change_description').comment('版本变更说明')
    table.string('upload_by', 50)
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.boolean('is_current').defaultTo(false).comment('是否为当前版本')

    // 外键和索引
    table.foreign('document_id').references('id').inTable('knowledge_documents').onDelete('CASCADE')
    table.unique(['document_id', 'version_number'])
    table.index('document_id', 'idx_document_versions_doc')
    table.index(['document_id', 'is_current'], 'idx_document_versions_current')
  })

  // 2. 创建向量索引表
  await knex.schema.createTable('knowledge_vectors', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'))
    table.string('document_id', 50).notNullable()
    table.string('version_id', 50).comment('关联版本')
    table.integer('chunk_index').comment('分块索引')
    table.text('chunk_text').comment('原始文本')
    table.bigInteger('milvus_id').comment('Milvus中的向量ID')
    table.timestamp('created_at').defaultTo(knex.fn.now())

    // 外键和索引
    table.foreign('document_id').references('id').inTable('knowledge_documents').onDelete('CASCADE')
    table.foreign('version_id').references('id').inTable('knowledge_document_versions').onDelete('CASCADE')
    table.index('document_id', 'idx_vectors_doc')
    table.index('milvus_id', 'idx_vectors_milvus')
    table.index('version_id', 'idx_vectors_version')
  })

  // 3. 创建知识图谱节点表
  await knex.schema.createTable('knowledge_graph_nodes', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'))
    table.string('document_id', 50).notNullable()
    table.string('version_id', 50).comment('关联版本')
    table.bigInteger('neo4j_node_id').comment('Neo4j中的节点ID')
    table.string('entity_type', 100).comment('实体类型')
    table.string('entity_name', 255).comment('实体名称')
    table.jsonb('properties').comment('实体属性')
    table.timestamp('created_at').defaultTo(knex.fn.now())

    // 外键和索引
    table.foreign('document_id').references('id').inTable('knowledge_documents').onDelete('CASCADE')
    table.foreign('version_id').references('id').inTable('knowledge_document_versions').onDelete('CASCADE')
    table.index('document_id', 'idx_graph_nodes_doc')
    table.index('entity_type', 'idx_graph_nodes_type')
    table.index('version_id', 'idx_graph_nodes_version')
    table.index('neo4j_node_id', 'idx_graph_nodes_neo4j')
  })

  // 4. 创建知识图谱关系表
  await knex.schema.createTable('knowledge_graph_relationships', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'))
    table.string('document_id', 50).notNullable()
    table.string('version_id', 50).comment('关联版本')
    table.bigInteger('neo4j_rel_id').comment('Neo4j中的关系ID')
    table.string('source_node_id', 50).comment('源节点')
    table.string('target_node_id', 50).comment('目标节点')
    table.string('relationship_type', 100).comment('关系类型')
    table.jsonb('properties').comment('关系属性')
    table.timestamp('created_at').defaultTo(knex.fn.now())

    // 外键和索引
    table.foreign('document_id').references('id').inTable('knowledge_documents').onDelete('CASCADE')
    table.foreign('version_id').references('id').inTable('knowledge_document_versions').onDelete('CASCADE')
    table.foreign('source_node_id').references('id').inTable('knowledge_graph_nodes').onDelete('CASCADE')
    table.foreign('target_node_id').references('id').inTable('knowledge_graph_nodes').onDelete('CASCADE')
    table.index('document_id', 'idx_graph_rels_doc')
    table.index(['source_node_id', 'target_node_id'], 'idx_graph_rels_nodes')
    table.index('version_id', 'idx_graph_rels_version')
  })

  // 5. 给knowledge_documents表添加current_version字段
  await knex.schema.table('knowledge_documents', (table) => {
    table.integer('current_version').defaultTo(0).comment('当前版本号')
  })

  console.log('✅ 版本管理和知识图谱表创建成功')
}

exports.down = async function(knex) {
  // 按照依赖关系逆序删除
  await knex.schema.dropTableIfExists('knowledge_graph_relationships')
  await knex.schema.dropTableIfExists('knowledge_graph_nodes')
  await knex.schema.dropTableIfExists('knowledge_vectors')
  await knex.schema.dropTableIfExists('knowledge_document_versions')

  await knex.schema.table('knowledge_documents', (table) => {
    table.dropColumn('current_version')
  })

  console.log('✅ 回滚完成')
}
