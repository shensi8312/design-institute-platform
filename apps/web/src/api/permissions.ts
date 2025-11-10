import { BaseAPI } from './base'

/**
 * 权限类型定义
 */
export interface Permission {
  id: string
  code: string
  name: string
  description?: string
  resource: string
  action: string
  type: 'menu' | 'button' | 'api' | 'data'
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

/**
 * 创建权限DTO
 */
export interface CreatePermissionDTO {
  code: string
  name: string
  description?: string
  resource: string
  action: string
  type: 'menu' | 'button' | 'api' | 'data'
  status?: 'active' | 'inactive'
}

/**
 * 更新权限DTO
 */
export interface UpdatePermissionDTO {
  name?: string
  description?: string
  resource?: string
  action?: string
  type?: 'menu' | 'button' | 'api' | 'data'
  status?: 'active' | 'inactive'
}

/**
 * 权限API - 与后端PermissionController对接
 */
class PermissionAPI extends BaseAPI<Permission, CreatePermissionDTO, UpdatePermissionDTO> {
  constructor() {
    super('permissions')
  }

  /**
   * 根据类型获取权限
   */
  async getByType(type: 'menu' | 'button' | 'api' | 'data') {
    const response = await this.getList({ type })
    return response.list
  }

  /**
   * 根据资源获取权限
   */
  async getByResource(resource: string) {
    const response = await this.getList({ resource })
    return response.list
  }

  /**
   * 获取权限树（用于权限选择器）
   */
  async getPermissionTree() {
    const response = await this.getList()
    const permissions = response.list

    // 按资源分组
    const grouped: Record<string, Permission[]> = {}
    permissions.forEach(perm => {
      if (!grouped[perm.resource]) {
        grouped[perm.resource] = []
      }
      grouped[perm.resource].push(perm)
    })

    // 转换为树形结构
    return Object.keys(grouped).map(resource => ({
      label: resource,
      value: resource,
      children: grouped[resource].map(perm => ({
        label: perm.name,
        value: perm.code
      }))
    }))
  }

  /**
   * 批量创建权限
   */
  async bulkCreate(permissions: CreatePermissionDTO[]) {
    return this.bulkAction('create', [], { permissions })
  }

  /**
   * 检查权限编码是否存在
   */
  async checkCodeExists(code: string): Promise<boolean> {
    const response = await this.getList({ search: code })
    return response.list.some(p => p.code === code)
  }
}

// 导出单例
export const permissionAPI = new PermissionAPI()
export default permissionAPI