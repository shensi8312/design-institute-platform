const BaseRepository = require('./BaseRepository')

/**
 * 知识库Repository
 */
class KnowledgeRepository extends BaseRepository {
  constructor() {
    super('knowledge_bases')
  }

  /**
   * 重写create方法，清理临时字段
   */
  async create(data, returning = true) {
    // 保存临时权限数据
    const permissions = data._permissions
    
    // 删除不应该存入数据库的临时字段
    delete data._permissions
    
    // 调用父类的create方法
    const result = await super.create(data, returning)
    
    // 如果需要，恢复权限数据到返回结果中
    if (result && permissions) {
      result._permissions = permissions
    }
    
    return result
  }

  /**
   * 获取用户有权限的知识库
   */
  async findByUserPermissions(userId, departmentId, roleId, isAdmin = false) {
    let query = this.db('knowledge_bases')
      .where('knowledge_bases.deleted_at', null)
    
    // 管理员可以看到所有知识库
    if (!isAdmin) {
      query = query.where(function() {
        this.where('knowledge_bases.owner_id', userId)
          .orWhere('knowledge_bases.is_public', true)
        
        // 只有当departmentId或roleId存在时才添加权限查询
        if (departmentId || roleId) {
          this.orWhereExists(function() {
            this.select('*')
              .from('knowledge_base_permissions')
              .whereRaw('knowledge_base_permissions.kb_id = knowledge_bases.id')
              .where(function() {
                if (departmentId) {
                  this.orWhere('knowledge_base_permissions.department_id', departmentId)
                }
                if (roleId) {
                  this.orWhere('knowledge_base_permissions.role_id', roleId)
                }
              })
          })
        }
      })
    }
    
    return await query.orderBy('knowledge_bases.created_at', 'desc')
  }

  /**
   * 获取知识库的权限信息
   */
  async getPermissions(kbId) {
    return await this.db('knowledge_base_permissions')
      .leftJoin('departments', 'knowledge_base_permissions.department_id', 'departments.id')
      .leftJoin('roles', 'knowledge_base_permissions.role_id', 'roles.id')
      .leftJoin('projects', 'knowledge_base_permissions.project_id', 'projects.id')
      .leftJoin('organizations', 'knowledge_base_permissions.organization_id', 'organizations.id')
      .where('kb_id', kbId)
      .select(
        'knowledge_base_permissions.*',
        'departments.name as department_name',
        'roles.name as role_name',
        'projects.name as project_name',
        'organizations.name as organization_name'
      )
  }

  /**
   * 设置知识库权限
   */
  async setPermissions(kbId, permissions, userId) {
    const trx = await this.db.transaction()
    
    try {
      // 删除旧权限
      await trx('knowledge_base_permissions')
        .where('kb_id', kbId)
        .delete()
      
      // 添加新权限
      if (permissions && permissions.length > 0) {
        const permissionRecords = permissions.map(perm => ({
          kb_id: kbId,
          permission_type: perm.permission_type,
          organization_id: perm.permission_type === 'organization' ? perm.organization_id : null,
          department_id: perm.permission_type === 'department' ? perm.department_id : null,
          role_id: perm.permission_type === 'role' ? perm.role_id : null,
          project_id: perm.permission_type === 'project' ? perm.project_id : null,
          access_level: perm.access_level || 'read',
          created_by: userId
        }))
        
        await trx('knowledge_base_permissions').insert(permissionRecords)
      }
      
      await trx.commit()
      return true
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * 更新知识库统计信息
   */
  async updateStatistics(kbId) {
    // 获取文档统计（只统计文档数量，chunk_count列不存在）
    const docStats = await this.db('knowledge_documents')
      .where('kb_id', kbId)
      .where('deleted_at', null)
      .count('* as document_count')
      .first()

    // 更新知识库统计信息
    await this.update(kbId, {
      document_count: parseInt(docStats.document_count) || 0,
      updated_at: new Date()
    })
  }

  /**
   * 获取知识库详情（包含权限）
   */
  async findByIdWithPermissions(kbId) {
    const kb = await this.findById(kbId)
    
    if (kb) {
      kb.permissions = await this.getPermissions(kbId)
    }
    
    return kb
  }
}

/**
 * 知识文档Repository
 */
class KnowledgeDocumentRepository extends BaseRepository {
  constructor() {
    super('knowledge_documents')
  }

  /**
   * 根据知识库ID获取文档列表
   */
  async findByKnowledgeBaseId(kbId, options = {}) {
    let query = this.db('knowledge_documents')
      .where('kb_id', kbId)
      .where('deleted_at', null)
    
    // 状态筛选
    if (options.status) {
      query = query.where('status', options.status)
    }
    
    // 类型筛选
    if (options.fileType) {
      query = query.where('file_type', options.fileType)
    }
    
    // 搜索
    if (options.search) {
      query = query.where(function() {
        this.where('name', 'ilike', `%${options.search}%`)
          .orWhere('description', 'ilike', `%${options.search}%`)
      })
    }
    
    // 排序
    query = query.orderBy(options.orderBy || 'created_at', options.order || 'desc')
    
    // 分页
    if (options.limit) {
      query = query.limit(options.limit)
    }
    if (options.offset) {
      query = query.offset(options.offset)
    }
    
    return await query
  }

  /**
   * 获取文档的处理状态统计
   */
  async getStatusStatistics(kbId) {
    const stats = await this.db('knowledge_documents')
      .where('kb_id', kbId)
      .where('deleted_at', null)
      .select('status')
      .count('* as count')
      .groupBy('status')
    
    return stats.reduce((acc, item) => {
      acc[item.status] = parseInt(item.count)
      return acc
    }, {})
  }

  /**
   * 更新文档处理状态
   */
  async updateProcessingStatus(docId, status, processedChunks = null, errorMessage = null) {
    const updateData = {
      status,
      updated_at: new Date()
    }

    // chunk_count和error_message列不存在，将这些信息存储在metadata中
    if (processedChunks !== null || errorMessage) {
      const doc = await this.findById(docId)
      const metadata = doc?.metadata || {}

      if (processedChunks !== null) {
        metadata.chunk_count = processedChunks
      }

      if (errorMessage) {
        metadata.error_message = errorMessage
      }

      updateData.metadata = metadata
    }

    return await this.update(docId, updateData)
  }

  /**
   * 批量更新文档知识库
   */
  async moveDocuments(docIds, targetKbId) {
    return await this.db('knowledge_documents')
      .whereIn('id', docIds)
      .update({
        kb_id: targetKbId,
        updated_at: new Date()
      })
  }

  /**
   * 获取文档的向量和图谱处理状态
   */
  async getProcessingStatus(docId) {
    return await this.db('knowledge_documents')
      .where('id', docId)
      .select('vector_status', 'graph_status', 'extraction_status')
      .first()
  }

  /**
   * 更新向量处理状态
   */
  async updateVectorStatus(docId, status, vectorCount = null) {
    const updateData = {
      vector_status: status,
      updated_at: new Date()
    }
    
    if (vectorCount !== null) {
      updateData.vector_count = vectorCount
    }
    
    return await this.update(docId, updateData)
  }

  /**
   * 更新图谱处理状态
   */
  async updateGraphStatus(docId, status, nodeCount = null, edgeCount = null) {
    const updateData = {
      graph_status: status,
      updated_at: new Date()
    }
    
    if (nodeCount !== null) {
      updateData.graph_node_count = nodeCount
    }
    
    if (edgeCount !== null) {
      updateData.graph_edge_count = edgeCount
    }
    
    return await this.update(docId, updateData)
  }

  /**
   * 获取需要处理的文档
   */
  async getPendingDocuments(limit = 10) {
    return await this.db('knowledge_documents')
      .where('status', 'pending')
      .where('deleted_at', null)
      .orderBy('created_at', 'asc')
      .limit(limit)
  }

  /**
   * 获取文档的分块信息
   */
  async getChunks(docId) {
    return await this.db('knowledge_chunks')
      .where('document_id', docId)
      .orderBy('chunk_index', 'asc')
  }

  /**
   * 保存文档分块
   */
  async saveChunks(docId, chunks) {
    const chunkRecords = chunks.map((chunk, index) => ({
      document_id: docId,
      chunk_index: index,
      content: chunk.content,
      metadata: JSON.stringify(chunk.metadata || {}),
      token_count: chunk.token_count || 0,
      created_at: new Date()
    }))
    
    return await this.db('knowledge_chunks').insert(chunkRecords)
  }

  /**
   * 删除文档的所有分块
   */
  async deleteChunks(docId) {
    // knowledge_chunks表不存在，跳过删除
    // TODO: 如果将来创建了chunks表，取消注释下面的代码
    // return await this.db('knowledge_chunks')
    //   .where('document_id', docId)
    //   .delete()
    return Promise.resolve()
  }

  /**
   * 软删除文档
   */
  async softDelete(docId) {
    return await this.update(docId, {
      deleted_at: new Date(),
      status: 'deleted'
    })
  }

  /**
   * 批量软删除文档
   */
  async batchSoftDelete(docIds) {
    return await this.db('knowledge_documents')
      .whereIn('id', docIds)
      .update({
        deleted_at: new Date(),
        status: 'deleted'
      })
  }

  /**
   * 恢复软删除的文档
   */
  async restore(docId) {
    return await this.update(docId, {
      deleted_at: null,
      status: 'pending'
    })
  }

  /**
   * 获取文档历史版本
   */
  async getVersionHistory(docId) {
    return await this.db('knowledge_document_versions')
      .where('document_id', docId)
      .orderBy('version', 'desc')
  }

  /**
   * 创建文档版本
   */
  async createVersion(docId, versionData) {
    // 获取最新版本号
    const latestVersion = await this.db('knowledge_document_versions')
      .where('document_id', docId)
      .max('version as max_version')
      .first()
    
    const newVersion = (latestVersion?.max_version || 0) + 1
    
    return await this.db('knowledge_document_versions').insert({
      document_id: docId,
      version: newVersion,
      ...versionData,
      created_at: new Date()
    })
  }
}

module.exports = {
  KnowledgeRepository,
  KnowledgeDocumentRepository
}