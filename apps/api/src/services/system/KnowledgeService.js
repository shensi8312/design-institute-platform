const BaseService = require('../BaseService')
const { KnowledgeRepository } = require('../../repositories/KnowledgeRepository')
const db = require('../../config/database')
const SystemAuditService = require('./SystemAuditService')
const auditService = new SystemAuditService()
const crypto = require('crypto')

/**
 * 知识管理服务
 */
class KnowledgeService extends BaseService {
  constructor() {
    const repository = new KnowledgeRepository()
    super(repository)
    this.knowledgeRepository = repository
    this.auditService = auditService

    // 延迟加载以避免循环依赖
    this._documentProcessor = null
    this._minioService = null
    this._documentRepository = null
    this._versionRepository = null
  }

  get documentRepository() {
    if (!this._documentRepository) {
      // DocumentRepository不存在,直接使用db查询
      this._documentRepository = {
        findById: async (id) => {
          return await db('knowledge_documents').where('id', id).first()
        },
        findAll: async (filters = {}) => {
          let query = db('knowledge_documents').whereNull('deleted_at')
          if (filters.kb_id) query = query.where('kb_id', filters.kb_id)
          return await query.orderBy('created_at', 'desc')
        },
        update: async (id, data) => {
          const [updated] = await db('knowledge_documents').where('id', id).update(data).returning('*')
          return updated
        },
        softDelete: async (id) => {
          await db('knowledge_documents').where('id', id).update({ deleted_at: db.fn.now() })
        },
        deleteChunks: async (docId) => {
          await db('knowledge_chunks').where('document_id', docId).del()
        }
      }
    }
    return this._documentRepository
  }

  get versionRepository() {
    if (!this._versionRepository) {
      const DocumentVersionRepository = require('../../repositories/DocumentVersionRepository')
      this._versionRepository = new DocumentVersionRepository()
    }
    return this._versionRepository
  }

  get documentProcessor() {
    if (!this._documentProcessor) {
      const DocumentProcessorService = require('../document/DocumentProcessorService')
      this._documentProcessor = new DocumentProcessorService()
    }
    return this._documentProcessor
  }

  get minioService() {
    if (!this._minioService) {
      // MinioService导出的是单例实例，直接使用
      this._minioService = require('../utils/MinioService')
    }
    return this._minioService
  }

  /**
   * 获取知识库列表
   */
  async getKnowledgeBases(userId = null, filters = {}) {
    try {
      const bases = await this.knowledgeRepository.findAll({
        userId,
        ...filters
      })

      return {
        success: true,
        data: bases
      }
    } catch (error) {
      console.error('获取知识库列表失败:', error)
      return {
        success: false,
        message: '获取知识库列表失败',
        error: error.message
      }
    }
  }

  /**
   * 创建知识库
   */
  async createKnowledgeBase(data, userId) {
    try {
      const kb = await this.knowledgeRepository.create({
        ...data,
        created_by: userId
      })

      // 记录审计日志
      await auditService.log({
        userId,
        module: 'knowledge',
        action: 'create_knowledge_base',
        resourceType: 'knowledge_base',
        resourceId: kb.id,
        resourceName: kb.name,
        newValue: kb,
        status: 'success'
      })

      return {
        success: true,
        message: '知识库创建成功',
        data: kb
      }
    } catch (error) {
      console.error('创建知识库失败:', error)
      return {
        success: false,
        message: '创建知识库失败',
        error: error.message
      }
    }
  }

  /**
   * 更新知识库
   */
  async updateKnowledgeBase(kbId, data, userId) {
    try {
      const oldKb = await this.knowledgeRepository.findById(kbId)
      if (!oldKb) {
        return {
          success: false,
          message: '知识库不存在'
        }
      }

      const kb = await this.knowledgeRepository.update(kbId, data)

      // 记录审计日志
      await auditService.log({
        userId,
        module: 'knowledge',
        action: 'update_knowledge_base',
        resourceType: 'knowledge_base',
        resourceId: kbId,
        resourceName: kb.name,
        oldValue: oldKb,
        newValue: kb,
        status: 'success'
      })

      return {
        success: true,
        message: '知识库更新成功',
        data: kb
      }
    } catch (error) {
      console.error('更新知识库失败:', error)
      return {
        success: false,
        message: '更新知识库失败',
        error: error.message
      }
    }
  }

  /**
   * 删除知识库
   */
  async deleteKnowledgeBase(kbId, userId) {
    try {
      const kb = await this.knowledgeRepository.findById(kbId)
      if (!kb) {
        return {
          success: false,
          message: '知识库不存在'
        }
      }

      await this.knowledgeRepository.delete(kbId)

      // 记录审计日志
      await auditService.log({
        userId,
        module: 'knowledge',
        action: 'delete_knowledge_base',
        resourceType: 'knowledge_base',
        resourceId: kbId,
        resourceName: kb.name,
        oldValue: kb,
        status: 'success'
      })

      return {
        success: true,
        message: '知识库删除成功'
      }
    } catch (error) {
      console.error('删除知识库失败:', error)
      return {
        success: false,
        message: '删除知识库失败',
        error: error.message
      }
    }
  }

  /**
   * 获取文档列表
   */
  async getDocuments(filters = {}) {
    try {
      const documents = await this.documentRepository.findAll(filters)

      return {
        success: true,
        data: documents
      }
    } catch (error) {
      console.error('获取文档列表失败:', error)
      return {
        success: false,
        message: '获取文档列表失败',
        error: error.message
      }
    }
  }

  /**
   * 根据知识库ID获取文档列表
   */
  async getDocumentsByKbId(kbId, options = {}) {
    try {
      const db = require('../../config/database')
      const { page = 1, pageSize = 10, search = '' } = options

      const offset = (parseInt(page) - 1) * parseInt(pageSize)
      const limit = parseInt(pageSize)

      // 构建查询 (显示所有状态的文档)
      let query = db('knowledge_documents')
        .where('kb_id', kbId)
        .whereNull('deleted_at')

      if (search) {
        query = query.where(function() {
          this.where('title', 'like', `%${search}%`)
            .orWhere('file_name', 'like', `%${search}%`)
        })
      }

      // 获取总数
      const [{ count }] = await query.clone().count('* as count')

      // 获取文档列表
      const documents = await query
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)

      return {
        success: true,
        data: {
          list: documents,
          total: parseInt(count),
          page: parseInt(page),
          pageSize: parseInt(pageSize)
        }
      }
    } catch (error) {
      console.error('[getDocumentsByKbId] 失败:', error)
      return {
        success: false,
        message: '获取文档列表失败',
        error: error.message
      }
    }
  }

  /**
   * 获取企业文档列表
   */
  async getEnterpriseDocuments(options = {}) {
    try {
      const db = require('../../config/database')
      const { page = 1, pageSize = 10, search = '' } = options

      const offset = (parseInt(page) - 1) * parseInt(pageSize)
      const limit = parseInt(pageSize)

      // 构建查询 - 企业知识库的文档
      let query = db('knowledge_documents')
        .join('knowledge_bases', 'knowledge_documents.kb_id', 'knowledge_bases.id')
        .where('knowledge_bases.permission_level', 'organization')
        .where('knowledge_documents.status', '!=', 'deleted')
        .select('knowledge_documents.*')

      if (search) {
        query = query.where(function() {
          this.where('knowledge_documents.title', 'like', `%${search}%`)
            .orWhere('knowledge_documents.file_name', 'like', `%${search}%`)
        })
      }

      const [{ count }] = await query.clone().count('* as count')
      const documents = await query
        .orderBy('knowledge_documents.created_at', 'desc')
        .limit(limit)
        .offset(offset)

      return {
        success: true,
        data: {
          list: documents,
          total: parseInt(count),
          page: parseInt(page),
          pageSize: parseInt(pageSize)
        }
      }
    } catch (error) {
      console.error('[getEnterpriseDocuments] 失败:', error)
      return {
        success: false,
        message: '获取企业文档列表失败',
        error: error.message
      }
    }
  }

  /**
   * 获取个人文档列表
   */
  async getPersonalDocuments(userId, options = {}) {
    try {
      const db = require('../../config/database')
      const { page = 1, pageSize = 10, search = '' } = options

      const offset = (parseInt(page) - 1) * parseInt(pageSize)
      const limit = parseInt(pageSize)

      // 构建查询 - 个人知识库的文档 (显示所有状态)
      let query = db('knowledge_documents')
        .join('knowledge_bases', 'knowledge_documents.kb_id', 'knowledge_bases.id')
        .where('knowledge_bases.permission_level', '=', 'personal')
        .andWhere('knowledge_bases.owner_id', '=', userId)
        .whereNull('knowledge_documents.deleted_at')
        .select('knowledge_documents.*')

      if (search) {
        query = query.where(function() {
          this.where('knowledge_documents.title', 'like', `%${search}%`)
            .orWhere('knowledge_documents.file_name', 'like', `%${search}%`)
        })
      }

      const [{ count }] = await query.clone().count('* as count')
      const documents = await query
        .orderBy('knowledge_documents.created_at', 'desc')
        .limit(limit)
        .offset(offset)

      return {
        success: true,
        data: {
          list: documents,
          total: parseInt(count),
          page: parseInt(page),
          pageSize: parseInt(pageSize)
        }
      }
    } catch (error) {
      console.error('[getPersonalDocuments] 失败:', error)
      return {
        success: false,
        message: '获取个人文档列表失败',
        error: error.message
      }
    }
  }

  /**
   * 获取所有文档列表（企业+个人）
   */
  async getAllDocuments(userId, options = {}) {
    try {
      const db = require('../../config/database')
      const { page = 1, pageSize = 10, search = '' } = options

      const offset = (parseInt(page) - 1) * parseInt(pageSize)
      const limit = parseInt(pageSize)

      // 构建查询 - 企业文档 + 用户个人文档
      let query = db('knowledge_documents')
        .join('knowledge_bases', 'knowledge_documents.kb_id', 'knowledge_bases.id')
        .where(function() {
          this.where('knowledge_bases.permission_level', '=', 'organization')
            .orWhere(function() {
              this.where('knowledge_bases.permission_level', '=', 'personal')
                .andWhere('knowledge_bases.owner_id', '=', userId)
            })
        })
        .whereNot('knowledge_documents.status', 'deleted')
        .select('knowledge_documents.*')

      if (search) {
        query = query.where(function() {
          this.where('knowledge_documents.title', 'like', `%${search}%`)
            .orWhere('knowledge_documents.file_name', 'like', `%${search}%`)
        })
      }

      const [{ count }] = await query.clone().count('* as count')
      const documents = await query
        .orderBy('knowledge_documents.created_at', 'desc')
        .limit(limit)
        .offset(offset)

      return {
        success: true,
        data: {
          list: documents,
          total: parseInt(count),
          page: parseInt(page),
          pageSize: parseInt(pageSize)
        }
      }
    } catch (error) {
      console.error('[getAllDocuments] 失败:', error)
      return {
        success: false,
        message: '获取文档列表失败',
        error: error.message
      }
    }
  }

  /**
   * 上传文档
   */
  async uploadDocument(kbId, file, metadata = {}, userId) {
    try {
      const db = require('../../config/database')

      console.log('[UploadDocument] 参数检查:', {
        kbId,
        kbIdType: typeof kbId,
        fileName: file?.originalname,
        userId
      })

      // 参数验证
      if (!kbId) {
        return {
          success: false,
          message: '知识库ID不能为空'
        }
      }

      // 检查知识库是否存在
      const kb = await db('knowledge_bases').where('id', kbId).first()
      if (!kb) {
        return {
          success: false,
          message: '知识库不存在'
        }
      }

      // 计算文件MD5哈希
      const fileHash = crypto.createHash('md5').update(file.buffer).digest('hex')

      // 上传文件到MinIO
      // Multer配置为memoryStorage，file.buffer包含文件内容
      const uploadResult = await this.minioService.uploadFile(
        file.buffer,
        file.originalname
      )
      if (!uploadResult.success) {
        return uploadResult
      }

      // 创建文档记录
      // 只保留表中实际存在的字段
      const documentData = {
        kb_id: kbId,
        name: file.originalname || file.name,
        file_path: file.path,
        minio_path: uploadResult.path,
        file_type: file.mimetype,
        file_size: file.size,
        status: 'pending',
        vector_status: 'pending',
        graph_status: 'pending',
        vectorization_status: 'pending',
        graph_extraction_status: 'pending',
        upload_by: userId,
        current_version: 1
      }

      // 解析文档内容
      if (metadata.content) {
        documentData.content = metadata.content
      } else {
        const DocumentParserService = require('../document/DocumentParserService')
        const parserService = new DocumentParserService()

        try {
          const parsedContent = await parserService.parseDocument(
            file.buffer,
            file.mimetype,
            file.originalname
          )

          if (parsedContent) {
            documentData.content = parsedContent
            console.log('[UploadDocument] 文档解析成功，内容长度:', documentData.content.length)
          } else {
            console.warn('[UploadDocument] 文档解析返回空，使用文件名作为内容')
            documentData.content = `文件: ${file.originalname}`
          }
        } catch (parseError) {
          console.error('[UploadDocument] 文档解析失败:', parseError.message)
          documentData.content = `文件解析失败: ${file.originalname}`
        }
      }

      // 将其他metadata存储在metadata字段中（包括domain）
      if (Object.keys(metadata).length > 0) {
        documentData.metadata = metadata
      }

      // domain存储在metadata.domain中，读取时使用: document.metadata?.domain
      // 数据库表没有独立的domain字段

      const [document] = await db('knowledge_documents').insert(documentData).returning('*')

      // 创建初始版本记录
      const DocumentVersionRepository = require('../../repositories/DocumentVersionRepository')
      const versionRepo = new DocumentVersionRepository()

      await versionRepo.createVersion({
        document_id: document.id,
        version_number: 1,
        file_path: file.path || '',
        minio_path: uploadResult.path,
        file_size: file.size,
        file_hash: fileHash,
        change_description: '初始版本',
        upload_by: userId,
        is_current: true
      })

      console.log('[UploadDocument] 版本记录创建成功')

      // 异步触发文档处理
      setImmediate(async () => {
        try {
          console.log(`[文档处理] 开始处理文档: ${document.id}`)

          // 更新状态为processing
          await db('knowledge_documents')
            .where({ id: document.id })
            .update({
              vectorization_status: 'processing',
              graph_extraction_status: 'processing',
              vector_status: 'processing',
              graph_status: 'processing',
              updated_at: db.fn.now()
            })

          try {
            // 执行向量化
            await this.vectorizeDocument(document.id)
            console.log(`[文档处理] 向量化完成: ${document.id}`)
          } catch (vecError) {
            console.error(`[文档处理] 向量化失败:`, vecError)
            await db('knowledge_documents')
              .where({ id: document.id })
              .update({
                vectorization_status: 'failed',
                vector_status: 'failed',
                vectorization_error: vecError.message,
                updated_at: db.fn.now()
              })
          }

          try {
            // 执行图谱提取
            await this.extractGraph(document.id)
            console.log(`[文档处理] 图谱提取完成: ${document.id}`)
          } catch (graphError) {
            console.error(`[文档处理] 图谱提取失败:`, graphError)
            await db('knowledge_documents')
              .where({ id: document.id })
              .update({
                graph_extraction_status: 'failed',
                graph_status: 'failed',
                graph_extraction_error: graphError.message,
                updated_at: db.fn.now()
              })
          }

          try {
            // 执行自动分类
            const DocumentClassifierService = require('../document/DocumentClassifierService')
            const classifierService = new DocumentClassifierService()

            await classifierService.classifyDocument(
              document.id,
              documentData.content,
              file.originalname,
              kb.organization_id
            )
            console.log(`[文档处理] 自动分类完成: ${document.id}`)
          } catch (classifyError) {
            console.error(`[文档处理] 自动分类失败:`, classifyError)
            // 分类失败不影响整体流程
          }

          console.log(`[文档处理] 文档处理完成: ${document.id}`)
        } catch (error) {
          console.error(`[文档处理] 处理失败: ${document.id}`, error)
          await db('knowledge_documents')
            .where({ id: document.id })
            .update({
              vectorization_status: 'failed',
              graph_extraction_status: 'failed',
              vector_status: 'failed',
              graph_status: 'failed',
              updated_at: db.fn.now()
            })
        }
      })

      // 更新知识库统计
      await this.knowledgeRepository.updateStatistics(kbId)

      // TODO: 记录审计日志
      // await auditService.log({
      //   userId,
      //   module: 'knowledge',
      //   action: 'upload_document',
      //   resourceType: 'knowledge_document',
      //   resourceId: document.id,
      //   resourceName: document.name,
      //   newValue: document,
      //   status: 'success'
      // })

      return {
        success: true,
        message: '文档上传成功',
        data: document
      }
    } catch (error) {
      console.error('上传文档失败:', error)
      return {
        success: false,
        message: '上传文档失败',
        error: error.message
      }
    }
  }

  /**
   * 获取用户的知识库列表(按permission_level区分)
   */
  async getUserKnowledgeBases(user, permission_level = null) {
    try {
      const db = require('../../config/database')

      console.log(`[getUserKnowledgeBases] permission_level=${permission_level}, user_id=${user.id}, org_id=${user.organization_id}`)

      let query = db('knowledge_bases')
        .whereNull('deleted_at')

      // 根据permission_level参数过滤
      if (permission_level === 'personal') {
        // 只显示个人知识库
        console.log('[getUserKnowledgeBases] 过滤: 只显示个人知识库')
        query = query
          .where('permission_level', 'personal')
          .where('owner_id', user.id)
      } else if (permission_level === 'organization') {
        // 只显示企业知识库
        console.log('[getUserKnowledgeBases] 过滤: 只显示企业知识库')
        query = query
          .where('permission_level', 'organization')
          .andWhere(function() {
            this.where('organization_id', user.organization_id)
              .orWhere('is_public', true)
          })
      } else {
        // 显示所有可访问的知识库(个人的 + 企业的)
        console.log('[getUserKnowledgeBases] 过滤: 显示所有知识库')
        query = query.where(function() {
          // 个人知识库:自己创建的
          this.where(function() {
            this.where('permission_level', 'personal')
              .where('owner_id', user.id)
          })
          // 企业知识库:同组织的或公开的
          .orWhere(function() {
            this.where('permission_level', 'organization')
              .where(function() {
                this.where('organization_id', user.organization_id)
                  .orWhere('is_public', true)
              })
          })
        })
      }

      const knowledgeBases = await query.orderBy('created_at', 'desc')

      console.log(`[getUserKnowledgeBases] 返回结果数: ${knowledgeBases.length}`)
      knowledgeBases.forEach(kb => {
        console.log(`  - ${kb.name} (${kb.permission_level}, owner=${kb.owner_id})`)
      })

      return {
        success: true,
        data: knowledgeBases
      }
    } catch (error) {
      console.error('[KnowledgeService] 获取知识库列表失败:', error)
      return {
        success: false,
        message: '获取知识库列表失败',
        error: error.message
      }
    }
  }

  /**
   * 向量化文档
   */
  async vectorizeDocument(docId) {
    const db = require('../../config/database')
    try {
      console.log(`[向量化] 开始: ${docId}`)

      const processResult = await this.documentProcessor.processDocument(docId)

      if (processResult.success) {
        await db('knowledge_documents')
          .where({ id: docId })
          .update({
            vectorization_status: 'completed',
            vectorization_time: db.fn.now(),
            vector_status: 'completed',
            vector_indexed_at: db.fn.now(),
            updated_at: db.fn.now()
          })
        console.log(`[向量化] 成功: ${docId}`)
      } else {
        throw new Error(processResult.message || '向量化失败')
      }

      return processResult
    } catch (error) {
      console.error(`[向量化] 失败:`, error)
      await db('knowledge_documents')
        .where({ id: docId })
        .update({
          vectorization_status: 'failed',
          vectorization_error: error.message,
          updated_at: db.fn.now()
        })
      throw error
    }
  }

  /**
   * 提取知识图谱
   */
  async extractGraph(docId) {
    const db = require('../../config/database')
    try {
      console.log(`[图谱提取] 开始: ${docId}`)

      // 获取文档和版本信息
      const document = await db('knowledge_documents').where({ id: docId }).first()
      if (!document) {
        throw new Error('文档不存在')
      }

      // 获取文档的领域配置（从metadata.domain读取，默认为architecture）
      const domain = document.metadata?.domain || 'architecture'
      console.log(`[图谱提取] 使用领域: ${domain}`)

      const GraphRAGService = require('../rag/GraphRAGService')
      const graphService = new GraphRAGService(domain) // 使用文档的领域创建服务

      const currentVersion = await db('knowledge_document_versions')
        .where({ document_id: docId, is_current: true })
        .first()

      if (!currentVersion) {
        throw new Error('文档版本不存在')
      }

      // 获取文档内容
      const textContent = document.content || `文件: ${document.name}`

      // 调用正确的方法: extractGraph(docId, versionId, textContent)
      const extractResult = await graphService.extractGraph(
        docId,
        currentVersion.id,
        textContent
      )

      if (extractResult.success) {
        await db('knowledge_documents')
          .where({ id: docId })
          .update({
            graph_extraction_status: 'completed',
            graph_extraction_time: db.fn.now(),
            graph_status: 'completed',
            graph_indexed_at: db.fn.now(),
            updated_at: db.fn.now()
          })
        console.log(`[图谱提取] 成功: ${docId}`)
      } else {
        throw new Error(extractResult.message || '图谱提取失败')
      }

      return extractResult
    } catch (error) {
      console.error(`[图谱提取] 失败:`, error)
      await db('knowledge_documents')
        .where({ id: docId })
        .update({
          graph_extraction_status: 'failed',
          graph_extraction_error: error.message,
          updated_at: db.fn.now()
        })
      throw error
    }
  }

  /**
   * 处理文档（旧版本兼容）
   */
  async processDocument(docId) {
    try {
      console.log(`[KnowledgeService] 开始处理文档: ${docId}`)

      // 获取文档信息
      const document = await this.documentRepository.findById(docId)
      if (!document) {
        throw new Error('文档不存在')
      }

      // 使用新的DocumentProcessorService进行向量化处理
      const processResult = await this.documentProcessor.processDocument(document)

      if (processResult.success) {
        console.log(`[KnowledgeService] 文档处理成功: ${docId}`)
        console.log(`  - 分块数: ${processResult.chunks_count}`)
        console.log(`  - 向量数: ${processResult.vectors_count}`)

        // 更新知识库统计
        if (document.kb_id) {
          await this.knowledgeRepository.updateStatistics(document.kb_id)
        }
      }

      return processResult
    } catch (error) {
      console.error('[KnowledgeService] 处理文档失败:', error)
      return {
        success: false,
        message: '处理文档失败',
        error: error.message
      }
    }
  }

  /**
   * 删除文档
   */
  async deleteDocument(docId, userId) {
    try {
      const document = await this.documentRepository.findById(docId)
      if (!document) {
        return {
          success: false,
          message: '文档不存在'
        }
      }

      // 软删除文档
      await this.documentRepository.softDelete(docId)

      // 删除分块 - 暂时跳过，因为knowledge_chunks表不存在
      // TODO: 实现向量数据删除
      // await this.documentRepository.deleteChunks(docId)

      // 更新知识库统计
      await this.knowledgeRepository.updateStatistics(document.kb_id)

      // 记录审计日志
      await auditService.log({
        userId,
        module: 'knowledge',
        action: 'delete_document',
        resourceType: 'knowledge_document',
        resourceId: docId,
        resourceName: document.name,
        oldValue: document,
        status: 'success'
      })

      return {
        success: true,
        message: '文档删除成功'
      }
    } catch (error) {
      console.error('删除文档失败:', error)
      return {
        success: false,
        message: '删除文档失败',
        error: error.message
      }
    }
  }

  /**
   * 批量删除文档
   */
  async batchDeleteDocuments(docIds, userId) {
    try {
      const results = []
      const errors = []

      for (const docId of docIds) {
        const result = await this.deleteDocument(docId, userId)
        if (result.success) {
          results.push(docId)
        } else {
          errors.push({
            id: docId,
            error: result.message
          })
        }
      }

      return {
        success: true,
        message: `成功删除${results.length}个文档，失败${errors.length}个`,
        data: {
          deleted: results,
          failed: errors
        }
      }
    } catch (error) {
      console.error('批量删除文档失败:', error)
      return {
        success: false,
        message: '批量删除文档失败',
        error: error.message
      }
    }
  }

  /**
   * 移动文档到其他知识库
   */
  async moveDocuments(docIds, targetKbId, userId) {
    try {
      const results = []
      const errors = []

      for (const docId of docIds) {
        try {
          const document = await this.documentRepository.findById(docId)
          if (!document) {
            errors.push({
              id: docId,
              error: '文档不存在'
            })
            continue
          }

          const oldKbId = document.kb_id

          await this.documentRepository.update(docId, {
            kb_id: targetKbId
          })

          // 更新两个知识库的统计
          await this.knowledgeRepository.updateStatistics(oldKbId)
          await this.knowledgeRepository.updateStatistics(targetKbId)

          results.push(docId)

          // 记录审计日志
          await auditService.log({
            userId,
            module: 'knowledge',
            action: 'move_document',
            resourceType: 'knowledge_document',
            resourceId: docId,
            resourceName: document.name,
            oldValue: { kb_id: oldKbId },
            newValue: { kb_id: targetKbId },
            status: 'success'
          })
        } catch (error) {
          errors.push({
            id: docId,
            error: error.message
          })
        }
      }

      return {
        success: true,
        message: `成功移动${results.length}个文档，失败${errors.length}个`,
        data: {
          moved: results,
          failed: errors
        }
      }
    } catch (error) {
      console.error('移动文档失败:', error)
      return {
        success: false,
        message: '移动文档失败',
        error: error.message
      }
    }
  }

  /**
   * 获取文档版本列表
   */
  async getDocumentVersions(docId, userId) {
    try {
      const versions = await this.versionRepository.findByDocumentId(docId)

      return {
        success: true,
        data: versions
      }
    } catch (error) {
      console.error('获取文档版本列表失败:', error)
      return {
        success: false,
        message: '获取文档版本列表失败',
        error: error.message
      }
    }
  }

  /**
   * 上传新版本
   */
  async uploadNewVersion(docId, file, changeDescription, userId) {
    try {
      const db = require('../../config/database')

      // 检查文档是否存在
      const document = await this.documentRepository.findById(docId)
      if (!document) {
        return {
          success: false,
          message: '文档不存在'
        }
      }

      // 计算文件MD5哈希
      const fileHash = crypto.createHash('md5').update(file.buffer).digest('hex')

      // 上传文件到MinIO
      const uploadResult = await this.minioService.uploadFile(
        file.buffer,
        file.originalname
      )
      if (!uploadResult.success) {
        return uploadResult
      }

      // 获取当前最大版本号
      const versions = await this.versionRepository.findByDocumentId(docId)
      const currentVersion = document.current_version || 1
      const nextVersion = currentVersion + 1

      // 将旧版本设置为非当前版本
      await db('knowledge_document_versions')
        .where({ document_id: docId, is_current: true })
        .update({ is_current: false })

      // 创建新版本记录
      const version = await this.versionRepository.createVersion({
        document_id: docId,
        version_number: nextVersion,
        file_path: file.path,
        minio_path: uploadResult.path,
        file_size: file.size,
        file_hash: fileHash,
        change_description: changeDescription || `版本${nextVersion}`,
        upload_by: userId,
        is_current: true
      })

      // 更新文档的current_version
      await this.documentRepository.update(docId, {
        current_version: nextVersion,
        file_size: file.size,
        minio_path: uploadResult.path,
        status: 'pending',
        updated_at: new Date()
      })

      // 触发文档处理（删除旧数据，重新向量化和图谱提取）
      setImmediate(async () => {
        try {
          console.log(`[KnowledgeService] 开始处理新版本文档: ${docId}`)

          // 1. 删除旧向量数据
          console.log(`[KnowledgeService] 删除旧向量数据`)
          await this.documentProcessor.deleteDocumentVectors(docId)

          // 2. 删除旧图谱数据
          console.log(`[KnowledgeService] 删除旧图谱数据`)
          const GraphRAGService = require('../rag/GraphRAGService')
          const graphService = new GraphRAGService()
          await graphService.deleteDocumentGraph(docId)

          // 3. 重新处理文档
          console.log(`[KnowledgeService] 重新处理文档`)
          await this.processDocument(docId)

          console.log(`[KnowledgeService] 新版本处理完成: ${docId}`)
        } catch (error) {
          console.error(`[KnowledgeService] 新版本处理失败: ${docId}`, error)
        }
      })

      // 记录审计日志
      await auditService.log({
        userId,
        module: 'knowledge',
        action: 'upload_new_version',
        resourceType: 'knowledge_document',
        resourceId: docId,
        newValue: { version: nextVersion },
        status: 'success'
      })

      return {
        success: true,
        message: `新版本${nextVersion}上传成功`,
        data: {
          document_id: docId,
          version: version,
          old_version: nextVersion - 1,
          new_version: nextVersion
        }
      }
    } catch (error) {
      console.error('上传新版本失败:', error)
      return {
        success: false,
        message: '上传新版本失败',
        error: error.message
      }
    }
  }

  /**
   * 语义搜索
   */
  async semanticSearch(query, options = {}) {
    try {
      const result = await this.documentProcessor.semanticSearch(query, options)

      // 记录审计日志
      if (options.userId) {
        await auditService.log({
          userId: options.userId,
          module: 'knowledge',
          action: 'semantic_search',
          resourceType: 'knowledge_search',
          newValue: { query, results_count: result.results?.length || 0 },
          status: result.success ? 'success' : 'failed'
        })
      }

      return result
    } catch (error) {
      console.error('语义搜索失败:', error)
      return {
        success: false,
        message: '语义搜索失败',
        error: error.message
      }
    }
  }

  /**
   * 切换到指定版本
   */
  async switchDocumentVersion(docId, versionId, userId) {
    try {
      const db = require('../../config/database')

      // 检查版本是否存在
      const version = await this.versionRepository.findById(versionId)
      if (!version || version.document_id !== docId) {
        return {
          success: false,
          message: '版本不存在'
        }
      }

      // 将所有版本设置为非当前版本
      await db('knowledge_document_versions')
        .where({ document_id: docId })
        .update({ is_current: false })

      // 将指定版本设置为当前版本
      await db('knowledge_document_versions')
        .where({ id: versionId })
        .update({ is_current: true })

      // 更新文档信息
      await this.documentRepository.update(docId, {
        current_version: version.version_number,
        minio_path: version.minio_path,
        file_size: version.file_size
      })

      // 重新处理文档
      setImmediate(async () => {
        try {
          await this.documentProcessor.deleteDocumentVectors(docId)
          const GraphRAGService = require('../rag/GraphRAGService')
          const graphService = new GraphRAGService()
          await graphService.deleteDocumentGraph(docId)
          await this.processDocument(docId)
        } catch (error) {
          console.error('切换版本后处理失败:', error)
        }
      })

      // 记录审计日志
      await auditService.log({
        userId,
        module: 'knowledge',
        action: 'switch_document_version',
        resourceType: 'knowledge_document',
        resourceId: docId,
        newValue: { version: version.version_number },
        status: 'success'
      })

      return {
        success: true,
        message: `已切换到版本${version.version_number}`
      }
    } catch (error) {
      console.error('切换版本失败:', error)
      return {
        success: false,
        message: '切换版本失败',
        error: error.message
      }
    }
  }

  /**
   * 重新处理失败的文档
   */
  async reprocessDocument(docId, userId) {
    try {
      const db = require('../../config/database')

      // 获取文档
      const document = await this.documentRepository.findById(docId)
      if (!document) {
        return {
          success: false,
          message: '文档不存在'
        }
      }

      console.log(`[重新处理] 开始重新处理文档: ${docId}`)

      // 重置状态为pending
      await db('knowledge_documents')
        .where({ id: docId })
        .update({
          status: 'pending',
          vectorization_status: 'pending',
          graph_extraction_status: 'pending',
          vector_status: 'pending',
          graph_status: 'pending',
          vectorization_error: null,
          graph_extraction_error: null,
          updated_at: db.fn.now()
        })

      // 异步触发文档处理
      setImmediate(async () => {
        try {
          console.log(`[重新处理] 开始处理文档: ${docId}`)

          // 更新状态为processing
          await db('knowledge_documents')
            .where({ id: docId })
            .update({
              vectorization_status: 'processing',
              graph_extraction_status: 'processing',
              vector_status: 'processing',
              graph_status: 'processing',
              updated_at: db.fn.now()
            })

          try {
            // 执行向量化
            await this.vectorizeDocument(docId)
            console.log(`[重新处理] 向量化完成: ${docId}`)
          } catch (vecError) {
            console.error(`[重新处理] 向量化失败:`, vecError)
            await db('knowledge_documents')
              .where({ id: docId })
              .update({
                vectorization_status: 'failed',
                vector_status: 'failed',
                vectorization_error: vecError.message,
                updated_at: db.fn.now()
              })
          }

          try {
            // 执行图谱提取
            await this.extractGraph(docId)
            console.log(`[重新处理] 图谱提取完成: ${docId}`)
          } catch (graphError) {
            console.error(`[重新处理] 图谱提取失败:`, graphError)
            await db('knowledge_documents')
              .where({ id: docId })
              .update({
                graph_extraction_status: 'failed',
                graph_status: 'failed',
                graph_extraction_error: graphError.message,
                updated_at: db.fn.now()
              })
          }

          console.log(`[重新处理] 文档处理完成: ${docId}`)
        } catch (error) {
          console.error(`[重新处理] 处理失败: ${docId}`, error)
          await db('knowledge_documents')
            .where({ id: docId })
            .update({
              vectorization_status: 'failed',
              graph_extraction_status: 'failed',
              vector_status: 'failed',
              graph_status: 'failed',
              updated_at: db.fn.now()
            })
        }
      })

      // 记录审计日志
      await auditService.log({
        userId,
        module: 'knowledge',
        action: 'reprocess_document',
        resourceType: 'knowledge_document',
        resourceId: docId,
        resourceName: document.name,
        status: 'success'
      })

      return {
        success: true,
        message: '已开始重新处理文档'
      }
    } catch (error) {
      console.error('重新处理文档失败:', error)
      return {
        success: false,
        message: '重新处理文档失败',
        error: error.message
      }
    }
  }
}

module.exports = KnowledgeService
