const BaseRuleProcessor = require('./BaseRuleProcessor');
const knex = require('../../../config/database');

/**
 * 装配规则处理器
 * 复用现有的装配学习逻辑
 */
class AssemblyRuleProcessor extends BaseRuleProcessor {
  /**
   * 从STEP文件或装配任务学习规则
   */
  async learnFromSource(sourceData, config) {
    // 复用现有的装配学习逻辑
    // 这里调用已有的 AssemblyController.learnRules 的核心逻辑

    try {
      // 1. 查询已有的装配任务约束数据
      const tasks = await knex('assembly_inference_tasks')
        .where('status', 'completed')
        .whereNotNull('constraints_json')
        .orderBy('created_at', 'desc')
        .limit(config.sampleLimit || 50);

      if (tasks.length === 0) {
        console.log('⚠️  没有找到已完成的装配任务');
        return [];
      }

      // 2. 统计约束模式
      const constraintStats = this.analyzeConstraintPatterns(tasks);

      // 3. 生成规则
      const learnedRules = [];
      for (const [constraintType, patterns] of Object.entries(constraintStats)) {
        if (patterns.count >= (config.minOccurrences || 3)) {
          const rule = {
            name: `${constraintType}装配约束规则`,
            code: `ASM_${constraintType.toUpperCase()}_${Date.now()}`,
            content: `基于${patterns.count}个样本学习的${constraintType}约束规则`,
            parameters: {
              constraint_type: constraintType,
              common_params: patterns.commonParams,
              success_rate: patterns.successRate
            },
            categoryId: 'assembly_rules',
            priority: patterns.count > 10 ? 'high' : 'normal',
            confidence: this.calculateConfidence(patterns)
          };

          learnedRules.push(rule);
        }
      }

      console.log(`✅ 从${tasks.length}个样本学习到${learnedRules.length}条规则`);
      return learnedRules;

    } catch (error) {
      console.error('❌ 装配规则学习失败:', error);
      throw error;
    }
  }

  /**
   * 分析约束模式
   */
  analyzeConstraintPatterns(tasks) {
    const stats = {};

    tasks.forEach(task => {
      const constraints = JSON.parse(task.constraints_json || '[]');

      constraints.forEach(constraint => {
        const type = constraint.type || constraint.constraint_type;
        if (!type) return;

        if (!stats[type]) {
          stats[type] = {
            count: 0,
            params: [],
            successCount: 0
          };
        }

        stats[type].count++;
        stats[type].params.push(constraint.parameters);

        // 如果任务标记为成功，累计成功次数
        if (task.review_status === 'approved') {
          stats[type].successCount++;
        }
      });
    });

    // 计算每种约束的共同参数和成功率
    for (const type in stats) {
      const pattern = stats[type];
      pattern.commonParams = this.findCommonParams(pattern.params);
      pattern.successRate = pattern.count > 0
        ? (pattern.successCount / pattern.count * 100).toFixed(2)
        : 0;
    }

    return stats;
  }

  /**
   * 查找共同参数
   */
  findCommonParams(paramsList) {
    if (paramsList.length === 0) return {};

    // 统计每个参数出现的频率
    const paramFreq = {};
    paramsList.forEach(params => {
      if (!params) return;
      Object.keys(params).forEach(key => {
        paramFreq[key] = (paramFreq[key] || 0) + 1;
      });
    });

    // 提取出现频率 > 50% 的参数
    const common = {};
    const threshold = paramsList.length * 0.5;
    Object.keys(paramFreq).forEach(key => {
      if (paramFreq[key] >= threshold) {
        // 计算该参数的平均值或众数
        const values = paramsList.map(p => p && p[key]).filter(v => v !== undefined);
        common[key] = this.getMostCommonValue(values);
      }
    });

    return common;
  }

  /**
   * 获取最常见的值
   */
  getMostCommonValue(values) {
    if (values.length === 0) return null;

    // 如果是数字，返回平均值
    if (typeof values[0] === 'number') {
      return values.reduce((a, b) => a + b, 0) / values.length;
    }

    // 否则返回众数
    const freq = {};
    values.forEach(v => {
      freq[v] = (freq[v] || 0) + 1;
    });

    return Object.keys(freq).reduce((a, b) => freq[a] > freq[b] ? a : b);
  }

  /**
   * 计算置信度
   */
  calculateConfidence(pattern) {
    const { count, successRate } = pattern;

    // 基于样本数量和成功率计算置信度
    const sampleScore = Math.min(count / 20, 1); // 20个样本 = 满分
    const successScore = parseFloat(successRate) / 100;

    return (sampleScore * 0.4 + successScore * 0.6).toFixed(2);
  }

  /**
   * 根据上下文过滤规则
   */
  async filterByContext(query, context) {
    // context = { partA: {...}, partB: {...} }
    if (!context || !context.partA || !context.partB) {
      return await query;
    }

    // 根据零件特征过滤（简化版）
    return await query.where(knex.raw(
      "parameters @> ?",
      [JSON.stringify({ constraint_type: context.expectedType })]
    ));
  }

  /**
   * 应用规则到装配设计
   */
  async applyRule(rule, design) {
    // 返回约束定义
    return {
      type: rule.parameters.constraint_type,
      parameters: rule.parameters.common_params,
      ruleId: rule.id,
      ruleName: rule.rule_name,
      confidence: rule.confidence_score
    };
  }
}

module.exports = AssemblyRuleProcessor;
