/**
 * 模板服务
 * 核心：模板管理和AI解析
 */

const knex = require('../../config/database');
const DocumentDomainConfig = require('../../config/DocumentDomainConfig');
const UnifiedLLMService = require('../llm/UnifiedLLMService');
const MasterFormatMatcher = require('./MasterFormatMatcher');
const WordOutlineExtractor = require('./WordOutlineExtractor');
const CSIFrameworkService = require('./CSIFrameworkService');
const CSIContentMatcher = require('./CSIContentMatcher');

class TemplateService {
  constructor() {
    this.domainConfig = DocumentDomainConfig;
    this.llmService = UnifiedLLMService;
    this.masterFormatMatcher = MasterFormatMatcher;
    this.csiFrameworkService = CSIFrameworkService;
    this.csiContentMatcher = CSIContentMatcher;
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
   * @param {string} params.sourceType - CSI来源类型: CSI_EN/CSI_ZH/COMPANY
   * @param {string} params.sourceProject - 来源项目名（公司SPEC时）
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
    description,
    sourceType,
    sourceProject,
    projectType
  }) {
    // 长度校验，超出直接报错，避免悄悄截断丢信息
    const validateLength = (label, value, max) => {
      if (!value) return value;
      if (value.length > max) {
        throw new Error(`${label} 长度超出限制（最大 ${max} 字符），请调整后再上传`);
      }
      return value;
    };

    const safeName = validateLength('模板名称', name || fileName || 'template', 255);
    const safeFileName = validateLength('文件名', fileName, 512);
    const safeMinioObject = validateLength('存储对象名', fileName, 512);
    const safeFileType = validateLength('文件类型', fileType, 255);
    const safeProjectType = validateLength('项目类型', projectType, 100);

    // 根据来源类型选择解析方式
    let parseResult;
    let csiParseResult = null;

    if (sourceType === 'CSI_EN' || sourceType === 'CSI_ZH') {
      // CSI 标准模板：使用 CSI 解析器
      parseResult = await this._parseCSITemplate(filePath, sourceType);
      csiParseResult = parseResult.csiResult;
    } else if (sourceType === 'COMPANY') {
      // 公司 SPEC：先普通解析，再 AI 匹配 CSI
      parseResult = await this._parseTemplateFile(filePath, templateType);
      // AI 匹配将在后续处理
    } else {
      // 默认：普通解析
      parseResult = await this._parseTemplateFile(filePath, templateType);
    }

    // 创建模板记录
    const [template] = await knex('document_templates').insert({
      code: `TEMPLATE_${Date.now()}`,  // 生成唯一code
      name: safeName,
      type: templateType,  // 数据库列名是 type
      description,
      file_path: filePath,
      file_name: safeFileName,
      file_type: safeFileType,
      file_size: fileSize,
      minio_bucket: 'templates',
      minio_object: safeMinioObject,
      config: JSON.stringify(parseResult.config || {}),
      version: '1.0',
      status: 'draft',
      created_by: createdBy,
      // CSI 扩展字段
      source_type: sourceType || null,
      source_project: sourceProject || null,
      project_type: safeProjectType || null,
      csi_parsed: !!csiParseResult,
      csi_parse_result: csiParseResult ? JSON.stringify(csiParseResult) : null
    }).returning('*');

    // 如果是 CSI 模板，导入框架
    if (csiParseResult && (sourceType === 'CSI_EN' || sourceType === 'CSI_ZH')) {
      await this._importCSIFramework(csiParseResult, template.id, sourceType);
    }

    return template;
  }

  /**
   * 解析 CSI 标准模板
   * @private
   */
  async _parseCSITemplate(filePath, sourceType) {
    try {
      console.log('[CSI解析] 开始解析:', filePath, sourceType);

      // 调用 Python CSI 解析器
      const csiResult = await this.csiFrameworkService.parseCSIDocx(filePath);

      console.log('[CSI解析] 解析成功:', csiResult.stats);

      return {
        sectionStructure: csiResult.tree,
        flatSections: csiResult.flat_list,
        stats: csiResult.stats,
        variables: [],
        config: {
          csiSectionCode: csiResult.section_code,
          csiDivision: csiResult.division
        },
        csiResult
      };
    } catch (error) {
      console.error('[CSI解析] 失败，降级到普通解析:', error);
      // 降级到普通解析
      const normalResult = await this._parseTemplateFile(filePath, 'spec');
      return {
        ...normalResult,
        csiResult: null
      };
    }
  }

  /**
   * 导入 CSI 框架到数据库
   * @private
   */
  async _importCSIFramework(csiResult, templateId, sourceType) {
    try {
      // 导入到 spec_csi_framework 表
      const importResult = await this.csiFrameworkService.importFramework(
        csiResult,
        sourceType === 'CSI_EN' ? 'CSI_EN_2020' : 'CSI_ZH_2020'
      );

      console.log('[CSI导入] 框架导入完成:', importResult);

      // 同时创建 template_sections 记录（关联 CSI 框架）
      await this._createCSITemplateSections(csiResult.flat_list, templateId, sourceType);

      return importResult;
    } catch (error) {
      console.error('[CSI导入] 失败:', error);
      // 不影响模板创建
    }
  }

  /**
   * 创建关联 CSI 框架的模板章节
   * @private
   */
  async _createCSITemplateSections(flatList, templateId, sourceType) {
    console.log(`[CSI章节] 开始创建: templateId=${templateId}, flatList.length=${flatList?.length || 0}`);

    // 先删除该模板的现有章节（如果有的话）
    await knex('template_sections').where({ template_id: templateId }).del();

    const sections = flatList.map((node, index) => {
      // PART 节点有时解析不到 parent_code，兜底挂在 Section 下，避免出现在根层级
      const parentCode =
        node.parent_code ||
        (node.level_type === 'PRT'
          ? node.section_code || node.full_code.split('.').slice(0, 1).join('.')
          : null);

      return {
        template_id: templateId,
        code: node.full_code,
        title: sourceType === 'CSI_ZH' ? (node.title_zh || node.title_en || node.content || node.full_code) : (node.title_en || node.content || node.full_code),
        level: node.level,
        parent_code: parentCode,
        description: '',
        template_content: node.content || '',
        metadata: JSON.stringify({
          csiLevelType: node.level_type,
          csiLevelLabel: node.level_label,
          titleEn: node.title_en,
          titleZh: node.title_zh
        }),
        sort_order: index,
        is_required: false,
        is_editable: true,
        csi_full_code: node.full_code,
        csi_level_type: node.level_type,
        is_csi_custom: false
      };
    });

    if (sections.length > 0) {
      try {
        await knex.batchInsert('template_sections', sections, 100);
        console.log(`[CSI章节] 创建成功: ${sections.length} 个章节`);
      } catch (batchError) {
        console.error(`[CSI章节] 批量插入失败:`, batchError.message);
        // 尝试逐条插入以找出问题
        for (let i = 0; i < Math.min(5, sections.length); i++) {
          try {
            await knex('template_sections').insert(sections[i]);
            console.log(`[CSI章节] 单条插入成功: ${sections[i].code}`);
          } catch (singleError) {
            console.error(`[CSI章节] 单条插入失败 ${sections[i].code}:`, singleError.message);
          }
        }
        throw batchError;
      }
    } else {
      console.log('[CSI章节] 没有章节需要创建');
    }
  }

  /**
   * 处理公司 SPEC 的 CSI 匹配
   * @param {string} templateId - 模板ID
   * @param {string} targetSectionCode - 目标 CSI Section 编号
   * @returns {Promise<Object>}
   */
  async matchCompanySpecToCSI(templateId, targetSectionCode) {
    const template = await this.getTemplate(templateId);

    if (!template) {
      throw new Error('模板不存在');
    }

    // 获取模板的章节内容
    const sections = await knex('template_sections')
      .where({ template_id: templateId });

    const contentBlocks = sections.map(s => ({
      code: s.code,
      title: s.title,
      content: s.template_content || s.title
    }));

    // 批量匹配
    const matchResult = await this.csiContentMatcher.batchMatch(
      contentBlocks,
      targetSectionCode,
      {
        name: template.source_project || template.name,
        templateId
      }
    );

    // 保存匹配结果
    for (const match of matchResult.matched) {
      await this.csiContentMatcher.saveContent({
        frameworkId: match.frameworkId,
        frameworkCode: match.frameworkCode,
        sourceType: 'COMPANY',
        sourceName: template.source_project || template.name,
        sourceTemplateId: templateId,
        contentZh: match.content,
        confidence: match.confidence
      });
    }

    // 自动创建新章节
    for (const newSection of matchResult.newSections) {
      await this.csiContentMatcher.createCustomSection({
        ...newSection.suggestion,
        originalContent: newSection.content
      });
    }

    // 更新模板的 CSI 解析状态
    await knex('document_templates')
      .where({ id: templateId })
      .update({
        csi_parsed: true,
        csi_parse_result: JSON.stringify({
          targetSectionCode,
          matched: matchResult.matched.length,
          newSections: matchResult.newSections.length,
          unmatched: matchResult.unmatched.length
        })
      });

    return matchResult;
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
        'type as template_type',  // 数据库列是 type，别名为 template_type 以兼容前端
        'description',
        'section_code_format',
        'max_level',
        'is_system',
        'is_active',
        'created_at',
        'created_by'
      );

    if (filters.templateType) {
      query = query.where({ type: filters.templateType });  // 数据库列名是 type
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
      oldQuery = oldQuery.where({ type: filters.templateType });  // 数据库列名是 type
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

    // 批量查询子节点数量，避免 N+1 查询
    // 只需查询 parent_code 在当前结果集中的记录
    const sectionCodes = sections.map(s => s.code);
    let childCountsMap = new Map();

    if (sectionCodes.length > 0) {
      const childCounts = await knex('template_sections')
        .where({ template_id: templateId })
        .whereIn('parent_code', sectionCodes)
        .groupBy('parent_code')
        .count('* as count')
        .select('parent_code');
      
      childCounts.forEach(row => {
        childCountsMap.set(row.parent_code, parseInt(row.count));
      });
    }

    const result = sections.map(section => ({
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
      isLeaf: !childCountsMap.has(section.code)
    }));

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

    // 清理叶子节点的空 children，防止前端误以为可展开
    const pruneEmptyChildren = (nodes = []) => {
      nodes.forEach(node => {
        if (!node.children || node.children.length === 0) {
          delete node.children;
          return;
        }
        pruneEmptyChildren(node.children);
      });
    };
    pruneEmptyChildren(roots);

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
  async createDocumentFromTemplate({ templateId, title, projectId, createdBy, sectionCodes }) {
    // 创建document_instance
    const [instance] = await knex('document_instances').insert({
      template_id: templateId,
      title,
      project_id: projectId,
      created_by: createdBy,
      status: 'draft'
    }).returning('*');

    // 初始化章节
    let templateSections = await knex('template_sections')
      .where({ template_id: templateId });

    // 如果指定了sectionCodes，只导入选中的章节
    if (sectionCodes && sectionCodes.length > 0) {
      templateSections = templateSections.filter(s => sectionCodes.includes(s.code));
    }

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
    if (!sections || sections.length === 0) return [];

    // 1. 根据 parent_code 将章节分组
    const childrenMap = new Map();
    
    sections.forEach(s => {
      // 确保 parent_code 为 null 或 undefined 时统一处理为 null
      const pCode = s.parent_code || null;
      if (!childrenMap.has(pCode)) {
        childrenMap.set(pCode, []);
      }
      childrenMap.get(pCode).push(s);
    });

    // 2. 递归构建树函数
    const buildNode = (section) => {
      const children = childrenMap.get(section.code) || [];
      // 按 sort_order 排序
      children.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      return {
        key: section.code,
        title: `${section.code} ${section.title}`,
        ...section,
        children: children.map(buildNode)
      };
    };

    // 3. 获取根节点列表（即 parent_code 等于传入的 parentCode 的节点）
    // 注意：传入的 parentCode 可能是 null
    const targetParentCode = parentCode || null;
    const roots = childrenMap.get(targetParentCode) || [];

    // 排序根节点
    roots.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    return roots.map(buildNode);
  }
}

module.exports = new TemplateService();
