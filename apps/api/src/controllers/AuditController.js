const AuditService = require('../services/system/AuditService');

/**
 * AI审核控制器
 */
class AuditController {
  /**
   * 获取待审核列表
   */
  static async getPendingAudits(req, res) {
    try {
      const filters = req.query;
      const result = await AuditService.getPendingAudits(filters);
      res.json(result);
    } catch (error) {
      console.error('获取待审核列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取待审核列表失败',
        error: error.message
      });
    }
  }

  /**
   * 批准结果
   */
  static async approve(req, res) {
    try {
      const { auditId } = req.params;
      const userId = req.user?.id || 'system';
      
      const result = await AuditService.approveResult(auditId, userId);
      res.json(result);
    } catch (error) {
      console.error('批准失败:', error);
      res.status(500).json({
        success: false,
        message: '批准失败',
        error: error.message
      });
    }
  }

  /**
   * 拒绝结果
   */
  static async reject(req, res) {
    try {
      const { auditId } = req.params;
      const { reason } = req.body;
      const userId = req.user?.id || 'system';
      
      if (!reason) {
        return res.status(400).json({
          success: false,
          message: '请提供拒绝原因'
        });
      }
      
      const result = await AuditService.rejectResult(auditId, reason, userId);
      res.json(result);
    } catch (error) {
      console.error('拒绝失败:', error);
      res.status(500).json({
        success: false,
        message: '拒绝失败',
        error: error.message
      });
    }
  }

  /**
   * 修改结果
   */
  static async modify(req, res) {
    try {
      const { auditId } = req.params;
      const { corrections } = req.body;
      const userId = req.user?.id || 'system';
      
      if (!corrections || Object.keys(corrections).length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供修正内容'
        });
      }
      
      const result = await AuditService.modifyResult(auditId, corrections, userId);
      res.json(result);
    } catch (error) {
      console.error('修改失败:', error);
      res.status(500).json({
        success: false,
        message: '修改失败',
        error: error.message
      });
    }
  }

  /**
   * 请求专家审核
   */
  static async requestExpert(req, res) {
    try {
      const { auditId } = req.params;
      const { expertId, notes } = req.body;
      
      const result = await AuditService.requestExpertReview(auditId, expertId, notes);
      res.json(result);
    } catch (error) {
      console.error('请求专家审核失败:', error);
      res.status(500).json({
        success: false,
        message: '请求专家审核失败',
        error: error.message
      });
    }
  }

  /**
   * 获取统计信息
   */
  static async getStatistics(req, res) {
    try {
      const { timeRange = 'today' } = req.query;
      const result = await AuditService.getStatistics(timeRange);
      res.json(result);
    } catch (error) {
      console.error('获取统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取统计失败',
        error: error.message
      });
    }
  }

  /**
   * 获取审核历史
   */
  static async getHistory(req, res) {
    try {
      const filters = req.query;
      const result = await AuditService.getAuditHistory(filters);
      res.json(result);
    } catch (error) {
      console.error('获取历史失败:', error);
      res.status(500).json({
        success: false,
        message: '获取历史失败',
        error: error.message
      });
    }
  }

  /**
   * 批量批准
   */
  static async batchApprove(req, res) {
    try {
      const { auditIds } = req.body;
      const userId = req.user?.id || 'system';
      
      if (!Array.isArray(auditIds) || auditIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供审核项ID数组'
        });
      }
      
      const result = await AuditService.batchApprove(auditIds, userId);
      res.json(result);
    } catch (error) {
      console.error('批量批准失败:', error);
      res.status(500).json({
        success: false,
        message: '批量批准失败',
        error: error.message
      });
    }
  }

  /**
   * 获取学习反馈
   */
  static async getLearningFeedback(req, res) {
    try {
      const result = await AuditService.getLearningFeedback();
      res.json(result);
    } catch (error) {
      console.error('获取学习反馈失败:', error);
      res.status(500).json({
        success: false,
        message: '获取学习反馈失败',
        error: error.message
      });
    }
  }

  /**
   * 添加审核项
   */
  static async addAuditItem(req, res) {
    try {
      const item = req.body;
      
      if (!item.type || !item.category || !item.aiResult) {
        return res.status(400).json({
          success: false,
          message: '审核项数据不完整'
        });
      }
      
      const result = await AuditService.addAuditItem(item);
      res.json(result);
    } catch (error) {
      console.error('添加审核项失败:', error);
      res.status(500).json({
        success: false,
        message: '添加审核项失败',
        error: error.message
      });
    }
  }

  /**
   * 获取修正记录
   */
  static async getCorrections(req, res) {
    try {
      const { auditId } = req.params;
      const result = await AuditService.getCorrections(auditId);
      res.json(result);
    } catch (error) {
      console.error('获取修正记录失败:', error);
      res.status(500).json({
        success: false,
        message: '获取修正记录失败',
        error: error.message
      });
    }
  }

  /**
   * 导出审核数据
   */
  static async exportData(req, res) {
    try {
      const result = await AuditService.exportAuditData();
      
      // 设置下载响应头
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=audit-data-${Date.now()}.json`);
      
      res.json(result.data);
    } catch (error) {
      console.error('导出数据失败:', error);
      res.status(500).json({
        success: false,
        message: '导出数据失败',
        error: error.message
      });
    }
  }
}

module.exports = AuditController;