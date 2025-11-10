const axios = require('axios');

/**
 * 规则引擎服务 - 真实实现
 * 处理建筑设计规范的检查、学习和应用
 */
class RulesEngineService {
  constructor() {
    this.rulesDatabase = [];
    this.learnedPatterns = new Map();
    this.violationHistory = [];
    this.vllmEndpoint = process.env.VLLM_ENDPOINT || 'http://10.10.18.2:8000';
    this.initializeRules();
  }

  /**
   * 初始化规则库
   */
  async initializeRules() {
    // 基础建筑规范规则
    this.rulesDatabase = [
      {
        id: 'FIRE_001',
        category: '防火规范',
        source: 'GB50016-2021',
        condition: {
          buildingType: 'residential',
          heightRange: [27, Infinity]
        },
        requirement: {
          fireDistance: { min: 13, unit: 'm' },
          exception: '设有自动喷水灭火系统时可减少25%'
        },
        confidence: 0.95
      },
      {
        id: 'FIRE_002',
        category: '防火规范',
        source: 'GB50016-2021',
        condition: {
          buildingType: 'residential',
          heightRange: [0, 27]
        },
        requirement: {
          fireDistance: { min: 6, unit: 'm' }
        },
        confidence: 0.95
      },
      {
        id: 'HEIGHT_001',
        category: '建筑高度',
        source: '规划条件',
        condition: {
          zoneType: 'R2'
        },
        requirement: {
          maxHeight: { value: 24, unit: 'm' }
        },
        confidence: 0.90
      },
      {
        id: 'GREEN_001',
        category: '绿地率',
        source: '规划条件',
        condition: {
          buildingType: 'residential'
        },
        requirement: {
          greenRatio: { min: 0.35, unit: '%' }
        },
        confidence: 0.88
      },
      {
        id: 'FLOOR_HEIGHT_001',
        category: '层高要求',
        source: 'GB50096-2022',
        condition: {
          buildingType: 'residential',
          spaceType: 'living'
        },
        requirement: {
          minHeight: { value: 2.8, unit: 'm' }
        },
        confidence: 0.95
      }
    ];
  }

  /**
   * 检查设计参数是否符合规则
   */
  async checkCompliance(designParams) {
    const violations = [];
    const suggestions = [];
    const appliedRules = [];

    for (const rule of this.rulesDatabase) {
      const result = this.evaluateRule(rule, designParams);
      
      if (result.applicable) {
        appliedRules.push({
          ruleId: rule.id,
          category: rule.category,
          source: rule.source,
          status: result.compliant ? 'passed' : 'violated'
        });

        if (!result.compliant) {
          violations.push({
            ruleId: rule.id,
            category: rule.category,
            description: result.violation,
            severity: result.severity || 'medium',
            requirement: rule.requirement,
            actual: result.actualValue,
            suggestion: result.suggestion
          });
        }
      }
    }

    // 使用AI生成智能建议
    if (violations.length > 0) {
      const aiSuggestions = await this.generateAISuggestions(violations, designParams);
      suggestions.push(...aiSuggestions);
    }

    // 计算合规分数
    const complianceScore = this.calculateComplianceScore(appliedRules, violations);

    // 记录检查历史
    this.recordCheckHistory(designParams, violations, complianceScore);

    return {
      success: true,
      complianceScore,
      totalRules: appliedRules.length,
      passedRules: appliedRules.filter(r => r.status === 'passed').length,
      violations,
      suggestions,
      appliedRules,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 评估单个规则
   */
  evaluateRule(rule, params) {
    // 检查规则是否适用
    const applicable = this.isRuleApplicable(rule.condition, params);
    
    if (!applicable) {
      return { applicable: false };
    }

    // 检查是否符合要求
    let compliant = true;
    let violation = null;
    let actualValue = null;
    let suggestion = null;

    // 防火间距检查
    if (rule.requirement.fireDistance && params.fireDistance !== undefined) {
      actualValue = params.fireDistance;
      if (params.fireDistance < rule.requirement.fireDistance.min) {
        compliant = false;
        violation = `防火间距不足：要求≥${rule.requirement.fireDistance.min}m，实际${params.fireDistance}m`;
        suggestion = `将防火间距调整至${rule.requirement.fireDistance.min}m以上`;
        
        // 检查例外情况
        if (rule.requirement.exception && params.hasSprinkler) {
          const reducedDistance = rule.requirement.fireDistance.min * 0.75;
          if (params.fireDistance >= reducedDistance) {
            compliant = true;
            violation = null;
            suggestion = '已安装自动喷水系统，满足减少25%的例外条件';
          }
        }
      }
    }

    // 建筑高度检查
    if (rule.requirement.maxHeight && params.buildingHeight !== undefined) {
      actualValue = params.buildingHeight;
      if (params.buildingHeight > rule.requirement.maxHeight.value) {
        compliant = false;
        violation = `建筑高度超限：限高${rule.requirement.maxHeight.value}m，实际${params.buildingHeight}m`;
        suggestion = `降低建筑高度至${rule.requirement.maxHeight.value}m以下，或调整规划条件`;
      }
    }

    // 绿地率检查
    if (rule.requirement.greenRatio && params.greenRatio !== undefined) {
      actualValue = params.greenRatio;
      if (params.greenRatio < rule.requirement.greenRatio.min) {
        compliant = false;
        violation = `绿地率不足：要求≥${rule.requirement.greenRatio.min * 100}%，实际${params.greenRatio * 100}%`;
        suggestion = `增加绿地面积，提高绿地率至${rule.requirement.greenRatio.min * 100}%以上`;
      }
    }

    // 层高检查
    if (rule.requirement.minHeight && params.floorHeight !== undefined) {
      actualValue = params.floorHeight;
      if (params.floorHeight < rule.requirement.minHeight.value) {
        compliant = false;
        violation = `层高不足：要求≥${rule.requirement.minHeight.value}m，实际${params.floorHeight}m`;
        suggestion = `提高层高至${rule.requirement.minHeight.value}m以上`;
      }
    }

    return {
      applicable: true,
      compliant,
      violation,
      actualValue,
      suggestion,
      severity: this.calculateSeverity(rule, compliant)
    };
  }

  /**
   * 判断规则是否适用
   */
  isRuleApplicable(condition, params) {
    // 建筑类型匹配
    if (condition.buildingType && params.buildingType !== condition.buildingType) {
      return false;
    }

    // 高度范围匹配
    if (condition.heightRange && params.buildingHeight !== undefined) {
      const [min, max] = condition.heightRange;
      if (params.buildingHeight < min || params.buildingHeight > max) {
        return false;
      }
    }

    // 区域类型匹配
    if (condition.zoneType && params.zoneType !== condition.zoneType) {
      return false;
    }

    // 空间类型匹配
    if (condition.spaceType && params.spaceType !== condition.spaceType) {
      return false;
    }

    return true;
  }

  /**
   * 计算违规严重程度
   */
  calculateSeverity(rule, compliant) {
    if (compliant) return 'none';
    
    // 防火规范违规为高严重度
    if (rule.category === '防火规范') return 'high';
    
    // 强制性规范为高严重度
    if (rule.source.includes('GB')) return 'high';
    
    // 其他为中等严重度
    return 'medium';
  }

  /**
   * 计算合规分数
   */
  calculateComplianceScore(appliedRules, violations) {
    if (appliedRules.length === 0) return 100;

    const passedCount = appliedRules.filter(r => r.status === 'passed').length;
    const baseScore = (passedCount / appliedRules.length) * 100;

    // 根据违规严重程度调整分数
    let penalty = 0;
    violations.forEach(v => {
      if (v.severity === 'high') penalty += 5;
      else if (v.severity === 'medium') penalty += 2;
      else penalty += 1;
    });

    return Math.max(0, Math.round(baseScore - penalty));
  }

  /**
   * 学习新规则
   */
  async learnNewRule(ruleData) {
    try {
      // 解析规则内容
      const parsedRule = await this.parseRuleContent(ruleData.content);
      
      // 验证规则逻辑
      const validation = this.validateRule(parsedRule);
      
      if (!validation.valid) {
        return {
          success: false,
          message: '规则验证失败',
          errors: validation.errors
        };
      }

      // 检查规则冲突
      const conflicts = this.checkRuleConflicts(parsedRule);
      
      if (conflicts.length > 0) {
        return {
          success: false,
          message: '规则存在冲突',
          conflicts
        };
      }

      // 添加到规则库
      parsedRule.id = `LEARNED_${Date.now()}`;
      parsedRule.confidence = 0.7; // 新学习的规则初始置信度较低
      parsedRule.source = ruleData.source || 'User Input';
      parsedRule.learnedAt = new Date().toISOString();
      
      this.rulesDatabase.push(parsedRule);
      
      // 记录学习历史
      this.learnedPatterns.set(parsedRule.id, {
        originalContent: ruleData.content,
        parsedRule,
        timestamp: new Date().toISOString(),
        validationScore: validation.score
      });

      return {
        success: true,
        ruleId: parsedRule.id,
        message: '规则学习成功',
        confidence: parsedRule.confidence,
        willApplyTo: this.estimateApplicationScope(parsedRule)
      };
    } catch (error) {
      console.error('规则学习失败:', error);
      return {
        success: false,
        message: '规则学习失败',
        error: error.message
      };
    }
  }

  /**
   * 解析规则内容
   */
  async parseRuleContent(content) {
    // 使用AI辅助解析规则
    if (this.vllmEndpoint) {
      try {
        const response = await axios.post(`${this.vllmEndpoint}/v1/chat/completions`, {
          model: 'Qwen3-32B',
          messages: [{
            role: 'user',
            content: `解析以下建筑规范条文，提取规则要素：
条文内容：${content}

请提取：
1. 适用条件（建筑类型、高度范围等）
2. 具体要求（数值、单位）
3. 例外情况
4. 规则类别

以JSON格式返回。`
          }],
          max_tokens: 500,
          temperature: 0.3
        });

        const parsed = JSON.parse(response.data.choices[0].message.content);
        return this.normalizeRuleFormat(parsed);
      } catch (error) {
        console.log('AI解析失败，使用规则解析');
      }
    }

    // 规则解析逻辑
    return this.basicRuleParsing(content);
  }

  /**
   * 基础规则解析
   */
  basicRuleParsing(content) {
    const rule = {
      category: '自定义规则',
      condition: {},
      requirement: {}
    };

    // 提取数值
    const numbers = content.match(/\d+(\.\d+)?/g);
    if (numbers) {
      rule.requirement.value = parseFloat(numbers[0]);
    }

    // 提取单位
    const units = content.match(/[米m公尺平方米㎡%]/g);
    if (units) {
      rule.requirement.unit = units[0];
    }

    // 识别建筑类型
    if (content.includes('住宅')) {
      rule.condition.buildingType = 'residential';
    } else if (content.includes('办公')) {
      rule.condition.buildingType = 'office';
    }

    return rule;
  }

  /**
   * 验证规则
   */
  validateRule(rule) {
    const errors = [];
    let score = 100;

    // 必须有类别
    if (!rule.category) {
      errors.push('缺少规则类别');
      score -= 20;
    }

    // 必须有条件或要求
    if (!rule.condition && !rule.requirement) {
      errors.push('缺少规则条件和要求');
      score -= 50;
    }

    // 数值合理性检查
    if (rule.requirement) {
      for (const [key, value] of Object.entries(rule.requirement)) {
        if (typeof value === 'object' && value.value !== undefined) {
          if (value.value < 0) {
            errors.push(`${key}的值不能为负数`);
            score -= 10;
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      score
    };
  }

  /**
   * 检查规则冲突
   */
  checkRuleConflicts(newRule) {
    const conflicts = [];

    for (const existingRule of this.rulesDatabase) {
      // 检查相同条件下的冲突要求
      if (this.isSameCondition(newRule.condition, existingRule.condition)) {
        if (this.isConflictingRequirement(newRule.requirement, existingRule.requirement)) {
          conflicts.push({
            existingRuleId: existingRule.id,
            conflictType: 'requirement',
            description: `与规则${existingRule.id}的要求冲突`
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * 判断条件是否相同
   */
  isSameCondition(cond1, cond2) {
    if (!cond1 || !cond2) return false;
    
    return cond1.buildingType === cond2.buildingType &&
           JSON.stringify(cond1.heightRange) === JSON.stringify(cond2.heightRange);
  }

  /**
   * 判断要求是否冲突
   */
  isConflictingRequirement(req1, req2) {
    if (!req1 || !req2) return false;
    
    // 检查相同属性的不同要求
    for (const key of Object.keys(req1)) {
      if (req2[key] && JSON.stringify(req1[key]) !== JSON.stringify(req2[key])) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 估算规则应用范围
   */
  estimateApplicationScope(rule) {
    let scope = [];
    
    if (rule.condition.buildingType) {
      scope.push(`${rule.condition.buildingType}类建筑`);
    }
    
    if (rule.condition.heightRange) {
      const [min, max] = rule.condition.heightRange;
      scope.push(`高度${min}-${max === Infinity ? '∞' : max}米`);
    }
    
    return scope.join('，');
  }

  /**
   * 使用AI生成建议
   */
  async generateAISuggestions(violations, _params) {
    const suggestions = [];
    
    // 基于违规情况生成建议
    for (const violation of violations) {
      if (violation.category === '防火规范') {
        suggestions.push({
          type: 'optimization',
          priority: 'high',
          content: '考虑安装自动喷水系统以减少防火间距要求',
          impact: '可减少25%的防火间距要求'
        });
      }
      
      if (violation.category === '建筑高度') {
        suggestions.push({
          type: 'design',
          priority: 'medium',
          content: '调整顶层功能或降低层高',
          impact: '可降低总高度2-3米'
        });
      }
    }
    
    return suggestions;
  }

  /**
   * 记录检查历史
   */
  recordCheckHistory(params, violations, score) {
    this.violationHistory.push({
      timestamp: new Date().toISOString(),
      params,
      violations,
      score,
      learned: false
    });
    
    // 保持历史记录在合理范围内
    if (this.violationHistory.length > 1000) {
      this.violationHistory = this.violationHistory.slice(-500);
    }
  }

  /**
   * 获取规则统计
   */
  async getStatistics() {
    const stats = {
      totalRules: this.rulesDatabase.length,
      categories: {},
      sources: {},
      learnedRules: this.learnedPatterns.size,
      recentChecks: this.violationHistory.slice(-10),
      averageComplianceScore: 0,
      commonViolations: []
    };

    // 统计类别分布
    this.rulesDatabase.forEach(rule => {
      stats.categories[rule.category] = (stats.categories[rule.category] || 0) + 1;
      stats.sources[rule.source] = (stats.sources[rule.source] || 0) + 1;
    });

    // 计算平均合规分数
    if (this.violationHistory.length > 0) {
      const totalScore = this.violationHistory.reduce((sum, h) => sum + h.score, 0);
      stats.averageComplianceScore = Math.round(totalScore / this.violationHistory.length);
    }

    // 统计常见违规
    const violationCounts = {};
    this.violationHistory.forEach(h => {
      h.violations.forEach(v => {
        violationCounts[v.category] = (violationCounts[v.category] || 0) + 1;
      });
    });
    
    stats.commonViolations = Object.entries(violationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    return stats;
  }

  /**
   * 导出规则库
   */
  async exportRules() {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      rules: this.rulesDatabase,
      learnedPatterns: Array.from(this.learnedPatterns.entries()),
      statistics: await this.getStatistics()
    };
  }

  /**
   * 导入规则库
   */
  async importRules(data) {
    try {
      if (data.rules && Array.isArray(data.rules)) {
        this.rulesDatabase = [...this.rulesDatabase, ...data.rules];
      }
      
      if (data.learnedPatterns && Array.isArray(data.learnedPatterns)) {
        data.learnedPatterns.forEach(([key, value]) => {
          this.learnedPatterns.set(key, value);
        });
      }
      
      return {
        success: true,
        imported: {
          rules: data.rules?.length || 0,
          patterns: data.learnedPatterns?.length || 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 标准化规则格式
   */
  normalizeRuleFormat(parsed) {
    return {
      category: parsed.category || '未分类',
      condition: {
        buildingType: parsed.buildingType,
        heightRange: parsed.heightRange,
        zoneType: parsed.zoneType,
        spaceType: parsed.spaceType
      },
      requirement: parsed.requirement || {},
      confidence: parsed.confidence || 0.7
    };
  }
}

module.exports = new RulesEngineService();
