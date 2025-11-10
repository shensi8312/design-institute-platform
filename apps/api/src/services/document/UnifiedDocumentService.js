/**
 * 统一文档服务
 * 核心：文档生命周期管理
 */

const knex = require('../../config/database');
const DocumentDomainConfig = require('../../config/DocumentDomainConfig');

class UnifiedDocumentService {
  constructor() {
    this.domainConfig = DocumentDomainConfig;
  }

  /**
   * 获取文档列表
   * @param {Object} params
   * @param {string} params.documentType - 文档类型（可选）
   * @param {string} params.userId - 用户ID
   * @returns {Promise<Array>} 文档列表
   */
  async getDocuments({ documentType, userId }) {
    let query = knex('project_documents')
      .select('project_documents.*')
      .orderBy('project_documents.created_at', 'desc');

    // 按文档类型过滤
    if (documentType) {
      query = query.where('project_documents.document_type', documentType);
    }

    // 权限过滤：管理员看所有，普通用户看自己创建的
    // TODO: 添加更细粒度的权限控制
    // query = query.where('project_documents.created_by', userId);

    const documents = await query;
    return documents;
  }

  /**
   * 创建文档
   * @param {Object} params
   * @param {string} params.title - 文档标题
   * @param {string} params.documentType - 文档类型 (spec | contract | bidding)
   * @param {string} params.projectId - 项目ID
   * @param {string} params.templateId - 模板ID（可选）
   * @param {string} params.createdBy - 创建人ID
   * @returns {Promise<Object>} 文档对象
   */
  async createDocument({
    title,
    documentType,
    projectId,
    templateId,
    createdBy
  }) {
    // 验证文档类型
    const domain = this.domainConfig.getDomain(documentType);

    // 创建文档记录
    const [document] = await knex('project_documents').insert({
      title,
      document_type: documentType,
      project_id: projectId,
      template_id: templateId || null,
      status: 'draft',
      created_by: createdBy,
    }).returning('*');

    // 如果指定了模板，从模板复制章节结构
    if (templateId) {
      await this._copyTemplateStructure(document.id, templateId);
    }

    // 创建修订设置
    await this._createRevisionSettings(document.id, documentType);

    return document;
  }

  /**
   * 从模板复制章节结构
   * @private
   */
  async _copyTemplateStructure(documentId, templateId) {
    const template = await knex('document_templates').where({ id: templateId }).first();
    if (!template) return;

    const sectionStructure = JSON.parse(template.section_structure || '[]');
    const sections = this._flattenSectionStructure(sectionStructure);

    for (const section of sections) {
      await knex('document_sections').insert({
        document_id: documentId,
        section_code: section.code,
        title: section.title,
        level: section.level,
        parent_id: section.parentId,
        sort_order: section.order,
        from_template: true,
        template_section_id: section.id,
        editable: section.editable !== false,
        deletable: section.deletable !== false,
      });
    }
  }

  /**
   * 展平章节结构（递归）
   * @private
   */
  _flattenSectionStructure(structure, parentId = null, level = 1) {
    const sections = [];

    structure.forEach((section, index) => {
      const flatSection = {
        id: section.id,
        code: section.code,
        title: section.title,
        level: level,
        order: index,
        parentId: parentId,
        editable: section.editable,
        deletable: section.deletable,
      };

      sections.push(flatSection);

      if (section.children && section.children.length > 0) {
        const childSections = this._flattenSectionStructure(
          section.children,
          section.id,
          level + 1
        );
        sections.push(...childSections);
      }
    });

    return sections;
  }

  /**
   * 创建修订设置
   * @private
   */
  async _createRevisionSettings(documentId, documentType) {
    const revisionConfig = this.domainConfig.getRevisionTrackingConfig(documentType);

    await knex('document_revision_settings').insert({
      document_id: documentId,
      track_changes_enabled: revisionConfig.defaultOn,
      who_can_edit: 'all',
      who_can_accept_reject: 'owner',
      show_revisions: true,
      show_comments: true,
    });
  }

  /**
   * 获取文档详情
   * @param {string} documentId - 文档ID
   * @param {Object} options - 选项
   * @param {boolean} options.includeSections - 是否包含章节
   * @param {boolean} options.includeRevisions - 是否包含修订
   * @returns {Promise<Object>}
   */
  async getDocument(documentId, options = {}) {
    const document = await knex('project_documents')
      .where({ id: documentId })
      .first();

    if (!document) {
      throw new Error('文档不存在');
    }

    // 加载章节
    if (options.includeSections) {
      document.sections = await this.getDocumentSections(documentId);
    }

    // 加载修订设置
    document.revisionSettings = await knex('document_revision_settings')
      .where({ document_id: documentId })
      .first();

    return document;
  }

  /**
   * 获取文档章节列表
   * @param {string} documentId
   * @returns {Promise<Array>}
   */
  async getDocumentSections(documentId) {
    const sections = await knex('document_sections')
      .where({ document_id: documentId })
      .orderBy('sort_order');

    return this._buildSectionTree(sections);
  }

  /**
   * 构建章节树结构
   * @private
   */
  _buildSectionTree(sections) {
    const map = new Map();
    const roots = [];

    sections.forEach(section => {
      map.set(section.id, { ...section, children: [] });
    });

    sections.forEach(section => {
      const node = map.get(section.id);
      if (section.parent_id) {
        const parent = map.get(section.parent_id);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  /**
   * 更新文档基本信息
   * @param {string} documentId
   * @param {Object} updates
   * @param {string} userId - 操作人ID
   * @returns {Promise<Object>}
   */
  async updateDocument(documentId, updates, userId) {
    await knex('project_documents')
      .where({ id: documentId })
      .update({
        ...updates,
        updated_by: userId,
        updated_at: knex.fn.now(),
      });

    return this.getDocument(documentId);
  }

  /**
   * 删除文档
   * @param {string} documentId
   * @param {string} userId - 操作人ID
   * @returns {Promise<void>}
   */
  async deleteDocument(documentId, userId) {
    // 检查权限
    const document = await this.getDocument(documentId);
    // TODO: 权限检查

    // 记录操作日志
    await this._logOperation({
      document_id: documentId,
      operation_type: 'delete',
      operation_target: 'document',
      operator_id: userId,
    });

    // 删除文档（级联删除章节、评论等）
    await knex('project_documents').where({ id: documentId }).del();
  }

  /**
   * 更新文档状态
   * @param {string} documentId
   * @param {string} status - 新状态
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async updateDocumentStatus(documentId, status, userId) {
    const document = await this.getDocument(documentId);

    // 状态转换验证
    this._validateStatusTransition(document.status, status);

    await knex('project_documents')
      .where({ id: documentId })
      .update({
        status,
        updated_by: userId,
        updated_at: knex.fn.now(),
        ...(status === 'completed' && {
          completed_at: knex.fn.now(),
          completed_by: userId,
        }),
      });

    return this.getDocument(documentId);
  }

  /**
   * 验证状态转换
   * @private
   */
  _validateStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
      draft: ['in_review', 'completed'],
      in_review: ['draft', 'completed'],
      completed: ['archive_pending'],
      archive_pending: ['archived'],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(`无效的状态转换: ${currentStatus} -> ${newStatus}`);
    }
  }

  /**
   * 记录操作日志
   * @private
   */
  async _logOperation(logData) {
    await knex('document_operation_logs').insert({
      ...logData,
      created_at: knex.fn.now(),
    });
  }

  /**
   * 获取项目的所有文档
   * @param {string} projectId
   * @param {Object} filters
   * @returns {Promise<Array>}
   */
  async getProjectDocuments(projectId, filters = {}) {
    let query = knex('project_documents')
      .where({ project_id: projectId });

    if (filters.documentType) {
      query = query.where({ document_type: filters.documentType });
    }

    if (filters.status) {
      query = query.where({ status: filters.status });
    }

    return query.orderBy('created_at', 'desc');
  }
}

module.exports = new UnifiedDocumentService();
