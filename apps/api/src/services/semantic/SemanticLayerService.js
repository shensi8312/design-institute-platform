const knex = require('../../config/database')
const { SemanticChunk, SemanticDomain, SemanticType } = require('../../types/SemanticChunk')
const VectorStoreService = require('../utils/VectorStoreService')
const EmbeddingQueueService = require('./EmbeddingQueueService')
const CacheService = require('./CacheService')
const MinIOService = require('../storage/MinIOService')
const crypto = require('crypto')

/**
 * 语义层统一服务
 *
 * 功能:
 * 1. 统一的 Chunk 索引接口 (支持所有 domain/type)
 * 2. 向量存储抽象 (Milvus/Chroma/pgvector)
 * 3. 异步 embedding 队列
 * 4. 增量索引 (基于内容哈希)
 * 5. Redis 缓存层
 */
class SemanticLayerService {
  constructor() {
    this.vectorStore = new VectorStoreService()
    this.embeddingQueue = EmbeddingQueueService
    this.cache = CacheService
    this.initialized = false
  }

  /**
   * 初始化服务
   */
  async initialize() {
    if (this.initialized) return

    try {
      await this.vectorStore.initialize()
      await this.embeddingQueue.initialize()
      await this.cache.initialize()
      await MinIOService.initialize()
      this.initialized = true
      console.log('✅ SemanticLayerService 初始化完成')
    } catch (error) {
      console.error('[SemanticLayer] 初始化失败:', error)
      throw error
    }
  }

  /**
   * 索引 Chunks (支持增量更新)
   *
   * @param {string} domain - 领域枚举值
   * @param {string} type - 类型枚举值
   * @param {Array} chunks - 待索引数据
   * @param {Object} options - 选项
   */
  async indexChunks(domain, type, chunks, options = {}) {
    if (!this.initialized) await this.initialize()

    const {
      tenantId = null,
      projectId = null,
      immediate = false,
      incremental = true // 默认启用增量索引
    } = options

    try {
      console.log(`[SemanticLayer] 索引 ${domain}/${type}: ${chunks.length} 条`)

      const semanticChunks = []
      const dbRecords = []
      const updateChunks = [] // 需要更新的
      const newChunks = []     // 需要新增的

      for (const chunk of chunks) {
        const id = this._generateStableId(domain, type, chunk)
        const contentHash = this._generateContentHash(chunk.text)

        const semanticChunk = new SemanticChunk({
          id,
          domain,
          type,
          text: chunk.text,
          metadata: chunk.metadata || {},
          embedding: chunk.embedding || null,
          tenantId,
          projectId
        })

        // 增量索引检查
        if (incremental) {
          const existing = await knex('semantic_chunks')
            .where('id', id)
            .first()

          if (existing) {
            // 检查内容是否变化
            if (existing.content_hash === contentHash) {
              console.log(`[SemanticLayer] 跳过未变化: ${id}`)
              continue
            }
            console.log(`[SemanticLayer] 检测到变化,更新: ${id}`)
            updateChunks.push(semanticChunk)
          } else {
            newChunks.push(semanticChunk)
          }
        } else {
          newChunks.push(semanticChunk)
        }

        semanticChunks.push(semanticChunk)

        dbRecords.push({
          id,
          domain,
          type,
          text: chunk.text,
          metadata: JSON.stringify(semanticChunk.metadata),
          content_hash: contentHash,
          tenant_id: tenantId,
          project_id: projectId,
          indexed_at: knex.fn.now()
        })
      }

      if (semanticChunks.length === 0) {
        console.log('[SemanticLayer] 无需更新,所有内容未变化')
        return { success: true, indexed: 0, skipped: chunks.length }
      }

      console.log(`[SemanticLayer] 增量统计: 新增 ${newChunks.length}, 更新 ${updateChunks.length}`)

      // 1. 存储到 semantic_chunks 表
      await knex('semantic_chunks')
        .insert(dbRecords)
        .onConflict('id')
        .merge(['text', 'metadata', 'content_hash', 'indexed_at'])

      // 2. 生成 embedding 并索引到向量库
      if (immediate) {
        console.log('[SemanticLayer] 立即生成 embedding 并索引')
        await this._embedAndIndex(semanticChunks)
      } else {
        console.log('[SemanticLayer] 加入 embedding 队列')
        await this.embeddingQueue.enqueue(semanticChunks.map(c => c.id))
      }

      // 3. 清除相关缓存
      await this._invalidateCache(domain, type, tenantId, projectId)

      return {
        success: true,
        indexed: semanticChunks.length,
        new: newChunks.length,
        updated: updateChunks.length,
        skipped: chunks.length - semanticChunks.length
      }

    } catch (error) {
      console.error('[SemanticLayer] 索引失败:', error)
      throw error
    }
  }

  /**
   * 语义搜索 (带缓存)
   */
  async search(query, filterObj = {}, topK = 10) {
    if (!this.initialized) await this.initialize()

    try {
      // 尝试从缓存获取
      const cacheParams = { query, filter: filterObj, topK }
      const cached = await this.cache.get('search', cacheParams)
      if (cached) {
        return cached
      }

      // 从向量库搜索
      console.log(`[SemanticLayer] 搜索: "${query}"`, filterObj)
      const results = await this.vectorStore.search(query, filterObj, topK)

      // 缓存结果 (5分钟)
      await this.cache.set('search', cacheParams, results, 300)

      return results

    } catch (error) {
      console.error('[SemanticLayer] 搜索失败:', error)
      throw error
    }
  }

  /**
   * 批量删除
   */
  async deleteChunks(ids) {
    if (!this.initialized) await this.initialize()

    try {
      // 1. 从数据库删除
      await knex('semantic_chunks').whereIn('id', ids).del()

      // 2. 从向量库删除
      await this.vectorStore.delete(ids)

      // 3. 清除缓存
      await this.cache.invalidatePattern('search:*')

      console.log(`[SemanticLayer] 已删除 ${ids.length} 条`)
      return { success: true, deleted: ids.length }

    } catch (error) {
      console.error('[SemanticLayer] 删除失败:', error)
      throw error
    }
  }

  /**
   * 生成稳定 ID (基于 domain/type/source_key 的哈希)
   */
  _generateStableId(domain, type, chunk) {
    const srcKey =
      chunk.metadata?.kb_id ||
      chunk.metadata?.rule_code ||
      chunk.metadata?.template_section_id ||
      chunk.metadata?.graph_node_id ||
      chunk.metadata?.part_number ||
      chunk.text.substring(0, 50)

    const raw = `${domain}:${type}:${srcKey}`
    const hash = crypto.createHash('sha1').update(raw).digest('hex').substring(0, 16)
    return `${domain}:${type}:${hash}`
  }

  /**
   * 生成内容哈希 (用于增量索引)
   */
  _generateContentHash(text) {
    return crypto.createHash('sha256').update(text).digest('hex').substring(0, 16)
  }

  /**
   * 立即生成 embedding 并索引
   */
  async _embedAndIndex(chunks) {
    const EmbeddingService = require('../rag/EmbeddingService')
    const embeddingService = new EmbeddingService()

    for (const chunk of chunks) {
      if (!chunk.embedding) {
        chunk.embedding = await embeddingService.generateEmbedding(chunk.text)
      }
    }

    await this.vectorStore.upsert(chunks)
    console.log(`[SemanticLayer] 已索引 ${chunks.length} 个向量`)
  }

  /**
   * 清除缓存
   */
  async _invalidateCache(domain, type, tenantId, projectId) {
    const patterns = [
      'search:*',
      `search:${domain}:*`,
      tenantId ? `search:*:${tenantId}:*` : null
    ].filter(Boolean)

    for (const pattern of patterns) {
      await this.cache.invalidatePattern(pattern)
    }
  }

  /**
   * 从知识库导入
   */
  async importFromKnowledge(kbId, options = {}) {
    const docs = await knex('kb_documents')
      .where('kb_id', kbId)
      .select('*')

    const chunks = docs.map(doc => ({
      text: doc.content,
      metadata: {
        kb_id: kbId,
        doc_id: doc.id,
        doc_title: doc.title
      }
    }))

    return await this.indexChunks(
      SemanticDomain.KNOWLEDGE,
      SemanticType.CHUNK,
      chunks,
      options
    )
  }

  /**
   * 从模板导入
   */
  async importFromTemplates(templateId, options = {}) {
    const sections = await knex('template_sections')
      .where('template_id', templateId)
      .select('*')

    const chunks = sections.map(section => ({
      text: `${section.title}\n${section.content || ''}`,
      metadata: {
        template_id: templateId,
        template_section_id: section.id,
        section_code: section.section_code,
        section_title: section.title
      }
    }))

    return await this.indexChunks(
      SemanticDomain.SPEC,
      SemanticType.SECTION,
      chunks,
      options
    )
  }

  /**
   * 从规则库导入
   */
  async importFromRules(ruleType = null, options = {}) {
    let query = knex('design_rules').select('*')
    if (ruleType) {
      query = query.where('rule_type', ruleType)
    }

    const rules = await query

    const chunks = rules.map(rule => ({
      text: `${rule.rule_name}: ${rule.rule_description || ''}`,
      metadata: {
        rule_code: rule.rule_code,
        rule_name: rule.rule_name,
        rule_type: rule.rule_type,
        severity: rule.severity
      }
    }))

    return await this.indexChunks(
      SemanticDomain.RULE,
      SemanticType.RULE,
      chunks,
      options
    )
  }

  /**
   * 从知识图谱导入
   */
  async importFromGraph(graphId, options = {}) {
    const GraphService = require('../GraphService')
    const graphService = new GraphService()

    const nodes = await graphService.getAllNodes()

    const chunks = nodes.map(node => ({
      text: `${node.name}: ${node.description || ''}`,
      metadata: {
        graph_node_id: node.id,
        node_name: node.name,
        node_type: node.entity_type
      }
    }))

    return await this.indexChunks(
      SemanticDomain.GRAPH,
      SemanticType.NODE,
      chunks,
      options
    )
  }

  /**
   * 🆕 上传并处理文档 (完整工作流: MinIO → 解析 → 索引)
   */
  async uploadAndProcessDocument(fileBuffer, fileName, domain, type, options = {}) {
    if (!this.initialized) await this.initialize()

    try {
      const { tenantId = null, projectId = null, metadata = {} } = options

      console.log(`[SemanticLayer] 处理文档: ${fileName}`)

      // Step 1: 上传到 MinIO
      console.log('[SemanticLayer] 1/3 上传到 MinIO...')
      const uploadResult = await MinIOService.uploadFile(fileBuffer, fileName, {
        domain,
        type,
        tenantId,
        projectId,
        ...metadata
      })

      // Step 2: 解析文档 (使用 Docling 或其他解析器)
      console.log('[SemanticLayer] 2/3 解析文档...')
      const parseResult = await this._parseDocument(fileBuffer, fileName)

      // Step 3: 索引到语义层
      console.log('[SemanticLayer] 3/3 索引到语义层...')
      const indexResult = await this.indexChunks(
        domain,
        type,
        parseResult.chunks,
        {
          tenantId,
          projectId,
          immediate: options.immediate || false,
          incremental: true
        }
      )

      return {
        success: true,
        file: {
          fileId: uploadResult.fileId,
          objectName: uploadResult.objectName,
          size: uploadResult.size,
          url: uploadResult.url
        },
        parse: {
          chunks: parseResult.chunks.length,
          parser: parseResult.parser
        },
        index: indexResult
      }

    } catch (error) {
      console.error('[SemanticLayer] 文档处理失败:', error)
      throw error
    }
  }

  /**
   * 🆕 从 MinIO 重新处理文档
   */
  async reprocessDocument(objectName, domain, type, options = {}) {
    if (!this.initialized) await this.initialize()

    try {
      console.log(`[SemanticLayer] 重新处理文档: ${objectName}`)

      // 从 MinIO 下载
      const fileBuffer = await MinIOService.downloadFile(objectName)
      const fileInfo = await MinIOService.getFileInfo(objectName)

      // 重新解析和索引
      const parseResult = await this._parseDocument(fileBuffer, objectName)

      const indexResult = await this.indexChunks(
        domain,
        type,
        parseResult.chunks,
        options
      )

      return {
        success: true,
        objectName,
        parse: {
          chunks: parseResult.chunks.length,
          parser: parseResult.parser
        },
        index: indexResult
      }

    } catch (error) {
      console.error('[SemanticLayer] 重新处理失败:', error)
      throw error
    }
  }

  /**
   * 解析文档 (可扩展支持多种解析器)
   */
  async _parseDocument(fileBuffer, fileName) {
    // 这里可以集成 Docling 或其他解析器
    // 目前简单示例:将文档分段
    const text = fileBuffer.toString('utf-8').substring(0, 10000) // 简化处理
    const chunks = this._simpleChunk(text)

    return {
      chunks,
      parser: 'simple'
    }
  }

  /**
   * 简单分块 (示例)
   */
  _simpleChunk(text) {
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0)
    return paragraphs.map((para, idx) => ({
      text: para.trim(),
      metadata: { chunk_index: idx }
    }))
  }

  /**
   * 获取统计信息
   */
  async getStats(domain = null, tenantId = null) {
    let query = knex('semantic_chunks')

    if (domain) {
      query = query.where('domain', domain)
    }

    if (tenantId) {
      query = query.where('tenant_id', tenantId)
    }

    const stats = await query
      .select('domain', 'type')
      .count('* as count')
      .groupBy('domain', 'type')

    const cacheStats = await this.cache.getStats()
    const vectorStats = await this.vectorStore.healthCheck()
    const minioStats = await MinIOService.healthCheck()

    return {
      chunks: stats,
      cache: cacheStats,
      vectorStore: vectorStats,
      storage: minioStats
    }
  }

  /**
   * 关闭所有连接
   */
  async close() {
    await this.vectorStore.close()
    await this.cache.close()
    console.log('[SemanticLayer] 服务已关闭')
  }
}

module.exports = new SemanticLayerService()
