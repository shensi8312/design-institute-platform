const dayjs = require('dayjs')
const SiteAlertRepository = require('../../repositories/SiteAlertRepository')
const ProjectRepository = require('../../repositories/ProjectRepository')
const { getDigitalSiteWebSocket } = require('./DigitalSiteWebSocket')

const DEFAULT_TAGS = [
  { id: 'tag_safety', label: '安全监控', category: 'safety' },
  { id: 'tag_quality', label: '质量巡检', category: 'quality' },
  { id: 'tag_progress', label: '进度跟踪', category: 'progress' }
]

const DEFAULT_OVERVIEW = {
  metrics: {
    activeProjects: 2,
    todaysAlerts: 2,
    onlineCameras: 18,
    workersOnSite: 126
  },
  energyConsumption: {
    total: 1870,
    unit: 'kWh',
    trend: [120, 140, 160, 180, 210, 230, 260]
  },
  environment: {
    temperature: 25,
    humidity: 62,
    pm25: 43,
    noise: 65,
    updatedAt: dayjs().toISOString()
  }
}

const DEFAULT_PROJECTS = [
  {
    id: 'site_project_001',
    name: '总部园区智能施工',
    status: 'monitoring',
    progress: 62,
    updatedAt: dayjs().subtract(12, 'minute').toISOString(),
    tags: ['主体结构', '安全监控'],
    alertCount: 3
  },
  {
    id: 'site_project_002',
    name: '装配式示范楼',
    status: 'on_hold',
    progress: 38,
    updatedAt: dayjs().subtract(3, 'hour').toISOString(),
    tags: ['塔吊监控', '物料追踪'],
    alertCount: 1
  }
]

const DEFAULT_ALERTS = [
  {
    id: 'alert_1001',
    siteId: 'site_project_001',
    projectId: 'site_project_001',
    level: 'high',
    alertLevel: 'high',
    type: 'safety',
    alertCode: 'helmet_missing',
    title: '未佩戴安全帽',
    alertTitle: '未佩戴安全帽',
    message: '2号塔吊风速超过安全阈值，请立即检查',
    alertMessage: '2号塔吊风速超过安全阈值，请立即检查',
    detectedAt: dayjs().subtract(5, 'minute').toISOString(),
    createdAt: dayjs().subtract(5, 'minute').toISOString(),
    handled: false,
    ackStatus: 'unread',
    tags: [{ id: 'tag_safety', label: '安全监控' }]
  },
  {
    id: 'alert_1002',
    siteId: 'site_project_002',
    projectId: 'site_project_002',
    level: 'medium',
    alertLevel: 'medium',
    type: 'quality',
    alertCode: 'quality_missing_record',
    title: '质量巡检缺失',
    alertTitle: '质量巡检缺失',
    message: '混凝土浇筑振捣记录缺失，请补录',
    alertMessage: '混凝土浇筑振捣记录缺失，请补录',
    detectedAt: dayjs().subtract(27, 'minute').toISOString(),
    createdAt: dayjs().subtract(27, 'minute').toISOString(),
    handled: false,
    ackStatus: 'unread',
    tags: [{ id: 'tag_quality', label: '质量巡检' }]
  }
]

/**
 * 数字工地服务
 */
class DigitalSiteService {
  constructor() {
    this.siteAlertRepository = new SiteAlertRepository()
    this.projectRepository = new ProjectRepository()
  }

  sanitizeTags(tags = []) {
    if (!Array.isArray(tags)) return []
    return tags.map(tag => {
      if (typeof tag === 'string') {
        const fallback = DEFAULT_TAGS.find(item => item.id === tag)
        return fallback || { id: tag, label: tag }
      }
      return {
        id: tag.id || tag.code || tag.label,
        label: tag.label || tag.name || tag.id,
        category: tag.category
      }
    })
  }

  formatAlert(alert) {
    const formattedTags = this.sanitizeTags(alert.tags)
    return {
      id: alert.id,
      siteId: alert.site_id,
      projectId: alert.project_id,
      level: alert.alert_level,
      alertLevel: alert.alert_level,
      type: alert.alert_code,
      alertCode: alert.alert_code,
      title: alert.alert_title,
      alertTitle: alert.alert_title,
      message: alert.alert_message,
      alertMessage: alert.alert_message,
      detectedAt: alert.detected_at,
      createdAt: alert.detected_at,
      imageUrl: alert.image_url,
      videoUrl: alert.video_url,
      ackStatus: alert.ack_status,
      handled: alert.ack_status === 'resolved',
      ackBy: alert.ack_by,
      ackNote: alert.ack_note,
      ackAt: alert.ack_at,
      tags: formattedTags,
      rawPayload: alert.raw_payload,
      confidence:
        (alert.extra_metadata && alert.extra_metadata.confidence !== undefined
          ? alert.extra_metadata.confidence
          : undefined) ||
        (alert.raw_payload && alert.raw_payload.confidence !== undefined
          ? alert.raw_payload.confidence
          : undefined),
      extraMetadata: alert.extra_metadata
    }
  }

  async getOverview(params = {}) {
    const { siteId } = params
    const todayStart = dayjs().startOf('day').toDate()

    let activeProjectsQuery = this.projectRepository.db('projects')
      .whereNot('status', 'completed')
    if (siteId) {
      activeProjectsQuery = activeProjectsQuery.where((builder) => {
        builder.where('id', siteId).orWhere('code', siteId)
      })
    }
    const activeProjectsResult = await activeProjectsQuery.count('* as total').first()
    const activeProjects = parseInt(activeProjectsResult?.total || 0, 10)

    const todaysAlertsQuery = this.siteAlertRepository.db('site_alerts')
      .where('detected_at', '>=', todayStart)
    if (siteId) {
      todaysAlertsQuery.where('site_id', siteId)
    }
    const todaysAlertsResult = await todaysAlertsQuery.count('* as total').first()
    const todaysAlerts = parseInt(todaysAlertsResult?.total || 0, 10)

    let cameraQuery = this.siteAlertRepository.db('site_alerts')
      .whereNotNull('camera_id')
      .where('detected_at', '>=', dayjs().subtract(1, 'day').toDate())
    if (siteId) {
      cameraQuery = cameraQuery.where('site_id', siteId)
    }
    const cameraRows = await cameraQuery.distinct('camera_id')
    const onlineCameras = cameraRows.length

    let latestAlertQuery = this.siteAlertRepository.db('site_alerts')
      .orderBy('detected_at', 'desc')
    if (siteId) {
      latestAlertQuery = latestAlertQuery.where('site_id', siteId)
    }
    const latestAlert = await latestAlertQuery.first()
    const workersOnSite = latestAlert?.extra_metadata?.workerCount || DEFAULT_OVERVIEW.metrics.workersOnSite
    const environment = latestAlert?.extra_metadata?.environment || DEFAULT_OVERVIEW.environment

    const trendRows = await this.siteAlertRepository.getDailyTrend({ siteId, from: dayjs().subtract(6, 'day').toDate() })
    const trend = trendRows.map(row => Number(row.count))

    if (activeProjects === 0 && todaysAlerts === 0 && trend.length === 0) {
      return { success: true, data: DEFAULT_OVERVIEW }
    }

    return {
      success: true,
      data: {
        metrics: {
          activeProjects,
          todaysAlerts,
          onlineCameras,
          workersOnSite
        },
        energyConsumption: {
          total: trend.reduce((acc, val) => acc + val, 0) * 10 || DEFAULT_OVERVIEW.energyConsumption.total,
          unit: 'kWh',
          trend: trend.length > 0 ? trend : DEFAULT_OVERVIEW.energyConsumption.trend
        },
        environment: {
          ...environment,
          updatedAt: environment?.updatedAt || latestAlert?.detected_at || DEFAULT_OVERVIEW.environment.updatedAt
        }
      }
    }
  }

  async getStats(params = {}) {
    const { siteId, from, to } = params
    const distribution = await this.siteAlertRepository.getLevelDistribution({ siteId, from, to })
    const trend = await this.siteAlertRepository.getDailyTrend({ siteId, from, to })

    return {
      success: true,
      data: {
        byLevel: distribution.reduce((acc, item) => {
          acc[item.alert_level] = Number(item.count)
          return acc
        }, {}),
        trend: trend.map(item => ({
          date: dayjs(item.day).format('YYYY-MM-DD'),
          count: Number(item.count)
        }))
      }
    }
  }

  async listProjects() {
    const rows = await this.siteAlertRepository.db('site_alerts')
      .select('site_id', 'project_id')
      .count('* as alert_count')
      .max('detected_at as updated_at')
      .groupBy('site_id', 'project_id')
      .orderBy('updated_at', 'desc')

    if (rows.length === 0) {
      return { success: true, data: DEFAULT_PROJECTS }
    }

    const projectIds = Array.from(new Set(rows.map(row => row.project_id).filter(Boolean)))
    let projectMap = {}
    if (projectIds.length > 0) {
      const projectRecords = await this.projectRepository.db('projects').whereIn('id', projectIds)
      projectRecords.forEach(project => {
        projectMap[project.id] = project
      })
    }

    const siteIds = rows.map(row => row.site_id)
    const tagRows = await this.siteAlertRepository.db('site_alerts')
      .select('site_id', 'tags')
      .whereIn('site_id', siteIds)
    const tagMap = {}
    tagRows.forEach(row => {
      const safeTags = this.sanitizeTags(row.tags)
      if (!tagMap[row.site_id]) {
        tagMap[row.site_id] = new Map()
      }
      safeTags.forEach(tag => {
        tagMap[row.site_id].set(tag.id, tag)
      })
    })

    const data = rows.map(row => {
      const project = projectMap[row.project_id] || {}
      const tags = tagMap[row.site_id] ? Array.from(tagMap[row.site_id].values()).map(tag => tag.label) : []
      return {
        id: row.site_id,
        name: project.name || row.site_id,
        status: project.status || 'monitoring',
        progress: project.progress || 0,
        alertCount: Number(row.alert_count || 0),
        updatedAt: row.updated_at,
        tags
      }
    })

    return { success: true, data }
  }

  async listAlerts(params = {}) {
    const {
      page = 1,
      pageSize = 20,
      siteId,
      projectId,
      level,
      status,
      tagId,
      from,
      to,
      orderBy,
      order
    } = params

    const filters = {
      siteId,
      projectId,
      alertLevels: Array.isArray(level) ? level : level ? [level] : [],
      status: Array.isArray(status) ? status : status ? [status] : [],
      tagId,
      from,
      to,
      orderBy,
      order
    }

    const offset = (page - 1) * pageSize

    const [list, total] = await Promise.all([
      this.siteAlertRepository.findWithFilters(filters, { limit: pageSize, offset }),
      this.siteAlertRepository.countWithFilters(filters)
    ])

    if (list.length === 0 && total === 0) {
      return {
        success: true,
        data: {
          list: DEFAULT_ALERTS,
          pagination: {
            page: 1,
            pageSize: DEFAULT_ALERTS.length,
            total: DEFAULT_ALERTS.length,
            totalPages: 1
          }
        }
      }
    }

    return {
      success: true,
      data: {
        list: list.map(alert => this.formatAlert(alert)),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    }
  }

  async createAlert(data, userId = 'system') {
    const tags = this.sanitizeTags(data.tags)
    const threshold = Number(process.env.DIGITAL_SITE_CONFIDENCE_THRESHOLD || 0)
    const numericConfidence =
      data.confidence !== undefined && data.confidence !== null
        ? Number(data.confidence)
        : data.rawPayload && data.rawPayload.confidence !== undefined
          ? Number(data.rawPayload.confidence)
          : NaN

    if (!Number.isNaN(numericConfidence) && numericConfidence < threshold) {
      return {
        success: false,
        message: `告警置信度 ${numericConfidence.toFixed(2)} 低于阈值 ${threshold}`
      }
    }

    const payload = {
      site_id: data.siteId,
      project_id: data.projectId,
      camera_id: data.cameraId,
      area: data.area,
      alert_code: data.alertCode || data.type,
      alert_level: data.alertLevel || data.level || 'info',
      alert_title: data.alertTitle || data.title || '告警',
      alert_message: data.alertMessage || data.message,
      detected_at: data.detectedAt || new Date(),
      image_url: data.imageUrl,
      video_url: data.videoUrl,
      tags,
      raw_payload: data.rawPayload,
      ack_status: 'unread',
      created_by: userId,
      organization_id: data.organizationId,
      department_id: data.departmentId,
      extra_metadata: {
        ...(data.extraMetadata || {}),
        confidence: Number.isNaN(numericConfidence) ? undefined : numericConfidence
      }
    }

    if (!Number.isNaN(numericConfidence)) {
      payload.raw_payload = payload.raw_payload || {}
      payload.raw_payload.confidence = numericConfidence
    }

    if (!payload.site_id) {
      throw new Error('siteId 不能为空')
    }

    if (!payload.alert_code) {
      throw new Error('alertCode 不能为空')
    }

    const alert = await this.siteAlertRepository.create(payload)
    const formatted = this.formatAlert(alert)
    this.notifyAlertListeners('alert:new', formatted)
    await this.broadcastStats(formatted.siteId)
    return { success: true, data: formatted }
  }

  async acknowledgeAlert(id, status, note, userId) {
    if (!['acknowledged', 'resolved'].includes(status)) {
      throw new Error('无效的状态')
    }

    const updated = await this.siteAlertRepository.update(id, {
      ack_status: status,
      ack_note: note,
      ack_by: userId,
      ack_at: new Date()
    })

    if (!updated) {
      return { success: false, message: '告警不存在' }
    }

    const formatted = this.formatAlert(updated)
    this.notifyAlertListeners('alert:update', formatted)
    await this.broadcastStats(formatted.siteId)

    return { success: true, data: formatted }
  }

  async resolveAlert(id, note, userId) {
    return this.acknowledgeAlert(id, 'resolved', note, userId)
  }

  async getAlertById(id) {
    const alert = await this.siteAlertRepository.findById(id)
    if (!alert) {
      return { success: false, message: '告警不存在' }
    }

    return { success: true, data: this.formatAlert(alert) }
  }

  async listTags() {
    const rows = await this.siteAlertRepository.db('site_alerts')
      .select('tags')
      .whereNotNull('tags')
      .limit(200)

    const tagMap = new Map()
    rows.forEach(row => {
      const safeTags = this.sanitizeTags(row.tags)
      safeTags.forEach(tag => {
        tagMap.set(tag.id, { id: tag.id, label: tag.label, category: tag.category })
      })
    })

    if (tagMap.size === 0) {
      return { success: true, data: DEFAULT_TAGS }
    }

    const dynamicTags = Array.from(tagMap.values())
    return { success: true, data: dynamicTags }
  }

  notifyAlertListeners(eventType, alert) {
    const ws = typeof getDigitalSiteWebSocket === 'function' ? getDigitalSiteWebSocket() : null
    if (!ws || !alert) {
      return
    }
    try {
      if (eventType === 'alert:new') {
        ws.emitAlertCreated(alert)
      } else {
        ws.emitAlertUpdated(alert)
      }
    } catch (error) {
      console.warn('数字工地告警广播失败:', error.message)
    }
  }

  async broadcastStats(siteId = null) {
    const ws = typeof getDigitalSiteWebSocket === 'function' ? getDigitalSiteWebSocket() : null
    if (!ws) return
    try {
      const result = await this.getStats(siteId ? { siteId } : {})
      if (result.success) {
        ws.emitStats(result.data, siteId)
      }
    } catch (error) {
      console.warn('数字工地统计广播失败:', error.message)
    }
  }
}

module.exports = DigitalSiteService
