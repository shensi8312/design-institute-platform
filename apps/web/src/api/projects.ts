import { BaseAPI } from './base'

/**
 * 项目类型定义
 */
export interface Project {
  id: string
  code: string
  name: string
  type: 'design' | 'construction' | 'consulting' | 'other'
  status: 'planning' | 'in_progress' | 'completed' | 'suspended' | 'cancelled'
  description?: string
  department_id?: string
  department_name?: string
  manager_id?: string
  manager_name?: string
  start_date?: string
  end_date?: string
  budget?: number
  contract_amount?: number
  client_name?: string
  client_contact?: string
  address?: string
  created_at: string
  updated_at: string
}

/**
 * 创建项目DTO
 */
export interface CreateProjectDTO {
  code: string
  name: string
  type: 'design' | 'construction' | 'consulting' | 'other'
  status?: 'planning' | 'in_progress' | 'completed' | 'suspended' | 'cancelled'
  description?: string
  department_id?: string
  manager_id?: string
  start_date?: string
  end_date?: string
  budget?: number
  contract_amount?: number
  client_name?: string
  client_contact?: string
  address?: string
}

/**
 * 更新项目DTO
 */
export interface UpdateProjectDTO extends Partial<CreateProjectDTO> {
  status?: 'planning' | 'in_progress' | 'completed' | 'suspended' | 'cancelled'
}

/**
 * 项目API - 与后端ProjectController对接
 */
class ProjectAPI extends BaseAPI<Project, CreateProjectDTO, UpdateProjectDTO> {
  constructor() {
    super('projects')
  }

  /**
   * 根据部门获取项目
   */
  async getByDepartment(departmentId: string) {
    const response = await this.getList({ department_id: departmentId })
    return response.list
  }

  /**
   * 根据状态获取项目
   */
  async getByStatus(status: Project['status']) {
    const response = await this.getList({ status })
    return response.list
  }

  /**
   * 根据管理者获取项目
   */
  async getByManager(managerId: string) {
    const response = await this.getList({ manager_id: managerId })
    return response.list
  }

  /**
   * 获取项目统计信息
   */
  async getStatistics() {
    const response = await this.getList()
    const projects = response.list

    return {
      total: projects.length,
      byStatus: {
        planning: projects.filter(p => p.status === 'planning').length,
        in_progress: projects.filter(p => p.status === 'in_progress').length,
        completed: projects.filter(p => p.status === 'completed').length,
        suspended: projects.filter(p => p.status === 'suspended').length,
        cancelled: projects.filter(p => p.status === 'cancelled').length
      },
      byType: {
        design: projects.filter(p => p.type === 'design').length,
        construction: projects.filter(p => p.type === 'construction').length,
        consulting: projects.filter(p => p.type === 'consulting').length,
        other: projects.filter(p => p.type === 'other').length
      }
    }
  }

  /**
   * 更新项目状态
   */
  async updateStatus(projectId: string, status: Project['status']) {
    return this.update(projectId, { status })
  }
}

// 导出单例
export const projectAPI = new ProjectAPI()
export default projectAPI