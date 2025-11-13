const knex = require('../../config/database');

/**
 * 自动装配生成服务
 * 基于BOM和历史学习规则自动生成装配约束
 */
class AutoAssemblyGenerator {
  /**
   * 从BOM和历史规则生成装配
   * @param {Array} bomData - BOM数据
   * @param {Object} options - 选项 {useSTEP: boolean, minConfidence: number}
   * @returns {Object} - 生成的装配数据
   */
  async generateFromBOM(bomData, options = {}) {
    const { useSTEP = false, minConfidence = 0.5 } = options;

    console.log(`🤖 [自动装配] 基于BOM生成装配...`);
    console.log(`  零件数: ${bomData.length}, 最小置信度: ${minConfidence}`);

    // 1. 加载所有学习规则
    const rules = await this._loadLearnedRules(minConfidence);
    console.log(`  ✓ 加载 ${rules.length} 条历史规则`);

    // 2. 匹配规则并生成约束
    const constraints = await this._matchRulesAndGenerate(bomData, rules);
    console.log(`  ✓ 生成 ${constraints.length} 个装配约束`);

    // 3. 构建装配图
    const assembly = this._buildAssemblyStructure(bomData, constraints);

    console.log(`✅ [自动装配] 完成`);

    return {
      parts: bomData,
      constraints,
      stats: {
        partCount: bomData.length,
        constraintCount: constraints.length,
        rulesUsed: this._getUniqueRuleIds(constraints).length,
        avgConfidence: this._calculateAvgConfidence(constraints)
      },
      assembly
    };
  }

  /**
   * 加载学习规则
   */
  async _loadLearnedRules(minConfidence) {
    return await knex('assembly_rules')
      .where('is_active', true)
      .where('confidence', '>=', minConfidence)
      .whereIn('source', ['pid_topology', 'bom_matching', 'step_geometry'])
      .orderBy('priority', 'desc')
      .orderBy('confidence', 'desc');
  }

  /**
   * 匹配规则并生成约束
   */
  async _matchRulesAndGenerate(bomData, rules) {
    const constraints = [];
    const partMap = new Map(bomData.map(p => [p.partNumber, p]));

    for (const rule of rules) {
      const ruleLogic = typeof rule.condition_logic === 'string'
        ? JSON.parse(rule.condition_logic)
        : rule.condition_logic;

      const ruleAction = typeof rule.action_template === 'string'
        ? JSON.parse(rule.action_template)
        : rule.action_template;

      // 尝试在BOM中找到匹配的零件对
      const matches = this._findMatchingParts(bomData, ruleLogic, partMap);

      matches.forEach(match => {
        constraints.push({
          constraintType: rule.constraint_type,
          part1: match.part1.partNumber,
          part2: match.part2.partNumber,
          parameters: ruleAction.parameters || {},
          confidence: rule.confidence,
          ruleId: rule.rule_id,
          ruleName: rule.name,
          source: rule.source
        });

        // 记录规则使用
        this._incrementRuleUsage(rule.id);
      });
    }

    return constraints;
  }

  /**
   * 查找匹配规则条件的零件对
   */
  _findMatchingParts(bomData, ruleLogic, partMap) {
    const matches = [];

    switch (ruleLogic.type) {
      case 'bolt_nut_pair':
        if (partMap.has(ruleLogic.bolt) && partMap.has(ruleLogic.nut)) {
          matches.push({
            part1: partMap.get(ruleLogic.bolt),
            part2: partMap.get(ruleLogic.nut)
          });
        }
        break;

      case 'vcr_pair':
      case 'flange_gasket_pair':
        if (partMap.has(ruleLogic.part1) && partMap.has(ruleLogic.part2)) {
          matches.push({
            part1: partMap.get(ruleLogic.part1),
            part2: partMap.get(ruleLogic.part2)
          });
        }
        break;

      case 'pid_sequence':
        // PID序列规则：检查BOM中是否包含序列中的所有设备
        const seqParts = ruleLogic.sequence.map(tag =>
          bomData.find(p => p.tag === tag || p.partName.includes(tag))
        ).filter(Boolean);

        for (let i = 0; i < seqParts.length - 1; i++) {
          matches.push({
            part1: seqParts[i],
            part2: seqParts[i + 1]
          });
        }
        break;

      case 'geometry_learned':
        // STEP几何学习规则
        const geomPart1 = bomData.find(p => p.partNumber === ruleLogic.part1);
        const geomPart2 = bomData.find(p => p.partNumber === ruleLogic.part2);
        if (geomPart1 && geomPart2) {
          matches.push({ part1: geomPart1, part2: geomPart2 });
        }
        break;

      case 'both':
        // 通用类型匹配（如VCR接头）
        const candidateParts = bomData.filter(p =>
          p[ruleLogic.field] === ruleLogic.value ||
          (ruleLogic.contains && p[ruleLogic.field]?.includes(ruleLogic.contains))
        );

        for (let i = 0; i < candidateParts.length; i++) {
          for (let j = i + 1; j < candidateParts.length; j++) {
            matches.push({
              part1: candidateParts[i],
              part2: candidateParts[j]
            });
          }
        }
        break;
    }

    return matches;
  }

  /**
   * 构建装配结构
   */
  _buildAssemblyStructure(bomData, constraints) {
    return {
      name: 'Auto-Generated Assembly',
      parts: bomData.map(p => ({
        id: p.partNumber,
        name: p.partName,
        quantity: p.quantity || 1,
        type: p.type
      })),
      constraints: constraints.map(c => ({
        type: c.constraintType,
        entities: [c.part1, c.part2],
        parameters: c.parameters,
        confidence: c.confidence
      }))
    };
  }

  /**
   * 记录规则使用次数
   */
  async _incrementRuleUsage(ruleId) {
    try {
      await knex('assembly_rules')
        .where('id', ruleId)
        .increment('usage_count', 1)
        .increment('success_count', 1);
    } catch (error) {
      // 忽略统计错误
    }
  }

  /**
   * 获取唯一规则ID
   */
  _getUniqueRuleIds(constraints) {
    return [...new Set(constraints.map(c => c.ruleId))];
  }

  /**
   * 计算平均置信度
   */
  _calculateAvgConfidence(constraints) {
    if (constraints.length === 0) return 0;
    const sum = constraints.reduce((acc, c) => acc + c.confidence, 0);
    return (sum / constraints.length).toFixed(2);
  }
}

module.exports = new AutoAssemblyGenerator();
