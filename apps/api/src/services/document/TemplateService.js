/**
 * 模板服务
 * 核心：模板管理和AI解析
 */

const knex = require('../../config/database');
const DocumentDomainConfig = require('../../config/DocumentDomainConfig');
const UnifiedLLMService = require('../llm/UnifiedLLMService');
const MasterFormatMatcher = require('./MasterFormatMatcher');
const WordOutlineExtractor = require('./WordOutlineExtractor');

class TemplateService {
  constructor() {
    this.domainConfig = DocumentDomainConfig;
    this.llmService = UnifiedLLMService;
    this.masterFormatMatcher = MasterFormatMatcher;
    this._hasEditableUsersColumnPromise = null;
  }

  async _supportsEditableUsersColumn() {
    if (!this._hasEditableUsersColumnPromise) {
      this._hasEditableUsersColumnPromise = knex.schema
        .hasColumn('template_sections', 'editable_user_ids')
        .catch(() => false);
    }
    return this._hasEditableUsersColumnPromise;
  }

  async _selectTemplateSectionRows(builder) {
    const baseFields = [
      'id',
      'template_id',
      'code',
      'title',
      'level',
      'parent_code',
      'description',
      'template_content',
      'metadata',
      'sort_order',
      'is_required',
      'is_editable'
    ];

    const supportsEditableUsers = await this._supportsEditableUsersColumn();
    const fields = supportsEditableUsers
      ? [...baseFields, 'editable_user_ids']
      : baseFields;

    return builder.clone().select(fields);
  }

  _parseJsonArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
      return JSON.parse(value);
    } catch (error) {
      return [];
    }
  }

  _normalizeSectionRow(row) {
    const metadata = typeof row.metadata === 'string'
      ? (row.metadata ? JSON.parse(row.metadata) : {})
      : row.metadata || {};

    return {
      ...row,
      metadata,
      editable_user_ids: this._parseJsonArray(row.editable_user_ids || []),
    };
  }

  _canUserEditSection(section, user) {
    if (!section.is_editable) return false;
    const allowedUsers = section.editable_user_ids || [];
    if (allowedUsers.length === 0) return true;
    return !!user && allowedUsers.includes(user.id);
  }

  _filterSectionsForUser(sections, user) {
    return sections.filter(section => this._canUserEditSection(section, user));
  }

  /**
   * 上传并解析模板
   * @param {Object} params
   * @param {string} params.name - 模板名称
   * @param {string} params.templateType - 模板类型
   * @param {string} params.filePath - 文件路径
   * @param {string} params.fileName - 文件名
   * @param {string} params.fileType - 文件类型
   * @param {number} params.fileSize - 文件大小
   * @param {string} params.createdBy - 创建人
   * @returns {Promise<Object>}
   */
  async uploadTemplate({
    name,
    templateType,
    filePath,
    fileName,
    fileType,
    fileSize,
    createdBy,
    description
  }) {
    // AI解析模板结构
    const parseResult = await this._parseTemplateFile(filePath, templateType);

    // 创建模板记录
    const [template] = await knex('document_templates').insert({
      code: `TEMPLATE_${Date.now()}`,  // 生成唯一code
      name,
      type: templateType,
      description,
      file_path: filePath,
      file_name: fileName,
      file_type: fileType,
      file_size: fileSize,
      minio_bucket: 'templates',
      minio_object: fileName,
      config: JSON.stringify(parseResult.config || {}),
      version: '1.0',
      status: 'draft',
      created_by: createdBy,
    }).returning('*');

    return template;
  }

  /**
   * AI解析模板文件
   * @private
   */
  async _parseTemplateFile(filePath, templateType) {
    const domain = this.domainConfig.getDomain(templateType);
    const parseConfig = domain.template.parsing;

    try {
      console.log('[模板解析] 开始解析文件:', filePath);

      // 提取Word文档目录结构
      const { outline, flatOutline } = await WordOutlineExtractor.extractOutline(filePath);
      const stats = WordOutlineExtractor.getOutlineStats(outline);

      console.log('[模板解析] 目录提取成功:', stats);

      // TODO: 后续扩展
      // 1. 使用LLM识别模板变量 (如 {{projectName}})
      // 2. 提取表格、图片等资源
      // 3. 识别特殊格式和样式

      return {
        sectionStructure: outline,      // 树形结构
        flatSections: flatOutline,      // 扁平结构
        stats: stats,                   // 统计信息
        variables: [],                  // 模板变量（待实现）
        config: {}                      // 其他配置
      };
    } catch (error) {
      console.error('[模板解析] 失败:', error);
      // 返回空结构，不影响模板创建
      return {
        sectionStructure: [],
        flatSections: [],
        stats: { totalSections: 0 },
        variables: [],
        config: {}
      };
    }
  }

  /**
   * 获取模板详情
   * @param {string} templateId
   * @returns {Promise<Object>}
   */
  async getTemplate(templateId) {
    const template = await knex('document_templates')
      .where({ id: templateId })
      .first();

    if (!template) {
      throw new Error('模板不存在');
    }

    // 解析JSON字段（如果是字符串才解析）
    if (typeof template.section_structure === 'string') {
      template.section_structure = JSON.parse(template.section_structure || '[]');
    }
    if (typeof template.variables === 'string') {
      template.variables = JSON.parse(template.variables || '[]');
    }
    if (typeof template.config === 'string') {
      template.config = JSON.parse(template.config || '{}');
    }

    return template;
  }

  /**
   * 获取模板列表
   * @param {Object} filters
   * @returns {Promise<Array>}
   */
  async getTemplates(filters = {}) {
    // 先尝试从新表查询
    let query = knex('document_templates')
      .select(
        'id',
        'code',
        'name',
        'type as template_type',
        'description',
        'section_code_format',
        'max_level',
        'is_system',
        'is_active',
        'created_at',
        'created_by'
      );

    if (filters.templateType) {
      query = query.where({ type: filters.templateType });
    }

    if (filters.status) {
      // 新表使用is_active字段
      if (filters.status === 'published') {
        query = query.where({ is_active: true });
      }
    } else {
      // 默认只显示启用的模板
      query = query.where({ is_active: true });
    }

    const newTemplates = await query.orderBy('created_at', 'desc');

    // 如果新表有数据，返回
    if (newTemplates.length > 0) {
      return newTemplates.map(t => ({
        ...t,
        // 兼容前端字段
        status: t.is_active ? 'published' : 'draft',
        version: '1.0'
      }));
    }

    // 兼容旧表：如果新表没数据，从旧表查
    let oldQuery = knex('document_templates');

    if (filters.templateType) {
      oldQuery = oldQuery.where({ template_type: filters.templateType });
    }

    if (filters.status) {
      oldQuery = oldQuery.where({ status: filters.status });
    }

    return oldQuery.orderBy('created_at', 'desc');
  }

  /**
   * 更新模板
   * @param {string} templateId
   * @param {Object} updates
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async updateTemplate(templateId, updates, userId) {
    await knex('document_templates')
      .where({ id: templateId })
      .update({
        ...updates,
        updated_by: userId,
        updated_at: knex.fn.now(),
      });

    return this.getTemplate(templateId);
  }

  /**
   * 发布模板
   * @param {string} templateId
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async publishTemplate(templateId, userId) {
    const template = await this.getTemplate(templateId);

    // 验证模板完整性
    this._validateTemplate(template);

    await knex('document_templates')
      .where({ id: templateId })
      .update({
        status: 'published',
        published_at: knex.fn.now(),
        published_by: userId,
      });

    // 创建版本记录
    await knex('template_versions').insert({
      template_id: templateId,
      version: template.version,
      section_structure: JSON.stringify(template.section_structure),
      changes_summary: '首次发布',
      created_by: userId,
    });

    return this.getTemplate(templateId);
  }

  /**
   * 验证模板完整性
   * @private
   */
  _validateTemplate(template) {
    if (!template.section_structure || template.section_structure.length === 0) {
      throw new Error('模板章节结构不能为空');
    }
    // TODO: 更多验证规则
  }

  /**
   * 删除模板
   * @param {string} templateId
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async deleteTemplate(templateId, userId) {
    // 检查是否有文档在使用此模板
    const documentsUsingTemplate = await knex('project_documents')
      .where({ template_id: templateId })
      .count('id as count')
      .first();

    if (parseInt(documentsUsingTemplate.count) > 0) {
      throw new Error('该模板正在被使用，无法删除');
    }

    await knex('document_templates').where({ id: templateId }).del();
  }

  /**
   * 匹配上传文件到 MasterFormat 模板
   * @param {string} filename - 上传的文件名
   * @returns {Promise<Object>}
   */
  async matchMasterFormatTemplate(filename) {
    return await this.masterFormatMatcher.matchTemplate(filename);
  }

  /**
   * 根据 MasterFormat 编号查找模板
   * @param {string} code - 6位编号
   * @returns {Promise<Object|null>}
   */
  async findTemplateByCode(code) {
    return await this.masterFormatMatcher.findByCode(code);
  }

  /**
   * 批量匹配文件
   * @param {string[]} filenames
   * @returns {Promise<Object[]>}
   */
  async batchMatchTemplates(filenames) {
    return await this.masterFormatMatcher.batchMatchTemplates(filenames);
  }

  /**
   * 获取 MasterFormat 统计信息
   * @returns {Promise<Object>}
   */
  async getMasterFormatStatistics() {
    return await this.masterFormatMatcher.getStatistics();
  }

  /**
   * 获取模板的章节结构（懒加载）
   * @param {string} templateId
   * @param {string|null} parentCode - 父节点code，null表示获取根节点
   * @returns {Promise<Array>}
   */
  async getTemplateSections(templateId, parentCode = null) {
    // 只获取直接子节点，不递归
    const rawSections = await this._selectTemplateSectionRows(
      knex('template_sections')
        .where({ template_id: templateId })
        .andWhere(function() {
          if (parentCode === null) {
            this.whereNull('parent_code');
          } else {
            this.where('parent_code', parentCode);
          }
        })
        .orderBy('sort_order')
    );

    const sections = rawSections.map(section => this._normalizeSectionRow(section));

    // 按code的数字值重新排序（去除空格后作为数字比较）
    sections.sort((a, b) => {
      const codeA = parseInt(a.code.replace(/\s/g, '')) || 0;
      const codeB = parseInt(b.code.replace(/\s/g, '')) || 0;
      return codeA - codeB;
    });

    // 检查每个节点是否有子节点，并确保返回所有字段
    const result = [];
    for (const section of sections) {
      const hasChildren = await knex('template_sections')
        .where({ template_id: templateId, parent_code: section.code })
        .count('* as count')
        .first();

      result.push({
        id: section.id,
        code: section.code,
        title: section.title,
        level: section.level,
        sort_order: section.sort_order,
        parent_code: section.parent_code,
        description: section.description,
        template_content: section.template_content,
        is_required: section.is_required,
        is_editable: section.is_editable,
        editable_user_ids: section.editable_user_ids,
        metadata: section.metadata,
        isLeaf: parseInt(hasChildren.count) === 0
      });
    }

    return result;
  }

  /**
   * 获取完整章节树
   * @param {string} templateId
   * @param {Object} options
   * @param {Object|null} options.onlyEditableForUser - 仅返回当前用户可编辑的章节
   */
  async getTemplateSectionsTree(templateId, { onlyEditableForUser = null } = {}) {
    const rows = await this._selectTemplateSectionRows(
      knex('template_sections')
        .where({ template_id: templateId })
        .orderBy('level')
        .orderBy('sort_order')
    );

    const normalized = rows.map(row => this._normalizeSectionRow(row));
    const scopedSections = onlyEditableForUser
      ? this._filterSectionsForUser(normalized, onlyEditableForUser)
      : normalized;

    const nodeMap = new Map();
    const roots = [];

    scopedSections.forEach(section => {
      nodeMap.set(section.code, {
        id: section.id,
        code: section.code,
        title: section.title,
        level: section.level,
        parent_code: section.parent_code,
        sort_order: section.sort_order,
        template_content: section.template_content,
        is_editable: section.is_editable,
        editable_user_ids: section.editable_user_ids,
        metadata: section.metadata,
        children: []
      });
    });

    scopedSections.forEach(section => {
      const node = nodeMap.get(section.code);
      if (section.parent_code && nodeMap.has(section.parent_code)) {
        nodeMap.get(section.parent_code).children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortChildren = (nodes = []) => {
      nodes.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      nodes.forEach(child => sortChildren(child.children));
    };

    sortChildren(roots);
    return roots;
  }

  async getAllowedSectionCodes(templateId, user) {
    const supportsEditableUsers = await this._supportsEditableUsersColumn();
    const columns = ['code', 'is_editable'];
    if (supportsEditableUsers) {
      columns.push('editable_user_ids');
    }

    const rows = await knex('template_sections')
      .select(columns)
      .where({ template_id: templateId });

    const normalized = rows.map(row => this._normalizeSectionRow(row));
    const scoped = this._filterSectionsForUser(normalized, user);
    return scoped.map(section => section.code);
  }

  /**
   * 基于模板创建文档实例
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async createDocumentFromTemplate({ templateId, title, projectId, createdBy }) {
    // 创建document_instance
    const [instance] = await knex('document_instances').insert({
      template_id: templateId,
      title,
      project_id: projectId,
      created_by: createdBy,
      status: 'draft'
    }).returning('*');

    // 初始化所有章节
    const templateSections = await knex('template_sections')
      .where({ template_id: templateId });

    if (templateSections.length > 0) {
      const instanceSections = templateSections.map(s => ({
        instance_id: instance.id,
        section_code: s.code,
        status: 'empty'
      }));

      await knex.batchInsert('instance_sections', instanceSections, 100);
    }

    return instance;
  }

  /**
   * 获取文档实例的章节（合并模板结构和实际内容）
   * @param {string} instanceId
   * @returns {Promise<Array>}
   */
  async getInstanceSections(instanceId) {
    // 获取实例信息
    const instance = await knex('document_instances')
      .where({ id: instanceId })
      .first();

    if (!instance) {
      throw new Error('文档实例不存在');
    }

    // 获取模板章节结构
    const templateSections = await knex('template_sections')
      .where({ template_id: instance.template_id })
      .orderBy('sort_order');

    // 获取实例章节内容
    const instanceSections = await knex('instance_sections')
      .where({ instance_id: instanceId });

    const sectionMap = new Map(instanceSections.map(s => [s.section_code, s]));

    // 合并
    const merged = templateSections.map(ts => {
      const instanceData = sectionMap.get(ts.code);
      return {
        ...ts,
        content: instanceData?.content || '',
        content_status: instanceData?.status || 'empty',
        word_count: instanceData?.word_count || 0,
        last_edited_by: instanceData?.last_edited_by,
        last_edited_at: instanceData?.last_edited_at
      };
    });

    return this.buildSectionTree(merged);
  }

  /**
   * 更新实例章节内容
   * @param {string} instanceId
   * @param {string} sectionCode
   * @param {string} content
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async updateInstanceSection(instanceId, sectionCode, content, userId) {
    const wordCount = content.replace(/<[^>]*>/g, '').length;

    await knex('instance_sections')
      .where({ instance_id: instanceId, section_code: sectionCode })
      .update({
        content,
        word_count: wordCount,
        status: wordCount > 0 ? 'draft' : 'empty',
        last_edited_by: userId,
        last_edited_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });

    await knex('document_instances')
      .where({ id: instanceId })
      .update({
        current_editor: userId,
        last_edited_at: knex.fn.now()
      });
  }

  /**
   * 构建章节树
   * @private
   */
  buildSectionTree(sections, parentCode = null) {
    // 性能优化：如果所有记录的 parent_code 都是 null，使用优化的构建方式
    if (parentCode === null && sections.length > 1000) {
      const hasParentCode = sections.some(s => s.parent_code !== null && s.parent_code !== '');
      if (!hasParentCode) {
        // 使用 Map 来优化父子关系查找
        const childrenMap = new Map();

        // 预先计算每个节点的子节点
        sections.forEach(section => {
          const parent = this.inferParentCode(section.code);
          if (!childrenMap.has(parent)) {
            childrenMap.set(parent, []);
          }
          childrenMap.get(parent).push(section);
        });

        // 递归构建树
        const buildTree = (code) => {
          const children = childrenMap.get(code) || [];
          return children.map(s => ({
            key: s.code,
            title: `${s.code} ${s.title}`,
            ...s,
            children: buildTree(s.code)
          }));
        };

        return buildTree(null);
      }
    }

    // 原有逻辑（使用 parent_code 字段）
    return sections
      .filter(s => s.parent_code === parentCode)
      .map(s => ({
        key: s.code,
        title: `${s.code} ${s.title}`,
        ...s,
        children: this.buildSectionTree(sections, s.code)
      }));
  }

  /**
   * 根据 code 推断 parent_code
   * 例如：'00 24 13.13' -> '00 24 13'
   * @private
   */
  inferParentCode(code) {
    if (!code) return null;

    const trimmed = code.trim();

    // 如果包含小数点，父节点是去掉最后一个小数点部分
    if (trimmed.includes('.')) {
      const parts = trimmed.split('.');
      parts.pop();
      return parts.join('.');
    }

    // 如果是空格分隔的编号，父节点是去掉最后一个部分
    const parts = trimmed.split(/\s+/);
    if (parts.length > 1) {
      // 检查最后一个部分是否为 '00'
      if (parts[parts.length - 1] === '00') {
        parts.pop();
        return parts.length > 0 ? parts.join(' ') : null;
      }
      // 否则去掉最后一个非零部分
      parts.pop();
      return parts.length > 0 ? parts.join(' ') : null;
    }

    // 顶级节点
    return null;
  }
}

module.exports = new TemplateService();
