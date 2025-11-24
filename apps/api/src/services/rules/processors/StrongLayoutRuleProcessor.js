/**
 * 强排规则处理器
 * 处理建筑强制排布相关规则：
 * - 建筑间距规则
 * - 日照分析规则
 * - 红线退距规则
 * - 容积率规则
 * - 建筑高度规则
 * - 停车位配置规则
 */

const BaseRuleProcessor = require('./BaseRuleProcessor');

class StrongLayoutRuleProcessor extends BaseRuleProcessor {
  constructor() {
    super();

    // 强排规则子类型
    this.ruleSubTypes = {
      BUILDING_SPACING: 'building_spacing',      // 建筑间距
      SUNLIGHT_ANALYSIS: 'sunlight_analysis',    // 日照分析
      SETBACK: 'setback',                        // 红线退距
      FAR: 'floor_area_ratio',                   // 容积率
      BUILDING_HEIGHT: 'building_height',        // 建筑高度限制
      PARKING: 'parking',                        // 停车配置
      GREEN_RATIO: 'green_ratio',                // 绿地率
      BUILDING_DENSITY: 'building_density',      // 建筑密度
      FIRE_DISTANCE: 'fire_distance',            // 消防间距
    };

    // 规则模式匹配
    this.rulePatterns = {
      // 建筑间距模式
      building_spacing: [
        /建筑间距[不]*[应少低小于]*(\d+(?:\.\d+)?)\s*(米|m)/gi,
        /住宅[与和].*间距.*[不]*[应少低小于]*(\d+(?:\.\d+)?)/gi,
        /高层.*间距.*(\d+(?:\.\d+)?)/gi,
        /多层.*间距.*(\d+(?:\.\d+)?)/gi,
      ],
      // 日照分析模式
      sunlight_analysis: [
        /日照[时间时长]*[不]*[应少低小于]*(\d+(?:\.\d+)?)\s*(小时|h)/gi,
        /满窗日照.*(\d+(?:\.\d+)?)/gi,
        /大寒日.*日照.*(\d+(?:\.\d+)?)/gi,
        /冬至日.*日照.*(\d+(?:\.\d+)?)/gi,
      ],
      // 红线退距模式
      setback: [
        /[退让退距后退][不]*[应少低小于]*(\d+(?:\.\d+)?)\s*(米|m)/gi,
        /道路红线.*退.*(\d+(?:\.\d+)?)/gi,
        /用地红线.*退.*(\d+(?:\.\d+)?)/gi,
        /建筑红线.*(\d+(?:\.\d+)?)/gi,
      ],
      // 容积率模式
      floor_area_ratio: [
        /容积率[不]*[应超大过于]*(\d+(?:\.\d+)?)/gi,
        /FAR[不]*[应超大过于]*(\d+(?:\.\d+)?)/gi,
      ],
      // 建筑高度模式
      building_height: [
        /建筑高度[不]*[应超大过于]*(\d+(?:\.\d+)?)\s*(米|m)/gi,
        /限高.*(\d+(?:\.\d+)?)/gi,
        /最大高度.*(\d+(?:\.\d+)?)/gi,
      ],
      // 停车配置模式
      parking: [
        /停车位[不]*[应少低小于]*(\d+(?:\.\d+)?)\s*(个|辆)/gi,
        /每(\d+).*平.*配.*(\d+).*车位/gi,
        /机动车位.*(\d+(?:\.\d+)?)/gi,
      ],
      // 绿地率模式
      green_ratio: [
        /绿地率[不]*[应少低小于]*(\d+(?:\.\d+)?)\s*%/gi,
        /绿化率[不]*[应少低小于]*(\d+(?:\.\d+)?)/gi,
      ],
      // 建筑密度模式
      building_density: [
        /建筑密度[不]*[应超大过于]*(\d+(?:\.\d+)?)\s*%/gi,
        /覆盖率[不]*[应超大过于]*(\d+(?:\.\d+)?)/gi,
      ],
      // 消防间距模式
      fire_distance: [
        /消防[间距通道].*(\d+(?:\.\d+)?)\s*(米|m)/gi,
        /防火间距.*(\d+(?:\.\d+)?)/gi,
      ],
    };
  }

  /**
   * 从文档/规范中学习强排规则
   * @param {Object} sourceData - 源数据
   * @param {Object} config - 学习配置
   * @returns {Promise<Array>} - 学习到的规则列表
   */
  async learnFromSource(sourceData, config = {}) {
    const rules = [];
    const { text, documentId, documentName } = sourceData;

    if (!text) {
      return rules;
    }

    // 遍历每种规则类型进行匹配
    for (const [subType, patterns] of Object.entries(this.rulePatterns)) {
      for (const pattern of patterns) {
        const matches = text.matchAll(pattern);

        for (const match of matches) {
          const rule = this._buildRuleFromMatch(match, subType, {
            documentId,
            documentName,
            fullText: text,
          });

          if (rule) {
            rules.push(rule);
          }
        }
      }
    }

    // 去重
    return this._deduplicateRules(rules);
  }

  /**
   * 从匹配结果构建规则
   */
  _buildRuleFromMatch(match, subType, context) {
    const matchedText = match[0];
    const value = parseFloat(match[1]);
    const unit = match[2] || '';

    if (isNaN(value)) {
      return null;
    }

    // 获取上下文（前后50个字符）
    const startIdx = Math.max(0, match.index - 50);
    const endIdx = Math.min(context.fullText.length, match.index + matchedText.length + 50);
    const contextText = context.fullText.substring(startIdx, endIdx);

    // 确定约束类型
    const constraintType = this._determineConstraintType(matchedText);

    // 确定适用范围
    const scope = this._determineScope(contextText);

    return {
      rule_type: 'strong_layout',
      sub_type: subType,
      code: `SL_${subType.toUpperCase()}_${Date.now()}`,
      name: this._generateRuleName(subType, value, unit),
      content: matchedText,
      rule_structure: {
        subType,
        constraintType,
        value,
        unit,
        scope,
        conditions: this._extractConditions(contextText),
        exceptions: this._extractExceptions(contextText),
      },
      source: {
        documentId: context.documentId,
        documentName: context.documentName,
        matchedText,
        context: contextText,
      },
      confidence_score: this._calculateConfidence(matchedText, contextText),
      learned_from: 'ai_learning',
      review_status: 'pending',
    };
  }

  /**
   * 确定约束类型
   */
  _determineConstraintType(text) {
    if (/不[应该得能可以]*[小少低于]|[至最]少|[大大于等]*于/.test(text)) {
      return 'MIN';  // 最小值约束
    }
    if (/不[应该得能可以]*[大超高过于]|[至最]多|不得超过/.test(text)) {
      return 'MAX';  // 最大值约束
    }
    if (/[等于为是]/.test(text)) {
      return 'EQUAL';  // 等于约束
    }
    return 'RANGE';  // 范围约束
  }

  /**
   * 确定适用范围
   */
  _determineScope(text) {
    const scope = {
      buildingType: null,    // 建筑类型
      landUseType: null,     // 用地类型
      region: null,          // 区域
      climate: null,         // 气候区
    };

    // 建筑类型
    if (/住宅|居住/.test(text)) scope.buildingType = 'residential';
    else if (/商业|办公/.test(text)) scope.buildingType = 'commercial';
    else if (/工业|厂房/.test(text)) scope.buildingType = 'industrial';
    else if (/公共|公建/.test(text)) scope.buildingType = 'public';

    // 建筑高度类别
    if (/高层/.test(text)) scope.heightCategory = 'high_rise';
    else if (/多层/.test(text)) scope.heightCategory = 'multi_story';
    else if (/低层/.test(text)) scope.heightCategory = 'low_rise';

    return scope;
  }

  /**
   * 提取条件
   */
  _extractConditions(text) {
    const conditions = [];

    // 提取"当...时"类条件
    const whenMatches = text.match(/当(.+?)时/g);
    if (whenMatches) {
      conditions.push(...whenMatches.map(m => m.replace(/当|时/g, '').trim()));
    }

    // 提取"如果...则"类条件
    const ifMatches = text.match(/如果(.+?)则/g);
    if (ifMatches) {
      conditions.push(...ifMatches.map(m => m.replace(/如果|则/g, '').trim()));
    }

    return conditions;
  }

  /**
   * 提取例外情况
   */
  _extractExceptions(text) {
    const exceptions = [];

    // 提取"除...外"类例外
    const exceptMatches = text.match(/除(.+?)外/g);
    if (exceptMatches) {
      exceptions.push(...exceptMatches.map(m => m.replace(/除|外/g, '').trim()));
    }

    // 提取"但..."类例外
    const butMatches = text.match(/但(.+?)[。，]/g);
    if (butMatches) {
      exceptions.push(...butMatches.map(m => m.replace(/但|[。，]/g, '').trim()));
    }

    return exceptions;
  }

  /**
   * 生成规则名称
   */
  _generateRuleName(subType, value, unit) {
    const typeNames = {
      building_spacing: '建筑间距',
      sunlight_analysis: '日照要求',
      setback: '红线退距',
      floor_area_ratio: '容积率',
      building_height: '建筑高度',
      parking: '停车配置',
      green_ratio: '绿地率',
      building_density: '建筑密度',
      fire_distance: '消防间距',
    };

    return `${typeNames[subType] || subType}规则: ${value}${unit}`;
  }

  /**
   * 计算置信度
   */
  _calculateConfidence(matchedText, contextText) {
    let confidence = 0.5;  // 基础置信度

    // 有明确数值提高置信度
    if (/\d+(?:\.\d+)?/.test(matchedText)) {
      confidence += 0.2;
    }

    // 有明确单位提高置信度
    if (/米|m|%|小时|h|个|辆/.test(matchedText)) {
      confidence += 0.1;
    }

    // 上下文包含规范性词语提高置信度
    if (/应当|必须|不得|严禁|规定|要求/.test(contextText)) {
      confidence += 0.15;
    }

    // 有来源引用提高置信度
    if (/GB|JGJ|CJJ|DB|规范|标准/.test(contextText)) {
      confidence += 0.05;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * 规则去重
   */
  _deduplicateRules(rules) {
    const seen = new Map();

    return rules.filter(rule => {
      const key = `${rule.sub_type}_${rule.rule_structure.value}_${rule.rule_structure.constraintType}`;
      if (seen.has(key)) {
        // 保留置信度更高的
        const existing = seen.get(key);
        if (rule.confidence_score > existing.confidence_score) {
          seen.set(key, rule);
          return true;
        }
        return false;
      }
      seen.set(key, rule);
      return true;
    });
  }

  /**
   * 应用规则到设计
   * @param {Object} rule - 规则对象
   * @param {Object} design - 设计数据（包含建筑布局信息）
   * @returns {Promise<Object>} - 应用结果
   */
  async applyRule(rule, design) {
    const { rule_structure } = rule;
    const { subType, constraintType, value } = rule_structure;

    const result = {
      ruleId: rule.id,
      ruleName: rule.name,
      passed: true,
      violations: [],
      suggestions: [],
    };

    // 根据规则类型进行检查
    switch (subType) {
      case 'building_spacing':
        this._checkBuildingSpacing(design, value, constraintType, result);
        break;
      case 'setback':
        this._checkSetback(design, value, constraintType, result);
        break;
      case 'building_height':
        this._checkBuildingHeight(design, value, constraintType, result);
        break;
      case 'floor_area_ratio':
        this._checkFAR(design, value, constraintType, result);
        break;
      case 'green_ratio':
        this._checkGreenRatio(design, value, constraintType, result);
        break;
      case 'building_density':
        this._checkBuildingDensity(design, value, constraintType, result);
        break;
      default:
        result.suggestions.push(`规则类型 ${subType} 暂不支持自动检查`);
    }

    return result;
  }

  /**
   * 检查建筑间距
   */
  _checkBuildingSpacing(design, minSpacing, constraintType, result) {
    if (!design.buildings || design.buildings.length < 2) {
      return;
    }

    for (let i = 0; i < design.buildings.length; i++) {
      for (let j = i + 1; j < design.buildings.length; j++) {
        const spacing = this._calculateDistance(design.buildings[i], design.buildings[j]);

        if (constraintType === 'MIN' && spacing < minSpacing) {
          result.passed = false;
          result.violations.push({
            type: 'building_spacing',
            message: `建筑 ${i + 1} 与建筑 ${j + 1} 间距 ${spacing.toFixed(2)}m 小于最小要求 ${minSpacing}m`,
            buildings: [i, j],
            currentValue: spacing,
            requiredValue: minSpacing,
          });
        }
      }
    }
  }

  /**
   * 检查红线退距
   */
  _checkSetback(design, minSetback, constraintType, result) {
    if (!design.buildings || !design.redLine) {
      return;
    }

    design.buildings.forEach((building, idx) => {
      const setback = this._calculateSetback(building, design.redLine);

      if (constraintType === 'MIN' && setback < minSetback) {
        result.passed = false;
        result.violations.push({
          type: 'setback',
          message: `建筑 ${idx + 1} 红线退距 ${setback.toFixed(2)}m 小于最小要求 ${minSetback}m`,
          building: idx,
          currentValue: setback,
          requiredValue: minSetback,
        });
      }
    });
  }

  /**
   * 检查建筑高度
   */
  _checkBuildingHeight(design, maxHeight, constraintType, result) {
    if (!design.buildings) {
      return;
    }

    design.buildings.forEach((building, idx) => {
      if (constraintType === 'MAX' && building.height > maxHeight) {
        result.passed = false;
        result.violations.push({
          type: 'building_height',
          message: `建筑 ${idx + 1} 高度 ${building.height}m 超过最大限制 ${maxHeight}m`,
          building: idx,
          currentValue: building.height,
          requiredValue: maxHeight,
        });
      }
    });
  }

  /**
   * 检查容积率
   */
  _checkFAR(design, maxFAR, constraintType, result) {
    if (!design.totalFloorArea || !design.landArea) {
      return;
    }

    const currentFAR = design.totalFloorArea / design.landArea;

    if (constraintType === 'MAX' && currentFAR > maxFAR) {
      result.passed = false;
      result.violations.push({
        type: 'floor_area_ratio',
        message: `当前容积率 ${currentFAR.toFixed(2)} 超过最大限制 ${maxFAR}`,
        currentValue: currentFAR,
        requiredValue: maxFAR,
      });
    }
  }

  /**
   * 检查绿地率
   */
  _checkGreenRatio(design, minGreenRatio, constraintType, result) {
    if (!design.greenArea || !design.landArea) {
      return;
    }

    const currentRatio = (design.greenArea / design.landArea) * 100;

    if (constraintType === 'MIN' && currentRatio < minGreenRatio) {
      result.passed = false;
      result.violations.push({
        type: 'green_ratio',
        message: `当前绿地率 ${currentRatio.toFixed(2)}% 小于最小要求 ${minGreenRatio}%`,
        currentValue: currentRatio,
        requiredValue: minGreenRatio,
      });
    }
  }

  /**
   * 检查建筑密度
   */
  _checkBuildingDensity(design, maxDensity, constraintType, result) {
    if (!design.buildingFootprint || !design.landArea) {
      return;
    }

    const currentDensity = (design.buildingFootprint / design.landArea) * 100;

    if (constraintType === 'MAX' && currentDensity > maxDensity) {
      result.passed = false;
      result.violations.push({
        type: 'building_density',
        message: `当前建筑密度 ${currentDensity.toFixed(2)}% 超过最大限制 ${maxDensity}%`,
        currentValue: currentDensity,
        requiredValue: maxDensity,
      });
    }
  }

  /**
   * 计算两个建筑之间的距离
   */
  _calculateDistance(building1, building2) {
    const dx = building1.x - building2.x;
    const dy = building1.y - building2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 计算建筑到红线的距离
   */
  _calculateSetback(building, redLine) {
    // 简化计算：取建筑边界到红线的最小距离
    // 实际应用中需要更复杂的几何计算
    if (!redLine || !building.bounds) {
      return Infinity;
    }

    // 这里返回模拟值，实际需要几何库计算
    return building.setback || 0;
  }

  /**
   * 根据上下文过滤适用规则
   */
  async filterByContext(query, context) {
    // 按建筑类型过滤
    if (context.buildingType) {
      query = query.whereRaw(
        `rule_structure->'scope'->>'buildingType' = ? OR rule_structure->'scope'->>'buildingType' IS NULL`,
        [context.buildingType]
      );
    }

    // 按高度类别过滤
    if (context.heightCategory) {
      query = query.whereRaw(
        `rule_structure->'scope'->>'heightCategory' = ? OR rule_structure->'scope'->>'heightCategory' IS NULL`,
        [context.heightCategory]
      );
    }

    return await query;
  }
}

module.exports = StrongLayoutRuleProcessor;
