const db = require('../../config/database')

class RuleExtractionService {
  /**
   * 从知识图谱中提取设计规则
   */
  async extractRulesFromGraph(documentId) {
    console.log(`[规则提取] 开始从文档提取规则: ${documentId}`)

    try {
      // 1. 获取文档的知识图谱
      const nodes = await db('knowledge_graph_nodes')
        .where({ document_id: documentId })

      const relationships = await db('knowledge_graph_relationships')
        .where({ document_id: documentId })

      if (nodes.length === 0) {
        return {
          success: false,
          message: '该文档没有知识图谱，请先提取图谱'
        }
      }

      console.log(`[规则提取] 找到${nodes.length}个节点，${relationships.length}个关系`)

      // 2. 识别规范类实体
      const ruleNodes = nodes.filter(node => {
        const type = node.entity_type || ''
        const name = node.entity_name || ''
        const desc = node.properties?.description || ''

        // 包含规范相关关键词
        const keywords = ['规范', '标准', '要求', '参数', '条文', '规定', 'GB', 'JGJ', 'CJJ', 'DB']
        return keywords.some(kw => type.includes(kw) || name.includes(kw) || desc.includes(kw))
      })

      console.log(`[规则提取] 识别出${ruleNodes.length}个规范类节点`)

      const extractedRules = []

      for (const node of ruleNodes) {
        // 3. 找到相关的关系
        const relatedRelations = relationships.filter(rel =>
          rel.source_node_id === node.id || rel.target_node_id === node.id
        )

        // 4. 构建规则结构
        const rule = this.buildRuleStructure(node, relatedRelations, nodes)

        if (rule) {
          extractedRules.push(rule)
        }
      }

      // 5. 保存提取的规则
      const savedRules = []
      for (const rule of extractedRules) {
        const [saved] = await db('design_rules')
          .insert({
            ...rule,
            source_document_id: documentId,
            extraction_method: 'graph',
            review_status: 'pending'
          })
          .returning('*')

        savedRules.push(saved)
      }

      console.log(`[规则提取] 完成，共提取并保存${savedRules.length}条规则`)

      return {
        success: true,
        message: `成功提取${savedRules.length}条规则`,
        data: {
          extracted_count: savedRules.length,
          rules: savedRules
        }
      }
    } catch (error) {
      console.error('[规则提取] 失败:', error)
      return {
        success: false,
        message: '提取失败: ' + error.message
      }
    }
  }

  /**
   * 构建规则结构
   */
  buildRuleStructure(node, relationships, allNodes) {
    // 提取规则编号 (如: GB50809-2023-4.2.1)
    const ruleCode = this.extractRuleCode(node.entity_name, node.properties)

    if (!ruleCode) {
      console.log(`[规则提取] 节点${node.entity_name}未找到规则编号，使用名称`)
    }

    // 提取数值参数
    const parameters = this.extractParameters(node.properties?.description || '')

    // 确定规则类别
    const category = this.determineCategory(ruleCode || node.entity_name)

    return {
      category_id: category,
      rule_code: ruleCode || node.entity_name,
      rule_name: node.entity_name,
      rule_content: node.properties?.description || node.entity_name,
      rule_structure: {
        node_id: node.id,
        entities: [node],
        relationships: relationships.map(r => ({
          type: r.relationship_type,
          source: r.source_node_id,
          target: r.target_node_id
        })),
        context: this.buildContext(relationships, allNodes)
      },
      parameters,
      confidence_score: ruleCode ? 0.8 : 0.5,
      applicable_scope: this.determineScope(node.properties),
      priority: this.determinePriority(node.properties?.description || '')
    }
  }

  /**
   * 提取规则编号
   */
  extractRuleCode(name, properties) {
    const text = name + ' ' + JSON.stringify(properties)

    // 匹配模式
    const patterns = [
      /([A-Z]{2,4}\d+)-(\d{4})-(\d+\.[\d\.]+)/,  // GB50809-2023-4.2.1
      /([A-Z]{2,4}\/T\s*\d+)-(\d{4})-(\d+\.[\d\.]+)/, // GB/T 50378-2019-4.2.3
      /([A-Z]{2,4}\d+)-(\d{4})/, // GB50809-2023
      /第([0-9\.]+)条/  // 第4.2.1条
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        return match[0]
      }
    }

    return null
  }

  /**
   * 提取参数
   */
  extractParameters(text) {
    const parameters = {}

    // 提取数值
    const numPatterns = [
      { regex: /不应?[小少]于\s*([\d\.]+)\s*([a-zA-Z米度℃m]+)?/g, key: 'min' },
      { regex: /不应?[大多]于\s*([\d\.]+)\s*([a-zA-Z米度℃m]+)?/g, key: 'max' },
      { regex: /应为\s*([\d\.]+)\s*([a-zA-Z米度℃m]+)?/g, key: 'value' },
      { regex: /(\d+\.?\d*)\s*([a-zA-Z米度℃m]+)/g, key: 'general' }
    ]

    for (const pattern of numPatterns) {
      const matches = [...text.matchAll(pattern.regex)]
      for (const match of matches) {
        if (match[1]) {
          const value = parseFloat(match[1])
          const unit = match[2] || ''

          if (!parameters[pattern.key]) {
            parameters[pattern.key] = { value, unit }
          }
        }
      }
    }

    return parameters
  }

  /**
   * 确定规则类别
   */
  determineCategory(text) {
    if (text.includes('GB') || text.includes('国标') || text.includes('国家标准')) {
      return 'national_standard'
    }
    if (text.includes('JGJ') || text.includes('CJJ') || text.includes('行标') || text.includes('行业标准')) {
      return 'industry_standard'
    }
    if (text.includes('DB') || text.includes('地标') || text.includes('地方标准')) {
      return 'local_standard'
    }
    if (text.includes('Fab') || text.includes('FAB')) {
      return 'fab_design'
    }

    return 'national_standard'
  }

  /**
   * 确定适用范围
   */
  determineScope(properties) {
    const text = JSON.stringify(properties)

    if (text.includes('住宅')) return '住宅建筑'
    if (text.includes('公共')) return '公共建筑'
    if (text.includes('工业')) return '工业建筑'
    if (text.includes('高层')) return '高层建筑'

    return '通用'
  }

  /**
   * 确定优先级
   */
  determinePriority(text) {
    if (text.includes('必须') || text.includes('严禁') || text.includes('不得')) {
      return 'critical'
    }
    if (text.includes('应当') || text.includes('应')) {
      return 'high'
    }
    if (text.includes('宜') || text.includes('建议')) {
      return 'normal'
    }
    return 'low'
  }

  /**
   * 构建上下文
   */
  buildContext(relationships, allNodes) {
    return relationships.map(rel => {
      const source = allNodes.find(n => n.id === rel.source_node_id)
      const target = allNodes.find(n => n.id === rel.target_node_id)

      return {
        relationship: rel.relationship_type,
        source: source?.entity_name || rel.source_node_id,
        target: target?.entity_name || rel.target_node_id
      }
    })
  }
}

module.exports = RuleExtractionService
