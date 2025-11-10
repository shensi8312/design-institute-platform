const knex = require('../../config/database');
const UnifiedRuleService = require('./UnifiedRuleService');

/**
 * 规则匹配引擎
 * 根据上下文智能匹配最适用的规则
 * 支持置信度评分、优先级排序、冲突检测
 */
class RuleMatchingEngine {
  /**
   * 匹配适用规则（通用接口）
   * @param {Object} params
   * @param {String} params.ruleType - 规则类型
   * @param {Object} params.context - 应用上下文
   * @param {Object} params.options - 匹配选项
   */
  async matchRules({ ruleType, context, options = {} }) {
    const {
      minConfidence = 0.5,
      maxResults = 10,
      includeInactive = false,
      sortBy = 'score' // 'score' | 'confidence' | 'usage'
    } = options;

    // 1. 基础查询：获取已批准的规则
    let query = knex('design_rules')
      .where('rule_type', ruleType)
      .where('review_status', 'approved');

    if (!includeInactive) {
      query = query.where('is_active', true);
    }

    if (minConfidence) {
      query = query.where('confidence_score', '>=', minConfidence);
    }

    // 2. JOIN业务表获取详细信息
    const businessTable = this.getBusinessTable(ruleType);
    if (businessTable) {
      query = query.leftJoin(
        businessTable,
        'design_rules.rule_code',
        `${businessTable}.rule_id`
      );
    }

    // 3. 业务逻辑过滤（调用处理器）
    const processor = this.getProcessor(ruleType);
    const filtered = await processor.filterByContext(query, context);

    // 4. 计算匹配分数
    const scored = filtered.map(rule => ({
      ...rule,
      matchScore: this.calculateMatchScore(rule, context)
    }));

    // 5. 排序
    const sorted = this.sortRules(scored, sortBy);

    // 6. 返回Top N
    return sorted.slice(0, maxResults);
  }

  /**
   * 计算匹配分数
   * 综合考虑：置信度、历史成功率、优先级
   */
  calculateMatchScore(rule, context) {
    // 1. 置信度得分（40%权重）
    const confidenceScore = rule.confidence_score || 0.5;

    // 2. 历史成功率（40%权重）
    const usageCount = rule.usage_count || 0;
    const successCount = rule.success_count || 0;
    const successRate = usageCount > 0
      ? successCount / usageCount
      : 0.5; // 新规则默认0.5

    // 3. 优先级得分（20%权重）
    const priorityMap = {
      'critical': 1.0,
      'high': 0.8,
      'normal': 0.5,
      'low': 0.3
    };
    const priorityScore = priorityMap[rule.priority] || 0.5;

    // 4. 加权计算
    const matchScore =
      confidenceScore * 0.4 +
      successRate * 0.4 +
      priorityScore * 0.2;

    return parseFloat(matchScore.toFixed(3));
  }

  /**
   * 排序规则
   */
  sortRules(rules, sortBy) {
    switch (sortBy) {
      case 'confidence':
        return rules.sort((a, b) => b.confidence_score - a.confidence_score);

      case 'usage':
        return rules.sort((a, b) => b.usage_count - a.usage_count);

      case 'score':
      default:
        return rules.sort((a, b) => b.matchScore - a.matchScore);
    }
  }

  /**
   * 智能推荐规则（带自动/人工决策）
   * @returns {Object} { autoApply: boolean, recommendedRules: [], reason: string }
   */
  async recommend({ ruleType, context, config = {} }) {
    const {
      autoApplyThreshold = 0.8,
      conflictResolution = 'highest_confidence'
    } = config;

    // 1. 匹配规则
    const matches = await this.matchRules({
      ruleType,
      context,
      options: { minConfidence: 0.5, maxResults: 5 }
    });

    if (matches.length === 0) {
      return {
        autoApply: false,
        recommendedRules: [],
        reason: '未找到匹配的规则'
      };
    }

    // 2. 检测冲突
    const conflicts = this.detectConflicts(matches);

    // 3. 高置信度且无冲突 → 自动应用
    const topRule = matches[0];
    if (topRule.matchScore >= autoApplyThreshold && conflicts.length === 0) {
      return {
        autoApply: true,
        recommendedRules: [topRule],
        reason: `置信度${(topRule.matchScore * 100).toFixed(0)}% ≥ 阈值${(autoApplyThreshold * 100)}%，无冲突，自动应用`
      };
    }

    // 4. 有冲突 → 根据策略处理
    if (conflicts.length > 0) {
      const resolved = this.resolveConflicts(matches, conflictResolution);
      return {
        autoApply: false,
        recommendedRules: resolved,
        reason: `检测到${conflicts.length}个冲突，需要人工选择`,
        conflicts
      };
    }

    // 5. 置信度不足 → 人工选择
    return {
      autoApply: false,
      recommendedRules: matches,
      reason: `最高置信度${(topRule.matchScore * 100).toFixed(0)}% < 阈值${(autoApplyThreshold * 100)}%，建议人工确认`
    };
  }

  /**
   * 检测规则冲突
   */
  detectConflicts(rules) {
    const conflicts = [];

    // 简化版：检查constraint_type是否互斥
    const mutuallyExclusive = [
      ['mate', 'offset'], // 配合和偏移冲突
      ['align', 'angle']  // 对齐和角度冲突
    ];

    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const typeA = rules[i].constraint_type;
        const typeB = rules[j].constraint_type;

        for (const pair of mutuallyExclusive) {
          if (
            (pair.includes(typeA) && pair.includes(typeB)) &&
            typeA !== typeB
          ) {
            conflicts.push({
              rule1: rules[i].id,
              rule2: rules[j].id,
              reason: `${typeA} 与 ${typeB} 互斥`
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * 解决冲突
   */
  resolveConflicts(rules, strategy) {
    switch (strategy) {
      case 'highest_confidence':
        // 返回置信度最高的
        return [rules[0]];

      case 'manual_select':
        // 全部返回，让用户选择
        return rules;

      case 'weighted':
        // 加权评分，返回得分最高的
        return [rules.sort((a, b) => b.matchScore - a.matchScore)[0]];

      default:
        return rules;
    }
  }

  /**
   * 获取业务表名
   */
  getBusinessTable(ruleType) {
    const tables = {
      'assembly': 'assembly_rules',
      'pid': 'pid_rules',
      'building': null // 建筑规范没有单独业务表
    };
    return tables[ruleType];
  }

  /**
   * 获取业务处理器
   */
  getProcessor(ruleType) {
    // 复用 UnifiedRuleService 的处理器
    const processors = UnifiedRuleService.processors;
    return processors[ruleType];
  }

  /**
   * 批量匹配（优化性能）
   */
  async batchMatch(requests) {
    const results = [];

    // 可以优化为并行查询
    for (const req of requests) {
      const matches = await this.matchRules(req);
      results.push({
        context: req.context,
        matches
      });
    }

    return results;
  }

  /**
   * 解释推荐理由（可解释性AI）
   */
  explainRecommendation(rule, context) {
    const reasons = [];

    // 1. 置信度
    if (rule.confidence_score >= 0.8) {
      reasons.push(`高置信度(${(rule.confidence_score * 100).toFixed(0)}%)`);
    }

    // 2. 历史成功率
    if (rule.usage_count > 0) {
      const rate = (rule.success_count / rule.usage_count * 100).toFixed(0);
      reasons.push(`历史成功率${rate}% (${rule.success_count}/${rule.usage_count})`);
    }

    // 3. 优先级
    if (rule.priority === 'critical' || rule.priority === 'high') {
      reasons.push(`${rule.priority}优先级`);
    }

    // 4. 上下文匹配
    if (context && rule.parameters) {
      // 检查参数匹配度
      const paramMatch = this.checkParameterMatch(rule.parameters, context);
      if (paramMatch > 0.7) {
        reasons.push(`参数高度匹配(${(paramMatch * 100).toFixed(0)}%)`);
      }
    }

    return reasons.join(', ');
  }

  /**
   * 检查参数匹配度
   */
  checkParameterMatch(ruleParams, context) {
    // 简化实现：计算共同参数的比例
    if (!ruleParams || !context) return 0;

    const ruleKeys = Object.keys(ruleParams);
    const contextKeys = Object.keys(context);
    const commonKeys = ruleKeys.filter(k => contextKeys.includes(k));

    return commonKeys.length / Math.max(ruleKeys.length, 1);
  }
}

module.exports = new RuleMatchingEngine();
