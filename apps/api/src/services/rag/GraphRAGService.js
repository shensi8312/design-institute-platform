const KnowledgeGraphNodesRepository = require('../../repositories/KnowledgeGraphNodesRepository')
const { v4: uuidv4 } = require('uuid')
const { getDomainConfig } = require('../../config/DomainConfig')

/**
 * 知识图谱提取服务
 * 使用LLM从文档中提取实体和关系
 * 支持多领域配置
 */
class GraphRAGService {
  constructor(domain = 'architecture') {
    this.graphRepository = new KnowledgeGraphNodesRepository()
    this.domainConfig = getDomainConfig(domain)
    console.log(`[GraphRAG] 使用领域: ${this.domainConfig.domainName}`)
  }

  /**
   * 使用LLM提取实体和关系（通用方法，不写死关键词）
   */
  async extractByLLM(text) {
    try {
      const db = require('../../config/database')

      // 从数据库读取配置（保持兼容性）
      const entityTypes = await db('graph_entity_types').where('is_active', true)
      const relationTypes = await db('graph_relationship_types').where('is_active', true)

      // 优先使用数据库配置，如果为空则使用领域配置
      const entityTypeNames = entityTypes.length > 0
        ? entityTypes.map(t => t.name).join('、')
        : this.domainConfig.entityTypes.map(t => t.name).join('、')

      const relationTypeNames = relationTypes.length > 0
        ? relationTypes.map(t => t.name).join('、')
        : this.domainConfig.relationTypes.map(t => t.name).join('、')

      console.log(`[GraphRAG] 实体类型: ${entityTypeNames}`)
      console.log(`[GraphRAG] 关系类型: ${relationTypeNames}`)

      const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434'
      const model = process.env.OLLAMA_MODEL || 'qwen2:1.5b'

      // 分段处理长文本
      const maxLength = 500
      const textSegment = text.substring(0, maxLength)

      // 使用领域配置的提示词模板
      const prompt = this.domainConfig.getEntityExtractionPrompt({
        text: textSegment,
        entity_types: entityTypeNames,
        relation_types: relationTypeNames
      }) + `\n\n请直接返回JSON，不要其他内容。`

      const response = await fetch(`${ollamaHost}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          stream: false,
          format: 'json',
          options: {
            temperature: 0.3,
            top_p: 0.9
          }
        })
      })

      if (!response.ok) {
        console.error('[GraphRAG] LLM请求失败:', response.statusText)
        return { entities: [], relationships: [] }
      }

      const data = await response.json()
      let graphData

      try {
        graphData = JSON.parse(data.response)

        // 验证返回格式
        if (!graphData.entities || !Array.isArray(graphData.entities)) {
          graphData.entities = []
        }
        if (!graphData.relationships || !Array.isArray(graphData.relationships)) {
          graphData.relationships = []
        }

        console.log(`[GraphRAG] LLM成功提取: ${graphData.entities.length}个实体, ${graphData.relationships.length}个关系`)
      } catch (e) {
        console.error('[GraphRAG] JSON解析失败:', e.message, '返回:', data.response?.substring(0, 200))
        graphData = { entities: [], relationships: [] }
      }

      return graphData
    } catch (error) {
      console.error('[GraphRAG] LLM提取失败:', error)
      return { entities: [], relationships: [] }
    }
  }

  /**
   * 从文本中提取知识图谱
   */
  async extractGraph(docId, versionId, textContent) {
    try {
      console.log(`[GraphRAG] 开始提取知识图谱: ${docId}`)

      // 使用LLM通用提取（不写死关键词）
      let graphData = await this.extractByLLM(textContent)

      console.log(`[GraphRAG] 提取完成: ${graphData.entities?.length || 0}个实体, ${graphData.relationships?.length || 0}个关系`)

      const nodes = []
      const nodeMap = {}

      // 插入节点
      for (const entity of graphData.entities || []) {
        const nodeId = uuidv4()
        nodeMap[entity.name] = nodeId

        nodes.push({
          id: nodeId,
          document_id: docId,
          version_id: versionId,
          entity_name: entity.name,
          entity_type: entity.type || 'unknown',
          properties: {
            description: entity.description || ''
          },
          created_at: new Date()
        })
      }

      if (nodes.length > 0) {
        await this.graphRepository.batchInsertNodes(nodes)
        console.log(`[GraphRAG] 插入${nodes.length}个节点`)
      }

      const relationships = []

      // 插入关系
      for (const rel of graphData.relationships || []) {
        const sourceId = nodeMap[rel.source]
        const targetId = nodeMap[rel.target]

        if (sourceId && targetId) {
          relationships.push({
            id: uuidv4(),
            document_id: docId,
            version_id: versionId,
            source_node_id: sourceId,
            target_node_id: targetId,
            relationship_type: rel.type || 'related',
            properties: {
              description: rel.description || ''
            },
            created_at: new Date()
          })
        }
      }

      if (relationships.length > 0) {
        await this.graphRepository.batchInsertRelationships(relationships)
        console.log(`[GraphRAG] 插入${relationships.length}个关系`)
      }

      return {
        success: true,
        nodes_count: nodes.length,
        relationships_count: relationships.length
      }
    } catch (error) {
      console.error('[GraphRAG] 提取失败:', error)
      return {
        success: false,
        error: error.message,
        nodes_count: 0,
        relationships_count: 0
      }
    }
  }

  /**
   * 获取文档的知识图谱
   */
  async getDocumentGraph(docId) {
    try {
      const graph = await this.graphRepository.getGraphByDocId(docId)

      return {
        success: true,
        graph: graph
      }
    } catch (error) {
      console.error('[GraphRAG] 获取图谱失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 删除文档的知识图谱
   */
  async deleteDocumentGraph(docId) {
    try {
      await this.graphRepository.deleteNodesByDocId(docId)
      console.log(`[GraphRAG] 删除文档图谱: ${docId}`)

      return { success: true }
    } catch (error) {
      console.error('[GraphRAG] 删除图谱失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 更新节点
   */
  async updateNode(nodeId, updateData) {
    try {
      const result = await this.graphRepository.updateNode(nodeId, updateData)

      return {
        success: true,
        node: result[0]
      }
    } catch (error) {
      console.error('[GraphRAG] 更新节点失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 更新关系
   */
  async updateRelationship(relId, updateData) {
    try {
      const result = await this.graphRepository.updateRelationship(relId, updateData)

      return {
        success: true,
        relationship: result[0]
      }
    } catch (error) {
      console.error('[GraphRAG] 更新关系失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 删除节点
   */
  async deleteNode(nodeId) {
    try {
      await this.graphRepository.deleteNode(nodeId)

      return { success: true }
    } catch (error) {
      console.error('[GraphRAG] 删除节点失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 删除关系
   */
  async deleteRelationship(relId) {
    try {
      await this.graphRepository.deleteRelationship(relId)

      return { success: true }
    } catch (error) {
      console.error('[GraphRAG] 删除关系失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 获取所有知识图谱数据
   * @returns {Promise<Object>} 包含nodes和relationships的图谱数据
   */
  async getAllGraphData() {
    try {
      const db = require('../../config/database')

      // 从数据库获取所有节点
      const nodes = await db('knowledge_graph_nodes')
        .select('*')
        .orderBy('created_at', 'desc')

      // 从数据库获取所有关系
      const relationships = await db('knowledge_graph_relationships')
        .select('*')
        .orderBy('created_at', 'desc')

      console.log(`[GraphRAG] 获取图谱数据: ${nodes.length} 个节点, ${relationships.length} 个关系`)

      return {
        nodes: nodes || [],
        relationships: relationships || []
      }
    } catch (error) {
      console.error('[GraphRAG] 获取所有图谱数据失败:', error)
      throw error
    }
  }
}

module.exports = GraphRAGService
