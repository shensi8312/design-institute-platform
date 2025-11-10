/**
 * 创建专业领域模板表
 */
exports.up = function(knex) {
  return knex.schema
    // 领域模板表
    .createTable('domain_templates', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('name', 100).notNullable().comment('模板名称')
      table.text('description').comment('模板描述')
      table.enum('domain', [
        'semiconductor', 'mechanical', 'electrical', 'architecture',
        'literature', 'standards', 'regulations'
      ]).notNullable().comment('专业领域')
      table.jsonb('entity_types').comment('实体类型配置')
      table.jsonb('relation_types').comment('关系类型配置')
      table.jsonb('document_types').comment('文档类型配置')
      table.jsonb('classification_schema').comment('分类体系')
      table.jsonb('extraction_rules').comment('信息抽取规则')
      table.jsonb('validation_rules').comment('数据验证规则')
      table.boolean('is_default').defaultTo(false).comment('是否默认模板')
      table.timestamps(true, true)
      
      table.index(['domain'])
      table.comment('专业领域模板表')
    })
    
    // 知识分类表
    .createTable('knowledge_categories', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('name', 100).notNullable().comment('分类名称')
      table.string('code', 50).unique().comment('分类编码')
      table.uuid('parent_id').references('id').inTable('knowledge_categories').onDelete('CASCADE').comment('父分类')
      table.enum('domain', [
        'semiconductor', 'mechanical', 'electrical', 'architecture',
        'literature', 'standards', 'regulations'
      ]).comment('所属领域')
      table.text('description').comment('分类描述')
      table.jsonb('metadata').comment('分类元数据')
      table.integer('sort_order').defaultTo(0).comment('排序')
      table.timestamps(true, true)
      
      table.index(['domain', 'parent_id'])
      table.comment('知识分类表')
    })
    
    // 标准规范表
    .createTable('standards', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('code', 50).unique().notNullable().comment('标准编号')
      table.string('title', 200).notNullable().comment('标准名称')
      table.enum('type', [
        'national_standard', 'industry_standard', 'enterprise_standard',
        'international_standard', 'design_rule', 'inspection_standard'
      ]).notNullable().comment('标准类型')
      table.enum('domain', [
        'semiconductor', 'mechanical', 'electrical', 'architecture'
      ]).notNullable().comment('适用领域')
      table.string('version', 20).comment('版本号')
      table.date('effective_date').comment('生效日期')
      table.date('expiry_date').comment('失效日期')
      table.enum('status', ['draft', 'active', 'deprecated']).defaultTo('active').comment('状态')
      table.text('abstract').comment('标准摘要')
      table.jsonb('key_parameters').comment('关键参数')
      table.jsonb('applicable_scope').comment('适用范围')
      table.uuid('document_id').references('id').inTable('documents').onDelete('SET NULL').comment('关联文档')
      table.uuid('organization_id').references('id').inTable('organizations').onDelete('CASCADE').comment('组织ID')
      table.timestamps(true, true)
      
      table.index(['domain', 'type'])
      table.index(['status'])
      table.comment('标准规范表')
    })
    
    // 文献表
    .createTable('literatures', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('title', 300).notNullable().comment('文献标题')
      table.text('authors').comment('作者列表')
      table.string('journal', 200).comment('期刊/会议名称')
      table.string('doi', 100).unique().comment('DOI')
      table.integer('year').comment('发表年份')
      table.text('abstract').comment('摘要')
      table.jsonb('keywords').comment('关键词')
      table.enum('type', [
        'journal_paper', 'conference_paper', 'patent',
        'thesis', 'technical_report', 'white_paper'
      ]).notNullable().comment('文献类型')
      table.enum('domain', [
        'semiconductor', 'mechanical', 'electrical', 'architecture'
      ]).comment('领域分类')
      table.integer('citation_count').defaultTo(0).comment('引用次数')
      table.decimal('impact_factor', 5, 3).comment('影响因子')
      table.jsonb('research_areas').comment('研究方向')
      table.uuid('document_id').references('id').inTable('documents').onDelete('SET NULL').comment('关联文档')
      table.uuid('organization_id').references('id').inTable('organizations').onDelete('CASCADE').comment('组织ID')
      table.timestamps(true, true)
      
      table.index(['domain', 'type'])
      table.index(['year'])
      table.comment('文献表')
    })
}

exports.down = function(knex) {
  return knex.schema
    .dropTable('literatures')
    .dropTable('standards')
    .dropTable('knowledge_categories')
    .dropTable('domain_templates')
}