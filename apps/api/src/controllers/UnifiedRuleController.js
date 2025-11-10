const UnifiedRuleService = require('../services/rules/UnifiedRuleService');
const RuleMatchingEngine = require('../services/rules/RuleMatchingEngine');
const FeedbackLearningService = require('../services/rules/FeedbackLearningService');

/**
 * 统一规则控制器
 * 支持多种规则类型（assembly/pid/building/process）
 * 提供学习、审核、匹配、反馈等完整功能
 */
class UnifiedRuleController {
  /**
   * 获取规则列表（统一接口）
   * GET /api/rules/:ruleType
   */
  static async getRules(req, res) {
    try {
      const { ruleType } = req.params;
      const filters = {
        categoryId: req.query.categoryId,
        reviewStatus: req.query.reviewStatus,
        priority: req.query.priority,
        search: req.query.search,
        minConfidence: parseFloat(req.query.minConfidence),
        page: parseInt(req.query.page) || 1,
        pageSize: parseInt(req.query.pageSize) || 20
      };

      const result = await UnifiedRuleService.getRules(ruleType, filters);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('获取规则失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 获取单个规则
   * GET /api/rules/:ruleType/:ruleId
   */
  static async getRule(req, res) {
    try {
      const { ruleId } = req.params;
      const rule = await UnifiedRuleService.getRule(ruleId);

      res.json({
        success: true,
        data: rule
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 创建规则
   * POST /api/rules/:ruleType
   */
  static async createRule(req, res) {
    try {
      const { ruleType } = req.params;
      const ruleData = {
        ...req.body,
        ruleType
      };

      const rule = await UnifiedRuleService.createRule(ruleData);

      res.json({
        success: true,
        data: rule,
        message: '规则创建成功'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 更新规则
   * PUT /api/rules/:ruleType/:ruleId
   */
  static async updateRule(req, res) {
    try {
      const { ruleId } = req.params;
      const updates = req.body;

      const rule = await UnifiedRuleService.updateRule(ruleId, updates);

      res.json({
        success: true,
        data: rule,
        message: '规则更新成功'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 删除规则
   * DELETE /api/rules/:ruleType/:ruleId
   */
  static async deleteRule(req, res) {
    try {
      const { ruleId } = req.params;
      await UnifiedRuleService.deleteRule(ruleId);

      res.json({
        success: true,
        message: '规则已删除'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 学习规则
   * POST /api/rules/:ruleType/learn
   */
  static async learnRules(req, res) {
    try {
      const { ruleType } = req.params;
      const sourceData = req.body;
      const config = {
        sampleLimit: parseInt(req.body.sampleLimit) || 50,
        minOccurrences: parseInt(req.body.minOccurrences) || 3
      };

      const rules = await UnifiedRuleService.learnRules(ruleType, sourceData, config);

      res.json({
        success: true,
        data: rules,
        rules_count: rules.length,
        message: `学习到 ${rules.length} 条规则`
      });
    } catch (error) {
      console.error('规则学习失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 批准规则
   * POST /api/rules/:ruleType/:ruleId/approve
   */
  static async approveRule(req, res) {
    try {
      const { ruleId } = req.params;
      const { comment } = req.body;
      const userId = req.user.userId || req.user.id;

      await UnifiedRuleService.approveRule(ruleId, userId, comment);

      res.json({
        success: true,
        message: '规则已批准'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 拒绝规则
   * POST /api/rules/:ruleType/:ruleId/reject
   */
  static async rejectRule(req, res) {
    try {
      const { ruleId } = req.params;
      const { comment } = req.body;
      const userId = req.user.userId || req.user.id;

      if (!comment) {
        return res.status(400).json({
          success: false,
          message: '拒绝时必须提供意见'
        });
      }

      await UnifiedRuleService.rejectRule(ruleId, userId, comment);

      res.json({
        success: true,
        message: '规则已拒绝'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 获取待审核规则
   * GET /api/rules/pending
   */
  static async getPendingRules(req, res) {
    try {
      const ruleType = req.query.ruleType;
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 20;

      const result = await UnifiedRuleService.getPendingRules(ruleType, page, pageSize);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 匹配规则
   * POST /api/rules/:ruleType/match
   */
  static async matchRules(req, res) {
    try {
      const { ruleType } = req.params;
      const { context, options } = req.body;

      const matches = await RuleMatchingEngine.matchRules({
        ruleType,
        context,
        options
      });

      res.json({
        success: true,
        data: matches
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 智能推荐规则（带自动/人工决策）
   * POST /api/rules/:ruleType/recommend
   */
  static async recommendRules(req, res) {
    try {
      const { ruleType } = req.params;
      const { context } = req.body;

      // 获取学习配置
      const config = await UnifiedRuleService.getLearningConfig(ruleType);

      const recommendation = await RuleMatchingEngine.recommend({
        ruleType,
        context,
        config: {
          autoApplyThreshold: config.auto_approve_threshold || 0.8,
          conflictResolution: config.conflict_resolution_strategy || 'highest_confidence'
        }
      });

      res.json({
        success: true,
        data: recommendation
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 记录规则应用反馈
   * POST /api/rules/:ruleType/feedback
   */
  static async submitFeedback(req, res) {
    try {
      const { ruleType } = req.params;
      const {
        ruleId,
        applicationType,
        context,
        appliedMethod,
        resultStatus,
        userFeedback,
        userCorrection,
        feedbackComment,
        projectId,
        designId
      } = req.body;

      const userId = req.user.userId || req.user.id;

      const application = await FeedbackLearningService.recordApplication({
        ruleId,
        applicationType,
        context,
        appliedMethod,
        resultStatus,
        userFeedback,
        userCorrection,
        feedbackComment,
        projectId,
        designId,
        userId
      });

      res.json({
        success: true,
        data: application,
        message: '反馈已记录'
      });
    } catch (error) {
      console.error('记录反馈失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 获取学习配置
   * GET /api/rules/:ruleType/config
   */
  static async getLearningConfig(req, res) {
    try {
      const { ruleType } = req.params;
      const config = await UnifiedRuleService.getLearningConfig(ruleType);

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 更新学习配置
   * PUT /api/rules/:ruleType/config
   */
  static async updateLearningConfig(req, res) {
    try {
      const { ruleType } = req.params;
      const updates = req.body;

      await UnifiedRuleService.updateLearningConfig(ruleType, updates);

      res.json({
        success: true,
        message: '配置已更新'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 获取规则统计
   * GET /api/rules/:ruleType/statistics
   */
  static async getStatistics(req, res) {
    try {
      const { ruleType } = req.params;
      const stats = await UnifiedRuleService.getStatistics(ruleType);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 获取学习报告
   * GET /api/rules/:ruleType/learning-report
   */
  static async getLearningReport(req, res) {
    try {
      const { ruleType } = req.params;
      const days = parseInt(req.query.days) || 30;

      const report = await FeedbackLearningService.getLearningReport(ruleType, days);

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 触发批量学习（定时任务调用）
   * POST /api/rules/:ruleType/batch-learning
   */
  static async triggerBatchLearning(req, res) {
    try {
      const { ruleType } = req.params;
      const days = parseInt(req.body.days) || 30;

      const result = await FeedbackLearningService.batchLearning(ruleType, days);

      res.json({
        success: true,
        data: result,
        message: `批量学习完成，更新了 ${result.updated} 条规则`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = UnifiedRuleController;
