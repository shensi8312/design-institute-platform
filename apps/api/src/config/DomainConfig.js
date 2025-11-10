const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

/**
 * 领域配置管理器
 * 用于加载和管理不同领域（建筑、机械等）的配置
 */
class DomainConfig {
  constructor(domain = 'architecture') {
    this.domain = domain
    this.config = this.loadConfig(domain)
  }

  /**
   * 加载领域配置文件
   * @param {string} domain - 领域名称（architecture, mechanical等）
   * @returns {Object} 配置对象
   */
  loadConfig(domain) {
    try {
      const configPath = path.join(__dirname, 'domains', `${domain}.yaml`)

      if (!fs.existsSync(configPath)) {
        console.warn(`[DomainConfig] 配置文件不存在: ${configPath}，使用默认配置`)
        return this.getDefaultConfig()
      }

      const configContent = fs.readFileSync(configPath, 'utf8')
      const config = yaml.load(configContent)

      console.log(`[DomainConfig] 已加载 ${domain} 领域配置`)
      return config
    } catch (error) {
      console.error(`[DomainConfig] 加载配置失败:`, error.message)
      return this.getDefaultConfig()
    }
  }

  /**
   * 获取默认配置（通用配置）
   */
  getDefaultConfig() {
    return {
      domain: {
        name: '通用领域',
        description: '默认通用配置'
      },
      extraction: {
        entity_types: [],
        prompts: {
          entity_extraction: '从文本中提取实体',
          relation_extraction: '从文本中提取关系'
        }
      },
      knowledge_graph: {
        node_types: [],
        relation_types: []
      },
      rule_extraction: {
        rule_templates: []
      },
      recommendation: {
        scoring_weights: {
          vector_similarity: 0.5,
          rule_matching: 0.3,
          graph_connectivity: 0.2
        }
      }
    }
  }

  // ========== 便捷访问方法 ==========

  /**
   * 获取领域名称
   */
  get domainName() {
    return this.config.domain?.name || '未知领域'
  }

  /**
   * 获取领域描述
   */
  get domainDescription() {
    return this.config.domain?.description || ''
  }

  /**
   * 获取实体类型列表
   */
  get entityTypes() {
    return this.config.extraction?.entity_types || []
  }

  /**
   * 获取关系类型列表
   */
  get relationTypes() {
    return this.config.knowledge_graph?.relation_types || []
  }

  /**
   * 获取提取提示词
   * @param {string} type - 提示词类型（entity_extraction, relation_extraction等）
   * @param {Object} variables - 变量替换对象
   */
  getPrompt(type, variables = {}) {
    // 先尝试从顶层prompts读取，然后从extraction.prompts读取
    let prompt = this.config.prompts?.[type] || this.config.extraction?.prompts?.[type] || ''

    // 替换变量
    if (variables && Object.keys(variables).length > 0) {
      Object.keys(variables).forEach(key => {
        const placeholder = `{${key}}`
        prompt = prompt.replace(new RegExp(placeholder, 'g'), variables[key])
      })
    }

    return prompt
  }

  /**
   * 获取实体提取提示词（支持变量替换）
   * @param {Object} variables - 变量对象，如 {text: "..."}
   */
  getEntityExtractionPrompt(variables = {}) {
    let prompt = this.getPrompt('entity_extraction')

    // 替换变量
    Object.keys(variables).forEach(key => {
      const placeholder = `{${key}}`
      prompt = prompt.replace(new RegExp(placeholder, 'g'), variables[key])
    })

    return prompt
  }

  /**
   * 获取关系提取提示词
   */
  getRelationExtractionPrompt(variables = {}) {
    let prompt = this.getPrompt('relation_extraction')

    Object.keys(variables).forEach(key => {
      const placeholder = `{${key}}`
      prompt = prompt.replace(new RegExp(placeholder, 'g'), variables[key])
    })

    return prompt
  }

  /**
   * 根据实体类型名称获取配置
   * @param {string} typeName - 实体类型名称
   */
  getEntityTypeConfig(typeName) {
    return this.entityTypes.find(t =>
      t.name === typeName || t.aliases?.includes(typeName)
    )
  }

  /**
   * 获取Neo4j节点标签
   * @param {string} entityType - 实体类型
   */
  getNeo4jLabel(entityType) {
    const nodeType = this.config.knowledge_graph?.node_types?.find(
      nt => nt.entity_type === entityType
    )
    return nodeType?.neo4j_label || entityType
  }

  /**
   * 获取Neo4j关系类型
   * @param {string} relationName - 关系名称
   */
  getNeo4jRelationType(relationName) {
    const relType = this.relationTypes.find(rt => rt.name === relationName)
    return relType?.neo4j_type || relationName.toUpperCase().replace(/\s+/g, '_')
  }

  /**
   * 获取实体颜色（用于图谱可视化）
   */
  getEntityColor(entityType) {
    const typeConfig = this.getEntityTypeConfig(entityType)
    return typeConfig?.color || '#999999'
  }

  /**
   * 获取规则模板列表
   */
  get ruleTemplates() {
    return this.config.rule_extraction?.rule_templates || []
  }

  /**
   * 根据模式匹配规则模板
   * @param {string} pattern - 模式字符串，如 "{A} -承重-> {B}"
   */
  matchRuleTemplate(pattern) {
    return this.ruleTemplates.find(template => template.pattern === pattern)
  }

  /**
   * 获取推荐评分权重
   */
  get scoringWeights() {
    return this.config.recommendation?.scoring_weights || {
      vector_similarity: 0.5,
      rule_matching: 0.3,
      graph_connectivity: 0.2
    }
  }

  /**
   * 获取推荐提示词
   */
  getRecommendationPrompt(variables = {}) {
    let prompt = this.config.recommendation?.prompts?.design_assistance ||
      '基于以下信息提供设计建议'

    Object.keys(variables).forEach(key => {
      const placeholder = `{${key}}`
      prompt = prompt.replace(new RegExp(placeholder, 'g'), variables[key])
    })

    return prompt
  }

  /**
   * 获取规则生成提示词
   */
  getRuleGenerationPrompt(variables = {}) {
    let prompt = this.config.rule_extraction?.prompts?.rule_generation ||
      '基于以下模式生成规则'

    Object.keys(variables).forEach(key => {
      const placeholder = `{${key}}`
      prompt = prompt.replace(new RegExp(placeholder, 'g'), variables[key])
    })

    return prompt
  }

  /**
   * 判断实体类型是否启用向量化
   * @param {string} entityType
   */
  isVectorEnabled(entityType) {
    const nodeType = this.config.knowledge_graph?.node_types?.find(
      nt => nt.entity_type === entityType
    )
    return nodeType?.vector_enabled !== false // 默认启用
  }

  /**
   * 获取所有支持的领域列表
   */
  static getSupportedDomains() {
    const domainsDir = path.join(__dirname, 'domains')

    try {
      const files = fs.readdirSync(domainsDir)
      return files
        .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
        .map(file => file.replace(/\.(yaml|yml)$/, ''))
    } catch (error) {
      console.error('[DomainConfig] 读取领域列表失败:', error.message)
      return ['architecture'] // 默认返回建筑领域
    }
  }

  /**
   * 重新加载配置（用于配置文件更新后）
   */
  reload() {
    this.config = this.loadConfig(this.domain)
  }
}

// 单例缓存，避免重复加载
const domainInstances = {}

/**
 * 获取领域配置实例（单例模式）
 * @param {string} domain - 领域名称
 * @returns {DomainConfig}
 */
function getDomainConfig(domain = 'architecture') {
  if (!domainInstances[domain]) {
    domainInstances[domain] = new DomainConfig(domain)
  }
  return domainInstances[domain]
}

module.exports = {
  DomainConfig,
  getDomainConfig
}
