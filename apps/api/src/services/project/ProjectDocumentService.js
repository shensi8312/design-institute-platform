const knex = require('../../config/database')
const { v4: uuidv4 } = require('uuid')
const path = require('path')
const fs = require('fs').promises

/**
 * V3.0 项目文档服务
 * 处理项目中的文档管理（合同、投标书等）
 */
class ProjectDocumentService {
  /**
   * 上传项目文档
   */
  async uploadDocument(projectId, fileData, metadata, userId) {
    try {
      // 验证项目是否存在
      const project = await knex('projects').where({ id: projectId }).first()
      if (!project) {
        return {
          success: false,
          message: '项目不存在'
        }
      }

      // 验证必填字段
      if (!metadata.document_type) {
        return {
          success: false,
          message: '文档类型不能为空'
        }
      }

      // 生成文档ID
      const documentId = uuidv4()

      // 构建文档数据
      const documentData = {
        id: documentId,
        project_id: projectId,
        title: metadata.title || fileData.originalname,
        document_type: metadata.document_type, // contract, bidding_doc, our_bid, competitor_bid, evaluation, other
        document_subtype: metadata.document_subtype, // tech, commercial, draft, final, amendment
        responsible_department: metadata.responsible_department,
        status: 'draft',
        file_path: fileData.path,
        file_name: fileData.originalname,
        file_size: fileData.size,
        mime_type: fileData.mimetype,
        created_by: userId,
        updated_by: userId,
        created_at: new Date(),
        updated_at: new Date()
      }

      // 插入数据库
      await knex('project_documents').insert(documentData)

      return {
        success: true,
        message: '文档上传成功',
        data: {
          id: documentId,
          ...documentData
        }
      }
    } catch (error) {
      console.error('上传项目文档失败:', error)
      return {
        success: false,
        message: '上传文档失败',
        error: error.message
      }
    }
  }

  /**
   * 获取项目文档列表
   */
  async getDocuments(projectId, filters = {}) {
    try {
      let query = knex('project_documents')
        .where({ project_id: projectId })
        .select('*')

      // 按文档类型筛选
      if (filters.document_type) {
        query = query.where({ document_type: filters.document_type })
      }

      // 按文档子类型筛选
      if (filters.document_subtype) {
        query = query.where({ document_subtype: filters.document_subtype })
      }

      // 按状态筛选
      if (filters.status) {
        query = query.where({ status: filters.status })
      }

      // 按负责部门筛选
      if (filters.responsible_department) {
        query = query.where({ responsible_department: filters.responsible_department })
      }

      // 排序
      query = query.orderBy('created_at', 'desc')

      const documents = await query

      return {
        success: true,
        data: {
          total: documents.length,
          items: documents
        }
      }
    } catch (error) {
      console.error('获取项目文档列表失败:', error)
      return {
        success: false,
        message: '获取文档列表失败',
        error: error.message
      }
    }
  }

  /**
   * 获取文档详情
   */
  async getDocumentDetail(documentId) {
    try {
      const document = await knex('project_documents')
        .where({ id: documentId })
        .first()

      if (!document) {
        return {
          success: false,
          message: '文档不存在'
        }
      }

      // 获取项目信息
      const project = await knex('projects')
        .where({ id: document.project_id })
        .first()

      return {
        success: true,
        data: {
          ...document,
          project: project ? {
            id: project.id,
            name: project.name,
            code: project.code
          } : null
        }
      }
    } catch (error) {
      console.error('获取文档详情失败:', error)
      return {
        success: false,
        message: '获取文档详情失败',
        error: error.message
      }
    }
  }

  /**
   * 更新文档信息
   */
  async updateDocument(documentId, updates, userId) {
    try {
      const document = await knex('project_documents')
        .where({ id: documentId })
        .first()

      if (!document) {
        return {
          success: false,
          message: '文档不存在'
        }
      }

      // 准备更新数据
      const updateData = {
        ...updates,
        updated_by: userId,
        updated_at: new Date()
      }

      // 删除不允许更新的字段
      delete updateData.id
      delete updateData.project_id
      delete updateData.created_by
      delete updateData.created_at

      await knex('project_documents')
        .where({ id: documentId })
        .update(updateData)

      return {
        success: true,
        message: '文档更新成功',
        data: {
          id: documentId,
          ...updateData
        }
      }
    } catch (error) {
      console.error('更新文档失败:', error)
      return {
        success: false,
        message: '更新文档失败',
        error: error.message
      }
    }
  }

  /**
   * 删除文档
   */
  async deleteDocument(documentId, userId) {
    try {
      const document = await knex('project_documents')
        .where({ id: documentId })
        .first()

      if (!document) {
        return {
          success: false,
          message: '文档不存在'
        }
      }

      // 删除文件
      if (document.file_path) {
        try {
          await fs.unlink(document.file_path)
        } catch (err) {
          console.warn('删除文件失败:', err.message)
        }
      }

      // 删除数据库记录
      await knex('project_documents')
        .where({ id: documentId })
        .delete()

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
   * 获取项目文档统计
   */
  async getDocumentStatistics(projectId) {
    try {
      const stats = await knex('project_documents')
        .where({ project_id: projectId })
        .select('document_type')
        .count('* as count')
        .groupBy('document_type')

      const statusStats = await knex('project_documents')
        .where({ project_id: projectId })
        .select('status')
        .count('* as count')
        .groupBy('status')

      return {
        success: true,
        data: {
          by_type: stats.reduce((acc, item) => {
            acc[item.document_type] = parseInt(item.count)
            return acc
          }, {}),
          by_status: statusStats.reduce((acc, item) => {
            acc[item.status] = parseInt(item.count)
            return acc
          }, {})
        }
      }
    } catch (error) {
      console.error('获取文档统计失败:', error)
      return {
        success: false,
        message: '获取文档统计失败',
        error: error.message
      }
    }
  }
}

module.exports = ProjectDocumentService
