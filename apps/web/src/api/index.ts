/**
 * API统一导出文件
 * 所有API调用都通过这个文件导入
 * 
 * 使用示例：
 * import { api } from '@/api'
 * 
 * // 使用具体的API
 * const users = await api.user.getList()
 * const departments = await api.department.getTree()
 */

// 导入所有API模块
import userAPI from './users'
import organizationAPI from './organizations'
import departmentAPI from './departments'
import roleAPI from './roles'
import permissionAPI from './permissions'
import menuAPI from './menus'
import projectAPI from './projects'

// 统一导出对象
export const api = {
  user: userAPI,
  organization: organizationAPI,
  department: departmentAPI,
  role: roleAPI,
  permission: permissionAPI,
  menu: menuAPI,
  project: projectAPI
}

// 分别导出各个API（便于单独引入）
export { userAPI } from './users'
export { organizationAPI } from './organizations'
export { departmentAPI } from './departments'
export { roleAPI } from './roles'
export { permissionAPI } from './permissions'
export { menuAPI } from './menus'
export { projectAPI } from './projects'

// 导出类型定义
export type { User, CreateUserDTO, UpdateUserDTO } from './users'
export type { Organization, OrganizationFormData } from './organizations'
export type { Department, CreateDepartmentDTO, UpdateDepartmentDTO } from './departments'
export type { Role, CreateRoleDTO, UpdateRoleDTO } from './roles'
export type { Permission, CreatePermissionDTO, UpdatePermissionDTO } from './permissions'
export type { Menu, CreateMenuDTO, UpdateMenuDTO } from './menus'
export type { Project, CreateProjectDTO, UpdateProjectDTO } from './projects'

// 导出基础类型
export type { ApiResponse, PaginatedResponse, PaginationParams, SearchParams } from './base'

// 默认导出
export default api