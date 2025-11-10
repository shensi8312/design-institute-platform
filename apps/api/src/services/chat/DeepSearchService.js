const VectorService = require('../knowledge/VectorService')
const db = require('../../config/database')

/**
 * 深度搜索服务
 * 在知识库中进行深度检索，返回带来源引用的结果
 */
class DeepSearchService {
  constructor() {
    this.vectorService = VectorService // VectorService 是单例，直接使用
  }

  /**
   * 深度搜索知识库
   * @param {string} query - 查询文本
   * @param {object} options - 搜索选项
   * @returns {Promise<object>} 搜索结果和来源引用
   */
  async search(query, options = {}) {
    const {
      userId,
      topK = 5,
      minScore = 0.6,
      includeGraph = true
    } = options

    try {
      console.log(`[深度搜索] 查询: "${query}", topK=${topK}`)

      // 1. 向量检索
      const vectorResults = await this.vectorSearch(query, {
        topK: topK * 2, // 多取一些候选
        userId
      })

      console.log(`[深度搜索] 向量检索返回 ${vectorResults.length} 条结果`)

      // 2. 过滤相关性分数
      const filteredResults = vectorResults.filter(r => r.score >= minScore)

      console.log(`[深度搜索] 过滤后剩余 ${filteredResults.length} 条结果 (score >= ${minScore})`)

      // 3. 获取文档详情和权限
      const enrichedResults = await this.enrichResults(filteredResults, userId)

      // 4. 如果启用图谱增强，进行图谱检索
      let graphContext = null
      if (includeGraph && enrichedResults.length > 0) {
        graphContext = await this.getGraphContext(enrichedResults, query)
      }

      // 5. 生成来源引用
      const sources = this.generateSourceCitations(enrichedResults)

      // 6. 构建上下文
      const context = this.buildContext(enrichedResults, graphContext)

      return {
        success: true,
        data: {
          context,
          sources,
          totalResults: enrichedResults.length,
          graphEnhanced: !!graphContext
        }
      }
    } catch (error) {
      console.error('[深度搜索] 失败:', error)
      return {
        success: false,
        error: error.message,
        data: {
          context: '',
          sources: [],
          totalResults: 0
        }
      }
    }
  }

  /**
   * 向量检索
   */
  async vectorSearch(query, options) {
    try {
      const { topK, userId } = options

      // 使用VectorService进行检索
      const result = await this.vectorService.search(query, {
        limit: topK,
        collection: 'knowledge_base'
      })

      if (!result.success || !result.data) {
        return []
      }

      return result.data.map(item => ({
        id: item.id,
        content: item.text || item.content,
        score: item.score || item.distance,
        metadata: item.metadata || {}
      }))
    } catch (error) {
      console.error('[向量检索] 失败:', error)
      return []
    }
  }

  /**
   * 丰富检索结果（添加文档信息和权限检查）
   */
  async enrichResults(results, userId) {
    const enriched = []

    for (const result of results) {
      try {
        // 从metadata中获取文档ID
        const docId = result.metadata?.document_id || result.metadata?.doc_id

        if (!docId) {
          console.warn('[深度搜索] 结果缺少document_id:', result)
          continue
        }

        // 获取文档信息（包含minio_path用于预览）
        const doc = await db('knowledge_documents')
          .where({ id: docId })
          .first()

        if (!doc) {
          console.warn(`[深度搜索] 文档不存在: ${docId}`)
          continue
        }

        // 提取章节信息（从 metadata 或 content 中）
        let section = null
        let article = null

        // 尝试从文档metadata中获取章节信息
        if (doc.metadata && doc.metadata.structure) {
          const chunkIndex = result.metadata?.chunk_index || 0
          const structure = doc.metadata.structure
          // 根据chunk_index查找对应的章节
          if (structure.sections && structure.sections[chunkIndex]) {
            section = structure.sections[chunkIndex].title
            article = structure.sections[chunkIndex].article
          }
        }

        // 如果没有结构化数据，尝试从内容中提取
        if (!section && result.content) {
          const sectionMatch = result.content.match(/第[一二三四五六七八九十\d]+章\s+(.+?)[\n\r]/)
          const articleMatch = result.content.match(/第[\d.]+条/)
          if (sectionMatch) section = sectionMatch[0]
          if (articleMatch) article = articleMatch[0]
        }

        enriched.push({
          ...result,
          document: {
            id: doc.id,
            name: doc.name,
            file_type: doc.file_type,
            file_path: doc.file_path,
            minio_path: doc.minio_path,
            created_at: doc.created_at
          },
          page: result.metadata?.page || null,
          section: section,
          article: article,
          chunk_index: result.metadata?.chunk_index || null
        })
      } catch (error) {
        console.error('[丰富结果] 处理失败:', error)
      }
    }

    return enriched
  }

  /**
   * 获取图谱上下文
   */
  async getGraphContext(results, query) {
    try {
      // 从检索结果中提取相关的图谱节点
      const docIds = [...new Set(results.map(r => r.document.id))]

      // 查询这些文档的图谱节点
      const nodes = await db('knowledge_graph_nodes')
        .whereIn('document_id', docIds)
        .limit(10)

      if (nodes.length === 0) {
        return null
      }

      // 查询节点之间的关系
      const nodeIds = nodes.map(n => n.id)
      const relationships = await db('knowledge_graph_relationships')
        .where(function() {
          this.whereIn('source_node_id', nodeIds)
            .orWhereIn('target_node_id', nodeIds)
        })
        .limit(20)

      return {
        nodes: nodes.map(n => ({
          id: n.id,
          name: n.entity_name,
          type: n.entity_type,
          properties: n.properties
        })),
        relationships: relationships.map(r => ({
          source: r.source_node_id,
          target: r.target_node_id,
          type: r.relationship_type
        }))
      }
    } catch (error) {
      console.error('[图谱上下文] 获取失败:', error)
      return null
    }
  }

  /**
   * 生成来源引用
   */
  generateSourceCitations(results) {
    return results.map((result, index) => {
      let citation = `[${index + 1}] ${result.document.name}`

      // 添加章节信息
      if (result.section) {
        citation += ` - ${result.section}`
      }

      // 添加条款信息
      if (result.article) {
        citation += ` ${result.article}`
      }

      // 添加页码信息
      if (result.page) {
        citation += ` (第${result.page}页)`
      }

      return {
        id: index + 1,
        citation: citation,
        document_name: result.document.name,
        document_id: result.document.id,
        section: result.section,
        article: result.article,
        page: result.page,
        score: result.score,
        preview: result.content.substring(0, 150) + '...',
        full_content: result.content,
        file_type: result.document.file_type,
        file_path: result.document.file_path,
        minio_path: result.document.minio_path
      }
    })
  }

  /**
   * 构建上下文字符串
   */
  buildContext(results, graphContext) {
    let context = '以下是从知识库中检索到的相关信息：\n\n'

    // 添加向量检索结果
    results.forEach((result, index) => {
      let sourceLabel = `[来源${index + 1}] ${result.document.name}`
      if (result.section) sourceLabel += ` - ${result.section}`
      if (result.article) sourceLabel += ` ${result.article}`
      if (result.page) sourceLabel += ` (第${result.page}页)`

      context += `${sourceLabel}\n${result.content}\n\n`
    })

    // 添加图谱增强信息
    if (graphContext && graphContext.nodes.length > 0) {
      context += '\n【知识图谱关联信息】\n'
      graphContext.nodes.forEach(node => {
        context += `- ${node.name} (${node.type})\n`
      })
      context += '\n'
    }

    return context
  }

  /**
   * 为LLM准备prompt
   */
  preparePromptWithContext(query, context, sources) {
    let prompt = `你是一个专业的知识问答助手。请基于以下知识库内容回答用户的问题。

${context}

用户问题: ${query}

请基于上述知识库内容回答问题。如果知识库中没有相关信息，请明确告知用户。回答时请保持专业和准确。`

    return prompt
  }
}

module.exports = DeepSearchService
