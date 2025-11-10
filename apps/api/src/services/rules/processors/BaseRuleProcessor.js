/**
 * 规则处理器基类
 * 所有业务规则处理器必须实现这些方法
 */
class BaseRuleProcessor {
  /**
   * 从源数据学习规则（子类必须实现）
   * @param {Object} sourceData - 源数据（如STEP文件、图纸、文档等）
   * @param {Object} config - 学习配置
   * @returns {Promise<Array>} - 学习到的规则列表
   */
  async learnFromSource(sourceData, config) {
    throw new Error('子类必须实现 learnFromSource 方法');
  }

  /**
   * 根据上下文过滤适用规则（子类实现）
   * @param {Object} query - Knex查询对象
   * @param {Object} context - 应用上下文
   * @returns {Promise<Array>} - 过滤后的规则
   */
  async filterByContext(query, context) {
    // 默认不过滤，返回所有
    return await query;
  }

  /**
   * 应用规则到设计（子类实现）
   * @param {Object} rule - 规则对象
   * @param {Object} design - 设计数据
   * @returns {Promise<Object>} - 应用结果
   */
  async applyRule(rule, design) {
    throw new Error('子类必须实现 applyRule 方法');
  }

  /**
   * 验证规则格式（可选实现）
   */
  validateRule(rule) {
    if (!rule.name || !rule.code || !rule.content) {
      throw new Error('规则必须包含 name, code, content 字段');
    }
    return true;
  }
}

module.exports = BaseRuleProcessor;
