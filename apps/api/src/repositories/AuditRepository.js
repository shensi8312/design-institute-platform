const BaseRepository = require('./BaseRepository')

/**
 * 审计日志Repository
 */
class AuditRepository extends BaseRepository {
  constructor() {
    super('audit_logs')
  }

  /**
   * 获取审计日志列表（包含关联信息）
   */
  async findAllWithRelations(conditions = {}, options = {}) {
    let query = this.db('audit_logs')
      .select([
        'audit_logs.*',
        'users.name as user_name',
        'users.username as username'
      ])
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
    
    // 应用条件
    if (Object.keys(conditions).length > 0) {
      Object.keys(conditions).forEach(key => {
        if (key.includes('.')) {
          query = query.where(key, conditions[key])
        } else {
          query = query.where(`audit_logs.${key}`, conditions[key])
        }
      })
    }
    
    // 排序
    if (options.orderBy) {
      query = query.orderBy(options.orderBy, options.order || 'desc')
    } else {
      query = query.orderBy('audit_logs.created_at', 'desc')
    }
    
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
   * 按用户ID获取审计日志
   */
  async findByUserId(userId, options = {}) {
    return await this.findAllWithRelations(
      { 'audit_logs.user_id': userId },
      options
    )
  }

  /**
   * 按模块获取审计日志
   */
  async findByModule(module, options = {}) {
    return await this.findAllWithRelations(
      { 'audit_logs.module': module },
      options
    )
  }

  /**
   * 按操作类型获取审计日志
   */
  async findByAction(action, options = {}) {
    return await this.findAllWithRelations(
      { 'audit_logs.action': action },
      options
    )
  }

  /**
   * 按日期范围查询
   */
  async findByDateRange(startDate, endDate, additionalConditions = {}) {
    let query = this.db('audit_logs')
      .select([
        'audit_logs.*',
        'users.name as user_name',
        'users.username as username'
      ])
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
      .where('audit_logs.created_at', '>=', startDate)
      .where('audit_logs.created_at', '<=', endDate)
    
    // 添加额外条件
    Object.keys(additionalConditions).forEach(key => {
      query = query.where(key, additionalConditions[key])
    })
    
    return await query.orderBy('audit_logs.created_at', 'desc')
  }

  /**
   * 记录审计日志
   */
  async log(data) {
    const auditData = {
      id: `audit_${Date.now()}`,
      user_id: data.userId,
      module: data.module,
      action: data.action,
      resource_type: data.resourceType,
      resource_id: data.resourceId,
      resource_name: data.resourceName,
      old_value: data.oldValue ? JSON.stringify(data.oldValue) : null,
      new_value: data.newValue ? JSON.stringify(data.newValue) : null,
      ip_address: data.ipAddress,
      user_agent: data.userAgent,
      request_method: data.requestMethod,
      request_path: data.requestPath,
      request_body: data.requestBody ? JSON.stringify(data.requestBody) : null,
      response_status: data.responseStatus,
      response_body: data.responseBody ? JSON.stringify(data.responseBody) : null,
      duration_ms: data.durationMs,
      status: data.status || 'success',
      error_message: data.errorMessage,
      created_at: new Date()
    }
    
    return await this.create(auditData)
  }

  /**
   * 获取操作统计
   */
  async getActionStatistics(startDate, endDate) {
    const result = await this.db('audit_logs')
      .select('action')
      .count('* as count')
      .where('created_at', '>=', startDate)
      .where('created_at', '<=', endDate)
      .groupBy('action')
      .orderBy('count', 'desc')
    
    return result
  }

  /**
   * 获取模块统计
   */
  async getModuleStatistics(startDate, endDate) {
    const result = await this.db('audit_logs')
      .select('module')
      .count('* as count')
      .where('created_at', '>=', startDate)
      .where('created_at', '<=', endDate)
      .groupBy('module')
      .orderBy('count', 'desc')
    
    return result
  }

  /**
   * 获取用户活动统计
   */
  async getUserActivityStatistics(startDate, endDate) {
    const result = await this.db('audit_logs')
      .select([
        'audit_logs.user_id',
        'users.name as user_name',
        'users.username'
      ])
      .count('* as count')
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
      .where('audit_logs.created_at', '>=', startDate)
      .where('audit_logs.created_at', '<=', endDate)
      .groupBy('audit_logs.user_id', 'users.name', 'users.username')
      .orderBy('count', 'desc')
    
    return result
  }

  /**
   * 清理过期日志
   */
  async cleanupOldLogs(retentionDays = 90) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)
    
    return await this.db('audit_logs')
      .where('created_at', '<', cutoffDate)
      .delete()
  }

  /**
   * 搜索审计日志
   */
  async searchLogs(keyword, options = {}) {
    let query = this.db('audit_logs')
      .select([
        'audit_logs.*',
        'users.name as user_name',
        'users.username as username'
      ])
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
    
    if (keyword) {
      query = query.where(function() {
        this.where('audit_logs.module', 'like', `%${keyword}%`)
          .orWhere('audit_logs.action', 'like', `%${keyword}%`)
          .orWhere('audit_logs.resource_name', 'like', `%${keyword}%`)
          .orWhere('users.name', 'like', `%${keyword}%`)
          .orWhere('users.username', 'like', `%${keyword}%`)
      })
    }
    
    // 排序
    query = query.orderBy(options.orderBy || 'audit_logs.created_at', options.order || 'desc')
    
    // 分页
    if (options.limit) {
      query = query.limit(options.limit)
    }
    
    if (options.offset) {
      query = query.offset(options.offset)
    }
    
    return await query
  }
}

module.exports = AuditRepository