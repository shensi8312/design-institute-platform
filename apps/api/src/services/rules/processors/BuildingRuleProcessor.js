const BaseRuleProcessor = require('./BaseRuleProcessor');

/**
 * 建筑规范处理器（占位实现，二期开发）
 */
class BuildingRuleProcessor extends BaseRuleProcessor {
  async learnFromSource(sourceData, config) {
    // 二期实现：从PDF/Word文档LLM提取建筑规范
    console.log('⏸  建筑规范学习功能待二期实现');
    return [];
  }

  async applyRule(rule, design) {
    return {
      type: 'building',
      message: '建筑规范应用待实现'
    };
  }
}

module.exports = BuildingRuleProcessor;
