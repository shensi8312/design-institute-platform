const db = require('../../config/database')

/**
 * 建筑强排知识图谱服务
 * 将规则同步到 Neo4j 知识图谱，建立规则关系网络
 */
class BuildingLayoutKnowledgeGraphService {
  /**
   * 同步规则到知识图谱
   * @param {string} ruleId - 规则ID
   * @returns {Object} 同步结果
   */
  async syncRuleToGraph(ruleId) {
    try {
      // 1. 获取规则详情
      const rule = await db('design_rules')
        .where('id', ruleId)
        .first()

      if (!rule) {
        return { success: false, message: '规则不存在' }
      }

      // 2. 检查是否已存在图节点
      let graphNode = await db('knowledge_graph_nodes')
        .where('entity_type', 'BuildingRule')
        .whereRaw("properties->>'rule_id' = ?", [rule.id])
        .first()

      const nodeProperties = {
        rule_id: rule.id,
        rule_code: rule.rule_code,
        rule_name: rule.rule_name,
        category_id: rule.category_id,
        rule_type: rule.rule_type,
        confidence_score: rule.confidence_score,
        usage_count: rule.usage_count,
        success_count: rule.success_count,
        priority: rule.priority,
        is_active: rule.is_active,
        synced_at: new Date().toISOString()
      }

      if (graphNode) {
        // 3a. 更新现有节点
        await db('knowledge_graph_nodes')
          .where('id', graphNode.id)
          .update({
            properties: JSON.stringify(nodeProperties),
            updated_at: new Date()
          })
      } else {
        // 3b. 创建新节点
        const [newNode] = await db('knowledge_graph_nodes')
          .insert({
            document_id: rule.source_document_id || null,
            entity_type: 'BuildingRule',
            entity_name: rule.rule_name,
            properties: JSON.stringify(nodeProperties)
          })
          .returning('*')

        graphNode = newNode
      }

      // 4. 建立规则依赖关系
      await this.syncRuleDependencies(rule, graphNode.id)

      return {
        success: true,
        node_id: graphNode.id,
        rule_code: rule.rule_code
      }
    } catch (error) {
      console.error('同步规则到图谱失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 同步规则依赖关系
   * @param {Object} rule - 规则对象
   * @param {string} nodeId - 图节点ID
   */
  async syncRuleDependencies(rule, nodeId) {
    try {
      const ruleStructure = typeof rule.rule_structure === 'string'
        ? JSON.parse(rule.rule_structure)
        : rule.rule_structure

      // 提取依赖关系
      const dependencies = ruleStructure.rule?.dependencies || []

      if (dependencies.length === 0) {
        return
      }

      // 查找依赖的规则（通过 target_area 匹配）
      for (const dep of dependencies) {
        // 查找提供此输出的规则
        const dependencyRules = await db('design_rules')
          .whereRaw("rule_structure->>'rule'->>'target_area' = ?", [dep.replace('_area', '')])
          .where('category_id', 'layout_area')
          .where('is_active', true)

        for (const depRule of dependencyRules) {
          // 获取依赖规则的图节点
          const depNode = await db('knowledge_graph_nodes')
            .where('entity_type', 'BuildingRule')
            .whereRaw("properties->>'rule_id' = ?", [depRule.id])
            .first()

          if (depNode) {
            // 检查关系是否已存在
            const existingRel = await db('knowledge_graph_relationships')
              .where('source_node_id', depNode.id)
              .where('target_node_id', nodeId)
              .where('relationship_type', 'PROVIDES_INPUT_TO')
              .first()

            if (!existingRel) {
              // 创建 PROVIDES_INPUT_TO 关系
              await db('knowledge_graph_relationships')
                .insert({
                  document_id: rule.source_document_id || null,
                  source_node_id: depNode.id,
                  target_node_id: nodeId,
                  relationship_type: 'PROVIDES_INPUT_TO',
                  properties: JSON.stringify({
                    dependency_field: dep,
                    created_at: new Date().toISOString()
                  })
                })
            }
          }
        }
      }
    } catch (error) {
      console.error('同步规则依赖失败:', error)
    }
  }

  /**
   * 批量同步所有建筑规则到图谱
   * @returns {Object} 同步结果
   */
  async syncAllBuildingRulesToGraph() {
    try {
      // 获取所有建筑强排规则
      const rules = await db('design_rules')
        .whereIn('category_id', [
          'layout_setback',
          'layout_area',
          'layout_um',
          'layout_compliance'
        ])
        .where('is_active', true)

      let successCount = 0
      let failureCount = 0
      const results = []

      for (const rule of rules) {
        const result = await this.syncRuleToGraph(rule.id)
        if (result.success) {
          successCount++
        } else {
          failureCount++
        }
        results.push({
          rule_code: rule.rule_code,
          success: result.success,
          error: result.error
        })
      }

      return {
        success: true,
        total: rules.length,
        success_count: successCount,
        failure_count: failureCount,
        results
      }
    } catch (error) {
      console.error('批量同步规则失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 查询规则依赖图
   * @param {string} ruleCode - 规则编码
   * @returns {Object} 依赖图
   */
  async getRuleDependencyGraph(ruleCode) {
    try {
      // 1. 获取规则节点
      const ruleNode = await db('knowledge_graph_nodes')
        .where('entity_type', 'BuildingRule')
        .whereRaw("properties->>'rule_code' = ?", [ruleCode])
        .first()

      if (!ruleNode) {
        return {
          success: false,
          message: '规则在图谱中不存在'
        }
      }

      // 2. 获取上游依赖（此规则依赖的规则）
      const upstream = await db('knowledge_graph_relationships as r')
        .join('knowledge_graph_nodes as n', 'r.source_node_id', 'n.id')
        .where('r.target_node_id', ruleNode.id)
        .where('r.relationship_type', 'PROVIDES_INPUT_TO')
        .select('n.*', 'r.properties as rel_properties')

      // 3. 获取下游依赖（依赖此规则的规则）
      const downstream = await db('knowledge_graph_relationships as r')
        .join('knowledge_graph_nodes as n', 'r.target_node_id', 'n.id')
        .where('r.source_node_id', ruleNode.id)
        .where('r.relationship_type', 'PROVIDES_INPUT_TO')
        .select('n.*', 'r.properties as rel_properties')

      return {
        success: true,
        rule: {
          node_id: ruleNode.id,
          rule_code: JSON.parse(ruleNode.properties).rule_code,
          rule_name: ruleNode.entity_name,
          properties: JSON.parse(ruleNode.properties)
        },
        upstream_dependencies: upstream.map(n => ({
          node_id: n.id,
          rule_code: JSON.parse(n.properties).rule_code,
          rule_name: n.entity_name,
          relationship: JSON.parse(n.rel_properties)
        })),
        downstream_dependents: downstream.map(n => ({
          node_id: n.id,
          rule_code: JSON.parse(n.properties).rule_code,
          rule_name: n.entity_name,
          relationship: JSON.parse(n.rel_properties)
        }))
      }
    } catch (error) {
      console.error('查询依赖图失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 查询完整的规则依赖链
   * @param {string} startRuleCode - 起始规则编码
   * @param {number} maxDepth - 最大深度
   * @returns {Object} 依赖链
   */
  async getRuleDependencyChain(startRuleCode, maxDepth = 5) {
    try {
      const visited = new Set()
      const chain = []

      const traverse = async (ruleCode, depth) => {
        if (depth > maxDepth || visited.has(ruleCode)) {
          return
        }

        visited.add(ruleCode)

        const graph = await this.getRuleDependencyGraph(ruleCode)
        if (!graph.success) {
          return
        }

        chain.push({
          depth,
          rule_code: ruleCode,
          rule_name: graph.rule.rule_name,
          upstream_count: graph.upstream_dependencies.length,
          downstream_count: graph.downstream_dependents.length
        })

        // 递归遍历上游依赖
        for (const dep of graph.upstream_dependencies) {
          await traverse(dep.rule_code, depth + 1)
        }
      }

      await traverse(startRuleCode, 0)

      return {
        success: true,
        start_rule: startRuleCode,
        max_depth: maxDepth,
        total_rules: chain.length,
        chain
      }
    } catch (error) {
      console.error('查询依赖链失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 获取规则网络统计
   * @returns {Object} 统计信息
   */
  async getGraphStatistics() {
    try {
      // 规则节点总数
      const totalNodes = await db('knowledge_graph_nodes')
        .where('entity_type', 'BuildingRule')
        .count('* as count')
        .first()

      // 关系总数
      const totalRels = await db('knowledge_graph_relationships as r')
        .join('knowledge_graph_nodes as n1', 'r.source_node_id', 'n1.id')
        .where('n1.entity_type', 'BuildingRule')
        .where('r.relationship_type', 'PROVIDES_INPUT_TO')
        .count('* as count')
        .first()

      // 按分类统计
      const byCategory = await db('knowledge_graph_nodes')
        .where('entity_type', 'BuildingRule')
        .select(db.raw("properties->>'category_id' as category"))
        .count('* as count')
        .groupBy('category')

      return {
        success: true,
        statistics: {
          total_rule_nodes: parseInt(totalNodes.count),
          total_dependencies: parseInt(totalRels.count),
          by_category: byCategory.map(c => ({
            category: c.category,
            count: parseInt(c.count)
          }))
        }
      }
    } catch (error) {
      console.error('获取图谱统计失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

module.exports = BuildingLayoutKnowledgeGraphService
