const BaseRuleProcessor = require('./BaseRuleProcessor');
const knex = require('../../../config/database');

/**
 * PID规则处理器
 * 复用UnifiedRuleService架构，处理PID组件分类
 */
class PIDRuleProcessor extends BaseRuleProcessor {
  /**
   * 分类组件（复用规则引擎）
   * @param {Array} components - QWEN-VL识别的原始组件
   * @param {Object} legend - 图例信息
   * @returns {Object} - {devices, interfaces, mediums, specs}
   */
  async classifyComponents(components, legend = {}) {
    console.log(`🔍 [PID分类] 开始分类 ${components.length} 个组件...`);

    // 1. 获取PID分类规则
    const rules = await knex('design_rules')
      .where('category_id', 'pid_classification')
      .where('is_active', true)
      .where('review_status', 'approved')
      .orderBy(knex.raw("rule_structure->>'priority'"), 'asc');

    console.log(`✓ 加载 ${rules.length} 条PID分类规则`);

    // 2. 分类结果
    const classified = {
      devices: [],
      interfaces: [],
      mediums: [],
      specs: []
    };

    // 3. 遍历组件，应用规则分类
    for (const comp of components) {
      const category = await this._classifyOne(comp, rules, legend);

      const enriched = {
        ...comp,
        category,
        type: comp.type || comp.symbol_type
      };

      classified[category + 's'].push(enriched);
    }

    console.log(`✅ [PID分类] 设备:${classified.devices.length} 接口:${classified.interfaces.length} 介质:${classified.mediums.length} 规格:${classified.specs.length}`);

    return classified;
  }

  /**
   * 分类单个组件
   */
  async _classifyOne(component, rules, legend) {
    const { tag, type } = component;

    for (const rule of rules) {
      const ruleStruct = typeof rule.rule_structure === 'string'
        ? JSON.parse(rule.rule_structure)
        : rule.rule_structure;

      const { category, method } = ruleStruct;

      try {
        const matches = this._matchRule(method, ruleStruct, tag, type, legend);

        if (matches) {
          console.log(`  ✓ ${tag} → ${category} (${rule.rule_code})`);
          // 记录规则使用
          await this._incrementRuleUsage(rule.id);
          return category;
        }
      } catch (error) {
        console.error(`  ❌ 规则${rule.rule_code}应用失败:`, error.message);
      }
    }

    // 默认分类为device
    return 'device';
  }

  /**
   * 匹配规则（核心分类逻辑）
   */
  _matchRule(method, ruleStruct, tag, type, legend) {
    switch (method) {
      case 'legend_match':
        return this._matchByLegend(tag, type, legend);

      case 'exact_match':
        return ruleStruct.values && ruleStruct.values.includes(tag);

      case 'regex':
        const regex = new RegExp(ruleStruct.pattern);
        return regex.test(tag);

      case 'keyword':
        return this._matchByKeywords(tag, ruleStruct);

      default:
        return false;
    }
  }

  /**
   * 基于图例匹配设备
   */
  _matchByLegend(tag, type, legend) {
    const devicePrefixes = [
      'CV', 'MV', 'RG', 'PT', 'PS', 'MFC', 'NV', 'V\\d+', 'F\\d+', 'PI', 'TI', 'FI'
    ];

    for (const prefix of devicePrefixes) {
      if (new RegExp(`^${prefix}$`).test(tag)) {
        return true;
      }
    }

    if (legend?.devices) {
      return legend.devices.some(dev =>
        dev.symbol_type === type || tag.startsWith(dev.prefix)
      );
    }

    return false;
  }

  /**
   * 基于关键词匹配
   */
  _matchByKeywords(tag, ruleStruct) {
    const { keywords, min_keywords = 1 } = ruleStruct;

    const matchCount = keywords.filter(kw =>
      tag.toUpperCase().includes(kw.toUpperCase())
    ).length;

    return matchCount >= min_keywords;
  }

  /**
   * 记录规则使用次数
   */
  async _incrementRuleUsage(ruleId) {
    try {
      await knex('design_rules')
        .where('id', ruleId)
        .increment('usage_count', 1);
    } catch (error) {
      // 忽略统计错误
    }
  }

  /**
   * 从PID识别结果学习规则（未来功能）
   */
  async learnFromSource(sourceData, config) {
    console.log('⏸  PID规则学习功能待实现');
    return [];
  }

  /**
   * 应用规则到PID设计（标准接口）
   */
  async applyRule(rule, design) {
    const ruleStruct = typeof rule.rule_structure === 'string'
      ? JSON.parse(rule.rule_structure)
      : rule.rule_structure;

    return {
      type: 'pid_classification',
      category: ruleStruct.category,
      method: ruleStruct.method,
      ruleId: rule.id,
      ruleName: rule.rule_name
    };
  }
}

module.exports = PIDRuleProcessor;
