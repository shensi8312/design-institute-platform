const BaseRepository = require('./BaseRepository')

/**
 * 知识图谱Repository
 */
class GraphRepository extends BaseRepository {
  constructor() {
    super('knowledge_graphs')
  }

  /**
   * 获取用户的图谱列表
   */
  async findByUser(userId, organizationId, options = {}) {
    let query = this.db('knowledge_graphs')
      .select([
        'knowledge_graphs.*',
        'knowledge_bases.name as kb_name',
        this.db.raw('COUNT(DISTINCT graph_nodes.id) as node_count'),
        this.db.raw('COUNT(DISTINCT graph_edges.id) as edge_count')
      ])
      .leftJoin('knowledge_bases', 'knowledge_graphs.kb_id', 'knowledge_bases.id')
      .leftJoin('graph_nodes', 'knowledge_graphs.id', 'graph_nodes.graph_id')
      .leftJoin('graph_edges', 'knowledge_graphs.id', 'graph_edges.graph_id')
      .where('knowledge_graphs.organization_id', organizationId)
      .groupBy('knowledge_graphs.id', 'knowledge_bases.name')
    
    if (options.status) {
      query = query.where('knowledge_graphs.status', options.status)
    }
    
    if (options.kb_id) {
      query = query.where('knowledge_graphs.kb_id', options.kb_id)
    }
    
    return await query.orderBy('knowledge_graphs.updated_at', 'desc')
  }

  /**
   * 获取图谱详情（包含节点和边）
   */
  async findByIdWithDetails(graphId) {
    const graph = await this.findById(graphId)
    
    if (graph) {
      // 获取节点
      graph.nodes = await this.db('graph_nodes')
        .where('graph_id', graphId)
        .orderBy('created_at', 'asc')
      
      // 获取边
      graph.edges = await this.db('graph_edges')
        .where('graph_id', graphId)
        .orderBy('created_at', 'asc')
      
      // 解析JSON字段
      graph.config = JSON.parse(graph.config || '{}')
      graph.statistics = JSON.parse(graph.statistics || '{}')
    }
    
    return graph
  }

  /**
   * 创建或更新节点
   */
  async upsertNode(graphId, nodeData) {
    const existing = await this.db('graph_nodes')
      .where('graph_id', graphId)
      .where('entity_id', nodeData.entity_id)
      .first()
    
    if (existing) {
      await this.db('graph_nodes')
        .where('id', existing.id)
        .update({
          ...nodeData,
          updated_at: new Date()
        })
      return existing.id
    } else {
      const result = await this.db('graph_nodes').insert({
        graph_id: graphId,
        ...nodeData,
        created_at: new Date()
      }).returning('id')
      return result[0].id
    }
  }

  /**
   * 创建或更新边
   */
  async upsertEdge(graphId, edgeData) {
    const existing = await this.db('graph_edges')
      .where('graph_id', graphId)
      .where('source_id', edgeData.source_id)
      .where('target_id', edgeData.target_id)
      .where('relation_type', edgeData.relation_type)
      .first()
    
    if (existing) {
      await this.db('graph_edges')
        .where('id', existing.id)
        .update({
          weight: edgeData.weight || existing.weight,
          properties: JSON.stringify(edgeData.properties || {}),
          updated_at: new Date()
        })
      return existing.id
    } else {
      const result = await this.db('graph_edges').insert({
        graph_id: graphId,
        ...edgeData,
        properties: JSON.stringify(edgeData.properties || {}),
        created_at: new Date()
      }).returning('id')
      return result[0].id
    }
  }

  /**
   * 批量导入节点和边
   */
  async bulkImport(graphId, nodes, edges) {
    return await this.db.transaction(async (trx) => {
      // 清除旧数据
      await trx('graph_nodes').where('graph_id', graphId).delete()
      await trx('graph_edges').where('graph_id', graphId).delete()
      
      // 批量插入节点
      if (nodes && nodes.length > 0) {
        const nodeRecords = nodes.map(node => ({
          graph_id: graphId,
          entity_id: node.entity_id,
          entity_type: node.entity_type,
          name: node.name,
          properties: JSON.stringify(node.properties || {}),
          embedding: node.embedding,
          created_at: new Date()
        }))
        await trx('graph_nodes').insert(nodeRecords)
      }
      
      // 批量插入边
      if (edges && edges.length > 0) {
        const edgeRecords = edges.map(edge => ({
          graph_id: graphId,
          source_id: edge.source_id,
          target_id: edge.target_id,
          relation_type: edge.relation_type,
          weight: edge.weight || 1.0,
          properties: JSON.stringify(edge.properties || {}),
          created_at: new Date()
        }))
        await trx('graph_edges').insert(edgeRecords)
      }
      
      // 更新统计信息
      await trx('knowledge_graphs')
        .where('id', graphId)
        .update({
          statistics: JSON.stringify({
            node_count: nodes ? nodes.length : 0,
            edge_count: edges ? edges.length : 0,
            updated_at: new Date()
          }),
          updated_at: new Date()
        })
      
      return { node_count: nodes.length, edge_count: edges.length }
    })
  }

  /**
   * 搜索相似节点
   */
  async searchSimilarNodes(graphId, embedding, limit = 10) {
    // 使用向量相似度搜索
    const query = `
      SELECT 
        id, entity_id, entity_type, name, properties,
        1 - (embedding <=> $1::vector) as similarity
      FROM graph_nodes
      WHERE graph_id = $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `
    
    const result = await this.db.raw(query, [embedding, graphId, limit])
    return result.rows
  }

  /**
   * 获取节点的邻居
   */
  async getNodeNeighbors(graphId, nodeId, depth = 1) {
    const visited = new Set()
    const result = { nodes: [], edges: [] }
    
    async function traverse(currentId, currentDepth) {
      if (currentDepth > depth || visited.has(currentId)) return
      visited.add(currentId)
      
      // 获取相连的边
      const edges = await this.db('graph_edges')
        .where('graph_id', graphId)
        .where(function() {
          this.where('source_id', currentId).orWhere('target_id', currentId)
        })
      
      for (const edge of edges) {
        result.edges.push(edge)
        
        const neighborId = edge.source_id === currentId ? edge.target_id : edge.source_id
        if (!visited.has(neighborId)) {
          const node = await this.db('graph_nodes')
            .where('graph_id', graphId)
            .where('entity_id', neighborId)
            .first()
          
          if (node) {
            result.nodes.push(node)
            if (currentDepth < depth) {
              await traverse(neighborId, currentDepth + 1)
            }
          }
        }
      }
    }
    
    await traverse(nodeId, 0)
    return result
  }

  /**
   * 执行图算法
   */
  async runAlgorithm(graphId, algorithm, params = {}) {
    switch (algorithm) {
      case 'pagerank':
        return await this.calculatePageRank(graphId, params)
      case 'community':
        return await this.detectCommunities(graphId, params)
      case 'centrality':
        return await this.calculateCentrality(graphId, params)
      case 'shortest_path':
        return await this.findShortestPath(graphId, params.source, params.target)
      default:
        throw new Error(`Unknown algorithm: ${algorithm}`)
    }
  }

  /**
   * 计算PageRank
   */
  async calculatePageRank(graphId, params = {}) {
    // 简化的PageRank实现
    const damping = params.damping || 0.85
    const iterations = params.iterations || 20
    
    const nodes = await this.db('graph_nodes').where('graph_id', graphId)
    const edges = await this.db('graph_edges').where('graph_id', graphId)
    
    // 初始化PageRank值
    const pagerank = {}
    const N = nodes.length
    nodes.forEach(node => {
      pagerank[node.entity_id] = 1.0 / N
    })
    
    // 构建邻接表
    const outlinks = {}
    edges.forEach(edge => {
      if (!outlinks[edge.source_id]) outlinks[edge.source_id] = []
      outlinks[edge.source_id].push(edge.target_id)
    })
    
    // 迭代计算
    for (let i = 0; i < iterations; i++) {
      const newPagerank = {}
      
      nodes.forEach(node => {
        const nodeId = node.entity_id
        newPagerank[nodeId] = (1 - damping) / N
        
        // 收集入链贡献
        edges.forEach(edge => {
          if (edge.target_id === nodeId) {
            const sourceOutlinks = outlinks[edge.source_id] || []
            if (sourceOutlinks.length > 0) {
              newPagerank[nodeId] += damping * (pagerank[edge.source_id] / sourceOutlinks.length)
            }
          }
        })
      })
      
      Object.assign(pagerank, newPagerank)
    }
    
    return pagerank
  }

  /**
   * 社区检测（简化版）
   */
  async detectCommunities(graphId, params = {}) {
    // 使用简单的连通分量算法
    const nodes = await this.db('graph_nodes').where('graph_id', graphId)
    const edges = await this.db('graph_edges').where('graph_id', graphId)
    
    const communities = {}
    let communityId = 0
    const visited = new Set()
    
    const dfs = (nodeId, currentCommunity) => {
      if (visited.has(nodeId)) return
      visited.add(nodeId)
      communities[nodeId] = currentCommunity
      
      edges.forEach(edge => {
        if (edge.source_id === nodeId && !visited.has(edge.target_id)) {
          dfs(edge.target_id, currentCommunity)
        } else if (edge.target_id === nodeId && !visited.has(edge.source_id)) {
          dfs(edge.source_id, currentCommunity)
        }
      })
    }
    
    nodes.forEach(node => {
      if (!visited.has(node.entity_id)) {
        dfs(node.entity_id, communityId++)
      }
    })
    
    return communities
  }

  /**
   * 计算中心性
   */
  async calculateCentrality(graphId, params = {}) {
    const type = params.type || 'degree'
    const nodes = await this.db('graph_nodes').where('graph_id', graphId)
    const edges = await this.db('graph_edges').where('graph_id', graphId)
    
    const centrality = {}
    
    if (type === 'degree') {
      // 度中心性
      nodes.forEach(node => {
        centrality[node.entity_id] = 0
      })
      
      edges.forEach(edge => {
        centrality[edge.source_id] = (centrality[edge.source_id] || 0) + 1
        centrality[edge.target_id] = (centrality[edge.target_id] || 0) + 1
      })
    }
    
    return centrality
  }

  /**
   * 最短路径
   */
  async findShortestPath(graphId, sourceId, targetId) {
    const edges = await this.db('graph_edges').where('graph_id', graphId)
    
    // 构建邻接表
    const graph = {}
    edges.forEach(edge => {
      if (!graph[edge.source_id]) graph[edge.source_id] = []
      if (!graph[edge.target_id]) graph[edge.target_id] = []
      graph[edge.source_id].push({ node: edge.target_id, weight: edge.weight || 1 })
      graph[edge.target_id].push({ node: edge.source_id, weight: edge.weight || 1 })
    })
    
    // Dijkstra算法
    const distances = { [sourceId]: 0 }
    const previous = {}
    const queue = [sourceId]
    const visited = new Set()
    
    while (queue.length > 0) {
      // 找到最小距离节点
      let minNode = null
      let minIndex = -1
      queue.forEach((node, index) => {
        if (!minNode || distances[node] < distances[minNode]) {
          minNode = node
          minIndex = index
        }
      })
      
      if (!minNode) break
      queue.splice(minIndex, 1)
      
      if (minNode === targetId) break
      if (visited.has(minNode)) continue
      visited.add(minNode)
      
      // 更新邻居距离
      const neighbors = graph[minNode] || []
      neighbors.forEach(({ node, weight }) => {
        const alt = distances[minNode] + weight
        if (distances[node] === undefined || alt < distances[node]) {
          distances[node] = alt
          previous[node] = minNode
          if (!queue.includes(node)) queue.push(node)
        }
      })
    }
    
    // 重建路径
    const path = []
    let current = targetId
    while (current !== undefined) {
      path.unshift(current)
      current = previous[current]
    }
    
    return {
      path,
      distance: distances[targetId] || Infinity,
      found: distances[targetId] !== undefined
    }
  }
}

module.exports = GraphRepository