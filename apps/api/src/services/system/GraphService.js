const BaseService = require('../BaseService')
const GraphRepository = require('../../repositories/GraphRepository')
const { KnowledgeRepository } = require('../../repositories/KnowledgeRepository')

/**
 * 知识图谱服务
 */
class GraphService extends BaseService {
  constructor() {
    const graphRepository = new GraphRepository()
    super(graphRepository)
    this.graphRepository = graphRepository
    this.knowledgeRepository = new KnowledgeRepository()
  }

  /**
   * 创建知识图谱
   */
  async create(data) {
    try {
      // 验证知识库
      const kb = await this.knowledgeRepository.findById(data.kb_id)
      if (!kb) {
        return {
          success: false,
          message: '知识库不存在'
        }
      }

      // 创建图谱
      const graph = await this.graphRepository.create({
        name: data.name,
        description: data.description,
        kb_id: data.kb_id,
        type: data.type || 'knowledge',
        config: JSON.stringify(data.config || {}),
        status: 'building',
        organization_id: data.organization_id,
        created_by: data.created_by
      })

      // 异步构建图谱
      this.buildGraphAsync(graph.id, data.kb_id)

      return {
        success: true,
        data: graph
      }
    } catch (error) {
      console.error('Create graph error:', error)
      return {
        success: false,
        message: '创建知识图谱失败',
        error: error.message
      }
    }
  }

  /**
   * 异步构建图谱
   */
  async buildGraphAsync(graphId, kbId) {
    try {
      // 获取知识库文档
      const documents = await this.knowledgeRepository.getDocuments(kbId)
      
      let totalNodes = 0
      let totalEdges = 0

      for (const doc of documents) {
        // 从文档中提取实体和关系
        const { entities, relations } = await this.extractEntitiesAndRelations(doc)
        
        // 创建节点
        for (const entity of entities) {
          await this.graphRepository.upsertNode(graphId, {
            entity_id: entity.id,
            entity_type: entity.type,
            name: entity.name,
            properties: entity.properties,
            embedding: entity.embedding
          })
          totalNodes++
        }
        
        // 创建边
        for (const relation of relations) {
          await this.graphRepository.upsertEdge(graphId, {
            source_id: relation.source,
            target_id: relation.target,
            relation_type: relation.type,
            weight: relation.weight,
            properties: relation.properties
          })
          totalEdges++
        }
      }

      // 更新图谱状态
      await this.graphRepository.update(graphId, {
        status: 'ready',
        statistics: JSON.stringify({
          node_count: totalNodes,
          edge_count: totalEdges,
          build_time: new Date()
        })
      })
    } catch (error) {
      console.error('Build graph error:', error)
      await this.graphRepository.update(graphId, {
        status: 'failed',
        error_message: error.message
      })
    }
  }

  /**
   * 从文档提取实体和关系
   */
  async extractEntitiesAndRelations(document) {
    // 这里应该调用NLP服务进行实体识别和关系抽取
    // 简化实现
    return {
      entities: [
        {
          id: `entity_${document.id}_1`,
          type: 'concept',
          name: document.name,
          properties: { source: document.id },
          embedding: null
        }
      ],
      relations: []
    }
  }

  /**
   * 获取图谱列表
   */
  async list(userId, organizationId, options = {}) {
    try {
      const graphs = await this.graphRepository.findByUser(
        userId,
        organizationId,
        options
      )
      
      return {
        success: true,
        data: graphs
      }
    } catch (error) {
      console.error('List graphs error:', error)
      return {
        success: false,
        message: '获取图谱列表失败',
        error: error.message
      }
    }
  }

  /**
   * 获取图谱详情
   */
  async getById(graphId) {
    try {
      const graph = await this.graphRepository.findByIdWithDetails(graphId)
      
      if (!graph) {
        return {
          success: false,
          message: '图谱不存在'
        }
      }

      return {
        success: true,
        data: graph
      }
    } catch (error) {
      console.error('Get graph error:', error)
      return {
        success: false,
        message: '获取图谱详情失败',
        error: error.message
      }
    }
  }

  /**
   * 更新图谱
   */
  async update(graphId, data) {
    try {
      const graph = await this.graphRepository.findById(graphId)
      
      if (!graph) {
        return {
          success: false,
          message: '图谱不存在'
        }
      }

      await this.graphRepository.update(graphId, {
        name: data.name,
        description: data.description,
        config: data.config ? JSON.stringify(data.config) : undefined,
        updated_at: new Date()
      })

      return {
        success: true,
        message: '图谱更新成功'
      }
    } catch (error) {
      console.error('Update graph error:', error)
      return {
        success: false,
        message: '更新图谱失败',
        error: error.message
      }
    }
  }

  /**
   * 删除图谱
   */
  async delete(graphId) {
    try {
      const graph = await this.graphRepository.findById(graphId)
      
      if (!graph) {
        return {
          success: false,
          message: '图谱不存在'
        }
      }

      await this.graphRepository.delete(graphId)

      return {
        success: true,
        message: '图谱删除成功'
      }
    } catch (error) {
      console.error('Delete graph error:', error)
      return {
        success: false,
        message: '删除图谱失败',
        error: error.message
      }
    }
  }

  /**
   * 批量导入数据
   */
  async importData(graphId, data) {
    try {
      const graph = await this.graphRepository.findById(graphId)
      
      if (!graph) {
        return {
          success: false,
          message: '图谱不存在'
        }
      }

      const result = await this.graphRepository.bulkImport(
        graphId,
        data.nodes,
        data.edges
      )

      return {
        success: true,
        data: result,
        message: '数据导入成功'
      }
    } catch (error) {
      console.error('Import data error:', error)
      return {
        success: false,
        message: '导入数据失败',
        error: error.message
      }
    }
  }

  /**
   * 导出图谱数据
   */
  async exportData(graphId, format = 'json') {
    try {
      const graph = await this.graphRepository.findByIdWithDetails(graphId)
      
      if (!graph) {
        return {
          success: false,
          message: '图谱不存在'
        }
      }

      let exportData
      
      if (format === 'json') {
        exportData = {
          graph: {
            id: graph.id,
            name: graph.name,
            description: graph.description,
            type: graph.type,
            config: graph.config
          },
          nodes: graph.nodes,
          edges: graph.edges
        }
      } else if (format === 'graphml') {
        exportData = this.convertToGraphML(graph)
      } else if (format === 'gexf') {
        exportData = this.convertToGEXF(graph)
      } else {
        return {
          success: false,
          message: '不支持的导出格式'
        }
      }

      return {
        success: true,
        data: exportData,
        format
      }
    } catch (error) {
      console.error('Export data error:', error)
      return {
        success: false,
        message: '导出数据失败',
        error: error.message
      }
    }
  }

  /**
   * 搜索节点
   */
  async searchNodes(graphId, query, options = {}) {
    try {
      const graph = await this.graphRepository.findById(graphId)
      
      if (!graph) {
        return {
          success: false,
          message: '图谱不存在'
        }
      }

      // 如果提供了embedding，使用向量搜索
      if (options.embedding) {
        const nodes = await this.graphRepository.searchSimilarNodes(
          graphId,
          options.embedding,
          options.limit || 10
        )
        
        return {
          success: true,
          data: nodes
        }
      }

      // 否则使用文本搜索
      const nodes = await this.graphRepository.db('graph_nodes')
        .where('graph_id', graphId)
        .where('name', 'ilike', `%${query}%`)
        .limit(options.limit || 20)

      return {
        success: true,
        data: nodes
      }
    } catch (error) {
      console.error('Search nodes error:', error)
      return {
        success: false,
        message: '搜索节点失败',
        error: error.message
      }
    }
  }

  /**
   * 获取节点邻居
   */
  async getNeighbors(graphId, nodeId, depth = 1) {
    try {
      const result = await this.graphRepository.getNodeNeighbors(
        graphId,
        nodeId,
        depth
      )

      return {
        success: true,
        data: result
      }
    } catch (error) {
      console.error('Get neighbors error:', error)
      return {
        success: false,
        message: '获取邻居节点失败',
        error: error.message
      }
    }
  }

  /**
   * 运行图算法
   */
  async runAlgorithm(graphId, algorithm, params = {}) {
    try {
      const graph = await this.graphRepository.findById(graphId)
      
      if (!graph) {
        return {
          success: false,
          message: '图谱不存在'
        }
      }

      const result = await this.graphRepository.runAlgorithm(
        graphId,
        algorithm,
        params
      )

      return {
        success: true,
        data: result,
        algorithm
      }
    } catch (error) {
      console.error('Run algorithm error:', error)
      return {
        success: false,
        message: '运行算法失败',
        error: error.message
      }
    }
  }

  /**
   * 查找最短路径
   */
  async findShortestPath(graphId, sourceId, targetId) {
    try {
      const result = await this.graphRepository.findShortestPath(
        graphId,
        sourceId,
        targetId
      )

      return {
        success: true,
        data: result
      }
    } catch (error) {
      console.error('Find shortest path error:', error)
      return {
        success: false,
        message: '查找最短路径失败',
        error: error.message
      }
    }
  }

  /**
   * 转换为GraphML格式
   */
  convertToGraphML(graph) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n'
    xml += '  <graph id="' + graph.id + '" edgedefault="directed">\n'
    
    // 添加节点
    graph.nodes.forEach(node => {
      xml += `    <node id="${node.entity_id}">\n`
      xml += `      <data key="label">${node.name}</data>\n`
      xml += `      <data key="type">${node.entity_type}</data>\n`
      xml += '    </node>\n'
    })
    
    // 添加边
    graph.edges.forEach((edge, index) => {
      xml += `    <edge id="e${index}" source="${edge.source_id}" target="${edge.target_id}">\n`
      xml += `      <data key="type">${edge.relation_type}</data>\n`
      xml += `      <data key="weight">${edge.weight}</data>\n`
      xml += '    </edge>\n'
    })
    
    xml += '  </graph>\n'
    xml += '</graphml>'
    
    return xml
  }

  /**
   * 转换为GEXF格式
   */
  convertToGEXF(graph) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">\n'
    xml += '  <graph mode="static" defaultedgetype="directed">\n'
    
    // 添加节点
    xml += '    <nodes>\n'
    graph.nodes.forEach(node => {
      xml += `      <node id="${node.entity_id}" label="${node.name}" />\n`
    })
    xml += '    </nodes>\n'
    
    // 添加边
    xml += '    <edges>\n'
    graph.edges.forEach((edge, index) => {
      xml += `      <edge id="${index}" source="${edge.source_id}" target="${edge.target_id}" weight="${edge.weight}" />\n`
    })
    xml += '    </edges>\n'
    
    xml += '  </graph>\n'
    xml += '</gexf>'
    
    return xml
  }
}

module.exports = GraphService