const db = require('../../config/database')

/**
 * 提取模板服务
 * 管理提取模板和提取结果的CRUD操作
 */
class ExtractionTemplateService {
  /**
   * 创建模板
   */
  async createTemplate(data) {
    const [template] = await db('extraction_templates')
      .insert({
        name: data.name,
        description: data.description,
        prompt_template: data.prompt_template,
        output_schema: data.output_schema ? JSON.stringify(data.output_schema) : null,
        enabled: data.enabled !== false,
        priority: data.priority || 0,
        category: data.category
      })
      .returning('*')

    return template
  }

  /**
   * 获取模板列表
   */
  async getTemplates(options = {}) {
    const { enabled = null, category = null } = options

    let query = db('extraction_templates')

    if (enabled !== null) {
      query = query.where('enabled', enabled)
    }

    if (category) {
      query = query.where('category', category)
    }

    const templates = await query.orderBy('priority', 'desc').orderBy('created_at', 'desc')

    // JSONB字段Knex已自动解析为对象，无需JSON.parse
    return templates
  }

  /**
   * 获取单个模板
   */
  async getTemplate(id) {
    const template = await db('extraction_templates').where('id', id).first()

    if (!template) {
      throw new Error('模板不存在')
    }

    // JSONB字段Knex已自动解析为对象，无需JSON.parse
    return template
  }

  /**
   * 更新模板
   */
  async updateTemplate(id, data) {
    const updates = {
      updated_at: new Date()
    }

    if (data.name !== undefined) updates.name = data.name
    if (data.description !== undefined) updates.description = data.description
    if (data.prompt_template !== undefined) updates.prompt_template = data.prompt_template
    if (data.output_schema !== undefined) updates.output_schema = JSON.stringify(data.output_schema)
    if (data.enabled !== undefined) updates.enabled = data.enabled
    if (data.priority !== undefined) updates.priority = data.priority
    if (data.category !== undefined) updates.category = data.category

    const [template] = await db('extraction_templates')
      .where('id', id)
      .update(updates)
      .returning('*')

    return template
  }

  /**
   * 删除模板
   */
  async deleteTemplate(id) {
    await db('extraction_templates').where('id', id).delete()
  }

  /**
   * 保存提取结果
   */
  async saveExtraction(data) {
    const [extraction] = await db('document_extractions')
      .insert({
        document_id: data.document_id,
        template_id: data.template_id,
        extraction_type: data.extraction_type,
        extracted_data: JSON.stringify(data.extracted_data),
        confidence: data.confidence,
        chunk_start: data.chunk_start,
        chunk_end: data.chunk_end
      })
      .returning('*')

    return extraction
  }

  /**
   * 批量保存提取结果
   */
  async saveExtractionBatch(documentId, extractions) {
    const records = extractions.map(e => ({
      document_id: documentId,
      template_id: e.template_id,
      extraction_type: e.extraction_type,
      extracted_data: JSON.stringify(e.extracted_data),
      confidence: e.confidence
    }))

    await db('document_extractions').insert(records)
  }

  /**
   * 获取文档的提取结果
   */
  async getExtractions(documentId, options = {}) {
    const { type = null } = options

    let query = db('document_extractions')
      .where('document_id', documentId)
      .leftJoin('extraction_templates', 'document_extractions.template_id', 'extraction_templates.id')
      .select(
        'document_extractions.*',
        'extraction_templates.name as template_name',
        'extraction_templates.category as template_category'
      )

    if (type) {
      query = query.where('document_extractions.extraction_type', type)
    }

    const extractions = await query.orderBy('document_extractions.created_at', 'desc')

    // JSONB字段Knex已自动解析为对象，无需JSON.parse
    return extractions
  }

  /**
   * 删除文档的所有提取结果
   */
  async deleteExtractions(documentId) {
    await db('document_extractions').where('document_id', documentId).delete()
  }
}

module.exports = ExtractionTemplateService
