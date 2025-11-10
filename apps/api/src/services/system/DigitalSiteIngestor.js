const dayjs = require('dayjs')
const DigitalSiteService = require('./DigitalSiteService')

class DigitalSiteIngestor {
  constructor() {
    this.service = new DigitalSiteService()
    this.timer = null
  }

  async ingest(payload, userId = 'yolo-monitor') {
    return this.service.createAlert(payload, userId)
  }

  start() {
    if (process.env.DIGITAL_SITE_MOCK !== 'true') {
      return
    }
    const interval = parseInt(process.env.DIGITAL_SITE_MOCK_INTERVAL || '60000', 10)
    if (this.timer) {
      clearInterval(this.timer)
    }
    this.timer = setInterval(async () => {
      const payload = this.generateMockPayload()
      try {
        await this.ingest(payload, 'mock-generator')
        console.log('🛰️  模拟生成数字工地告警:', payload.alertCode, payload.alertLevel)
      } catch (error) {
        console.warn('⚠️ 模拟告警写入失败:', error.message)
      }
    }, interval)
    console.log(`📡 数字工地模拟告警已启动，间隔 ${interval}ms`) 
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  generateMockPayload() {
    const sites = ['site_project_001', 'site_project_002', 'site_project_003']
    const alertTemplates = [
      {
        code: 'helmet_missing',
        title: '安全帽缺失',
        message: '检测到 1 名工人未佩戴安全帽',
        level: 'high',
        tags: [{ id: 'tag_safety', label: '安全监控' }]
      },
      {
        code: 'vest_missing',
        title: '反光背心缺失',
        message: '检测到施工区有人员未穿反光背心',
        level: 'medium',
        tags: [{ id: 'tag_safety', label: '安全监控' }]
      },
      {
        code: 'intrusion',
        title: '禁区入侵',
        message: '检测到未授权人员进入限制区域',
        level: 'critical',
        tags: [{ id: 'tag_safety', label: '安全监控' }]
      },
      {
        code: 'quality_missing_record',
        title: '质量巡检缺失',
        message: '结构浇筑记录缺失，请尽快补录',
        level: 'medium',
        tags: [{ id: 'tag_quality', label: '质量巡检' }]
      }
    ]

    const template = alertTemplates[Math.floor(Math.random() * alertTemplates.length)]
    const siteId = sites[Math.floor(Math.random() * sites.length)]
    const timestamp = dayjs().toISOString()
    const confidence = Number((0.5 + Math.random() * 0.5).toFixed(2))

    return {
      siteId,
      projectId: siteId,
      cameraId: `cam-${Math.floor(Math.random() * 10) + 1}`,
      alertCode: template.code,
      alertTitle: template.title,
      alertMessage: template.message,
      alertLevel: template.level,
      detectedAt: timestamp,
      imageUrl: `https://dummyimage.com/640x360/0015ff/ffffff&text=${encodeURIComponent(template.title)}`,
      tags: template.tags,
      confidence,
      rawPayload: {
        source: 'mock',
        timestamp,
        confidence
      },
      extraMetadata: {
        environment: {
          temperature: 24 + Math.random() * 4,
          humidity: 55 + Math.random() * 10,
          pm25: 30 + Math.random() * 20,
          updatedAt: timestamp
        },
        workerCount: 100 + Math.floor(Math.random() * 40)
      }
    }
  }
}

module.exports = new DigitalSiteIngestor()
