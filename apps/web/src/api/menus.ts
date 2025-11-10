import { BaseAPI } from './base'
import axios from '../utils/axios'

/**
 * 菜单类型定义
 */
export interface Menu {
  id: string
  name: string
  path?: string
  component?: string
  icon?: string
  parent_id?: string
  sort_order?: number
  visible: boolean
  permission_code?: string
  type: 'directory' | 'menu' | 'button'
  status: 'active' | 'inactive'
  children?: Menu[]
  created_at: string
  updated_at: string
}

/**
 * 创建菜单DTO
 */
export interface CreateMenuDTO {
  name: string
  path?: string
  component?: string
  icon?: string
  parent_id?: string
  sort_order?: number
  visible?: boolean
  permission_code?: string
  type?: 'directory' | 'menu' | 'button'
  status?: 'active' | 'inactive'
}

/**
 * 更新菜单DTO
 */
export type UpdateMenuDTO = Partial<CreateMenuDTO>

/**
 * 菜单API - 与后端MenuController对接
 */
class MenuAPI extends BaseAPI<Menu, CreateMenuDTO, UpdateMenuDTO> {
  constructor() {
    super('menus')
  }

  /**
   * 获取菜单树
   */
  async getMenuTree() {
    const response = await axios.get('/api/menus/tree')
    if (response.data.success) {
      return response.data.data
    }
    throw new Error(response.data.message || '获取菜单树失败')
  }

  /**
   * 获取用户菜单（根据权限过滤）
   */
  async getUserMenus() {
    const response = await axios.get('/api/menus/user')
    if (response.data.success) {
      return response.data.data
    }
    throw new Error(response.data.message || '获取用户菜单失败')
  }

  /**
   * 获取角色菜单
   */
  async getRoleMenus(roleId: string) {
    const response = await axios.get(`/api/menus/role/${roleId}`)
    if (response.data.success) {
      return response.data.data
    }
    throw new Error(response.data.message || '获取角色菜单失败')
  }

  /**
   * 更新菜单排序
   */
  async updateSortOrder(menuId: string, sortOrder: number) {
    return this.update(menuId, { sort_order: sortOrder })
  }

  /**
   * 切换菜单可见性
   */
  async toggleVisible(menuId: string, visible: boolean) {
    return this.update(menuId, { visible })
  }

  /**
   * 移动菜单到新的父菜单
   */
  async move(menuId: string, newParentId?: string | null) {
    const parentId = newParentId ?? undefined
    return this.update(menuId, { parent_id: parentId })
  }

  /**
   * 批量更新排序
   */
  async batchUpdateSort(sortData: { id: string; sort_order: number }[]) {
    return this.bulkAction('update-sort', [], { sortData })
  }
}

// 导出单例
export const menuAPI = new MenuAPI()
export default menuAPI
