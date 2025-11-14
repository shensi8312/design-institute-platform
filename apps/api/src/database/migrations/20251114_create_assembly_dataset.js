/**
 * Week 3 - 242装配数据集 + 语义匹配系统
 * 创建装配数据集和向量化相关表
 */
exports.up = async function(knex) {
  // 1. assembly_dataset - 历史装配数据集
  await knex.schema.createTable('assembly_dataset', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('dataset_name', 100).notNullable().comment('数据集名称，如"242装配体"')
    table.string('part_a', 200).notNullable().comment('零件A名称')
    table.string('part_b', 200).notNullable().comment('零件B名称')
    table.string('constraint_type', 50).notNullable().comment('约束类型：SCREW/COINCIDENT/CONCENTRIC/PARALLEL/PERPENDICULAR')
    table.jsonb('parameters').comment('约束参数：{threadSize, pitch, distance, angle等}')
    table.string('source', 100).comment('数据来源：step_file/manual/learned')
    table.decimal('confidence', 3, 2).defaultTo(0.9).comment('置信度 0.0-1.0')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())

    table.index(['dataset_name', 'part_a', 'part_b'])
    table.index('constraint_type')
  })

  // 2. part_name_vectors - 零件名称向量化（用于Milvus元数据）
  await knex.schema.createTable('part_name_vectors', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('part_name', 200).notNullable().unique().comment('零件名称（完整）')
    table.string('part_name_normalized', 200).notNullable().comment('规范化名称')
    table.jsonb('tfidf_vector').notNullable().comment('TF-IDF向量（保留字段兼容性）')
    table.string('category', 50).comment('零件分类：bolt/nut/flange/valve/sensor等')
    table.integer('occurrence_count').defaultTo(1).comment('出现次数')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())

    table.index('part_name_normalized')
    table.index('category')
  })

  // 3. assembly_patterns - 装配模式库
  await knex.schema.createTable('assembly_patterns', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('pattern_name', 100).notNullable().comment('模式名称')
    table.jsonb('part_pattern').notNullable().comment('零件模式：{partA_type, partB_type, relationship}')
    table.integer('support_count').defaultTo(1).comment('支持度（出现次数）')
    table.decimal('confidence', 3, 2).defaultTo(0.8).comment('置信度')
    table.boolean('is_validated').defaultTo(false).comment('是否经过人工验证')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())

    table.index('pattern_name')
    table.index('is_validated')
  })

  console.log('✅ Week 3 tables created: assembly_dataset, part_name_vectors, assembly_patterns')
}

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('assembly_patterns')
  await knex.schema.dropTableIfExists('part_name_vectors')
  await knex.schema.dropTableIfExists('assembly_dataset')

  console.log('✅ Week 3 tables dropped')
}
