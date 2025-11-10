const router = require('express').Router();
const AuditController = require('../controllers/AuditController');
const { authenticate } = require('../middleware/auth');

// 获取待审核列表
router.get('/pending', authenticate, AuditController.getPendingAudits);

// 批准结果
router.post('/:auditId/approve', authenticate, AuditController.approve);

// 拒绝结果
router.post('/:auditId/reject', authenticate, AuditController.reject);

// 修改结果
router.post('/:auditId/modify', authenticate, AuditController.modify);

// 请求专家审核
router.post('/:auditId/expert', authenticate, AuditController.requestExpert);

// 获取统计信息
router.get('/statistics', authenticate, AuditController.getStatistics);

// 获取审核历史
router.get('/history', authenticate, AuditController.getHistory);

// 批量批准
router.post('/batch-approve', authenticate, AuditController.batchApprove);

// 获取学习反馈
router.get('/learning-feedback', authenticate, AuditController.getLearningFeedback);

// 添加审核项
router.post('/add', authenticate, AuditController.addAuditItem);

// 获取修正记录
router.get('/:auditId/corrections', authenticate, AuditController.getCorrections);

// 导出审核数据
router.get('/export', authenticate, AuditController.exportData);

module.exports = router;