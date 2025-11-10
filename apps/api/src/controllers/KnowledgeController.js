const KnowledgeService = require('../services/system/KnowledgeService')
const PermissionAwareKnowledgeService = require('../services/knowledge/PermissionAwareKnowledgeService')
const LangExtractService = require('../services/knowledge/LangExtractService')

/**
 * 知识管理Controller - 重构版
 * 使用Service层架构
 */
class KnowledgeController {
  constructor() {
    this.knowledgeService = new KnowledgeService()
    this.permissionAwareService = new PermissionAwareKnowledgeService()
    this.langExtractService = new LangExtractService()
  }

  /**
   * 获取知识库列表
   */
  async getKnowledgeBases(req, res) {
    try {
      const { permission_level } = req.query
      console.log('[Controller] 获取知识库列表 - permission_level:', permission_level)

      const result = await this.knowledgeService.getUserKnowledgeBases(req.user, permission_level)

      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取知识库列表失败:', error)
      res.status(500).json({
        success: false,
        message: '获取知识库列表失败',
        error: error.message
      })
    }
  }

  /**
   * 获取知识库详情
   */
  async getKnowledgeBaseDetail(req, res) {
    try {
      const { id } = req.params
      const result = await this.knowledgeService.getById(id)
      
      if (result.success) {
        // 获取权限信息
        result.data.permissions = await this.knowledgeService.knowledgeRepository.getPermissions(id)
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('获取知识库详情失败:', error)
      res.status(500).json({
        success: false,
        message: '获取知识库详情失败',
        error: error.message
      })
    }
  }

  /**
   * 创建知识库
   */
  async createKnowledgeBase(req, res) {
    try {
      // 对于演示用户，使用第一个真实用户的ID
      let ownerId = req.user.id
      let departmentId = req.user.department_id
      
      if (ownerId === 'demo-admin') {
        const firstUser = await this.knowledgeService.knowledgeRepository.db('users')
          .select('id', 'department_id')
          .first()
        ownerId = firstUser ? firstUser.id : null
        departmentId = firstUser ? firstUser.department_id : null
      }
      
      // 如果department_id是'demo-dept'，也需要设为null或真实值
      if (departmentId === 'demo-dept') {
        departmentId = null
      }
      
      const data = {
        ...req.body,
        owner_id: ownerId,
        owner_department_id: req.body.owner_department_id || departmentId,
        organization_id: req.body.organization_id || req.user.organization_id || null,
        created_by: ownerId
      }
      
      const result = await this.knowledgeService.create(data)
      
      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('创建知识库失败:', error)
      res.status(500).json({
        success: false,
        message: '创建知识库失败',
        error: error.message
      })
    }
  }

  /**
   * 更新知识库
   */
  async updateKnowledgeBase(req, res) {
    try {
      const { id } = req.params
      const data = {
        ...req.body,
        updated_by: req.user.id
      }
      
      // 如果更新权限，单独处理
      if (data.permissions) {
        const permResult = await this.knowledgeService.updatePermissions(
          id,
          data.permissions,
          req.user.id
        )
        if (!permResult.success) {
          return res.status(400).json(permResult)
        }
        delete data.permissions
      }
      
      const result = await this.knowledgeService.update(id, data)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('更新知识库失败:', error)
      res.status(500).json({
        success: false,
        message: '更新知识库失败',
        error: error.message
      })
    }
  }

  /**
   * 删除知识库
   */
  async deleteKnowledgeBase(req, res) {
    try {
      const { id } = req.params
      const result = await this.knowledgeService.delete(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('删除知识库失败:', error)
      res.status(500).json({
        success: false,
        message: '删除知识库失败',
        error: error.message
      })
    }
  }

  /**
   * 获取知识库文档列表（支持scope参数）
   */
  async getDocuments(req, res) {
    try {
      const { scope, kb_id, page = 1, pageSize = 10, search = '' } = req.query
      const userId = req.user?.id

      console.log('[获取文档] 参数:', { scope, kb_id, page, pageSize, search, userId })

      let result

      // 如果指定了kb_id,直接查询该知识库的文档
      if (kb_id) {
        result = await this.knowledgeService.getDocumentsByKbId(kb_id, { page, pageSize, search })
      }
      // 根据scope查询文档
      else if (scope === 'enterprise') {
        // 查询企业知识库文档（所有公开文档）
        result = await this.knowledgeService.getEnterpriseDocuments({ page, pageSize, search })
      } else if (scope === 'personal') {
        // 查询个人知识库文档（当前用户的文档）
        result = await this.knowledgeService.getPersonalDocuments(userId, { page, pageSize, search })
      } else {
        // 查询所有文档（企业+个人）
        result = await this.knowledgeService.getAllDocuments(userId, { page, pageSize, search })
      }

      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取文档列表失败:', error)
      res.status(500).json({
        success: false,
        message: '获取文档列表失败',
        error: error.message
      })
    }
  }

  /**
   * 获取文档详情
   */
  async getDocumentDetail(req, res) {
    try {
      const { id } = req.params
      const result = await this.knowledgeService.getDocumentDetail(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('获取文档详情失败:', error)
      res.status(500).json({
        success: false,
        message: '获取文档详情失败',
        error: error.message
      })
    }
  }

  /**
   * 上传文档
   */
  async uploadDocument(req, res) {
    try {
      // Get kbId from either params or body (support both kb_id and knowledge_base_id)
      const kbId = req.params.kbId || req.body.kb_id || req.body.knowledge_base_id
      const file = req.file
      const domain = req.body.domain || req.query.domain || 'architecture' // 默认建筑领域

      console.log('[Controller] uploadDocument参数:', {
        paramsKbId: req.params.kbId,
        bodyKbId: req.body.kb_id,
        bodyKnowledgeBaseId: req.body.knowledge_base_id,
        finalKbId: kbId,
        fileName: file?.originalname,
        domain,
        bodyKeys: Object.keys(req.body)
      })

      if (!kbId) {
        return res.status(400).json({
          success: false,
          message: '请指定知识库ID'
        })
      }

      if (!file) {
        return res.status(400).json({
          success: false,
          message: '请选择要上传的文件'
        })
      }

      const metadata = {
        description: req.body.description,
        tags: req.body.tags ? JSON.parse(req.body.tags) : [],
        project_id: req.body.project_id,
        department_id: req.body.department_id || req.user.department_id,
        domain // 添加领域参数
      }

      const result = await this.knowledgeService.uploadDocument(
        kbId,
        file,
        metadata,
        req.user.id
      )
      
      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('上传文档失败:', error)
      res.status(500).json({
        success: false,
        message: '上传文档失败',
        error: error.message
      })
    }
  }

  /**
   * 批量上传文档
   */
  async batchUploadDocuments(req, res) {
    try {
      const { kbId } = req.params
      const files = req.files
      
      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请选择要上传的文件'
        })
      }
      
      const results = []
      const errors = []
      
      for (const file of files) {
        const result = await this.knowledgeService.uploadDocument(
          kbId,
          file,
          {},
          req.user.id
        )
        
        if (result.success) {
          results.push(result.data)
        } else {
          errors.push({
            file: file.originalname,
            error: result.message
          })
        }
      }
      
      res.json({
        success: true,
        message: `成功上传${results.length}个文件，失败${errors.length}个`,
        data: {
          uploaded: results,
          failed: errors
        }
      })
    } catch (error) {
      console.error('批量上传文档失败:', error)
      res.status(500).json({
        success: false,
        message: '批量上传文档失败',
        error: error.message
      })
    }
  }

  /**
   * 删除文档
   */
  async deleteDocument(req, res) {
    try {
      const { id } = req.params
      const result = await this.knowledgeService.deleteDocument(id, req.user.id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('删除文档失败:', error)
      res.status(500).json({
        success: false,
        message: '删除文档失败',
        error: error.message
      })
    }
  }

  /**
   * 批量删除文档
   */
  async batchDeleteDocuments(req, res) {
    try {
      const { documentIds } = req.body
      
      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供要删除的文档ID列表'
        })
      }
      
      const result = await this.knowledgeService.batchDeleteDocuments(
        documentIds,
        req.user.id
      )
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('批量删除文档失败:', error)
      res.status(500).json({
        success: false,
        message: '批量删除文档失败',
        error: error.message
      })
    }
  }

  /**
   * 移动文档
   */
  async moveDocuments(req, res) {
    try {
      const { documentIds, targetKbId } = req.body
      
      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供要移动的文档ID列表'
        })
      }
      
      if (!targetKbId) {
        return res.status(400).json({
          success: false,
          message: '请指定目标知识库'
        })
      }
      
      const result = await this.knowledgeService.moveDocuments(
        documentIds,
        targetKbId,
        req.user.id
      )
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('移动文档失败:', error)
      res.status(500).json({
        success: false,
        message: '移动文档失败',
        error: error.message
      })
    }
  }

  /**
   * 重新处理文档
   */
  async reprocessDocument(req, res) {
    try {
      const { id } = req.params
      const result = await this.knowledgeService.reprocessDocument(id, req.user.id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('重新处理文档失败:', error)
      res.status(500).json({
        success: false,
        message: '重新处理文档失败',
        error: error.message
      })
    }
  }

  /**
   * 搜索知识库
   */
  async searchKnowledge(req, res) {
    try {
      const { query, kbId, limit = 10 } = req.query
      
      if (!query) {
        return res.status(400).json({
          success: false,
          message: '搜索关键词不能为空'
        })
      }
      
      // 使用权限感知的搜索服务
      const result = await this.permissionAwareService.search({
        query,
        kbId,
        limit,
        userId: req.user.id,
        departmentId: req.user.department_id,
        roleId: req.user.role_id
      })
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('搜索知识库失败:', error)
      res.status(500).json({
        success: false,
        message: '搜索知识库失败',
        error: error.message
      })
    }
  }

  /**
   * 导出知识库
   */
  async exportKnowledgeBase(req, res) {
    try {
      const { id } = req.params
      const { format = 'json' } = req.query
      
      const result = await this.knowledgeService.exportKnowledgeBase(id, format)
      
      if (!result.success) {
        return res.status(400).json(result)
      }
      
      if (format === 'json') {
        res.json(result)
      } else {
        // 其他格式处理
        res.status(400).json({
          success: false,
          message: '不支持的导出格式'
        })
      }
    } catch (error) {
      console.error('导出知识库失败:', error)
      res.status(500).json({
        success: false,
        message: '导出知识库失败',
        error: error.message
      })
    }
  }

  /**
   * 获取知识库统计信息
   */
  async getStatistics(req, res) {
    try {
      const { kbId } = req.params
      
      // 获取知识库
      const kb = await this.knowledgeService.getById(kbId)
      if (!kb.success) {
        return res.status(404).json(kb)
      }
      
      // 获取文档统计
      const docStats = await this.knowledgeService.documentRepository.getStatusStatistics(kbId)
      
      // 获取总文档数和分块数
      const totalDocs = await this.knowledgeService.documentRepository.count({
        kb_id: kbId,
        deleted_at: null
      })
      
      const stats = {
        knowledgeBase: {
          id: kb.data.id,
          name: kb.data.name,
          documentCount: kb.data.document_count,
          totalChunks: kb.data.total_chunks
        },
        documents: {
          total: totalDocs,
          byStatus: docStats
        }
      }
      
      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      console.error('获取统计信息失败:', error)
      res.status(500).json({
        success: false,
        message: '获取统计信息失败',
        error: error.message
      })
    }
  }

  /**
   * 使用LangExtract处理文档
   */
  async processWithLangExtract(req, res) {
    try {
      const { id } = req.params
      const { options = {} } = req.body
      
      // 获取文档信息
      const document = await this.knowledgeService.documentRepository.findById(id)
      if (!document) {
        return res.status(404).json({
          success: false,
          message: '文档不存在'
        })
      }
      
      // 使用LangExtract处理
      const result = await this.langExtractService.processDocument({
        id: document.id,
        path: document.minio_path || document.file_path,
        type: document.file_type,
        ...options
      })
      
      if (result.success) {
        // 更新文档状态
        await this.knowledgeService.documentRepository.updateProcessingStatus(
          id,
          'processed',
          result.chunks?.length || 0
        )
        
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('LangExtract处理失败:', error)
      res.status(500).json({
        success: false,
        message: 'LangExtract处理失败',
        error: error.message
      })
    }
  }

  /**
   * 获取文档处理进度
   */
  async getProcessingProgress(req, res) {
    try {
      const { id } = req.params
      
      const status = await this.knowledgeService.documentRepository.getProcessingStatus(id)
      
      if (!status) {
        return res.status(404).json({
          success: false,
          message: '文档不存在'
        })
      }
      
      res.json({
        success: true,
        data: status
      })
    } catch (error) {
      console.error('获取处理进度失败:', error)
      res.status(500).json({
        success: false,
        message: '获取处理进度失败',
        error: error.message
      })
    }
  }

  /**
   * 批量处理文档
   */
  async batchProcessDocuments(req, res) {
    try {
      const { documentIds } = req.body
      
      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供要处理的文档ID列表'
        })
      }
      
      const results = []
      const errors = []
      
      for (const docId of documentIds) {
        const result = await this.knowledgeService.processDocument(docId)
        if (result.success) {
          results.push(docId)
        } else {
          errors.push({
            id: docId,
            error: result.message
          })
        }
      }
      
      res.json({
        success: true,
        message: `成功处理${results.length}个文档，失败${errors.length}个`,
        data: {
          processed: results,
          failed: errors
        }
      })
    } catch (error) {
      console.error('批量处理文档失败:', error)
      res.status(500).json({
        success: false,
        message: '批量处理文档失败',
        error: error.message
      })
    }
  }

  /**
   * 获取文档版本列表
   */
  async getDocumentVersions(req, res) {
    try {
      const { id } = req.params
      const result = await this.knowledgeService.getDocumentVersions(id)

      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取文档版本失败:', error)
      res.status(500).json({
        success: false,
        message: '获取版本列表失败',
        error: error.message
      })
    }
  }

  /**
   * 切换文档版本
   */
  async switchDocumentVersion(req, res) {
    try {
      const { id, versionId } = req.params
      const userId = req.user.id
      const result = await this.knowledgeService.switchDocumentVersion(id, versionId, userId)

      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('切换文档版本失败:', error)
      res.status(500).json({
        success: false,
        message: '切换版本失败',
        error: error.message
      })
    }
  }

  /**
   * 上传新版本
   */
  async uploadNewVersion(req, res) {
    try {
      const { id } = req.params
      const { change_description } = req.body
      const file = req.file
      const userId = req.user.id

      if (!file) {
        return res.status(400).json({
          success: false,
          message: '请选择要上传的文件'
        })
      }

      const result = await this.knowledgeService.uploadNewVersion(
        id,
        file,
        change_description,
        userId
      )

      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('上传新版本失败:', error)
      res.status(500).json({
        success: false,
        message: '上传新版本失败',
        error: error.message
      })
    }
  }
}

// 创建实例并导出
const controller = new KnowledgeController()

module.exports = {
  // 知识库相关
  getKnowledgeBases: (req, res) => controller.getKnowledgeBases(req, res),
  getKnowledgeBaseDetail: (req, res) => controller.getKnowledgeBaseDetail(req, res),
  createKnowledgeBase: (req, res) => controller.createKnowledgeBase(req, res),
  updateKnowledgeBase: (req, res) => controller.updateKnowledgeBase(req, res),
  deleteKnowledgeBase: (req, res) => controller.deleteKnowledgeBase(req, res),
  exportKnowledgeBase: (req, res) => controller.exportKnowledgeBase(req, res),
  getStatistics: (req, res) => controller.getStatistics(req, res),
  
  // 文档相关
  getDocuments: (req, res) => controller.getDocuments(req, res),
  getDocumentDetail: (req, res) => controller.getDocumentDetail(req, res),
  uploadDocument: (req, res) => controller.uploadDocument(req, res),
  batchUploadDocuments: (req, res) => controller.batchUploadDocuments(req, res),
  deleteDocument: (req, res) => controller.deleteDocument(req, res),
  batchDeleteDocuments: (req, res) => controller.batchDeleteDocuments(req, res),
  moveDocuments: (req, res) => controller.moveDocuments(req, res),
  reprocessDocument: (req, res) => controller.reprocessDocument(req, res),
  
  // 处理相关
  processWithLangExtract: (req, res) => controller.processWithLangExtract(req, res),
  getProcessingProgress: (req, res) => controller.getProcessingProgress(req, res),
  batchProcessDocuments: (req, res) => controller.batchProcessDocuments(req, res),
  
  // 搜索相关
  searchKnowledge: (req, res) => controller.searchKnowledge(req, res),

  // 版本管理相关
  getDocumentVersions: (req, res) => controller.getDocumentVersions(req, res),
  switchDocumentVersion: (req, res) => controller.switchDocumentVersion(req, res),
  uploadNewVersion: (req, res) => controller.uploadNewVersion(req, res)
}
