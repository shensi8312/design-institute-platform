import axios from '../utils/axios'
import type { ApiResponse } from './base'

export interface DigitalSiteOverview {
  metrics: {
    activeProjects: number
    todaysAlerts: number
    onlineCameras: number
    workersOnSite: number
  }
  energyConsumption: {
    total: number
    unit: string
    trend: number[]
  }
  environment: {
    temperature: number
    humidity: number
    pm25: number
    noise?: number
    updatedAt: string
  }
}

export interface DigitalSiteProject {
  id: string
  name: string
  status: 'monitoring' | 'on_hold' | 'completed' | string
  progress: number
  updatedAt: string
  tags: string[]
  alertCount?: number
}

export interface DigitalSiteTag {
  id: string
  label?: string
  name?: string
  category?: string
}

export interface DigitalSiteAlert {
  id: string
  siteId?: string
  projectId: string
  level: 'info' | 'low' | 'medium' | 'high' | string
  alertLevel?: string
  type: string
  alertCode?: string
  title?: string
  alertTitle?: string
  message: string
  alertMessage?: string
  createdAt: string
  detectedAt?: string
  imageUrl?: string
  videoUrl?: string
  cameraId?: string
  ackStatus?: string
  handled: boolean
  ackBy?: string
  ackNote?: string
  ackAt?: string
  confidence?: number
  tags: DigitalSiteTag[]
}

export interface DigitalSiteAlertQuery {
  page?: number
  pageSize?: number
  siteId?: string
  projectId?: string
  level?: string | string[]
  status?: string | string[]
  from?: string
  to?: string
  tagId?: string
  orderBy?: string
  order?: 'asc' | 'desc'
}

export interface DigitalSiteAlertListResponse {
  list: DigitalSiteAlert[]
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface DigitalSiteStatsResponse {
  byLevel: Record<string, number>
  trend: Array<{ date: string; count: number }>
}

export interface CreateDigitalSiteAlertPayload {
  siteId: string
  projectId?: string
  cameraId?: string
  area?: string
  alertCode: string
  alertLevel?: string
  alertTitle?: string
  alertMessage?: string
  detectedAt?: string
  imageUrl?: string
  videoUrl?: string
  tags?: Array<{ id: string; label?: string } | string>
  confidence?: number
  rawPayload?: Record<string, any>
  extraMetadata?: Record<string, any>
}

const BASE_URL = '/api/digital-site'

export async function getOverview(params?: { siteId?: string }): Promise<DigitalSiteOverview> {
  const response = await axios.get<ApiResponse<DigitalSiteOverview>>(`${BASE_URL}/overview`, { params })
  if (response.data.success && response.data.data) {
    return response.data.data
  }
  throw new Error(response.data.message || '获取数字工地概览失败')
}

export async function getProjects(): Promise<DigitalSiteProject[]> {
  const response = await axios.get<ApiResponse<DigitalSiteProject[]>>(`${BASE_URL}/projects`)
  if (response.data.success && response.data.data) {
    return response.data.data
  }
  throw new Error(response.data.message || '获取数字工地项目失败')
}

export async function getAlerts(params?: DigitalSiteAlertQuery): Promise<DigitalSiteAlertListResponse> {
  const response = await axios.get<ApiResponse<DigitalSiteAlertListResponse>>(`${BASE_URL}/alerts`, { params })
  if (response.data.success && response.data.data) {
    return response.data.data
  }
  throw new Error(response.data.message || '获取数字工地告警失败')
}

export async function getAlertDetail(id: string): Promise<DigitalSiteAlert> {
  const response = await axios.get<ApiResponse<DigitalSiteAlert>>(`${BASE_URL}/alerts/${id}`)
  if (response.data.success && response.data.data) {
    return response.data.data
  }
  throw new Error(response.data.message || '获取数字工地告警详情失败')
}

export async function createAlert(payload: CreateDigitalSiteAlertPayload): Promise<DigitalSiteAlert> {
  const response = await axios.post<ApiResponse<DigitalSiteAlert>>(`${BASE_URL}/alerts`, payload)
  if (response.data.success && response.data.data) {
    return response.data.data
  }
  throw new Error(response.data.message || '创建数字工地告警失败')
}

export async function acknowledgeAlert(
  id: string,
  body: { status?: 'acknowledged' | 'resolved'; note?: string }
): Promise<DigitalSiteAlert> {
  const response = await axios.patch<ApiResponse<DigitalSiteAlert>>(`${BASE_URL}/alerts/${id}/ack`, body)
  if (response.data.success && response.data.data) {
    return response.data.data
  }
  throw new Error(response.data.message || '更新告警状态失败')
}

export async function resolveAlert(id: string, note?: string): Promise<DigitalSiteAlert> {
  const response = await axios.patch<ApiResponse<DigitalSiteAlert>>(`${BASE_URL}/alerts/${id}/resolve`, { note })
  if (response.data.success && response.data.data) {
    return response.data.data
  }
  throw new Error(response.data.message || '关闭告警失败')
}

export async function getTags(): Promise<DigitalSiteTag[]> {
  const response = await axios.get<ApiResponse<DigitalSiteTag[]>>(`${BASE_URL}/tags`)
  if (response.data.success && response.data.data) {
    return response.data.data
  }
  throw new Error(response.data.message || '获取数字工地标签失败')
}

export async function getStats(params?: { siteId?: string; from?: string; to?: string }): Promise<DigitalSiteStatsResponse> {
  const response = await axios.get<ApiResponse<DigitalSiteStatsResponse>>(`${BASE_URL}/stats`, { params })
  if (response.data.success && response.data.data) {
    return response.data.data
  }
  throw new Error(response.data.message || '获取数字工地统计失败')
}
