import { BaseAPI } from './base'
import axios from '../utils/axios'

/**
 * 角色类型定义
 */
export interface Role {
  id: string
  code: string
  name: string
  description?: string
  permissions: string[] | any  // JSONB字段，可能是字符串或数组
  user_count?: number
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

/**
 * 创建角色DTO
 */
export interface CreateRoleDTO {
  code: string
  name: string
  description?: string
  permissions?: string[]
  status?: 'active' | 'inactive'
}

/**
 * 更新角色DTO
 */
export interface UpdateRoleDTO {
  name?: string
  description?: string
  permissions?: string[]
  status?: 'active' | 'inactive'
}

/**
 * 角色API - 与后端RoleController对接
 */
class RoleAPI extends BaseAPI<Role, CreateRoleDTO, UpdateRoleDTO> {
  constructor() {
    super('roles')
  }

  /**
   * 获取角色的用户列表
   */
  async getUsers(roleId: string) {
    const response = await axios.get(`/api/roles/${roleId}/users`)
    if (response.data.success) {
      return response.data.data
    }
    throw new Error(response.data.message || '获取角色用户失败')
  }

  /**
   * 更新角色权限
   */
  async updatePermissions(roleId: string, permissions: string[]) {
    const response = await axios.put(`/api/roles/${roleId}`, {
      permissions
    })
    if (!response.data.success) {
      throw new Error(response.data.message || '更新权限失败')
    }
  }

  /**
   * 批量分配权限
   */
  async bulkAssignPermissions(roleIds: string[], permissions: string[]) {
    const response = await axios.post('/api/roles/bulk-assign-permissions', {
      ids: roleIds,
      permissions
    })
    if (!response.data.success) {
      throw new Error(response.data.message || '批量分配权限失败')
    }
  }

  /**
   * 克隆角色
   */
  async clone(roleId: string, newCode: string, newName: string) {
    const response = await axios.post(`/api/roles/${roleId}/clone`, {
      code: newCode,
      name: newName
    })
    if (response.data.success) {
      return response.data.data
    }
    throw new Error(response.data.message || '克隆角色失败')
  }

  /**
   * 获取角色权限列表
   */
  async getPermissions(roleId: string): Promise<string[]> {
    const role = await this.getById(roleId)
    if (role.permissions) {
      // 处理JSONB字段
      if (typeof role.permissions === 'string') {
        try {
          return JSON.parse(role.permissions)
        } catch {
          return []
        }
      }
      return role.permissions
    }
    return []
  }

  /**
   * 检查角色编码是否存在
   */
  async checkCodeExists(code: string): Promise<boolean> {
    try {
      const response = await axios.get('/api/roles/check-code', {
        params: { code }
      })
      return response.data.data?.exists || false
    } catch {
      return false
    }
  }
}

// 导出单例
export const roleAPI = new RoleAPI()
export default roleAPI