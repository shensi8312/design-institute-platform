/**
 * Week 3: 242装配数据集 + 语义匹配
 *
 * 表设计：
 * 1. assembly_dataset - 历史装配数据集
 * 2. part_name_vectors - 零件名称向量化（TF-IDF）
 * 3. assembly_patterns - 装配模式库（频繁出现的约束组合）
 */

exports.up = async function(knex) {
  // 1. 历史装配数据集表
  await knex.schema.createTable('assembly_dataset', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('dataset_name', 100).notNullable() // 如: '242装配体', 'SolidWorks项目A'
    table.string('part_a', 200).notNullable() // 零件A名称
    table.string('part_b', 200).notNullable() // 零件B名称
    table.string('constraint_type', 50).notNullable() // CONCENTRIC/SCREW/COINCIDENT等
    table.jsonb('parameters') // 约束参数 {pitch, distance, angle等}
    table.string('source', 100) // 数据来源: step_file/manual/learned
    table.string('source_file', 500) // 源文件路径
    table.decimal('confidence', 3, 2).defaultTo(0.9) // 置信度 0.0-1.0
    table.text('notes') // 备注
    table.timestamps(true, true)

    table.index('dataset_name')
    table.index(['part_a', 'part_b'])
    table.index('constraint_type')
  })

  // 2. 零件名称向量化表（TF-IDF）
  await knex.schema.createTable('part_name_vectors', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('part_name', 200).notNullable().unique()
    table.string('part_name_normalized', 200).notNullable() // 标准化后的名称
    table.jsonb('tfidf_vector').notNullable() // TF-IDF向量 {term1: score1, term2: score2, ...}
    table.jsonb('term_frequencies') // 词频统计
    table.string('category', 50) // 推断的类别: bolt/nut/flange/valve等
    table.integer('occurrence_count').defaultTo(1) // 在数据集中出现次数
    table.timestamps(true, true)

    table.index('part_name')
    table.index('part_name_normalized')
    table.index('category')
  })

  // 3. 装配模式库（频繁约束组合）
  await knex.schema.createTable('assembly_patterns', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('pattern_name', 100).notNullable()
    table.text('description')
    table.jsonb('part_pattern') // 零件模式 {partA_type, partB_type, relationship}
    table.string('constraint_type', 50).notNullable()
    table.jsonb('typical_parameters') // 典型参数
    table.integer('support_count').defaultTo(1) // 支持度（出现次数）
    table.decimal('confidence', 3, 2).defaultTo(0.8) // 置信度
    table.boolean('is_validated').defaultTo(false) // 是否经过工程师验证
    table.timestamps(true, true)

    table.index('pattern_name')
    table.index('constraint_type')
    table.index('support_count')
  })
}

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('assembly_patterns')
  await knex.schema.dropTableIfExists('part_name_vectors')
  await knex.schema.dropTableIfExists('assembly_dataset')
}
