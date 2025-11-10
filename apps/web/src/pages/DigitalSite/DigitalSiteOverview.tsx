import React, { useEffect, useState } from 'react'
import { Card, Row, Col, Typography, List, Tag, Progress, Alert, Space, Skeleton } from 'antd'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import type { DigitalSiteOverview, DigitalSiteProject, DigitalSiteAlert, DigitalSiteTag } from '../../api/digitalSite'
import { getOverview, getProjects, getAlerts, getTags } from '../../api/digitalSite'

const { Title, Text } = Typography

dayjs.extend(relativeTime)

const fallbackOverview: DigitalSiteOverview = {
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
    updatedAt: dayjs().toISOString()
  }
}

const fallbackProjects: DigitalSiteProject[] = [
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

const fallbackAlerts: DigitalSiteAlert[] = [
  {
    id: 'alert_1001',
    siteId: 'site_project_001',
    projectId: 'site_project_001',
    level: 'high',
    alertLevel: 'high',
    type: 'safety',
    message: '2号塔吊风速超过安全阈值，请立即检查',
    alertMessage: '2号塔吊风速超过安全阈值，请立即检查',
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
    message: '混凝土浇筑振捣记录缺失，请补录',
    alertMessage: '混凝土浇筑振捣记录缺失，请补录',
    createdAt: dayjs().subtract(27, 'minute').toISOString(),
    handled: false,
    ackStatus: 'unread',
    tags: [{ id: 'tag_quality', label: '质量巡检' }]
  }
]

const fallbackTags: DigitalSiteTag[] = [
  { id: 'tag_safety', name: '安全监控', category: 'safety' },
  { id: 'tag_quality', name: '质量巡检', category: 'quality' },
  { id: 'tag_progress', name: '进度跟踪', category: 'progress' }
]

const levelColorMap: Record<string, string> = {
  high: 'error',
  medium: 'warning',
  low: 'default',
  info: 'default'
}

const statusLabelMap: Record<string, string> = {
  monitoring: '监控中',
  on_hold: '暂停',
  completed: '已完成'
}

const DigitalSiteDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [overview, setOverview] = useState<DigitalSiteOverview | null>(null)
  const [projects, setProjects] = useState<DigitalSiteProject[]>([])
  const [alerts, setAlerts] = useState<DigitalSiteAlert[]>([])
  const [tags, setTags] = useState<DigitalSiteTag[]>([])
  const [alertPagination, setAlertPagination] = useState<{ page: number; pageSize: number; total: number; totalPages: number } | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [overviewData, projectData, alertResponse, tagData] = await Promise.all([
          getOverview(),
          getProjects(),
          getAlerts({ pageSize: 50 }),
          getTags()
        ])

        setOverview(overviewData)
        setProjects(projectData)
        setAlerts(alertResponse.list)
        setAlertPagination(alertResponse.pagination || null)
        setTags(tagData)
      } catch (error) {
        console.warn('数字工地接口暂未就绪，使用占位数据，错误信息:', error)
        setErrorMessage('未能读取实时接口，当前展示示例数据，后端接入完成后即可自动切换。')
        setOverview(fallbackOverview)
        setProjects(fallbackProjects)
        setAlerts(fallbackAlerts)
        setTags(fallbackTags)
        setAlertPagination(null)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const renderTrend = (values: number[]) => {
    if (values.length === 0) return null
    const max = Math.max(...values)
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        {values.map((value, index) => (
          <div
            key={`${value}-${index}`}
            style={{
              width: 12,
              height: 40,
              background: '#1890ff',
              opacity: 0.3 + (value / max) * 0.7,
              borderRadius: 4
            }}
            title={`${value}`}
          />
        ))}
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Title level={3}>数字工地总览</Title>
          <Text type="secondary">实时掌握现场动态、关键告警与能源数据</Text>
        </div>

        {errorMessage && (
          <Alert type="warning" message={errorMessage} showIcon />
        )}

        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Card loading={loading}>
              <Title level={4}>在建项目</Title>
              <Text style={{ fontSize: 28, fontWeight: 600 }}>
                {overview?.metrics.activeProjects ?? '--'}
              </Text>
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card loading={loading}>
              <Title level={4}>今日告警</Title>
              <Text style={{ fontSize: 28, fontWeight: 600 }}>
                {overview?.metrics.todaysAlerts ?? '--'}
              </Text>
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card loading={loading}>
              <Title level={4}>在线摄像头</Title>
              <Text style={{ fontSize: 28, fontWeight: 600 }}>
                {overview?.metrics.onlineCameras ?? '--'}
              </Text>
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card loading={loading}>
              <Title level={4}>现场人员</Title>
              <Text style={{ fontSize: 28, fontWeight: 600 }}>
                {overview?.metrics.workersOnSite ?? '--'}
              </Text>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card title="能耗趋势" loading={loading}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Text>
                  当日能耗：
                  <Text strong>
                    {overview?.energyConsumption.total ?? '--'} {overview?.energyConsumption.unit || ''}
                  </Text>
                </Text>
                {loading ? <Skeleton active paragraph={{ rows: 1 }} /> : renderTrend(overview?.energyConsumption.trend || [])}
              </Space>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card title="环境监测" loading={loading}>
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Text type="secondary">温度</Text>
                  <div style={{ fontSize: 22, fontWeight: 500 }}>
                    {overview?.environment.temperature ?? '--'}°C
                  </div>
                </Col>
                <Col span={8}>
                  <Text type="secondary">湿度</Text>
                  <div style={{ fontSize: 22, fontWeight: 500 }}>
                    {overview?.environment.humidity ?? '--'}%
                  </div>
                </Col>
                <Col span={8}>
                  <Text type="secondary">PM2.5</Text>
                  <div style={{ fontSize: 22, fontWeight: 500 }}>
                    {overview?.environment.pm25 ?? '--'} μg/m³
                  </div>
                </Col>
              </Row>
              <Text type="secondary">
                更新时间：{overview ? dayjs(overview.environment.updatedAt).format('YYYY-MM-DD HH:mm:ss') : '--'}
              </Text>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card title="项目进度" loading={loading}>
              <List
                dataSource={projects}
                renderItem={(item) => (
                  <List.Item key={item.id}>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text strong>{item.name}</Text>
                          <Tag color="blue">{statusLabelMap[item.status] || item.status}</Tag>
                        </Space>
                      }
                      description={`更新于 ${dayjs(item.updatedAt).fromNow()}`}
                    />
                    <div style={{ width: 160 }}>
                      <Progress percent={item.progress} size="small" status="active" />
                      <Space size={4} wrap>
                        {item.tags.map((tag) => (
                          <Tag key={tag}>{tag}</Tag>
                        ))}
                      </Space>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card
              title="告警动态"
              loading={loading}
              extra={alertPagination ? <Text type="secondary">共 {alertPagination.total} 条</Text> : null}
            >
              <List
                dataSource={alerts}
                renderItem={(item) => (
                  <List.Item key={item.id}>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag color={levelColorMap[item.level] || 'default'}>
                            {item.level === 'high' ? '高' : item.level === 'medium' ? '中' : '低'}
                          </Tag>
                          <Text strong>{item.message}</Text>
                        </Space>
                      }
                      description={`所属项目：${item.projectId || '--'} · ${dayjs(item.createdAt || item.detectedAt || new Date()).fromNow()} · 置信度：${item.confidence !== undefined ? item.confidence.toFixed(2) : '—'}`}
                    />
                    <Tag color={item.handled ? 'success' : 'processing'}>
                      {item.handled ? '已处理' : '未处理'}
                    </Tag>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>

        <Card title="标签体系" loading={loading}>
          <Space size={8} wrap>
            {tags.map((tag) => (
              <Tag key={tag.id} color="geekblue">
                {tag.label || tag.name || tag.id}
              </Tag>
            ))}
          </Space>
        </Card>
      </Space>
    </div>
  )
}

export default DigitalSiteDashboard
