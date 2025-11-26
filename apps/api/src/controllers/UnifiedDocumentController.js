/**
 * 统一文档控制器
 * 处理所有文档相关的HTTP请求
 */

const fs = require('fs');
const path = require('path');
const knex = require('../config/database');
const JSZip = require('jszip');
const htmlToDocx = require('html-to-docx');
const TemplateService = require('../services/document/TemplateService');
const CSIFrameworkService = require('../services/document/CSIFrameworkService');
const UnifiedDocumentService = require('../services/document/UnifiedDocumentService');
const SectionService = require('../services/document/SectionService');
const RevisionTrackingService = require('../services/document/RevisionTrackingService');
const SectionApprovalService = require('../services/document/SectionApprovalService');
const ArchiveService = require('../services/document/ArchiveService');
const DocumentAIService = require('../services/document/DocumentAIService');

/**
 * 将嵌套的 tree 结构扁平化为数组（独立函数，避免 this 绑定问题）
 * @param {Array} tree - 嵌套树结构
 * @returns {Array} 扁平化的节点数组
 */
function flattenTree(tree) {
  const result = [];
  const traverse = (nodes) => {
    for (const node of nodes) {
      const { children, ...nodeData } = node;
      result.push(nodeData);
      if (children && children.length > 0) {
        traverse(children);
      }
    }
  };
  traverse(tree);
  return result;
}

/**
 * 将 CSI 解析结果转换为格式化的 HTML（独立函数，避免 this 绑定问题）
 * @param {Array} flatList - CSI 解析的扁平列表
 * @returns {string} 格式化的 HTML
 */
function convertCSIToHTML(flatList) {
  let html = '';

  for (const node of flatList) {
    const levelType = node.level_type;
    const label = node.level_label || '';
    const title = node.title_en || '';
    const content = node.content || '';

    // 根据层级类型设置不同的样式
    switch (levelType) {
      case 'SEC':
        // Section 标题 - 最大标题
        html += `<h1 style="font-size: 18px; font-weight: bold; color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 8px; margin: 24px 0 16px 0;">SECTION ${node.section_code} - ${title}</h1>\n`;
        break;
      case 'PRT':
        // PART 标题
        html += `<h2 style="font-size: 16px; font-weight: bold; color: #262626; margin: 20px 0 12px 0;">${label} - ${title}</h2>\n`;
        break;
      case 'ART':
        // Article (1.1, 1.2, 2.1...)
        html += `<h3 style="font-size: 14px; font-weight: 600; color: #262626; margin: 16px 0 8px 0;">${label} ${title}</h3>\n`;
        break;
      case 'PR1':
        // Paragraph Level 1 (A., B., C.)
        html += `<p style="margin: 8px 0 8px 24px; line-height: 1.8;">${label ? `<strong>${label}</strong> ` : ''}${content || title}</p>\n`;
        break;
      case 'PR2':
        // Paragraph Level 2 (1., 2., 3.)
        html += `<p style="margin: 6px 0 6px 48px; line-height: 1.8;">${label ? `${label} ` : ''}${content || title}</p>\n`;
        break;
      case 'PR3':
        // Paragraph Level 3 (a., b., c.)
        html += `<p style="margin: 4px 0 4px 72px; line-height: 1.8;">${label ? `${label} ` : ''}${content || title}</p>\n`;
        break;
      case 'PR4':
        // Paragraph Level 4 (1), 2), 3))
        html += `<p style="margin: 4px 0 4px 96px; line-height: 1.8;">${label ? `${label} ` : ''}${content || title}</p>\n`;
        break;
      case 'PR5':
        // Paragraph Level 5 (a), b), c))
        html += `<p style="margin: 4px 0 4px 120px; line-height: 1.8;">${label ? `${label} ` : ''}${content || title}</p>\n`;
        break;
      default:
        if (content || title) {
          html += `<p style="margin: 4px 0; line-height: 1.8;">${content || title}</p>\n`;
        }
    }
  }

  return html;
}

class UnifiedDocumentController {
  // ============================================
  // 文档管理
  // ============================================

  /**
   * 获取文档列表
   */
  async getDocuments(req, res) {
    try {
      const { documentType } = req.query;
      const userId = req.user.id;

      const documents = await UnifiedDocumentService.getDocuments({
        documentType,
        userId
      });

      res.json({
        success: true,
        data: documents,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 批量导入文件夹为单个模板
   * 接收多个 docx，按文件夹/文件名生成目录，正文为 docx 内容
   *
   * webkitRelativePath: specs_docx/11 - EQUIPMENT/113013 FL - xxx.docx
   *
   * 期望目录树（使用 CSI 编号作为 code）：
   * ├── 11 - EQUIPMENT (code=11, level=1, parent_code=null)  -- 从文件夹名提取
   * │   ├── 113013 FL - xxx (code=113013, level=2, parent_code=11)  -- 从文件名提取
   * ├── 12 - FURNISHINGS (code=12, level=1, parent_code=null)
   */
  async uploadTemplateFolder(req, res) {
    try {
      const files = req.files || [];
      const {
        templateName,
        sourceType,
        projectType,
        relativePaths = [],
        createdBy
      } = req.body;

      if (!files.length) {
        return res.status(400).json({ success: false, message: '请上传文件' });
      }

      // relativePaths 可能是字符串或数组
      const paths = Array.isArray(relativePaths) ? relativePaths : [relativePaths];
      if (paths.length !== files.length) {
        return res.status(400).json({ success: false, message: '文件与路径数量不匹配' });
      }

      // 创建模板记录（一个模板对应整个文件夹）
      const firstFile = files[0];
      const [template] = await knex('document_templates')
        .insert({
          code: `TEMPLATE_${Date.now()}`,
          name: templateName || '批量导入模板',
          type: 'spec',
          description: '',
          file_path: firstFile.path,
          file_name: firstFile.originalname,
          file_type: firstFile.mimetype,
          file_size: firstFile.size,
          minio_bucket: 'templates',
          minio_object: firstFile.filename,
          config: JSON.stringify({}),
          version: '1.0',
          status: 'draft',
          created_by: createdBy || null,
          source_type: sourceType || null,
          project_type: projectType || null
        })
        .returning('*');

      // 从名称中提取 CSI 编号的辅助函数
      // 支持格式：
      // - "11 - EQUIPMENT" -> "11"
      // - "113013 FL - xxx" -> "113013"
      // - "115213.19 FL - xxx" -> "115213.19"
      const extractCSICode = (name) => {
        const match = name.match(/^(\d+(?:\.\d+)?)/);
        return match ? match[1] : null;
      };

      // 生成章节树：使用 CSI 编号作为 code
      const sections = [];
      const nodeMap = new Map();
      // 虚拟根节点（不写入数据库），用于管理顶层节点
      nodeMap.set('', { code: '', isVirtualRoot: true });

      const ensureNode = (pathParts) => {
        // 空路径返回虚拟根节点
        if (!pathParts || pathParts.length === 0) {
          return nodeMap.get('');
        }
        const key = pathParts.join('/');
        if (nodeMap.has(key)) return nodeMap.get(key);

        // 递归确保父节点存在
        const parentParts = pathParts.slice(0, -1);
        const parentNode = ensureNode(parentParts);

        if (!parentNode) {
          throw new Error(`Failed to resolve parent node for path: ${key}`);
        }

        // 从文件夹名称提取 CSI 编号作为 code，剩余部分作为 title
        const folderName = pathParts[pathParts.length - 1];
        const code = extractCSICode(folderName) || folderName;
        // 去掉开头的 CSI 编号，保留描述部分
        // "11 - EQUIPMENT" -> "EQUIPMENT"
        const folderTitle = folderName.replace(/^\d+(?:\.\d+)?\s*-?\s*/, '').trim() || folderName;

        sections.push({
          template_id: template.id,
          code,
          title: folderTitle,
          level: pathParts.length, // 顶层 level=1
          parent_code: parentNode.isVirtualRoot ? null : parentNode.code,
          description: '',
          template_content: '',
          metadata: JSON.stringify({ isFolder: true }),
          sort_order: sections.length,
          is_required: false,
          is_editable: true
        });
        const node = { code };
        nodeMap.set(key, node);
        return node;
      };

      // 处理每个文件
      for (let i = 0; i < files.length; i++) {
        const rel = paths[i] || files[i].originalname;
        let parts = rel.split('/').filter(Boolean);
        if (parts.length > 1) {
          parts = parts.slice(1);
        }
        const fileName = parts.pop();
        const parentNode = ensureNode(parts);

        const fullTitle = fileName.replace(/\.[^/.]+$/, '');
        const sectionCode = extractCSICode(fullTitle) || fullTitle;
        const fileTitle = fullTitle.replace(/^\d+(?:\.\d+)?\s*/, '').trim() || fullTitle;

        // 使用 CSI 解析器解析 docx，生成带正确编号格式的 HTML
        let htmlContent = '';
        try {
          const csiResult = await CSIFrameworkService.parseCSIDocx(files[i].path);
          // Python 解析器返回 tree（嵌套结构），需要扁平化
          if (csiResult && csiResult.tree && csiResult.tree.length > 0) {
            const flatList = flattenTree(csiResult.tree);
            htmlContent = convertCSIToHTML(flatList);
          }
        } catch (e) {
          console.warn(`[CSI解析] ${fileName}: 解析失败 - ${e.message}`);
          htmlContent = '';
        }

        sections.push({
          template_id: template.id,
          code: sectionCode,
          title: fileTitle,
          level: parts.length + 1,
          parent_code: parentNode.isVirtualRoot ? null : parentNode.code,
          description: '',
          template_content: htmlContent,
          metadata: JSON.stringify({ isFile: true, originalName: files[i].originalname }),
          sort_order: sections.length,
          is_required: false,
          is_editable: true
        });
      }

      // 写入模板章节
      if (sections.length > 0) {
        await knex('template_sections').where({ template_id: template.id }).del();
        await knex.batchInsert('template_sections', sections, 100);
      }

      res.json({
        success: true,
        data: { templateId: template.id, sections: sections.length },
        message: '批量导入成功'
      });
    } catch (error) {
      console.error('[批量导入文件夹] 失败:', error);
      res.status(500).json({
        success: false,
        message: error.message || '批量导入失败'
      });
    }
  }

  /**
   * 创建文档
   */
  async createDocument(req, res) {
    try {
      const { title, documentType, projectId, templateId, sectionCodes } = req.body;
      const userId = req.user.id;

      const document = await UnifiedDocumentService.createDocument({
        title,
        documentType,
        projectId,
        templateId,
        createdBy: userId,
        selectedSectionCodes: sectionCodes,
        userContext: req.user,
      });

      res.json({
        success: true,
        data: document,
        message: '文档创建成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 获取文档详情
   */
  async getDocument(req, res) {
    try {
      const { id } = req.params;
      const { includeSections } = req.query;

      const document = await UnifiedDocumentService.getDocument(id, {
        includeSections: includeSections === 'true',
      });

      res.json({
        success: true,
        data: document,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 更新文档
   */
  async updateDocument(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const userId = req.user.id;

      const document = await UnifiedDocumentService.updateDocument(id, updates, userId);

      res.json({
        success: true,
        data: document,
        message: '文档更新成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 删除文档
   */
  async deleteDocument(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      await UnifiedDocumentService.deleteDocument(id, userId);

      res.json({
        success: true,
        message: '文档删除成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 获取项目文档列表
   */
  async getProjectDocuments(req, res) {
    try {
      const { projectId } = req.params;
      const { documentType, status } = req.query;

      const documents = await UnifiedDocumentService.getProjectDocuments(projectId, {
        documentType,
        status,
      });

      res.json({
        success: true,
        data: documents,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async importDocumentTemplate(req, res) {
    try {
      const { id } = req.params;
      const { templateId, sectionCodes } = req.body;

      if (!templateId) {
        return res.status(400).json({
          success: false,
          message: '请选择要导入的模板',
        });
      }

      const inserted = await UnifiedDocumentService.importTemplateSections(
        id,
        templateId,
        sectionCodes,
        req.user
      );

      res.json({
        success: true,
        data: {
          imported: inserted.length,
        },
        message: inserted.length > 0 ? '模板章节导入成功' : '没有新的章节导入',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async exportEditedSections(req, res) {
    try {
      const { id } = req.params;
      const document = await UnifiedDocumentService.getDocument(id);

      const sections = await knex('document_sections')
        .where({ document_id: id })
        .orderBy('sort_order');

      const editedSections = sections.filter(section =>
        this._hasSectionContent(section.content)
      );

      if (!editedSections.length) {
        return res.status(400).json({
          success: false,
          message: '暂无已编辑的章节可导出',
        });
      }

      const zip = new JSZip();
      for (const section of editedSections) {
        const html = section.content || '';
        const buffer = await htmlToDocx(html, null, {
          table: { row: { cantSplit: true } },
        });
        const safeName = this._sanitizeFilename(
          `${section.section_code || ''} ${section.title}`.trim() || section.title
        );
        zip.file(`${safeName || 'section'}.docx`, buffer);
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      const filename = this._sanitizeFilename(`${document.title}-edited-sections.zip`);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`
      );
      res.setHeader('Content-Length', zipBuffer.length);
      res.send(zipBuffer);
    } catch (error) {
      console.error('[exportEditedSections] 错误:', error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // ============================================
  // 模板管理
  // ============================================

  /**
   * 上传模板
   * @param {string} req.body.sourceType - CSI来源类型: CSI_EN/CSI_ZH/COMPANY (技术规范模板)
   * @param {string} req.body.sourceProject - 来源项目名（公司SPEC时）
   * @param {string} req.body.projectType - 项目类型：semiconductor/datacenter/pharmaceutical 等
   */
  async uploadTemplate(req, res) {
    try {
      const { name, templateType, description, sourceType, sourceProject, projectType } = req.body;
      const file = req.file;
      const userId = req.user.id;

      if (!file) {
        return res.status(400).json({
          success: false,
          message: '请上传文件',
        });
      }

      const template = await TemplateService.uploadTemplate({
        name,
        templateType,
        description,
        filePath: file.path,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        createdBy: userId,
        // CSI 扩展参数
        sourceType: sourceType || null,
        sourceProject: sourceProject || null,
        projectType: projectType || null,
      });

      res.json({
        success: true,
        data: template,
        message: sourceType ? '模板上传成功，CSI 解析进行中' : '模板上传成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 获取模板列表
   */
  async getTemplates(req, res) {
    try {
      const { templateType, status } = req.query;

      const templates = await TemplateService.getTemplates({
        templateType,
        status,
      });

      res.json({
        success: true,
        data: templates,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 获取模板详情
   */
  async getTemplate(req, res) {
    try {
      const { id } = req.params;

      const template = await TemplateService.getTemplate(id);

      res.json({
        success: true,
        data: template,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 删除模板
   */
  async deleteTemplate(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      await TemplateService.deleteTemplate(id, userId);

      res.json({
        success: true,
        message: '模板删除成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 发布模板
   */
  async publishTemplate(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const template = await TemplateService.publishTemplate(id, userId);

      res.json({
        success: true,
        data: template,
        message: '模板发布成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 获取模板章节结构（支持懒加载）
   */
  async getTemplateSections(req, res) {
    try {
      const { id } = req.params;
      const { parentCode } = req.query;

      const sections = await TemplateService.getTemplateSections(id, parentCode || null);

      res.json({
        success: true,
        data: sections,
      });
    } catch (error) {
      console.error('[getTemplateSections] 错误:', error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getTemplateSectionTree(req, res) {
    try {
      const { id } = req.params;
      const { editableOnly } = req.query;

      const tree = await TemplateService.getTemplateSectionsTree(id, {
        onlyEditableForUser: editableOnly === 'true' ? req.user : null,
      });

      res.json({
        success: true,
        data: tree,
      });
    } catch (error) {
      console.error('[getTemplateSectionTree] 错误:', error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 获取模板目录大纲
   */
  async getTemplateOutline(req, res) {
    try {
      const { id } = req.params;

      const template = await knex('document_templates')
        .where({ id })
        .first();

      if (!template) {
        return res.status(404).json({
          success: false,
          message: '模板不存在'
        });
      }

      // 从config中读取解析好的目录结构
      const config = JSON.parse(template.config || '{}');

      res.json({
        success: true,
        data: {
          outline: config.sectionStructure || [],
          flatOutline: config.flatSections || [],
          stats: config.stats || { totalSections: 0 }
        }
      });
    } catch (error) {
      console.error('[模板管理] 获取目录失败:', error);
      res.status(500).json({
        success: false,
        message: '获取模板目录失败',
        error: error.message
      });
    }
  }

  /**
   * 基于模板创建文档实例
   */
  async createDocumentFromTemplate(req, res) {
    try {
      const { templateId, title, projectId, sectionCodes } = req.body;
      const userId = req.user.id;

      const instance = await TemplateService.createDocumentFromTemplate({
        templateId,
        title,
        projectId,
        createdBy: userId,
        sectionCodes,
      });

      res.json({
        success: true,
        data: instance,
        message: '文档创建成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 获取文档实例章节（合并模板结构和实际内容）
   */
  async getInstanceSections(req, res) {
    try {
      const { instanceId } = req.params;

      const sections = await TemplateService.getInstanceSections(instanceId);

      res.json({
        success: true,
        data: sections,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 更新文档实例章节内容
   */
  async updateInstanceSection(req, res) {
    try {
      const { instanceId, sectionCode } = req.params;
      const { content } = req.body;
      const userId = req.user.id;

      await TemplateService.updateInstanceSection(instanceId, sectionCode, content, userId);

      res.json({
        success: true,
        message: '章节内容更新成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // ============================================
  // 章节管理
  // ============================================

  /**
   * 创建章节
   */
  async createSection(req, res) {
    try {
      const sectionData = req.body;
      const userId = req.user.id;

      const section = await SectionService.createSection({
        ...sectionData,
        createdBy: userId,
      });

      res.json({
        success: true,
        data: section,
        message: '章节创建成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 更新章节内容
   */
  async updateSectionContent(req, res) {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = req.user.id;

      const section = await SectionService.updateSectionContent(id, content, userId);

      res.json({
        success: true,
        data: section,
        message: '章节内容更新成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 删除章节
   */
  async deleteSection(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      await SectionService.deleteSection(id, userId);

      res.json({
        success: true,
        message: '章节删除成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 获取模板的单个章节详情（含template_content）
   */
  async getTemplateSection(req, res) {
    try {
      const { templateId, sectionId } = req.params;

      const section = await knex('template_sections')
        .where({ id: sectionId, template_id: templateId })
        .first();

      if (!section) {
        return res.status(404).json({
          success: false,
          message: '章节不存在',
        });
      }

      res.json({
        success: true,
        data: section,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 创建模板章节
   */
  async createTemplateSection(req, res) {
    try {
      const { templateId } = req.params;
      const sectionData = req.body;

      const section = await SectionService.createTemplateSection({
        templateId,
        ...sectionData,
      });

      res.json({
        success: true,
        data: section,
        message: '章节创建成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 更新模板章节
   */
  async updateTemplateSection(req, res) {
    try {
      const { templateId, sectionId } = req.params;
      const updates = req.body;

      const section = await SectionService.updateTemplateSection(
        templateId,
        sectionId,
        updates
      );

      res.json({
        success: true,
        data: section,
        message: '章节更新成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 移动模板章节
   */
  async moveTemplateSection(req, res) {
    try {
      const { templateId, sectionId } = req.params;
      const moveParams = req.body;

      const section = await SectionService.moveTemplateSection(
        templateId,
        sectionId,
        moveParams
      );

      res.json({
        success: true,
        data: section,
        message: '章节移动成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 删除模板章节
   */
  async deleteTemplateSection(req, res) {
    try {
      const { templateId, sectionId } = req.params;

      await SectionService.deleteTemplateSection(templateId, sectionId);

      res.json({
        success: true,
        message: '章节删除成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 锁定章节
   */
  async lockSection(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const section = await SectionService.lockSection(id, userId);

      res.json({
        success: true,
        data: section,
        message: '章节已锁定',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 解锁章节
   */
  async unlockSection(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      await SectionService.unlockSection(id, userId);

      res.json({
        success: true,
        message: '章节已解锁',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // ============================================
  // 修订追踪
  // ============================================

  /**
   * 获取章节修订列表
   */
  async getSectionRevisions(req, res) {
    try {
      const { sectionId } = req.params;
      const { status } = req.query;

      const revisions = await RevisionTrackingService.getSectionRevisions(sectionId, status);

      res.json({
        success: true,
        data: revisions,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 接受修订
   */
  async acceptRevision(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const revision = await RevisionTrackingService.acceptRevision(id, userId);

      res.json({
        success: true,
        data: revision,
        message: '修订已接受',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 拒绝修订
   */
  async rejectRevision(req, res) {
    try {
      const { id } = req.params;
      const { comment } = req.body;
      const userId = req.user.id;

      const revision = await RevisionTrackingService.rejectRevision(id, userId, comment);

      res.json({
        success: true,
        data: revision,
        message: '修订已拒绝',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 开启/关闭修订追踪
   */
  async toggleRevisionTracking(req, res) {
    try {
      const { documentId } = req.params;
      const { enabled } = req.body;

      await RevisionTrackingService.toggleRevisionTracking(documentId, enabled);

      res.json({
        success: true,
        message: `修订追踪已${enabled ? '开启' : '关闭'}`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // ============================================
  // 章节审批
  // ============================================

  /**
   * 提交章节审批
   */
  async submitSectionForApproval(req, res) {
    try {
      const approvalData = req.body;
      const userId = req.user.id;
      const userName = req.user.username;

      const task = await SectionApprovalService.submitSectionForApproval({
        ...approvalData,
        submittedBy: userId,
        submittedByName: userName,
      });

      res.json({
        success: true,
        data: task,
        message: '审批申请已提交',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 审批章节
   */
  async reviewSection(req, res) {
    try {
      const { taskId } = req.params;
      const { decision, comment, issues } = req.body;
      const userId = req.user.id;

      const task = await SectionApprovalService.reviewSection({
        taskId,
        reviewerId: userId,
        decision,
        comment,
        issues,
      });

      res.json({
        success: true,
        data: task,
        message: '审批完成',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 获取审批人的待审批任务
   */
  async getReviewerPendingTasks(req, res) {
    try {
      const userId = req.user.id;

      const tasks = await SectionApprovalService.getReviewerPendingTasks(userId);

      res.json({
        success: true,
        data: tasks,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 修复审批问题
   */
  async fixIssue(req, res) {
    try {
      const { issueId } = req.params;
      const { comment } = req.body;
      const userId = req.user.id;

      const issue = await SectionApprovalService.fixIssue(issueId, userId, comment);

      res.json({
        success: true,
        data: issue,
        message: '问题已标记为已修复',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // ============================================
  // 归档管理
  // ============================================

  /**
   * 提交归档申请
   */
  async requestArchive(req, res) {
    try {
      const { documentId, reason, suggestedCategory, suggestedTags } = req.body;
      const userId = req.user.id;

      const request = await ArchiveService.requestArchive({
        documentId,
        requesterId: userId,
        reason,
        suggestedCategory,
        suggestedTags,
      });

      res.json({
        success: true,
        data: request,
        message: '归档申请已提交',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 审批归档申请
   */
  async approveArchiveRequest(req, res) {
    try {
      const { requestId } = req.params;
      const { permissions, category, tags, securityLevel, comment } = req.body;
      const userId = req.user.id;

      const request = await ArchiveService.approveArchiveRequest({
        requestId,
        reviewerId: userId,
        permissions,
        category,
        tags,
        securityLevel,
        comment,
      });

      res.json({
        success: true,
        data: request,
        message: '归档申请已批准',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 拒绝归档申请
   */
  async rejectArchiveRequest(req, res) {
    try {
      const { requestId } = req.params;
      const { comment } = req.body;
      const userId = req.user.id;

      const request = await ArchiveService.rejectArchiveRequest(requestId, userId, comment);

      res.json({
        success: true,
        data: request,
        message: '归档申请已拒绝',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * 获取待审批的归档申请列表
   */
  async getPendingArchiveRequests(req, res) {
    try {
      const requests = await ArchiveService.getPendingArchiveRequests();

      res.json({
        success: true,
        data: requests,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // ============================================
  // AI能力
  // ============================================

  /**
   * 调用AI能力
   */
  async invokeAI(req, res) {
    try {
      const { documentType, capabilityId, inputData } = req.body;
      const userId = req.user.id;

      const result = await DocumentAIService.invokeAICapability({
        documentType,
        capabilityId,
        inputData,
        userId,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * AI对话助手 - 流式响应
   */
  async chatAssist(req, res) {
    try {
      const { documentId, sectionId, userMessage, context } = req.body;
      const userId = req.user.id;

      // 设置SSE响应头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      await DocumentAIService.chatAssist({
        documentId,
        sectionId,
        userMessage,
        context,
        userId,
        onChunk: (chunk) => {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        },
        onComplete: () => {
          res.write('data: [DONE]\n\n');
          res.end();
        },
        onError: (error) => {
          res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
          res.end();
        },
      });
    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }

  /**
   * 批量上传模板
   */
  async batchUploadTemplates(req, res) {
    try {
      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: '没有上传文件',
        });
      }

      const DocxParserService = require('../services/document/DocxParserService');
      const path = require('path');
      const results = [];

      for (const file of files) {
        try {
          // 解析文件（仅支持docx）
          let sections = [];
          if (file.originalname.endsWith('.docx')) {
            const parseResult = await DocxParserService.parseDocx(file.path);
            if (parseResult.success) {
              sections = parseResult.sections;
            }
          }

          // 推断文档类型
          const documentType = DocxParserService.inferDocumentType(file.originalname);

          // 创建模板记录
          const [template] = await knex('document_templates').insert({
            name: path.basename(file.originalname, path.extname(file.originalname)),
            document_type: documentType,
            file_path: file.path,
            file_size: file.size,
            status: 'draft',
            created_by: req.user.id,
          }).returning('*');

          // 创建文档
          const [document] = await knex('documents').insert({
            title: template.name,
            document_type: documentType,
            status: 'draft',
            created_by: req.user.id,
            template_id: template.id,
          }).returning('*');

          // 递归创建章节
          const createSectionsRecursively = async (sections, parentId = null, level = 1) => {
            for (const section of sections) {
              const [created] = await knex('document_sections').insert({
                document_id: document.id,
                title: section.title,
                content: section.content || '',
                level: section.level || level,
                parent_id: parentId,
                order_index: sections.indexOf(section),
                approval_status: 'draft',
                created_by: req.user.id,
              }).returning('*');

              if (section.children && section.children.length > 0) {
                await createSectionsRecursively(section.children, created.id, level + 1);
              }
            }
          };

          await createSectionsRecursively(sections);

          results.push({
            filename: file.originalname,
            success: true,
            template,
            document,
            sectionsCount: sections.length,
          });
        } catch (error) {
          console.error(`[批量上传] 处理文件失败: ${file.originalname}`, error);
          results.push({
            filename: file.originalname,
            success: false,
            error: error.message,
          });
        }
      }

      res.json({
        success: true,
        message: `成功上传 ${results.filter(r => r.success).length}/${files.length} 个文件`,
        data: results,
      });
    } catch (error) {
      console.error('[批量上传模板] 错误:', error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  _stripHtml(content = '') {
    if (!content) return '';
    return content
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ');
  }

  _hasSectionContent(content) {
    return this._stripHtml(content).trim().length > 0;
  }

  _sanitizeFilename(name = 'section') {
    return (name || 'section')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 120) || 'section';
  }
}

module.exports = new UnifiedDocumentController();
