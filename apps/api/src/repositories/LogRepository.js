const BaseRepository = require('./BaseRepository')

/**
 * 系统日志Repository
 */
class LogRepository extends BaseRepository {
  constructor() {
    super('system_logs')
  }

  /**
   * 查询日志
   */
  async findWithFilters(filters = {}) {
    let query = this.db('system_logs')
      .select([
        'system_logs.*',
        'users.name as user_name'
      ])
      .leftJoin('users', 'system_logs.user_id', 'users.id')
    
    // 时间范围
    if (filters.startDate) {
      query = query.where('system_logs.created_at', '>=', filters.startDate)
    }
    if (filters.endDate) {
      query = query.where('system_logs.created_at', '<=', filters.endDate)
    }
    
    // 日志级别
    if (filters.level) {
      query = query.where('system_logs.level', filters.level)
    }
    
    // 模块
    if (filters.module) {
      query = query.where('system_logs.module', filters.module)
    }
    
    // 操作类型
    if (filters.action) {
      query = query.where('system_logs.action', filters.action)
    }
    
    // 用户
    if (filters.userId) {
      query = query.where('system_logs.user_id', filters.userId)
    }
    
    // 搜索
    if (filters.search) {
      query = query.where(function() {
        this.where('system_logs.message', 'ilike', `%${filters.search}%`)
          .orWhere('system_logs.details', 'ilike', `%${filters.search}%`)
      })
    }
    
    // 排序和分页
    const countQuery = this.db('system_logs')
    if (filters.startDate) {
      countQuery.where('created_at', '>=', filters.startDate)
    }
    if (filters.endDate) {
      countQuery.where('created_at', '<=', filters.endDate)
    }
    if (filters.level) {
      countQuery.where('level', filters.level)
    }
    if (filters.module) {
      countQuery.where('module', filters.module)
    }
    if (filters.action) {
      countQuery.where('action', filters.action)
    }
    if (filters.userId) {
      countQuery.where('user_id', filters.userId)
    }
    if (filters.search) {
      countQuery.where(function() {
        this.where('message', 'ilike', `%${filters.search}%`)
          .orWhere('details', 'ilike', `%${filters.search}%`)
      })
    }
    const total = await countQuery.count('* as count').first()
    
    if (filters.orderBy) {
      query = query.orderBy(filters.orderBy, filters.order || 'desc')
    } else {
      query = query.orderBy('system_logs.created_at', 'desc')
    }
    
    if (filters.limit) {
      query = query.limit(filters.limit)
    }
    if (filters.offset) {
      query = query.offset(filters.offset)
    }
    
    const logs = await query
    
    return {
      data: logs,
      total: parseInt(total.count)
    }
  }

  /**
   * 记录日志
   */
  async log(level, module, action, message, details = {}, userId = null) {
    return await this.create({
      level,
      module,
      action,
      message,
      details: JSON.stringify(details),
      user_id: userId,
      ip_address: details.ip,
      user_agent: details.userAgent,
      request_id: details.requestId
    })
  }

  /**
   * 批量记录日志
   */
  async bulkLog(logs) {
    const records = logs.map(log => ({
      level: log.level,
      module: log.module,
      action: log.action,
      message: log.message,
      details: JSON.stringify(log.details || {}),
      user_id: log.userId,
      ip_address: log.ip,
      user_agent: log.userAgent,
      request_id: log.requestId,
      created_at: log.timestamp || new Date()
    }))
    
    return await this.db('system_logs').insert(records)
  }

  /**
   * 获取日志统计
   */
  async getStatistics(filters = {}) {
    let query = this.db('system_logs')
    
    // 时间范围
    if (filters.startDate) {
      query = query.where('created_at', '>=', filters.startDate)
    }
    if (filters.endDate) {
      query = query.where('created_at', '<=', filters.endDate)
    }
    
    // 按级别统计
    const byLevel = await query.clone()
      .select('level')
      .count('* as count')
      .groupBy('level')
    
    // 按模块统计
    const byModule = await query.clone()
      .select('module')
      .count('* as count')
      .groupBy('module')
      .orderBy('count', 'desc')
      .limit(10)
    
    // 按操作统计
    const byAction = await query.clone()
      .select('action')
      .count('* as count')
      .groupBy('action')
      .orderBy('count', 'desc')
      .limit(10)
    
    // 错误趋势（最近7天）
    const errorTrend = await this.db('system_logs')
      .select(this.db.raw('DATE(created_at) as date'))
      .count('* as count')
      .where('level', 'error')
      .where('created_at', '>=', this.db.raw("CURRENT_DATE - INTERVAL '7 days'"))
      .groupBy('date')
      .orderBy('date')
    
    return {
      byLevel,
      byModule,
      byAction,
      errorTrend
    }
  }

  /**
   * 清理旧日志
   */
  async cleanup(daysToKeep = 90) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    
    const deleted = await this.db('system_logs')
      .where('created_at', '<', cutoffDate)
      .delete()
    
    return deleted
  }

  /**
   * 导出日志
   */
  async export(filters = {}, format = 'json') {
    const result = await this.findWithFilters({
      ...filters,
      limit: filters.limit || 10000
    })
    
    if (format === 'csv') {
      return this.convertToCSV(result.data)
    }
    
    return result.data
  }

  /**
   * 转换为CSV
   */
  convertToCSV(logs) {
    const headers = ['时间', '级别', '模块', '操作', '消息', '用户', 'IP地址']
    const rows = logs.map(log => [
      log.created_at,
      log.level,
      log.module,
      log.action,
      log.message,
      log.user_name || '',
      log.ip_address || ''
    ])
    
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    
    return csv
  }
}

/**
 * 操作日志Repository
 */
class OperationLogRepository extends BaseRepository {
  constructor() {
    super('operation_logs')
  }

  /**
   * 记录操作
   */
  async logOperation(data) {
    return await this.create({
      user_id: data.userId,
      operation_type: data.type,
      resource_type: data.resourceType,
      resource_id: data.resourceId,
      operation_detail: JSON.stringify(data.detail || {}),
      ip_address: data.ip,
      user_agent: data.userAgent,
      status: data.status || 'success',
      error_message: data.error
    })
  }

  /**
   * 获取用户操作历史
   */
  async getUserOperations(userId, options = {}) {
    let query = this.db('operation_logs')
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
    
    if (options.limit) {
      query = query.limit(options.limit)
    }
    
    return await query
  }

  /**
   * 获取资源操作历史
   */
  async getResourceOperations(resourceType, resourceId, options = {}) {
    let query = this.db('operation_logs')
      .select([
        'operation_logs.*',
        'users.name as user_name'
      ])
      .leftJoin('users', 'operation_logs.user_id', 'users.id')
      .where('resource_type', resourceType)
      .where('resource_id', resourceId)
      .orderBy('operation_logs.created_at', 'desc')
    
    if (options.limit) {
      query = query.limit(options.limit)
    }
    
    return await query
  }
}

module.exports = {
  LogRepository,
  OperationLogRepository
}