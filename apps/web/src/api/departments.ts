import { BaseAPI } from './base'
import axios from '../utils/axios'

/**
 * 部门类型定义
 */
export interface Department {
  id: string
  name: string
  code: string
  parent_id?: string
  organization_id: string
  organization_name?: string
  manager_id?: string
  manager_name?: string
  description?: string
  sort_order?: number
  status: 'active' | 'inactive'
  member_count?: number
  children?: Department[]
  members?: any[]
  created_at: string
  updated_at: string
}

/**
 * 创建部门DTO
 */
export interface CreateDepartmentDTO {
  name: string
  code?: string
  parent_id?: string
  organization_id: string
  manager_id?: string
  description?: string
  sort_order?: number
  status?: 'active' | 'inactive'
}

/**
 * 更新部门DTO
 */
export interface UpdateDepartmentDTO {
  name?: string
  code?: string
  parent_id?: string
  manager_id?: string
  description?: string
  sort_order?: number
  status?: 'active' | 'inactive'
}

/**
 * 部门API - 与后端DepartmentController对接
 */
class DepartmentAPI extends BaseAPI<Department, CreateDepartmentDTO, UpdateDepartmentDTO> {
  constructor() {
    super('departments')
  }

  /**
   * 获取部门树形结构
   */
  async getTree(organizationId?: string) {
    const params = organizationId ? { organizationId } : {}
    const response = await axios.get('/api/departments', { params })
    if (response.data.success) {
      return response.data.data.list // 已经是树形结构
    }
    throw new Error(response.data.message || '获取部门树失败')
  }

  /**
   * 获取部门平铺列表
   */
  async getFlatList(organizationId?: string) {
    const params = organizationId ? { organizationId } : {}
    const response = await axios.get('/api/departments', { params })
    if (response.data.success) {
      return response.data.data.flatList || response.data.data.list
    }
    throw new Error(response.data.message || '获取部门列表失败')
  }

  /**
   * 获取部门成员
   */
  async getMembers(departmentId: string) {
    const response = await axios.get(`/api/departments/${departmentId}`)
    if (response.data.success) {
      return response.data.data.members || []
    }
    throw new Error(response.data.message || '获取部门成员失败')
  }

  /**
   * 获取子部门
   */
  async getChildren(departmentId: string) {
    const response = await axios.get(`/api/departments/${departmentId}`)
    if (response.data.success) {
      return response.data.data.children || []
    }
    throw new Error(response.data.message || '获取子部门失败')
  }

  /**
   * 移动部门到新的父部门
   */
  async move(departmentId: string, newParentId: string | null) {
    const response = await axios.put(`/api/departments/${departmentId}`, {
      parent_id: newParentId
    })
    if (!response.data.success) {
      throw new Error(response.data.message || '移动部门失败')
    }
  }

  /**
   * 更新部门排序
   */
  async updateSortOrder(departmentId: string, sortOrder: number) {
    const response = await axios.put(`/api/departments/${departmentId}`, {
      sort_order: sortOrder
    })
    if (!response.data.success) {
      throw new Error(response.data.message || '更新排序失败')
    }
  }

  /**
   * 获取部门树形选择器数据
   */
  async getTreeSelect(organizationId?: string) {
    const params = organizationId ? { organizationId } : {}
    const response = await axios.get('/api/departments/tree-select', { params })
    if (response.data.success) {
      return response.data.data
    }
    throw new Error(response.data.message || '获取部门树失败')
  }

  /**
   * 根据组织ID获取部门
   */
  async getByOrganization(organizationId: string) {
    return this.getTree(organizationId)
  }
}

// 导出单例
export const departmentAPI = new DepartmentAPI()
export default departmentAPI