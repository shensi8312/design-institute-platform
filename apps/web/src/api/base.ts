import axios from '../utils/axios'

/**
 * API响应的统一格式（与后端Controller返回格式一致）
 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

/**
 * 分页响应格式
 */
export interface PaginatedResponse<T> {
  list: T[]
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  total?: number
}

/**
 * 分页请求参数
 */
export interface PaginationParams {
  page?: number
  pageSize?: number
  orderBy?: string
  order?: 'asc' | 'desc'
}

/**
 * 搜索参数
 */
export interface SearchParams extends PaginationParams {
  search?: string
  [key: string]: any
}

/**
 * 基础API类 - 提供通用的CRUD方法
 * 所有API模块都继承这个类
 */
export class BaseAPI<T = any, CreateDTO = any, UpdateDTO = any> {
  protected baseURL: string

  constructor(endpoint: string) {
    this.baseURL = `/api/${endpoint}`
  }

  /**
   * 获取列表
   */
  async getList(params?: SearchParams): Promise<PaginatedResponse<T>> {
    const response = await axios.get(this.baseURL, { params })
    if (response.data.success) {
      return response.data.data
    }
    throw new Error(response.data.message || '获取列表失败')
  }

  /**
   * 获取详情
   */
  async getById(id: string): Promise<T> {
    const response = await axios.get(`${this.baseURL}/${id}`)
    if (response.data.success) {
      return response.data.data
    }
    throw new Error(response.data.message || '获取详情失败')
  }

  /**
   * 创建
   */
  async create(data: CreateDTO): Promise<T> {
    const response = await axios.post(this.baseURL, data)
    if (response.data.success) {
      return response.data.data
    }
    throw new Error(response.data.message || '创建失败')
  }

  /**
   * 更新
   */
  async update(id: string, data: UpdateDTO): Promise<T> {
    const response = await axios.put(`${this.baseURL}/${id}`, data)
    if (response.data.success) {
      return response.data.data
    }
    throw new Error(response.data.message || '更新失败')
  }

  /**
   * 删除
   */
  async delete(id: string): Promise<void> {
    const response = await axios.delete(`${this.baseURL}/${id}`)
    if (!response.data.success) {
      throw new Error(response.data.message || '删除失败')
    }
  }

  /**
   * 批量删除
   */
  async bulkDelete(ids: string[]): Promise<void> {
    const response = await axios.post(`${this.baseURL}/bulk-delete`, { ids })
    if (!response.data.success) {
      throw new Error(response.data.message || '批量删除失败')
    }
  }

  /**
   * 批量操作
   */
  async bulkAction(action: string, ids: string[], data?: any): Promise<any> {
    const response = await axios.post(`${this.baseURL}/bulk-${action}`, { 
      ids, 
      ...data 
    })
    if (response.data.success) {
      return response.data.data
    }
    throw new Error(response.data.message || `批量${action}失败`)
  }
}