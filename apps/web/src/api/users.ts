import { BaseAPI } from './base'
import axios from '../utils/axios'

/**
 * 用户类型定义
 */
export interface User {
  id: string
  username: string
  name?: string
  email?: string
  phone?: string
  password?: string
  role_id?: string
  role_name?: string
  department_id?: string
  department_name?: string
  organization_id?: string
  organization_name?: string
  departments?: Department[]
  status: 'active' | 'inactive' | 'deleted'
  is_admin: boolean
  last_login_at?: string
  created_at: string
  updated_at: string
}

export interface Department {
  id: string
  name: string
  is_primary: boolean
}

/**
 * 创建用户DTO
 */
export interface CreateUserDTO {
  username: string
  password: string
  name?: string
  email?: string
  phone?: string
  role_id?: string
  department_id?: string
  departmentIds?: string[]  // 支持多部门
  organization_id?: string
  is_admin?: boolean
  status?: 'active' | 'inactive'
}

/**
 * 更新用户DTO
 */
export interface UpdateUserDTO {
  name?: string
  email?: string
  phone?: string
  role_id?: string
  department_id?: string
  departmentIds?: string[]  // 支持多部门
  organization_id?: string
  status?: 'active' | 'inactive'
  is_admin?: boolean
}

/**
 * 用户API - 与后端UserController对接
 */
class UserAPI extends BaseAPI<User, CreateUserDTO, UpdateUserDTO> {
  constructor() {
    super('users')
  }

  /**
   * 登录
   */
  async login(username: string, password: string) {
    const response = await axios.post('/api/auth/login', { username, password })
    if (response.data.success) {
      const { token, user } = response.data.data
      // 保存token和用户信息
      localStorage.setItem('token', token)
      localStorage.setItem('userInfo', JSON.stringify(user))
      return { token, user }
    }
    throw new Error(response.data.message || '登录失败')
  }

  /**
   * 登出
   */
  async logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
    // 可以调用后端登出接口
    try {
      await axios.post('/api/auth/logout')
    } catch (error) {
      // 忽略登出错误
    }
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<User> {
    const response = await axios.get('/api/users/current')
    if (response.data.success) {
      return response.data.data
    }
    throw new Error(response.data.message || '获取用户信息失败')
  }

  /**
   * 修改密码
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const response = await axios.post(`/api/users/${userId}/change-password`, {
      oldPassword,
      newPassword
    })
    if (!response.data.success) {
      throw new Error(response.data.message || '修改密码失败')
    }
  }

  /**
   * 重置密码（管理员功能）
   */
  async resetPassword(userId: string, password: string) {
    const response = await axios.post(`/api/users/${userId}/reset-password`, {
      password
    })
    if (!response.data.success) {
      throw new Error(response.data.message || '重置密码失败')
    }
  }

  /**
   * 批量更新用户状态
   */
  async updateStatus(userIds: string[], status: 'active' | 'inactive') {
    const response = await axios.post('/api/users/update-status', {
      ids: userIds,
      status
    })
    if (!response.data.success) {
      throw new Error(response.data.message || '更新状态失败')
    }
  }

  /**
   * 分配角色
   */
  async assignRole(userId: string, roleId: string) {
    const response = await axios.post(`/api/users/${userId}/assign-role`, {
      roleId
    })
    if (!response.data.success) {
      throw new Error(response.data.message || '分配角色失败')
    }
  }

  /**
   * 根据部门ID获取用户
   */
  async getByDepartment(departmentId: string) {
    const response = await axios.get('/api/users', {
      params: { departmentId }
    })
    if (response.data.success) {
      return response.data.data.list
    }
    throw new Error(response.data.message || '获取部门用户失败')
  }

  /**
   * 根据角色ID获取用户
   */
  async getByRole(roleId: string) {
    const response = await axios.get('/api/users', {
      params: { roleId }
    })
    if (response.data.success) {
      return response.data.data.list
    }
    throw new Error(response.data.message || '获取角色用户失败')
  }
}

// 导出单例
export const userAPI = new UserAPI()
export default userAPI