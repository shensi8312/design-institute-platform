/**
 * 智能文档分析器
 *
 * 功能：
 * 1. 自动识别文档类型和专业领域
 * 2. 并行提取多种规则类型
 * 3. 构建多维度知识图谱
 */

const { getDomainConfig } = require('../../config/DomainConfig')
const llmService = require('../llm/UnifiedLLMService')

class IntelligentDocumentAnalyzer {
  constructor() {
    this.config = getDomainConfig('intelligent_standards')
    this.llm = llmService
  }

  /**
   * 第一步：智能识别文档
   * @param {Object} params
   * @param {string} params.title - 文档标题
   * @param {string} params.content - 文档内容（前2000字）
   * @returns {Promise<Object>} 识别结果
   */
  async analyzeDocument({ title, content }) {
    console.log('[智能分析] 开始识别文档类型...')

    const prompt = this.config.getPrompt('document_analysis', {
      title,
      content: content.substring(0, 2000) // 只用前2000字识别
    })

    try {
      const response = await this.llm.chat(
        [
          { role: 'system', content: '你是一个建筑工程标准文档分析专家。请严格按JSON格式返回分析结果。' },
          { role: 'user', content: prompt }
        ],
        { temperature: 0.1 }
      )

      const result = this._parseJSON(response.content)

      console.log('[智能分析] 识别结果:', {
        document_type: result.document_type,
        domains: result.domains,
        standard_level: result.standard_level,
        standard_code: result.standard_code
      })

      return result
    } catch (error) {
      console.error('[智能分析] 文档识别失败:', error.message)
      // 返回默认值
      return {
        document_type: '技术规程',
        domains: ['建筑工程'],
        standard_level: '国标',
        standard_code: '',
        keywords: [],
        summary: '文档识别失败，使用默认分类'
      }
    }
  }

  /**
   * 第二步：并行提取多种规则
   * @param {Object} params
   * @param {string} params.content - 文档内容
   * @param {Array<string>} params.ruleTypes - 要提取的规则类型（可选，默认全部）
   * @returns {Promise<Object>} 所有规则
   */
  async extractRules({ content, ruleTypes = null }) {
    console.log('[智能分析] 开始并行提取规则...')

    const allRuleTypes = this.config.config.rule_extraction?.rule_types || []
    const targetTypes = ruleTypes
      ? allRuleTypes.filter(rt => ruleTypes.includes(rt.code))
      : allRuleTypes

    console.log(`[智能分析] 将提取 ${targetTypes.length} 种规则类型`)

    // 并行提取所有规则类型
    const extractionPromises = targetTypes.map(ruleType =>
      this._extractSingleRuleType(content, ruleType)
    )

    const results = await Promise.allSettled(extractionPromises)

    // 整合结果
    const extractedRules = {}
    results.forEach((result, index) => {
      const ruleType = targetTypes[index]
      if (result.status === 'fulfilled') {
        extractedRules[ruleType.code] = {
          name: ruleType.name,
          color: ruleType.color,
          rules: result.value
        }
      } else {
        console.error(`[智能分析] ${ruleType.name}提取失败:`, result.reason)
        extractedRules[ruleType.code] = {
          name: ruleType.name,
          color: ruleType.color,
          rules: []
        }
      }
    })

    const totalRules = Object.values(extractedRules)
      .reduce((sum, rt) => sum + rt.rules.length, 0)

    console.log(`[智能分析] 规则提取完成，共提取 ${totalRules} 条规则`)

    return extractedRules
  }

  /**
   * 提取单一类型的规则
   * @private
   */
  async _extractSingleRuleType(content, ruleType) {
    console.log(`[智能分析] 提取 ${ruleType.name}...`)

    // 将长文档分块处理
    const chunks = this._chunkContent(content, 3000)
    const allRules = []

    for (const chunk of chunks) {
      const prompt = ruleType.prompt.replace('{content}', chunk)

      try {
        const response = await this.llm.chat(
          [
            {
              role: 'system',
              content: '你是建筑工程标准规则提取专家。请严格按JSON数组格式返回提取的规则。'
            },
            { role: 'user', content: prompt }
          ],
          { temperature: 0.1 }
        )

        const rules = this._parseJSON(response.content)
        if (Array.isArray(rules)) {
          allRules.push(...rules)
        }
      } catch (error) {
        console.error(`[智能分析] ${ruleType.name}提取失败:`, error.message)
      }
    }

    console.log(`[智能分析] ${ruleType.name}提取完成: ${allRules.length} 条`)
    return allRules
  }

  /**
   * 第三步：提取实体和关系
   * @param {Object} params
   * @param {Object} params.documentInfo - 文档识别信息
   * @param {Object} params.extractedRules - 提取的规则
   * @returns {Promise<Object>} 实体和关系
   */
  async extractEntitiesAndRelationships({ documentInfo, extractedRules }) {
    console.log('[智能分析] 开始提取实体和关系...')

    const entities = []
    const relationships = []

    // 1. 创建文档实体
    const docEntity = {
      name: documentInfo.standard_code || documentInfo.title || '未命名文档',
      type: '标准文档',
      properties: {
        标题: documentInfo.title,
        文档类型: documentInfo.document_type,
        标准层级: documentInfo.standard_level,
        编号: documentInfo.standard_code,
        摘要: documentInfo.summary
      }
    }
    entities.push(docEntity)

    // 2. 创建领域实体
    for (const domain of documentInfo.domains || []) {
      const domainEntity = {
        name: domain,
        type: '专业领域',
        properties: { 领域名称: domain }
      }
      entities.push(domainEntity)

      // 文档属于领域
      relationships.push({
        source: docEntity.name,
        target: domain,
        type: '属于'
      })
    }

    // 3. 处理所有提取的规则
    for (const [ruleTypeCode, ruleTypeData] of Object.entries(extractedRules)) {
      for (const rule of ruleTypeData.rules) {
        // 创建规则实体
        const ruleEntity = {
          name: rule.rule_name,
          type: '规则',
          properties: {
            规则名称: rule.rule_name,
            规则类型: ruleTypeData.name,
            适用条件: rule.applicable_condition,
            具体要求: rule.requirements,
            引用条款: rule.reference_clause,
            计算公式: rule.formula
          }
        }
        entities.push(ruleEntity)

        // 文档规定规则
        relationships.push({
          source: docEntity.name,
          target: rule.rule_name,
          type: '规定'
        })

        // 从规则内容中提取更多实体（构件、材料、指标等）
        const extractedFromRule = await this._extractEntitiesFromRule(rule)
        entities.push(...extractedFromRule.entities)
        relationships.push(...extractedFromRule.relationships)
      }
    }

    console.log(`[智能分析] 实体关系提取完成: ${entities.length} 个实体, ${relationships.length} 个关系`)

    return {
      entities,
      relationships
    }
  }

  /**
   * 从单条规则中提取实体
   * @private
   */
  async _extractEntitiesFromRule(rule) {
    const ruleContent = `
规则名称: ${rule.rule_name}
适用条件: ${rule.applicable_condition || '无'}
具体要求: ${rule.requirements || '无'}
计算公式: ${rule.formula || '无'}
    `.trim()

    const prompt = this.config.getPrompt('entity_relationship_extraction', {
      rule_content: ruleContent
    })

    try {
      const response = await this.llm.chat(
        [
          { role: 'system', content: '你是知识图谱构建专家。请严格按JSON格式返回实体和关系。' },
          { role: 'user', content: prompt }
        ],
        { temperature: 0.1 }
      )

      const result = this._parseJSON(response.content)

      // 为所有关系添加源实体（规则名称）
      const relationships = (result.relationships || []).map(rel => ({
        ...rel,
        source: rule.rule_name
      }))

      return {
        entities: result.entities || [],
        relationships
      }
    } catch (error) {
      console.error('[智能分析] 规则实体提取失败:', error.message)
      return { entities: [], relationships: [] }
    }
  }

  /**
   * 完整分析流程
   * @param {Object} params
   * @param {string} params.title - 文档标题
   * @param {string} params.content - 文档内容
   * @returns {Promise<Object>} 完整分析结果
   */
  async analyzeComplete({ title, content }) {
    console.log('[智能分析] ========== 开始完整分析 ==========')
    console.log('[智能分析] 文档标题:', title)
    console.log('[智能分析] 内容长度:', content.length)

    const startTime = Date.now()

    try {
      // 第一步：识别文档
      const documentInfo = await this.analyzeDocument({ title, content })

      // 第二步：提取规则
      const extractedRules = await this.extractRules({ content })

      // 第三步：提取实体关系
      const { entities, relationships } = await this.extractEntitiesAndRelationships({
        documentInfo,
        extractedRules
      })

      const duration = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`[智能分析] ========== 分析完成 (耗时 ${duration}s) ==========`)

      return {
        document_info: documentInfo,
        extracted_rules: extractedRules,
        knowledge_graph: {
          entities,
          relationships
        },
        analysis_metadata: {
          duration_seconds: parseFloat(duration),
          total_entities: entities.length,
          total_relationships: relationships.length,
          total_rules: Object.values(extractedRules).reduce((sum, rt) => sum + rt.rules.length, 0)
        }
      }
    } catch (error) {
      console.error('[智能分析] 完整分析失败:', error)
      throw error
    }
  }

  /**
   * 将长文本分块
   * @private
   */
  _chunkContent(content, chunkSize = 3000) {
    const chunks = []
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.substring(i, i + chunkSize))
    }
    return chunks
  }

  /**
   * 解析JSON响应
   * @private
   */
  _parseJSON(text) {
    try {
      // 提取JSON代码块（如果有）
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1])
      }

      // 直接解析
      return JSON.parse(text)
    } catch (error) {
      console.error('[智能分析] JSON解析失败:', text.substring(0, 200))
      throw new Error('LLM返回的不是有效的JSON格式')
    }
  }
}

module.exports = IntelligentDocumentAnalyzer
