const knex = require('../../config/database');
const UnifiedRuleService = require('./UnifiedRuleService');

/**
 * 反馈学习服务
 * 实现Human-in-the-Loop学习闭环
 * 记录应用、收集反馈、调整置信度、持续优化
 */
class FeedbackLearningService {
  /**
   * 记录规则应用
   * @param {Object} applicationData
   */
  async recordApplication({
    ruleId,
    applicationType, // 'assembly_generation' | 'pid_design' | 'compliance_check'
    context,         // 应用时的上下文数据
    appliedMethod,   // 'auto' | 'suggested' | 'manual_selected'
    resultStatus,    // 'success' | 'failed' | 'corrected' | 'rejected'
    userFeedback,    // 'correct' | 'incorrect' | 'partially_correct'
    userCorrection,  // 用户修正的正确答案
    feedbackComment, // 反馈备注
    projectId,
    designId,
    userId
  }) {
    try {
      // 1. 获取规则当前置信度
      const rule = await knex('design_rules')
        .where('id', ruleId)
        .first();

      if (!rule) {
        throw new Error(`规则 ${ruleId} 不存在`);
      }

      const originalConfidence = rule.confidence_score || 0.5;

      // 2. 根据反馈计算调整后的置信度
      const adjustedConfidence = await this.calculateAdjustedConfidence(
        originalConfidence,
        userFeedback,
        rule.rule_type
      );

      // 3. 插入应用记录
      const [application] = await knex('rule_applications')
        .insert({
          rule_id: ruleId,
          application_type: applicationType,
          context: JSON.stringify(context),
          applied_method: appliedMethod,
          result_status: resultStatus,
          user_feedback: userFeedback,
          user_correction: userCorrection ? JSON.stringify(userCorrection) : null,
          feedback_comment: feedbackComment,
          project_id: projectId,
          design_id: designId,
          original_confidence: originalConfidence,
          adjusted_confidence: adjustedConfidence,
          applied_by: userId,
          applied_at: knex.fn.now(),
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        })
        .returning('*');

      // 4. 更新规则统计
      await this.updateRuleStatistics(ruleId, resultStatus, userFeedback);

      // 5. 即时调整置信度（如果配置启用）
      const config = await UnifiedRuleService.getLearningConfig(rule.rule_type);
      if (config.enable_feedback_learning) {
        await this.adjustConfidenceImmediately(
          ruleId,
          adjustedConfidence,
          config.feedback_weight
        );
      }

      console.log(`✅ 规则应用已记录: ${ruleId}, 反馈: ${userFeedback}`);
      return application;

    } catch (error) {
      console.error('❌ 记录规则应用失败:', error);
      throw error;
    }
  }

  /**
   * 更新规则统计（使用次数+1，成功次数）
   */
  async updateRuleStatistics(ruleId, resultStatus, userFeedback) {
    // 使用次数 +1
    await knex('design_rules')
      .where('id', ruleId)
      .increment('usage_count', 1)
      .update({
        last_applied_at: knex.fn.now()
      });

    // 如果成功，成功次数 +1
    if (
      resultStatus === 'success' ||
      userFeedback === 'correct' ||
      userFeedback === 'partially_correct'
    ) {
      await knex('design_rules')
        .where('id', ruleId)
        .increment('success_count', 1);
    }
  }

  /**
   * 计算调整后的置信度
   */
  async calculateAdjustedConfidence(originalConfidence, userFeedback, ruleType) {
    // 反馈对应的分数
    const feedbackScoreMap = {
      'correct': 1.0,
      'partially_correct': 0.7,
      'incorrect': 0.3,
      null: 0.5 // 无反馈默认0.5
    };

    const feedbackScore = feedbackScoreMap[userFeedback] || 0.5;

    // 获取反馈权重配置
    const config = await UnifiedRuleService.getLearningConfig(ruleType);
    const weight = config.feedback_weight || 0.3;

    // 加权平均
    const adjusted = originalConfidence * (1 - weight) + feedbackScore * weight;

    // 限制在 [0, 1] 范围
    return Math.max(0, Math.min(1, adjusted));
  }

  /**
   * 即时调整置信度
   */
  async adjustConfidenceImmediately(ruleId, newConfidence, weight) {
    await knex('design_rules')
      .where('id', ruleId)
      .update({
        confidence_score: newConfidence,
        updated_at: knex.fn.now()
      });

    console.log(`  📈 置信度已调整: ${ruleId} → ${newConfidence.toFixed(2)}`);
  }

  /**
   * 定期批量学习（定时任务调用）
   * 分析最近N天的应用记录，批量调整置信度
   */
  async batchLearning(ruleType, days = 30) {
    try {
      console.log(`🔄 开始批量学习: ${ruleType}, 最近${days}天`);

      // 1. 获取最近N天的应用记录
      const recentApplications = await knex('rule_applications as ra')
        .join('design_rules as dr', 'ra.rule_id', 'dr.id')
        .where('dr.rule_type', ruleType)
        .where('ra.applied_at', '>', knex.raw(`NOW() - INTERVAL '${days} days'`))
        .select('ra.rule_id', 'ra.result_status', 'ra.user_feedback');

      if (recentApplications.length === 0) {
        console.log('  ℹ️  没有最近的应用记录');
        return { updated: 0 };
      }

      // 2. 按规则分组统计
      const stats = this.groupStatsByRule(recentApplications);

      // 3. 批量更新置信度
      let updatedCount = 0;
      for (const [ruleId, stat] of Object.entries(stats)) {
        // 至少5次应用才调整
        if (stat.total >= 5) {
          const successRate = stat.success / stat.total;
          const rule = await knex('design_rules').where('id', ruleId).first();

          // 加权计算新置信度
          const newConfidence = rule.confidence_score * 0.6 + successRate * 0.4;

          await knex('design_rules')
            .where('id', ruleId)
            .update({
              confidence_score: newConfidence,
              updated_at: knex.fn.now()
            });

          console.log(`  ✓ ${ruleId}: ${rule.confidence_score.toFixed(2)} → ${newConfidence.toFixed(2)} (成功率${(successRate * 100).toFixed(0)}%)`);
          updatedCount++;

          // 4. 低成功率预警
          if (successRate < 0.3 && stat.total >= 10) {
            await this.flagForReview(
              ruleId,
              `成功率过低(${(successRate * 100).toFixed(0)}%)，建议复审`
            );
          }
        }
      }

      console.log(`✅ 批量学习完成: 更新了${updatedCount}条规则`);
      return { updated: updatedCount };

    } catch (error) {
      console.error('❌ 批量学习失败:', error);
      throw error;
    }
  }

  /**
   * 按规则分组统计
   */
  groupStatsByRule(applications) {
    const stats = {};

    applications.forEach(app => {
      if (!stats[app.rule_id]) {
        stats[app.rule_id] = { total: 0, success: 0 };
      }

      stats[app.rule_id].total++;

      if (
        app.result_status === 'success' ||
        app.user_feedback === 'correct' ||
        app.user_feedback === 'partially_correct'
      ) {
        stats[app.rule_id].success++;
      }
    });

    return stats;
  }

  /**
   * 标记规则需要复审
   */
  async flagForReview(ruleId, reason) {
    await knex('design_rules')
      .where('id', ruleId)
      .update({
        review_status: 'pending',
        review_comment: `[自动标记] ${reason}`,
        updated_at: knex.fn.now()
      });

    console.log(`  ⚠️  规则 ${ruleId} 已标记复审: ${reason}`);
  }

  /**
   * 从用户修正中学习新规则
   */
  async learnFromCorrection(applicationId) {
    try {
      // 1. 获取应用记录
      const application = await knex('rule_applications')
        .where('id', applicationId)
        .first();

      if (!application || !application.user_correction) {
        return null;
      }

      // 2. 从修正中提取规则
      const correction = JSON.parse(application.user_correction);
      const originalRule = await knex('design_rules')
        .where('id', application.rule_id)
        .first();

      // 3. 创建修正后的新规则
      const newRule = await UnifiedRuleService.createRule({
        ruleType: originalRule.rule_type,
        name: `${originalRule.rule_name} (修正版)`,
        code: `${originalRule.rule_code}_CORRECTED_${Date.now()}`,
        content: correction.content || originalRule.rule_content,
        parameters: correction.parameters || originalRule.parameters,
        categoryId: originalRule.category_id,
        priority: originalRule.priority,
        confidence: 0.8, // 人工修正的置信度较高
        sourceDocumentId: originalRule.source_document_id,
        learnedFrom: 'user_correction'
      });

      console.log(`✅ 从用户修正中学习了新规则: ${newRule.id}`);
      return newRule;

    } catch (error) {
      console.error('❌ 从修正中学习失败:', error);
      throw error;
    }
  }

  /**
   * 获取学习报告
   */
  async getLearningReport(ruleType, days = 30) {
    const applications = await knex('rule_applications as ra')
      .join('design_rules as dr', 'ra.rule_id', 'dr.id')
      .where('dr.rule_type', ruleType)
      .where('ra.applied_at', '>', knex.raw(`NOW() - INTERVAL '${days} days'`))
      .select(
        knex.raw('COUNT(*) as total_applications'),
        knex.raw('COUNT(*) FILTER (WHERE ra.result_status = ?) as successful', ['success']),
        knex.raw('COUNT(*) FILTER (WHERE ra.user_feedback = ?) as correct_feedback', ['correct']),
        knex.raw('COUNT(*) FILTER (WHERE ra.user_feedback = ?) as incorrect_feedback', ['incorrect']),
        knex.raw('COUNT(*) FILTER (WHERE ra.applied_method = ?) as auto_applied', ['auto']),
        knex.raw('COUNT(*) FILTER (WHERE ra.applied_method = ?) as manual_selected', ['manual_selected']),
        knex.raw('AVG(dr.confidence_score) as avg_confidence')
      )
      .first();

    const totalRules = await knex('design_rules')
      .where('rule_type', ruleType)
      .where('is_active', true)
      .count('* as count')
      .first();

    return {
      ruleType,
      period: `最近${days}天`,
      totalRules: parseInt(totalRules.count),
      totalApplications: parseInt(applications.total_applications),
      successRate: applications.total_applications > 0
        ? (applications.successful / applications.total_applications * 100).toFixed(2) + '%'
        : '0%',
      correctRate: applications.total_applications > 0
        ? (applications.correct_feedback / applications.total_applications * 100).toFixed(2) + '%'
        : '0%',
      autoApplyRate: applications.total_applications > 0
        ? (applications.auto_applied / applications.total_applications * 100).toFixed(2) + '%'
        : '0%',
      avgConfidence: parseFloat(applications.avg_confidence || 0).toFixed(2)
    };
  }

  /**
   * 清理旧的应用记录（保留最近N天）
   */
  async cleanupOldRecords(days = 180) {
    const deleted = await knex('rule_applications')
      .where('applied_at', '<', knex.raw(`NOW() - INTERVAL '${days} days'`))
      .delete();

    console.log(`✅ 清理了${deleted}条超过${days}天的旧记录`);
    return deleted;
  }
}

module.exports = new FeedbackLearningService();
