const BaseRepository = require('./BaseRepository')

/**
 * 数字工地告警 Repository
 */
class SiteAlertRepository extends BaseRepository {
  constructor() {
    super('site_alerts')
  }

  applyFilters(query, filters = {}) {
    if (filters.siteId) {
      query.where('site_id', filters.siteId)
    }

    if (filters.projectId) {
      query.where('project_id', filters.projectId)
    }

    if (filters.alertLevels && filters.alertLevels.length > 0) {
      query.whereIn('alert_level', filters.alertLevels)
    }

    if (filters.status && filters.status.length > 0) {
      query.whereIn('ack_status', filters.status)
    }

    if (filters.from) {
      query.where('detected_at', '>=', filters.from)
    }

    if (filters.to) {
      query.where('detected_at', '<=', filters.to)
    }

    if (filters.tagId) {
      const tagPayload = JSON.stringify([{ id: filters.tagId }])
      query.whereRaw('tags @> ?', [tagPayload])
    }

    return query
  }

  /**
   * 构建列表查询
   */
  buildListQuery(filters = {}) {
    const orderField = filters.orderBy || 'detected_at'
    const orderDirection = filters.order === 'asc' ? 'asc' : 'desc'

    const query = this.db('site_alerts').select('*')
    this.applyFilters(query, filters)
    query.orderBy(orderField, orderDirection)
    return query
  }

  /**
   * 根据过滤条件获取列表
   */
  async findWithFilters(filters = {}, options = {}) {
    let query = this.buildListQuery(filters)

    if (options.limit) {
      query = query.limit(options.limit)
    }

    if (options.offset) {
      query = query.offset(options.offset)
    }

    return await query
  }

  async countWithFilters(filters = {}) {
    const query = this.db('site_alerts')
    this.applyFilters(query, filters)
    const [{ count }] = await query.count('* as count')
    return parseInt(count, 10)
  }

  async getRecent(limit = 10) {
    return await this.db('site_alerts')
      .select('*')
      .orderBy('detected_at', 'desc')
      .limit(limit)
  }

  async getLevelDistribution({ siteId, from, to }) {
    let query = this.db('site_alerts')
      .select('alert_level')
      .count('* as count')
      .groupBy('alert_level')

    if (siteId) {
      query = query.where('site_id', siteId)
    }

    if (from) {
      query = query.where('detected_at', '>=', from)
    }

    if (to) {
      query = query.where('detected_at', '<=', to)
    }

    return await query
  }

  async getDailyTrend({ siteId, from, to }) {
    let query = this.db('site_alerts')
      .select(this.db.raw("date_trunc('day', detected_at) as day"))
      .count('* as count')
      .groupByRaw("date_trunc('day', detected_at)")
      .orderBy('day', 'asc')

    if (siteId) {
      query = query.where('site_id', siteId)
    }

    if (from) {
      query = query.where('detected_at', '>=', from)
    }

    if (to) {
      query = query.where('detected_at', '<=', to)
    }

    return await query
  }
}

module.exports = SiteAlertRepository
