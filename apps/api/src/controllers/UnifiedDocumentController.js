/**
 * 统一文档控制器
 * 处理所有文档相关的HTTP请求
 */

const UnifiedDocumentService = require('../services/document/UnifiedDocumentService');
const TemplateService = require('../services/document/TemplateService');
const SectionService = require('../services/document/SectionService');
const RevisionTrackingService = require('../services/document/RevisionTrackingService');
const SectionApprovalService = require('../services/document/SectionApprovalService');
const ArchiveService = require('../services/document/ArchiveService');
const DocumentAIService = require('../services/document/DocumentAIService');

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
   * 创建文档
   */
  async createDocument(req, res) {
    try {
      const { title, documentType, projectId, templateId } = req.body;
      const userId = req.user.id;

      const document = await UnifiedDocumentService.createDocument({
        title,
        documentType,
        projectId,
        templateId,
        createdBy: userId,
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

  // ============================================
  // 模板管理
  // ============================================

  /**
   * 上传模板
   */
  async uploadTemplate(req, res) {
    try {
      const { name, templateType, description } = req.body;
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
      });

      res.json({
        success: true,
        data: template,
        message: '模板上传成功',
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
   * 获取模板章节结构
   */
  async getTemplateSections(req, res) {
    try {
      const { id } = req.params;

      const sections = await TemplateService.getTemplateSections(id);

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
      const { templateId, title, projectId } = req.body;
      const userId = req.user.id;

      const instance = await TemplateService.createDocumentFromTemplate({
        templateId,
        title,
        projectId,
        createdBy: userId,
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
      const knex = require('../config/database');
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
}

module.exports = new UnifiedDocumentController();
