const MilvusService = require('../rag/MilvusService')
const VectorRepository = require('../../repositories/VectorRepository')
const { KnowledgeDocumentRepository } = require('../../repositories/KnowledgeRepository')
const DocumentVersionRepository = require('../../repositories/DocumentVersionRepository')
const GraphRAGService = require('../rag/GraphRAGService')
const DocumentErrorLogger = require('./DocumentErrorLogger')
const MinioService = require('../utils/MinioService')
const DocumentParserService = require('./DocumentParserService')
const ExtractionTemplateService = require('../extraction/ExtractionTemplateService')
const DynamicExtractionEngine = require('../extraction/DynamicExtractionEngine')

/**
 * 文档处理服务
 * 负责文档的向量化和知识图谱提取
 */
class DocumentProcessorService {
  constructor() {
    this.milvusService = new MilvusService()
    this.vectorRepository = new VectorRepository()
    this.documentRepository = new KnowledgeDocumentRepository()
    this.versionRepository = new DocumentVersionRepository()
    this.graphRAGService = new GraphRAGService()
    this.errorLogger = new DocumentErrorLogger()
    this.minioService = MinioService
    this.documentParser = new DocumentParserService()
    this.extractionTemplateService = new ExtractionTemplateService()
    this.extractionEngine = new DynamicExtractionEngine()
  }

  /**
   * 文本分块
   * 将长文本分割成适合向量化的小块
   */
  chunkText(text, chunkSize = 512, overlap = 50) {
    const chunks = []
    let start = 0

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length)
      const chunk = text.slice(start, end)

      if (chunk.trim().length > 0) {
        chunks.push({
          text: chunk.trim(),
          start_pos: start,
          end_pos: end
        })
      }

      start += chunkSize - overlap
    }

    return chunks
  }

  /**
   * 从Minio读取并解析文档内容
   */
  async extractTextContent(document) {
    try {
      // 如果文档有content字段且不为空，直接使用
      if (document.content && document.content.trim().length > 0) {
        console.log(`[DocumentProcessor] 使用数据库中的content字段，长度: ${document.content.length}`)
        return document.content
      }

      // 如果有minio_path，从Minio读取并解析
      if (document.minio_path) {
        console.log(`[DocumentProcessor] 从Minio读取文件: ${document.minio_path}`)

        // 使用knowledge-documents bucket
        const bucketName = 'knowledge-documents'
        let objectPath = document.minio_path

        // 如果路径包含documents/前缀，去掉前缀
        if (objectPath.startsWith('documents/')) {
          objectPath = objectPath.replace('documents/', '')
        }

        // 从Minio获取文件内容
        const fileBuffer = await this.minioService.getFile(bucketName, objectPath)
        console.log(`[DocumentProcessor] 文件读取成功，大小: ${fileBuffer.length} bytes`)

        // 使用DocumentParserService解析
        const textContent = await this.documentParser.parseDocument(
          fileBuffer,
          document.file_type || 'application/pdf',
          document.name
        )

        if (textContent && textContent.trim().length > 0) {
          console.log(`[DocumentProcessor] 文档解析成功，提取文本长度: ${textContent.length}`)
          return textContent
        }
      }

      // 如果都没有，返回默认文本
      console.warn(`[DocumentProcessor] 文档无content也无minio_path，使用默认文本`)
      return '这是一个测试文档内容。'

    } catch (error) {
      console.error(`[DocumentProcessor] 文本提取失败:`, error.message)
      throw new Error(`文本提取失败: ${error.message}`)
    }
  }

  /**
   * 调用vLLM生成向量 (OpenAI兼容格式)
   */
  async generateEmbedding(text) {
    try {
      const apiBase = process.env.EMBEDDING_API_BASE || 'http://10.10.18.3:11434/v1'
      const model = process.env.EMBEDDING_MODEL || '/mnt/data/models/bge-large-zh-v1.5'

      const response = await fetch(`${apiBase}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          input: text  // OpenAI格式使用input字段
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`vLLM Embedding API error: ${response.status} ${errorText}`)
      }

      const data = await response.json()
      return data.data[0].embedding  // OpenAI格式返回data[0].embedding
    } catch (error) {
      console.error('[DocumentProcessor] Embedding生成失败:', error.message)
      throw error
    }
  }

  /**
   * 处理文档：提取文本、分块、向量化、存储
   */
  async processDocument(docId) {
    try {
      console.log(`[DocumentProcessor] 开始处理文档: ${docId}`)

      // 1. 获取文档信息
      const document = await this.documentRepository.findById(docId)
      if (!document) {
        throw new Error('文档不存在')
      }

      // 2. 获取当前版本
      const currentVersion = await this.versionRepository.getCurrentVersion(docId)
      if (!currentVersion) {
        throw new Error('文档版本不存在')
      }

      // 3. 更新状态为processing
      await this.documentRepository.update(docId, {
        status: 'processing',
        vector_status: 'processing',
        graph_status: 'processing'
      })

      // 4. 从Minio读取并解析文档内容
      const textContent = await this.extractTextContent(document)
      console.log(`[DocumentProcessor] 文本提取完成，长度: ${textContent.length}`)

      // 5. 文本分块
      const chunks = this.chunkText(textContent)
      console.log(`[DocumentProcessor] 文本分块完成，共${chunks.length}个块`)

      // 6. 生成向量并存储到Milvus
      const vectorRecords = []
      const milvusData = []

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]

        try {
          // 生成向量
          const embedding = await this.generateEmbedding(chunk.text)

          // 准备Milvus数据
          milvusData.push({
            document_id: docId,
            chunk_index: i,
            chunk_text: chunk.text,
            embedding: embedding
          })

          console.log(`[DocumentProcessor] 块 ${i + 1}/${chunks.length} 向量生成成功`)
        } catch (error) {
          console.error(`[DocumentProcessor] 块 ${i} 向量生成失败:`, error.message)
        }
      }

      // 7. 批量插入Milvus
      let milvusResult
      if (milvusData.length > 0) {
        // 确保Milvus集合存在
        console.log(`[DocumentProcessor] 检查Milvus集合...`)
        await this.milvusService.initCollection()

        console.log(`[DocumentProcessor] 开始插入Milvus，共${milvusData.length}条`)
        milvusResult = await this.milvusService.insertVectors(milvusData)

        if (milvusResult && milvusResult.success) {
          console.log(`[DocumentProcessor] Milvus插入成功: ${milvusResult.insert_count}条`)
        } else {
          console.error(`[DocumentProcessor] Milvus插入失败:`, milvusResult?.error)
        }
      }

      // 8. 保存向量记录到PostgreSQL
      if (milvusResult && milvusResult.success) {
        for (let i = 0; i < milvusData.length; i++) {
          vectorRecords.push({
            document_id: docId,
            version_id: currentVersion.id,
            chunk_index: i,
            chunk_text: milvusData[i].chunk_text,
            milvus_id: milvusResult.ids[i] // Milvus返回的ID
          })
        }

        if (vectorRecords.length > 0) {
          await this.vectorRepository.batchInsertVectors(vectorRecords)
          console.log(`[DocumentProcessor] 向量记录保存到PostgreSQL，共${vectorRecords.length}条`)
        }
      }

      // 9. 提取知识图谱
      console.log(`[DocumentProcessor] 开始知识图谱提取`)
      const graphResult = await this.graphRAGService.extractGraph(
        docId,
        currentVersion.id,
        textContent
      )

      if (graphResult.success) {
        console.log(`[DocumentProcessor] 图谱提取完成: ${graphResult.nodes_count}个节点, ${graphResult.relationships_count}个关系`)
      } else {
        console.error(`[DocumentProcessor] 图谱提取失败:`, graphResult.error)
      }

      // 10. 更新文档状态
      await this.documentRepository.update(docId, {
        status: 'processed',
        vector_status: 'completed',
        graph_status: graphResult.success ? 'completed' : 'failed',
        vector_indexed_at: new Date(),
        graph_indexed_at: graphResult.success ? new Date() : null
      })

      console.log(`[DocumentProcessor] 文档处理完成: ${docId}`)

      // 11. 自动提取设计规则（如果图谱提取成功）
      let rulesExtracted = 0
      if (graphResult.success && (graphResult.nodes_count || 0) > 0) {
        try {
          console.log(`[DocumentProcessor] 开始自动提取设计规则...`)
          const RuleExtractionService = require('../rules/RuleExtractionService')
          const ruleService = new RuleExtractionService()
          const ruleResult = await ruleService.extractRulesFromGraph(docId)

          if (ruleResult.success) {
            rulesExtracted = ruleResult.data?.extracted_count || 0
            console.log(`[DocumentProcessor] 规则提取完成: 提取了${rulesExtracted}条规则`)
          } else {
            console.log(`[DocumentProcessor] 规则提取失败: ${ruleResult.message}`)
          }
        } catch (ruleError) {
          console.error(`[DocumentProcessor] 规则提取异常:`, ruleError.message)
          // 规则提取失败不影响整体流程
        }
      }

      // 12. 结构化数据提取（新增）
      let extractionsCount = 0
      try {
        console.log(`[DocumentProcessor] 开始结构化提取...`)

        // 获取启用的提取模板
        const templates = await this.extractionTemplateService.getTemplates({ enabled: true })

        if (templates.length > 0) {
          console.log(`[DocumentProcessor] 找到 ${templates.length} 个启用的提取模板`)

          // 获取前10个向量块的文本用于提取
          const sampleChunks = chunks.slice(0, Math.min(10, chunks.length))
          const sampleText = sampleChunks.map(c => c.text).join('\n\n')

          if (sampleText.length > 100) {
            // 执行批量提取
            const extractionResults = await this.extractionEngine.extractBatch(sampleText, templates)

            // 保存提取结果
            if (extractionResults.length > 0) {
              await this.extractionTemplateService.saveExtractionBatch(docId, extractionResults)
              extractionsCount = extractionResults.length
              console.log(`[DocumentProcessor] 结构化提取完成: ${extractionsCount} 项数据`)
            }
          } else {
            console.log(`[DocumentProcessor] 文本过短，跳过结构化提取`)
          }
        } else {
          console.log(`[DocumentProcessor] 未找到启用的提取模板，跳过结构化提取`)
        }
      } catch (extractionError) {
        console.error(`[DocumentProcessor] 结构化提取异常:`, extractionError.message)
        // 提取失败不影响整体流程
      }

      return {
        success: true,
        document_id: docId,
        chunks_count: chunks.length,
        vectors_count: vectorRecords.length,
        graph_nodes_count: graphResult.nodes_count || 0,
        graph_relationships_count: graphResult.relationships_count || 0,
        rules_extracted: rulesExtracted,
        extractions_count: extractionsCount
      }
    } catch (error) {
      console.error(`[DocumentProcessor] 文档处理失败: ${docId}`, error)

      // 记录详细错误到错误日志表
      await this.errorLogger.logError({
        documentId: docId,
        errorStage: this.detectErrorStage(error),
        errorType: error.name || 'UnknownError',
        errorMessage: error.message || '未知错误',
        errorDetails: {
          stack: error.stack,
          timestamp: new Date().toISOString(),
          processStep: 'document_processing'
        },
        maxRetries: 3
      })

      // 更新为失败状态
      try {
        await this.documentRepository.update(docId, {
          status: 'failed',
          vectorization_status: 'failed',
          graph_extraction_status: 'failed',
          vectorization_error: error.message,
          graph_extraction_error: error.message
        })
      } catch (updateError) {
        console.error(`[DocumentProcessor] 更新失败状态出错:`, updateError)
      }

      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 语义搜索
   */
  async semanticSearch(query, options = {}) {
    try {
      const {
        kb_id = null,
        doc_ids = null,
        top_k = 5,
        threshold = 0.7
      } = options

      console.log('[SemanticSearch] 查询:', query)

      // 1. 生成查询向量
      const queryEmbedding = await this.generateEmbedding(query)

      // 2. 在Milvus中搜索
      const filter = doc_ids ? `document_id in [${doc_ids.map(id => `"${id}"`).join(',')}]` : null
      const searchResults = await this.milvusService.search(queryEmbedding, top_k, filter)

      if (!searchResults.success) {
        throw new Error('向量搜索失败')
      }

      // 3. Milvus已经返回了所有需要的字段，直接使用
      const docIds = [...new Set(searchResults.results.map(r => r.document_id))]

      // 4. 获取文档信息
      const documents = await this.documentRepository.db('knowledge_documents')
        .whereIn('id', docIds)

      // 5. 组合结果
      const results = searchResults.results.map(milvusResult => {
        const document = documents.find(d => d.id === milvusResult.document_id)

        return {
          score: milvusResult.score,
          chunk_text: milvusResult.chunk_text,
          chunk_index: milvusResult.chunk_index,
          document_id: milvusResult.document_id,
          document_name: document?.name,
          file_type: document?.file_type,
          kb_id: milvusResult.kb_id
        }
      }).filter(r => r.score >= threshold)

      console.log(`[SemanticSearch] 找到${results.length}个结果`)

      return {
        success: true,
        query: query,
        results: results
      }
    } catch (error) {
      console.error('[SemanticSearch] 搜索失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 删除文档的所有向量
   */
  async deleteDocumentVectors(docId) {
    try {
      // 1. 从PostgreSQL获取所有Milvus ID
      const vectors = await this.vectorRepository.getVectorsByDocId(docId)
      const milvusIds = vectors.map(v => v.milvus_id).filter(id => id)

      // 2. 从Milvus删除
      if (milvusIds.length > 0) {
        await this.milvusService.deleteVectors(milvusIds)
        console.log(`[DeleteVectors] 从Milvus删除${milvusIds.length}个向量`)
      }

      // 3. 从PostgreSQL删除
      await this.vectorRepository.deleteByDocId(docId)
      console.log(`[DeleteVectors] 从PostgreSQL删除向量记录`)

      return { success: true, deleted: milvusIds.length }
    } catch (error) {
      console.error('[DeleteVectors] 删除失败:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 检测错误发生在哪个阶段
   * @param {Error} error
   * @returns {string} 错误阶段
   */
  detectErrorStage(error) {
    const message = error.message || ''
    const stack = error.stack || ''

    // 根据错误信息判断阶段
    if (message.includes('OCR') || message.includes('paddle') || message.includes('tesseract')) {
      return 'ocr'
    }
    if (message.includes('YOLO') || message.includes('detection')) {
      return 'yolo'
    }
    if (message.includes('vector') || message.includes('Milvus') || message.includes('embedding')) {
      return 'vectorization'
    }
    if (message.includes('graph') || message.includes('Neo4j') || stack.includes('GraphRAGService')) {
      return 'graph_extraction'
    }
    if (message.includes('rule') || stack.includes('RuleExtractionService')) {
      return 'rule_extraction'
    }
    if (message.includes('parse') || message.includes('PDF') || message.includes('Word')) {
      return 'parsing'
    }

    return 'unknown'
  }
}

module.exports = DocumentProcessorService
