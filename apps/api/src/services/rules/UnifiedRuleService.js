const knex = require('../../config/database');
const AssemblyRuleProcessor = require('./processors/AssemblyRuleProcessor');
const PIDRuleProcessor = require('./processors/PIDRuleProcessor');
const BuildingRuleProcessor = require('./processors/BuildingRuleProcessor');

/**
 * 统一规则服务
 * 支持多种规则类型：assembly/pid/building/process
 * 复用现有 design_rules 表作为通用 rule_base
 */
class UnifiedRuleService {
  constructor() {
    // 业务处理器（可插拔）
    this.processors = {
      'assembly': new AssemblyRuleProcessor(),
      'pid': new PIDRuleProcessor(),
      'building': new BuildingRuleProcessor()
    };
  }

  /**
   * 获取规则列表（统一查询接口）
   */
  async getRules(ruleType, filters = {}) {
    const {
      categoryId,
      reviewStatus,
      priority,
      search,
      minConfidence,
      page = 1,
      pageSize = 20
    } = filters;

    let query = knex('design_rules')
      .where('design_rules.rule_type', ruleType)
      .where('design_rules.is_active', true);

    // 分类筛选
    if (categoryId && categoryId !== 'all') {
      query = query.where('category_id', categoryId);
    }

    // 审核状态
    if (reviewStatus && reviewStatus !== 'all') {
      query = query.where('review_status', reviewStatus);
    }

    // 优先级
    if (priority && priority !== 'all') {
      query = query.where('priority', priority);
    }

    // 置信度筛选
    if (minConfidence) {
      query = query.where('confidence_score', '>=', minConfidence);
    }

    // 搜索
    if (search) {
      query = query.where(function() {
        this.where('rule_name', 'like', `%${search}%`)
          .orWhere('rule_code', 'like', `%${search}%`)
          .orWhere('rule_content', 'like', `%${search}%`);
      });
    }

    // 先获取总数（在JOIN之前）
    const countQuery = knex('design_rules')
      .where('design_rules.rule_type', ruleType)
      .where('design_rules.is_active', true);

    if (categoryId && categoryId !== 'all') {
      countQuery.where('category_id', categoryId);
    }
    if (reviewStatus && reviewStatus !== 'all') {
      countQuery.where('review_status', reviewStatus);
    }
    if (priority && priority !== 'all') {
      countQuery.where('priority', priority);
    }
    if (minConfidence) {
      countQuery.where('confidence_score', '>=', minConfidence);
    }
    if (search) {
      countQuery.where(function() {
        this.where('rule_name', 'like', `%${search}%`)
          .orWhere('rule_code', 'like', `%${search}%`)
          .orWhere('rule_content', 'like', `%${search}%`);
      });
    }

    const [{ count }] = await countQuery.count('* as count');

    // 根据类型JOIN业务表
    if (ruleType === 'assembly') {
      query = query.leftJoin('assembly_rules', 'design_rules.rule_code', 'assembly_rules.rule_id')
        .select('design_rules.*', 'assembly_rules.constraint_type', 'assembly_rules.condition_logic');
    }

    // 分页
    const offset = (page - 1) * pageSize;

    const rules = await query
      .orderBy('design_rules.created_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    return {
      list: rules,
      total: parseInt(count),
      page,
      pageSize
    };
  }

  /**
   * 获取单个规则
   */
  async getRule(ruleId) {
    const rule = await knex('design_rules')
      .where('id', ruleId)
      .first();

    if (!rule) {
      throw new Error(`规则 ${ruleId} 不存在`);
    }

    // JOIN业务表获取完整信息
    if (rule.rule_type === 'assembly') {
      const assemblyDetail = await knex('assembly_rules')
        .where('rule_id', rule.rule_code)
        .first();
      return { ...rule, assemblyDetail };
    }

    return rule;
  }

  /**
   * 创建规则（统一创建接口）
   */
  async createRule(ruleData) {
    const {
      ruleType,
      name,
      description,
      code,
      content,
      parameters,
      categoryId,
      priority = 'normal',
      confidence = 0.5,
      sourceDocumentId,
      learnedFrom = 'manual'
    } = ruleData;

    const [rule] = await knex('design_rules')
      .insert({
        rule_type: ruleType,
        rule_name: name,
        rule_code: code,
        rule_content: content,
        parameters: JSON.stringify(parameters),
        category_id: categoryId,
        priority,
        confidence_score: confidence,
        source_document_id: sourceDocumentId,
        learned_from: learnedFrom,
        review_status: 'pending',
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      })
      .returning('*');

    return rule;
  }

  /**
   * 更新规则
   */
  async updateRule(ruleId, updates) {
    const [updated] = await knex('design_rules')
      .where('id', ruleId)
      .update({
        ...updates,
        updated_at: knex.fn.now()
      })
      .returning('*');

    return updated;
  }

  /**
   * 删除规则
   */
  async deleteRule(ruleId) {
    await knex('design_rules')
      .where('id', ruleId)
      .update({
        is_active: false,
        updated_at: knex.fn.now()
      });
  }

  /**
   * 学习规则（从源数据）
   */
  async learnRules(ruleType, sourceData, config = {}) {
    const processor = this.processors[ruleType];
    if (!processor) {
      throw new Error(`不支持的规则类型: ${ruleType}`);
    }

    // 调用业务处理器学习规则
    const learnedRules = await processor.learnFromSource(sourceData, config);

    // 保存到 design_rules 表
    const savedRules = [];
    for (const rule of learnedRules) {
      const saved = await this.createRule({
        ruleType,
        name: rule.name,
        code: rule.code,
        content: rule.content,
        parameters: rule.parameters,
        categoryId: rule.categoryId,
        priority: rule.priority,
        confidence: rule.confidence,
        sourceDocumentId: sourceData.documentId,
        learnedFrom: 'ai_learning'
      });
      savedRules.push(saved);
    }

    return savedRules;
  }

  /**
   * 批准规则
   */
  async approveRule(ruleId, reviewedBy, comment = '') {
    await knex('design_rules')
      .where('id', ruleId)
      .update({
        review_status: 'approved',
        reviewed_by: reviewedBy,
        reviewed_at: knex.fn.now(),
        review_comment: comment,
        is_active: true,
        updated_at: knex.fn.now()
      });
  }

  /**
   * 拒绝规则
   */
  async rejectRule(ruleId, reviewedBy, comment) {
    await knex('design_rules')
      .where('id', ruleId)
      .update({
        review_status: 'rejected',
        reviewed_by: reviewedBy,
        reviewed_at: knex.fn.now(),
        review_comment: comment,
        is_active: false,
        updated_at: knex.fn.now()
      });
  }

  /**
   * 获取待审核规则
   */
  async getPendingRules(ruleType = null, page = 1, pageSize = 20) {
    let query = knex('design_rules')
      .where('design_rules.review_status', 'pending')
      .where('design_rules.is_active', true);

    if (ruleType) {
      query = query.where('design_rules.rule_type', ruleType);
    }

    const offset = (page - 1) * pageSize;
    const [{ count }] = await query.clone().count('design_rules.id as count');

    const rules = await query
      .leftJoin('rule_categories', 'design_rules.category_id', 'rule_categories.id')
      .leftJoin('knowledge_documents', 'design_rules.source_document_id', 'knowledge_documents.id')
      .select(
        'design_rules.*',
        'rule_categories.name as category_name',
        'knowledge_documents.file_name as document_name'
      )
      .orderBy('design_rules.created_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    return {
      list: rules,
      total: parseInt(count),
      page,
      pageSize
    };
  }

  /**
   * 获取学习配置
   */
  async getLearningConfig(ruleType) {
    const config = await knex('rule_learning_config')
      .where('rule_type', ruleType)
      .first();

    return config || this.getDefaultConfig(ruleType);
  }

  /**
   * 更新学习配置
   */
  async updateLearningConfig(ruleType, updates) {
    const exists = await knex('rule_learning_config')
      .where('rule_type', ruleType)
      .first();

    if (exists) {
      await knex('rule_learning_config')
        .where('rule_type', ruleType)
        .update({
          ...updates,
          updated_at: knex.fn.now()
        });
    } else {
      await knex('rule_learning_config')
        .insert({
          rule_type: ruleType,
          ...updates
        });
    }
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig(ruleType) {
    return {
      trigger_mode: 'manual',
      auto_learn_enabled: false,
      min_confidence_threshold: 0.5,
      require_human_review: true,
      enable_feedback_learning: true,
      feedback_weight: 0.3
    };
  }

  /**
   * 更新规则统计（使用次数+1）
   */
  async incrementUsage(ruleId) {
    await knex('design_rules')
      .where('id', ruleId)
      .increment('usage_count', 1)
      .update({
        last_applied_at: knex.fn.now()
      });
  }

  /**
   * 更新规则成功次数
   */
  async incrementSuccess(ruleId) {
    await knex('design_rules')
      .where('id', ruleId)
      .increment('success_count', 1);
  }

  /**
   * 获取规则统计信息
   */
  async getStatistics(ruleType) {
    const stats = await knex('design_rules')
      .where('design_rules.rule_type', ruleType)
      .select(
        knex.raw('COUNT(*) as total'),
        knex.raw('COUNT(*) FILTER (WHERE design_rules.review_status = ?) as pending', ['pending']),
        knex.raw('COUNT(*) FILTER (WHERE design_rules.review_status = ?) as approved', ['approved']),
        knex.raw('COUNT(*) FILTER (WHERE design_rules.is_active = true) as active'),
        knex.raw('AVG(design_rules.confidence_score) as avg_confidence'),
        knex.raw('SUM(design_rules.usage_count) as total_usage'),
        knex.raw('SUM(design_rules.success_count) as total_success')
      )
      .first();

    return {
      ...stats,
      success_rate: stats.total_usage > 0
        ? (stats.total_success / stats.total_usage * 100).toFixed(2)
        : 0
    };
  }
}

module.exports = new UnifiedRuleService();
