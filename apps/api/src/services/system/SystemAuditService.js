const BaseService = require('../BaseService')
const AuditRepository = require('../../repositories/AuditRepository')

/**
 * 系统审计日志Service
 */
class SystemAuditService extends BaseService {
  constructor() {
    const repository = new AuditRepository()
    super(repository)
    this.auditRepository = repository
  }

  /**
   * 记录审计日志
   */
  async log(auditData) {
    try {
      // 计算请求耗时
      if (auditData.startTime) {
        auditData.durationMs = Date.now() - auditData.startTime
        delete auditData.startTime
      }

      // 记录日志
      const result = await this.auditRepository.log(auditData)

      return {
        success: true,
        data: result
      }
    } catch (error) {
      console.error('记录审计日志失败:', error)
      // 审计日志失败不应该影响主流程，所以这里只记录错误
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 获取审计日志列表
   */
  async getList(params = {}) {
    try {
      const {
        page = 1,
        pageSize = 20,
        userId,
        module,
        action,
        startDate,
        endDate,
        search,
        orderBy = 'created_at',
        order = 'desc'
      } = params

      // 构建查询条件
      const conditions = {}
      if (userId) conditions['audit_logs.user_id'] = userId
      if (module) conditions['audit_logs.module'] = module
      if (action) conditions['audit_logs.action'] = action

      let logs = []
      let total = 0

      // 如果有日期范围
      if (startDate && endDate) {
        logs = await this.auditRepository.findByDateRange(
          startDate,
          endDate,
          conditions
        )
        total = logs.length
      }
      // 如果有搜索关键词
      else if (search) {
        const offset = (page - 1) * pageSize
        logs = await this.auditRepository.searchLogs(search, {
          orderBy,
          order,
          limit: pageSize,
          offset
        })
        // 获取总数
        const allLogs = await this.auditRepository.searchLogs(search, {})
        total = allLogs.length
      }
      // 普通查询
      else {
        // 获取总数
        total = await this.auditRepository.count(conditions)

        // 获取分页数据
        const offset = (page - 1) * pageSize
        logs = await this.auditRepository.findAllWithRelations(
          conditions,
          { orderBy, order, limit: pageSize, offset }
        )
      }

      const safeParse = (value) => {
        if (!value || typeof value !== 'string') {
          return value
        }
        try {
          return JSON.parse(value)
        } catch (error) {
          return value
        }
      }

      // 解析JSON字段
      logs = logs.map(log => ({
        ...log,
        old_value: safeParse(log.old_value),
        new_value: safeParse(log.new_value),
        request_body: safeParse(log.request_body),
        response_body: safeParse(log.response_body)
      }))

      return {
        success: true,
        data: {
          list: logs,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        }
      }
    } catch (error) {
      console.error('获取审计日志失败:', error)
      return {
        success: false,
        message: '获取审计日志失败',
        error: error.message
      }
    }
  }

  /**
   * 获取操作统计
   */
  async getActionStatistics(startDate, endDate) {
    try {
      const statistics = await this.auditRepository.getActionStatistics(
        startDate,
        endDate
      )

      return {
        success: true,
        data: statistics
      }
    } catch (error) {
      console.error('获取操作统计失败:', error)
      return {
        success: false,
        message: '获取操作统计失败',
        error: error.message
      }
    }
  }

  /**
   * 获取模块统计
   */
  async getModuleStatistics(startDate, endDate) {
    try {
      const statistics = await this.auditRepository.getModuleStatistics(
        startDate,
        endDate
      )

      return {
        success: true,
        data: statistics
      }
    } catch (error) {
      console.error('获取模块统计失败:', error)
      return {
        success: false,
        message: '获取模块统计失败',
        error: error.message
      }
    }
  }

  /**
   * 获取用户活动统计
   */
  async getUserActivityStatistics(startDate, endDate) {
    try {
      const statistics = await this.auditRepository.getUserActivityStatistics(
        startDate,
        endDate
      )

      return {
        success: true,
        data: statistics
      }
    } catch (error) {
      console.error('获取用户活动统计失败:', error)
      return {
        success: false,
        message: '获取用户活动统计失败',
        error: error.message
      }
    }
  }

  /**
   * 清理过期日志
   */
  async cleanupOldLogs(retentionDays = 90) {
    try {
      const deletedCount = await this.auditRepository.cleanupOldLogs(retentionDays)

      // 记录清理操作本身
      await this.log({
        userId: 'system',
        module: 'audit',
        action: 'cleanup',
        resourceType: 'audit_logs',
        resourceName: '审计日志',
        newValue: { deletedCount, retentionDays },
        status: 'success'
      })

      return {
        success: true,
        message: `成功清理${deletedCount}条过期日志`,
        data: { deletedCount }
      }
    } catch (error) {
      console.error('清理过期日志失败:', error)
      return {
        success: false,
        message: '清理过期日志失败',
        error: error.message
      }
    }
  }

  /**
   * 导出审计日志
   */
  async exportLogs(params = {}) {
    try {
      const { startDate, endDate, format = 'json' } = params

      let logs = []
      if (startDate && endDate) {
        logs = await this.auditRepository.findByDateRange(startDate, endDate)
      } else {
        // 默认导出最近30天
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - 30)
        logs = await this.auditRepository.findByDateRange(startDate, endDate)
      }

      const safeParse = (value) => {
        if (!value || typeof value !== 'string') {
          return value
        }
        try {
          return JSON.parse(value)
        } catch (error) {
          return value
        }
      }

      // 解析JSON字段
      logs = logs.map(log => ({
        ...log,
        old_value: safeParse(log.old_value),
        new_value: safeParse(log.new_value)
      }))

      // 根据格式处理
      let exportData
      if (format === 'csv') {
        // 转换为CSV格式
        const headers = [
          'ID', '用户', '模块', '操作', '资源类型', '资源名称',
          'IP地址', '状态', '创建时间'
        ]
        const rows = logs.map(log => [
          log.id,
          log.user_name || log.username,
          log.module,
          log.action,
          log.resource_type,
          log.resource_name,
          log.ip_address,
          log.status,
          log.created_at
        ])
        
        exportData = [headers, ...rows]
          .map(row => row.join(','))
          .join('\n')
      } else {
        exportData = logs
      }

      return {
        success: true,
        data: exportData,
        format
      }
    } catch (error) {
      console.error('导出审计日志失败:', error)
      return {
        success: false,
        message: '导出审计日志失败',
        error: error.message
      }
    }
  }

  /**
   * 审计日志分析
   */
  async analyzeLogs(params = {}) {
    try {
      const { startDate, endDate } = params

      // 获取各种统计数据
      const [actionStats, moduleStats, userStats] = await Promise.all([
        this.auditRepository.getActionStatistics(startDate, endDate),
        this.auditRepository.getModuleStatistics(startDate, endDate),
        this.auditRepository.getUserActivityStatistics(startDate, endDate)
      ])

      // 分析风险操作
      const riskActions = ['delete', 'remove', 'drop', 'truncate', 'reset']
      const riskOperations = actionStats.filter(stat => 
        riskActions.some(risk => stat.action.toLowerCase().includes(risk))
      )

      // 分析异常活动
      const totalActions = actionStats.reduce((sum, stat) => sum + parseInt(stat.count), 0)
      const avgActionsPerUser = totalActions / userStats.length
      const abnormalUsers = userStats.filter(user => 
        parseInt(user.count) > avgActionsPerUser * 3  // 活动量超过平均值3倍的用户
      )

      return {
        success: true,
        data: {
          summary: {
            totalActions,
            totalUsers: userStats.length,
            totalModules: moduleStats.length,
            avgActionsPerUser: Math.round(avgActionsPerUser)
          },
          topActions: actionStats.slice(0, 10),
          topModules: moduleStats.slice(0, 10),
          topUsers: userStats.slice(0, 10),
          riskOperations,
          abnormalUsers,
          analysis: {
            hasRiskOperations: riskOperations.length > 0,
            hasAbnormalActivity: abnormalUsers.length > 0,
            recommendations: this.generateRecommendations(
              riskOperations,
              abnormalUsers
            )
          }
        }
      }
    } catch (error) {
      console.error('分析审计日志失败:', error)
      return {
        success: false,
        message: '分析审计日志失败',
        error: error.message
      }
    }
  }

  /**
   * 生成安全建议
   */
  generateRecommendations(riskOperations, abnormalUsers) {
    const recommendations = []

    if (riskOperations.length > 0) {
      recommendations.push({
        level: 'warning',
        type: 'risk_operations',
        message: `检测到${riskOperations.length}种风险操作，建议审查相关权限设置`,
        actions: riskOperations.map(op => op.action)
      })
    }

    if (abnormalUsers.length > 0) {
      recommendations.push({
        level: 'info',
        type: 'abnormal_activity',
        message: `${abnormalUsers.length}个用户活动异常频繁，建议关注`,
        users: abnormalUsers.map(u => u.username)
      })
    }

    if (recommendations.length === 0) {
      recommendations.push({
        level: 'success',
        type: 'normal',
        message: '系统活动正常，未发现异常'
      })
    }

    return recommendations
  }
}

module.exports = SystemAuditService
