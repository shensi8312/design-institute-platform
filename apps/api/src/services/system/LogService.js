const BaseService = require('../BaseService')
const { LogRepository, OperationLogRepository } = require('../../repositories/LogRepository')

class LogService extends BaseService {
  constructor() {
    const logRepository = new LogRepository()
    super(logRepository)
    this.logRepository = logRepository
    this.operationLogRepository = new OperationLogRepository()
  }

  async query(filters = {}) {
    try {
      const result = await this.logRepository.findWithFilters(filters)
      return { success: true, ...result }
    } catch (error) {
      console.error('Query logs error:', error)
      return { success: false, message: '查询日志失败', error: error.message }
    }
  }

  async log(level, module, action, message, details = {}, userId = null) {
    try {
      await this.logRepository.log(level, module, action, message, details, userId)
      return { success: true }
    } catch (error) {
      console.error('Log error:', error)
      return { success: false, message: '记录日志失败', error: error.message }
    }
  }

  async getStatistics(filters = {}) {
    try {
      const stats = await this.logRepository.getStatistics(filters)
      return { success: true, data: stats }
    } catch (error) {
      console.error('Get statistics error:', error)
      return { success: false, message: '获取统计失败', error: error.message }
    }
  }

  async cleanup(daysToKeep = 90) {
    try {
      const deleted = await this.logRepository.cleanup(daysToKeep)
      return { success: true, deleted }
    } catch (error) {
      console.error('Cleanup error:', error)
      return { success: false, message: '清理日志失败', error: error.message }
    }
  }

  async export(filters = {}, format = 'json') {
    try {
      const data = await this.logRepository.export(filters, format)
      return { success: true, data, format }
    } catch (error) {
      console.error('Export error:', error)
      return { success: false, message: '导出日志失败', error: error.message }
    }
  }
}

module.exports = LogService
