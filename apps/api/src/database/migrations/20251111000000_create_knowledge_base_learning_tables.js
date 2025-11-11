/**
 * 创建知识库学习相关表
 * - 历史案例表
 * - 标准规范库表
 * - 扩展design_rules表支持配套规则
 */
exports.up = async function(knex) {
  // 1. 历史案例表
  await knex.schema.createTable('historical_cases', (table) => {
    table.increments('id').primary()
    table.string('project_name', 255).notNullable()
    table.text('description')

    // 输入数据文件路径
    table.text('pid_file_path')
    table.text('bom_file_path')
    table.text('step_file_path')

    // 解析后的数据 (JSONB格式)
    table.jsonb('pid_data')
    table.jsonb('bom_data').notNullable()  // BOM清单
    table.jsonb('assembly_data')

    // 学习结果
    table.integer('extracted_rules_count').defaultTo(0)
    table.jsonb('learned_rules')

    // 元数据
    table.string('uploaded_by', 50).references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())

    // 索引
    table.index('project_name')
    table.index('uploaded_by')
    table.index('created_at')
  })

  // 2. 标准规范库表
  await knex.schema.createTable('standards_library', (table) => {
    table.string('standard_id', 50).primary()  // 如: GB/T 9119-2010
    table.string('standard_name', 255).notNullable()
    table.string('standard_category', 50).notNullable()  // flange, pipe, bolt, pump, valve

    // 标准内容 (结构化数据)
    table.jsonb('standard_data').notNullable()

    // 原始文档
    table.text('document_path')
    table.specificType('document_pages', 'text[]')  // 相关页码数组

    // 版本信息
    table.string('version', 50)
    table.date('issued_date')
    table.date('effective_date')
    table.date('discontinued_date')
    table.string('replaced_by', 50)  // 被哪个标准替代

    // 元数据
    table.string('uploaded_by', 50).references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())

    // 索引
    table.index('standard_category')
    table.index('effective_date')
  })

  // 3. 检查design_rules表是否需要添加新字段
  const hasRuleId = await knex.schema.hasColumn('design_rules', 'rule_id')
  const hasRuleType = await knex.schema.hasColumn('design_rules', 'rule_type')
  const hasConditionData = await knex.schema.hasColumn('design_rules', 'condition_data')
  const hasActionData = await knex.schema.hasColumn('design_rules', 'action_data')
  const hasSource = await knex.schema.hasColumn('design_rules', 'source')
  const hasConfidence = await knex.schema.hasColumn('design_rules', 'confidence')
  const hasSampleCount = await knex.schema.hasColumn('design_rules', 'sample_count')
  const hasReference = await knex.schema.hasColumn('design_rules', 'reference')
  const hasLearnedFrom = await knex.schema.hasColumn('design_rules', 'learned_from_projects')

  // 如果需要,扩展design_rules表
  if (!hasRuleId || !hasRuleType || !hasConditionData) {
    await knex.schema.alterTable('design_rules', (table) => {
      if (!hasRuleId) {
        table.string('rule_id', 100).unique()
      }
      if (!hasRuleType) {
        table.string('rule_type', 50)  // 'selection', 'matching', 'assembly'
        table.index('rule_type')
      }
      if (!hasConditionData) {
        table.jsonb('condition_data')  // 规则条件 (JSON格式)
      }
      if (!hasActionData) {
        table.jsonb('action_data')  // 规则动作 (JSON格式)
      }
      if (!hasSource) {
        table.string('source', 100)  // 'GB/T 9119-2010', 'learned_from_history'
      }
      if (!hasConfidence) {
        table.float('confidence').defaultTo(1.0)  // 0-1, 标准规则为1.0
      }
      if (!hasSampleCount) {
        table.integer('sample_count').defaultTo(0)  // 学习样本数量
      }
      if (!hasReference) {
        table.text('reference')  // 标准文档引用
      }
      if (!hasLearnedFrom) {
        table.specificType('learned_from_projects', 'text[]')  // 学习来源项目
      }
    })
  }

  // 4. 配套模式统计表 (缓存共现模式)
  await knex.schema.createTable('matching_patterns', (table) => {
    table.increments('id').primary()
    table.string('pattern_key', 200).notNullable().unique()  // valve_DN50_needs_flanges
    table.string('main_part_type', 100).notNullable()
    table.integer('main_part_dn')
    table.string('matching_part_type', 100).notNullable()
    table.string('matching_part_spec', 100)
    table.integer('avg_quantity')
    table.integer('occurrence_count').defaultTo(1)  // 出现次数
    table.integer('total_cases').defaultTo(1)  // 总案例数
    table.float('confidence')  // occurrence_count / total_cases
    table.jsonb('sample_data')  // 样本数据详情
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())

    // 索引
    table.index('main_part_type')
    table.index('matching_part_type')
    table.index('confidence')
  })

  console.log('✓ 知识库学习表创建完成')
}

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('matching_patterns')

  // 删除design_rules新增字段
  const hasRuleType = await knex.schema.hasColumn('design_rules', 'rule_type')
  if (hasRuleType) {
    await knex.schema.alterTable('design_rules', (table) => {
      table.dropColumn('rule_id')
      table.dropColumn('rule_type')
      table.dropColumn('condition_data')
      table.dropColumn('action_data')
      table.dropColumn('source')
      table.dropColumn('confidence')
      table.dropColumn('sample_count')
      table.dropColumn('reference')
      table.dropColumn('learned_from_projects')
    })
  }

  await knex.schema.dropTableIfExists('standards_library')
  await knex.schema.dropTableIfExists('historical_cases')
}
