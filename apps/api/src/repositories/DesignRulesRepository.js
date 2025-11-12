const BaseRepository = require('./BaseRepository')

/**
 * 设计规则 Repository
 * 支持多种规则类型：building/assembly/pid/process
 */
class DesignRulesRepository extends BaseRepository {
  constructor() {
    super('design_rules')
  }

  /**
   * 根据分类查询规则
   * @param {string} categoryId - 规则分类ID
   * @param {Object} additionalConditions - 额外条件
   * @returns {Array} 规则列表
   */
  async findByCategory(categoryId, additionalConditions = {}) {
    return await this.findAll({
      category_id: categoryId,
      ...additionalConditions
    }, {
      orderBy: 'sort_order',
      order: 'asc'
    })
  }

  /**
   * 根据规则类型查询
   * @param {string} ruleType - 规则类型 (building/assembly/pid/process)
   * @param {Object} additionalConditions - 额外条件
   * @returns {Array} 规则列表
   */
  async findByType(ruleType, additionalConditions = {}) {
    return await this.findAll({
      rule_type: ruleType,
      ...additionalConditions
    })
  }

  /**
   * 根据规则编码查询
   * @param {string} ruleCode - 规则编码
   * @returns {Object|null} 规则对象
   */
  async findByCode(ruleCode) {
    return await this.findOne({ rule_code: ruleCode })
  }

  /**
   * 查询激活的规则
   * @param {Object} filters - 过滤条件
   * @returns {Array} 规则列表
   */
  async findActive(filters = {}) {
    return await this.findAll({
      is_active: true,
      review_status: 'approved',
      ...filters
    })
  }

  /**
   * 增加规则使用次数
   * @param {string} ruleId - 规则ID
   * @returns {Object} 更新结果
   */
  async incrementUsageCount(ruleId) {
    const rule = await this.findById(ruleId)
    if (!rule) {
      return { success: false, message: '规则不存在' }
    }

    return await this.update(ruleId, {
      usage_count: (rule.usage_count || 0) + 1,
      last_applied_at: new Date()
    }, false)
  }

  /**
   * 增加规则成功次数
   * @param {string} ruleId - 规则ID
   * @returns {Object} 更新结果
   */
  async incrementSuccessCount(ruleId) {
    const rule = await this.findById(ruleId)
    if (!rule) {
      return { success: false, message: '规则不存在' }
    }

    return await this.update(ruleId, {
      success_count: (rule.success_count || 0) + 1,
      usage_count: (rule.usage_count || 0) + 1,
      last_applied_at: new Date()
    }, false)
  }

  /**
   * 更新规则置信度
   * @param {string} ruleId - 规则ID
   * @param {number} newConfidence - 新的置信度 (0-1)
   * @returns {Object} 更新结果
   */
  async updateConfidence(ruleId, newConfidence) {
    if (newConfidence < 0 || newConfidence > 1) {
      return { success: false, message: '置信度必须在0-1之间' }
    }

    return await this.update(ruleId, {
      confidence_score: newConfidence
    }, false)
  }

  /**
   * 搜索规则
   * @param {string} keyword - 搜索关键词
   * @param {Object} filters - 过滤条件
   * @returns {Array} 规则列表
   */
  async searchRules(keyword, filters = {}) {
    return await this.search(
      keyword,
      ['rule_name', 'rule_code', 'rule_content'],
      filters
    )
  }

  /**
   * 获取规则统计信息
   * @param {string} categoryId - 分类ID (可选)
   * @returns {Object} 统计信息
   */
  async getStatistics(categoryId = null) {
    let query = this.db(this.tableName)

    if (categoryId) {
      query = query.where('category_id', categoryId)
    }

    const stats = await query
      .select(
        this.db.raw('COUNT(*) as total'),
        this.db.raw('COUNT(CASE WHEN is_active = true THEN 1 END) as active_count'),
        this.db.raw('COUNT(CASE WHEN review_status = \'approved\' THEN 1 END) as approved_count'),
        this.db.raw('COUNT(CASE WHEN review_status = \'pending\' THEN 1 END) as pending_count'),
        this.db.raw('AVG(confidence_score) as avg_confidence'),
        this.db.raw('SUM(usage_count) as total_usage'),
        this.db.raw('SUM(success_count) as total_success')
      )
      .first()

    return {
      total: parseInt(stats.total) || 0,
      active: parseInt(stats.active_count) || 0,
      approved: parseInt(stats.approved_count) || 0,
      pending: parseInt(stats.pending_count) || 0,
      avgConfidence: parseFloat(stats.avg_confidence) || 0,
      totalUsage: parseInt(stats.total_usage) || 0,
      totalSuccess: parseInt(stats.total_success) || 0,
      successRate: stats.total_usage > 0
        ? (parseInt(stats.total_success) / parseInt(stats.total_usage) * 100).toFixed(2)
        : 0
    }
  }

  /**
   * 根据优先级查询规则
   * @param {string} priority - 优先级 (critical/high/normal/low)
   * @param {Object} additionalConditions - 额外条件
   * @returns {Array} 规则列表
   */
  async findByPriority(priority, additionalConditions = {}) {
    return await this.findAll({
      priority: priority,
      is_active: true,
      ...additionalConditions
    }, {
      orderBy: 'sort_order',
      order: 'asc'
    })
  }

  /**
   * 获取规则的依赖关系
   * @param {string} ruleId - 规则ID
   * @returns {Object} 依赖关系 {dependencies: [], dependents: []}
   */
  async getRuleDependencies(ruleId) {
    // 获取此规则依赖的规则
    const dependencies = await this.db('rule_relationships')
      .join('design_rules', 'rule_relationships.target_rule_id', 'design_rules.id')
      .where('rule_relationships.source_rule_id', ruleId)
      .select('design_rules.*', 'rule_relationships.relationship_type')

    // 获取依赖此规则的规则
    const dependents = await this.db('rule_relationships')
      .join('design_rules', 'rule_relationships.source_rule_id', 'design_rules.id')
      .where('rule_relationships.target_rule_id', ruleId)
      .select('design_rules.*', 'rule_relationships.relationship_type')

    return {
      dependencies,
      dependents
    }
  }

  /**
   * 批量更新规则状态
   * @param {Array} ruleIds - 规则ID数组
   * @param {boolean} isActive - 是否激活
   * @returns {Object} 更新结果
   */
  async batchUpdateStatus(ruleIds, isActive) {
    return await this.transaction(async (trx) => {
      const count = await trx(this.tableName)
        .whereIn('id', ruleIds)
        .update({
          is_active: isActive,
          updated_at: new Date()
        })

      return { success: true, count }
    })
  }

  /**
   * 获取待审核的规则
   * @param {number} limit - 限制数量
   * @returns {Array} 规则列表
   */
  async getPendingReview(limit = 50) {
    return await this.findAll({
      review_status: 'pending'
    }, {
      orderBy: 'created_at',
      order: 'asc',
      limit
    })
  }

  /**
   * 审核规则
   * @param {string} ruleId - 规则ID
   * @param {string} status - 审核状态 (approved/rejected)
   * @param {string} reviewedBy - 审核人ID
   * @param {string} comment - 审核意见
   * @returns {Object} 更新结果
   */
  async reviewRule(ruleId, status, reviewedBy, comment = '') {
    if (!['approved', 'rejected'].includes(status)) {
      return { success: false, message: '无效的审核状态' }
    }

    return await this.update(ruleId, {
      review_status: status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date(),
      review_comment: comment
    })
  }

  /**
   * 获取最常用的规则
   * @param {number} limit - 限制数量
   * @param {Object} filters - 过滤条件
   * @returns {Array} 规则列表
   */
  async getMostUsed(limit = 10, filters = {}) {
    return await this.findAll(filters, {
      orderBy: 'usage_count',
      order: 'desc',
      limit
    })
  }

  /**
   * 获取成功率最高的规则
   * @param {number} limit - 限制数量
   * @param {number} minUsage - 最小使用次数阈值
   * @returns {Array} 规则列表
   */
  async getHighestSuccessRate(limit = 10, minUsage = 5) {
    return await this.db(this.tableName)
      .select('*')
      .where('usage_count', '>=', minUsage)
      .whereRaw('success_count::float / usage_count::float > 0.8')
      .orderByRaw('success_count::float / usage_count::float DESC')
      .limit(limit)
  }
}

module.exports = DesignRulesRepository
