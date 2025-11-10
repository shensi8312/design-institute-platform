const BaseRuleProcessor = require('./BaseRuleProcessor');

/**
 * PID规则处理器（占位实现，二期开发）
 */
class PIDRuleProcessor extends BaseRuleProcessor {
  async learnFromSource(sourceData, config) {
    // 二期实现：从OCR识别结果学习PID规则
    console.log('⏸  PID规则学习功能待二期实现');
    return [];
  }

  async applyRule(rule, design) {
    return {
      type: 'pid',
      message: 'PID规则应用待实现'
    };
  }
}

module.exports = PIDRuleProcessor;
