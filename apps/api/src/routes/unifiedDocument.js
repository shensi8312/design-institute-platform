/**
 * 统一文档管理路由
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const UnifiedDocumentController = require('../controllers/UnifiedDocumentController');
const { authenticate } = require('../middleware/auth');

// 确保上传目录存在
const uploadsDir = path.join(__dirname, '../../uploads/templates');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /\.(docx|pdf)$/i;
    const extname = allowedExtensions.test(file.originalname);

    if (extname) {
      cb(null, true);
    } else {
      cb(new Error(`只支持.docx和.pdf格式的文件`));
    }
  }
});

// 所有路由都需要认证
router.use(authenticate);

// ============================================
// 文档管理
// ============================================

// 获取文档列表（所有文档）
router.get('/documents', UnifiedDocumentController.getDocuments);

// 创建文档
router.post('/documents', UnifiedDocumentController.createDocument);

// 获取文档详情
router.get('/documents/:id', UnifiedDocumentController.getDocument);

// 更新文档
router.put('/documents/:id', UnifiedDocumentController.updateDocument);

// 导出已编辑章节
router.get('/documents/:id/export-edited', UnifiedDocumentController.exportEditedSections);

// 导入模板章节
router.post('/documents/:id/import-template', UnifiedDocumentController.importDocumentTemplate);

// 删除文档
router.delete('/documents/:id', UnifiedDocumentController.deleteDocument);

// 获取项目文档列表
router.get('/projects/:projectId/documents', UnifiedDocumentController.getProjectDocuments);

// ============================================
// 模板管理
// ============================================

// 上传模板
router.post('/templates', upload.single('file'), UnifiedDocumentController.uploadTemplate);

// 获取模板列表
router.get('/templates', UnifiedDocumentController.getTemplates);

// 获取模板章节结构（必须在 /templates/:id 之前）
router.get('/templates/:id/sections', UnifiedDocumentController.getTemplateSections);
router.get('/templates/:id/sections-tree', UnifiedDocumentController.getTemplateSectionTree);

// 获取单个章节详情（必须在 /templates/:id 之前）
router.get('/templates/:templateId/sections/:sectionId', UnifiedDocumentController.getTemplateSection);

// 创建模板章节（必须在 /templates/:id 之前）
router.post('/templates/:templateId/sections', UnifiedDocumentController.createTemplateSection);

// 更新模板章节（必须在 /templates/:id 之前）
router.put('/templates/:templateId/sections/:sectionId', UnifiedDocumentController.updateTemplateSection);

// 移动模板章节（必须在 /templates/:id 之前）
router.post('/templates/:templateId/sections/:sectionId/move', UnifiedDocumentController.moveTemplateSection);

// 删除模板章节（必须在 /templates/:id 之前）
router.delete('/templates/:templateId/sections/:sectionId', UnifiedDocumentController.deleteTemplateSection);

// 获取模板目录大纲（必须在 /templates/:id 之前）
router.get('/templates/:id/outline', UnifiedDocumentController.getTemplateOutline);

// 发布模板（必须在 /templates/:id 之前）
router.post('/templates/:id/publish', UnifiedDocumentController.publishTemplate);

// 获取模板详情
router.get('/templates/:id', UnifiedDocumentController.getTemplate);

// 基于模板创建文档实例
router.post('/documents/from-template', UnifiedDocumentController.createDocumentFromTemplate);

// 获取文档实例章节
router.get('/instances/:instanceId/sections', UnifiedDocumentController.getInstanceSections);

// 更新文档实例章节内容
router.put('/instances/:instanceId/sections/:sectionCode', UnifiedDocumentController.updateInstanceSection);

// ============================================
// 章节管理
// ============================================

// 创建章节
router.post('/sections', UnifiedDocumentController.createSection);

// 更新章节内容
router.put('/sections/:id/content', UnifiedDocumentController.updateSectionContent);

// 删除章节
router.delete('/sections/:id', UnifiedDocumentController.deleteSection);

// 锁定章节
router.post('/sections/:id/lock', UnifiedDocumentController.lockSection);

// 解锁章节
router.post('/sections/:id/unlock', UnifiedDocumentController.unlockSection);

// ============================================
// 修订追踪
// ============================================

// 获取章节修订列表
router.get('/sections/:sectionId/revisions', UnifiedDocumentController.getSectionRevisions);

// 接受修订
router.post('/revisions/:id/accept', UnifiedDocumentController.acceptRevision);

// 拒绝修订
router.post('/revisions/:id/reject', UnifiedDocumentController.rejectRevision);

// 开启/关闭修订追踪
router.put('/documents/:documentId/revision-tracking', UnifiedDocumentController.toggleRevisionTracking);

// ============================================
// 章节审批
// ============================================

// 提交章节审批
router.post('/sections/submit-approval', UnifiedDocumentController.submitSectionForApproval);

// 审批章节
router.post('/approval-tasks/:taskId/review', UnifiedDocumentController.reviewSection);

// 获取审批人的待审批任务
router.get('/approval-tasks/pending', UnifiedDocumentController.getReviewerPendingTasks);

// 修复审批问题
router.post('/review-issues/:issueId/fix', UnifiedDocumentController.fixIssue);

// ============================================
// 归档管理
// ============================================

// 提交归档申请
router.post('/archive/request', UnifiedDocumentController.requestArchive);

// 审批归档申请
router.post('/archive/requests/:requestId/approve', UnifiedDocumentController.approveArchiveRequest);

// 拒绝归档申请
router.post('/archive/requests/:requestId/reject', UnifiedDocumentController.rejectArchiveRequest);

// 获取待审批的归档申请列表
router.get('/archive/requests/pending', UnifiedDocumentController.getPendingArchiveRequests);

// ============================================
// AI能力
// ============================================

// 调用AI能力
router.post('/ai/invoke', UnifiedDocumentController.invokeAI);

// AI对话助手
router.post('/ai/chat-assist', UnifiedDocumentController.chatAssist);

module.exports = router;
