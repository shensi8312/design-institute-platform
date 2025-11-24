const knex = require('../../config/database')
const KnowledgeIngestionService = require('../knowledge/KnowledgeIngestionService')
const EnterpriseKnowledgeService = require('../knowledge/EnterpriseKnowledgeService')
const SemanticLayerService = require('../semantic/SemanticLayerService')
const { SemanticDomain, SemanticType } = require('../../types/SemanticChunk')

/**
 * 知识系统集成服务
 *
 * 整合现有功能到新的审核工作流：
 * - 企业知识库 (knowledge_bases + knowledge_documents)
 * - 个人知识库 (permission_level='private')
 * - 规则提取 (design_rules)
 * - SPEC模板 (template_sections)
 * - 文档管理 (document_instances)
 */
class KnowledgeIntegrationService {
  /**
   * 集成点1: 从现有知识库文档创建入库任务
   */
  async importFromKnowledgeDocument(docId, options = {}) {
    const { forceReview = false } = options

    try {
      const doc = await knex('knowledge_documents')
        .where('id', docId)
        .first()

      if (!doc) {
        throw new Error(`文档不存在: ${docId}`)
      }

      const kb = await knex('knowledge_bases')
        .where('id', doc.kb_id)
        .first()

      console.log(`[Integration] 导入文档: ${doc.name} (知识库: ${kb.name})`)

      const kbType = this._mapKbType(kb)
      const needsReview = kbType === 'enterprise' || forceReview

      const [ingestion] = await knex('knowledge_ingestion')
        .insert({
          original_filename: doc.name,
          file_path: doc.minio_path || doc.file_path,
          file_type: doc.file_type,
          file_size: doc.file_size,
          uploaded_by: doc.upload_by,
          uploader_role: await this._getUserRole(doc.upload_by),
          domain: this._mapDomain(doc.domain),
          category: kb.name,
          tags: JSON.stringify(doc.metadata?.tags || []),
          tenant_id: kb.organization_id,
          project_id: null,
          parse_status: 'parsed',
          parse_result: JSON.stringify({
            chunks: this._extractChunksFromContent(doc.content),
            metadata: doc.metadata
          }),
          review_status: needsReview ? 'pending' : 'approved',
          ingested: !needsReview
        })
        .returning('*')

      console.log(`✅ 入库记录已创建: ${ingestion.id}`)

      if (needsReview) {
        await KnowledgeIngestionService.submitForReview(ingestion.id)
        return {
          success: true,
          ingestionId: ingestion.id,
          status: 'pending_review'
        }
      }

      await this._ingestDirectly(ingestion.id, doc, kb, 'personal')

      return {
        success: true,
        ingestionId: ingestion.id,
        status: 'ingested'
      }

    } catch (error) {
      console.error('[Integration] 导入失败:', error)
      throw error
    }
  }

  /**
   * 集成点2: 从SPEC模板导入（预审核通过）
   */
  async importFromTemplate(templateId, options = {}) {
    try {
      const sections = await knex('template_sections')
        .where('template_id', templateId)
        .select('*')

      if (sections.length === 0) {
        throw new Error(`模板不存在或无章节: ${templateId}`)
      }

      console.log(`[Integration] 导入模板: ${templateId}, ${sections.length} 个章节`)

      const chunks = sections.map(section => ({
        text: `${section.title}\n${section.content || ''}`,
        metadata: {
          template_id: templateId,
          template_section_id: section.id,
          section_code: section.section_code,
          section_title: section.title,
          page_number: section.page_number
        }
      }))

      const indexResult = await SemanticLayerService.indexChunks(
        SemanticDomain.SPEC,
        SemanticType.SECTION,
        chunks,
        {
          tenantId: options.tenantId || 'default',
          projectId: options.projectId,
          immediate: true,
          metadata: {
            kb_type: 'enterprise',
            status: 'approved',
            source: 'template',
            source_id: templateId
          }
        }
      )

      console.log(`✅ 模板已导入: ${indexResult.indexed} 条`)

      return {
        success: true,
        source: 'template',
        chunks_indexed: indexResult.indexed
      }

    } catch (error) {
      console.error('[Integration] 模板导入失败:', error)
      throw error
    }
  }

  /**
   * 集成点3: 从设计规则导入
   */
  async importFromDesignRules(options = {}) {
    const { ruleType = null, categoryId = null } = options

    try {
      let query = knex('design_rules')
        .where('is_active', true)

      if (ruleType) {
        query = query.where('rule_type', ruleType)
      }

      if (categoryId) {
        query = query.where('category_id', categoryId)
      }

      const rules = await query.select('*')

      console.log(`[Integration] 导入设计规则: ${rules.length} 条`)

      const chunks = rules.map(rule => ({
        text: `${rule.rule_name}: ${rule.rule_description || ''}`,
        metadata: {
          rule_code: rule.rule_code,
          rule_name: rule.rule_name,
          rule_type: rule.rule_type,
          severity: rule.severity,
          category_id: rule.category_id,
          source: 'design_rules',
          source_id: rule.id
        }
      }))

      const indexResult = await SemanticLayerService.indexChunks(
        SemanticDomain.RULE,
        SemanticType.RULE,
        chunks,
        {
          tenantId: options.tenantId || 'default',
          immediate: true,
          metadata: {
            kb_type: 'enterprise',
            status: 'approved'
          }
        }
      )

      console.log(`✅ 规则已导入: ${indexResult.indexed} 条`)

      return {
        success: true,
        source: 'design_rules',
        chunks_indexed: indexResult.indexed
      }

    } catch (error) {
      console.error('[Integration] 规则导入失败:', error)
      throw error
    }
  }

  /**
   * 集成点5: 统一搜索入口
   */
  async unifiedSearch(query, options = {}) {
    const {
      userId,
      tenantId,
      includePersonal = false,
      includeEnterprise = true,
      domain = null
    } = options

    try {
      const results = []

      if (includeEnterprise) {
        const enterpriseResults = await EnterpriseKnowledgeService.search(query, {
          tenantId,
          domain,
          userId
        })
        results.push(...enterpriseResults.map(r => ({ ...r, source: 'enterprise_kb_v2' })))
      }

      if (includePersonal && userId) {
        const personalResults = await this._searchPersonalKB(query, userId)
        results.push(...personalResults.map(r => ({ ...r, source: 'personal_kb' })))
      }

      results.sort((a, b) => b.score - a.score)

      return results

    } catch (error) {
      console.error('[Integration] 统一搜索失败:', error)
      throw error
    }
  }

  // === 辅助方法 ===

  _mapKbType(kb) {
    if (kb.permission_level === 'organization' || kb.is_public) {
      return 'enterprise'
    }
    if (kb.permission_level === 'project') {
      return 'project'
    }
    return 'personal'
  }

  _mapDomain(domain) {
    const domainMap = {
      'architecture': 'spec',
      'contract': 'contract',
      'rule': 'rule',
      'general': 'knowledge'
    }
    return domainMap[domain] || 'knowledge'
  }

  async _getUserRole(userId) {
    const user = await knex('users')
      .where('id', userId)
      .first()

    if (!user) return 'user'

    return user.is_admin ? 'admin' : 'user'
  }

  _extractChunksFromContent(content) {
    if (!content) return []

    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 50)
    return paragraphs.map((para, idx) => ({
      text: para.trim(),
      metadata: { chunk_index: idx }
    }))
  }

  async _ingestDirectly(ingestionId, doc, kb, kbType) {
    const ingestion = await knex('knowledge_ingestion')
      .where('id', ingestionId)
      .first()

    const parseResult = JSON.parse(ingestion.parse_result)

    await SemanticLayerService.indexChunks(
      this._mapDomain(doc.domain),
      SemanticType.CHUNK,
      parseResult.chunks,
      {
        tenantId: kb.organization_id,
        projectId: kb.id,
        immediate: true,
        metadata: {
          ingestion_id: ingestionId,
          kb_type: kbType,
          status: kbType === 'enterprise' ? 'approved' : 'draft',
          source: 'knowledge_documents',
          source_id: doc.id
        }
      }
    )

    await knex('knowledge_ingestion')
      .where('id', ingestionId)
      .update({
        ingested: true,
        ingested_at: knex.fn.now(),
        chunks_created: parseResult.chunks.length
      })
  }

  async _searchPersonalKB(query, userId) {
    return []
  }
}

module.exports = new KnowledgeIntegrationService()
