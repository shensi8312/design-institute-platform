const BaseService = require('../BaseService')
const ProjectRepository = require('../../repositories/ProjectRepository')
const SystemAuditService = require('./SystemAuditService')

/**
 * 项目Service
 */
class ProjectService extends BaseService {
  constructor() {
    const repository = new ProjectRepository()
    super(repository)
    this.projectRepository = repository
    this.auditService = new SystemAuditService()
  }

  /**
   * 获取项目列表
   */
  async getList(params = {}) {
    try {
      const {
        page = 1,
        pageSize = 20,
        search,
        status,
        type,
        departmentId,
        managerId,
        orderBy = 'created_at',
        order = 'desc'
      } = params

      // 构建查询条件
      const conditions = {}
      if (status && status !== 'all') conditions['projects.status'] = status
      if (type && type !== 'all') conditions['projects.type'] = type
      if (departmentId && departmentId !== 'all') conditions['projects.department_id'] = departmentId
      if (managerId) conditions['projects.manager_id'] = managerId

      // 如果有搜索关键词
      if (search) {
        const projects = await this.projectRepository.search(
          search,
          ['name', 'code', 'description'],
          conditions
        )
        return {
          success: true,
          data: {
            list: projects,
            total: projects.length
          }
        }
      }

      // 获取总数
      const total = await this.projectRepository.count(conditions)

      // 获取分页数据
      const offset = (page - 1) * pageSize
      const projects = await this.projectRepository.findAllWithRelations(conditions, {
        orderBy: `projects.${orderBy}`,
        order,
        limit: pageSize,
        offset
      })

      return {
        success: true,
        data: {
          list: projects,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        }
      }
    } catch (error) {
      console.error('获取项目列表失败:', error)
      return {
        success: false,
        message: '获取项目列表失败',
        error: error.message
      }
    }
  }

  /**
   * 获取项目详情
   */
  async getProjectDetail(projectId) {
    try {
      const project = await this.projectRepository.findByIdWithDetails(projectId)
      
      if (!project) {
        return {
          success: false,
          message: '项目不存在'
        }
      }

      return {
        success: true,
        data: project
      }
    } catch (error) {
      console.error('获取项目详情失败:', error)
      return {
        success: false,
        message: '获取项目详情失败',
        error: error.message
      }
    }
  }

  /**
   * 创建项目前的验证
   */
  async validateCreate(data) {
    // 验证必填字段
    if (!data.code || !data.name) {
      return {
        success: false,
        message: '项目编号和名称不能为空'
      }
    }

    // 检查项目编号是否已存在
    const existingProject = await this.projectRepository.findOne({ code: data.code })
    if (existingProject) {
      return {
        success: false,
        message: '项目编号已存在'
      }
    }

    // 验证日期
    if (data.start_date && data.end_date) {
      const startDate = new Date(data.start_date)
      const endDate = new Date(data.end_date)
      if (endDate < startDate) {
        return {
          success: false,
          message: '结束日期不能早于开始日期'
        }
      }
    }

    return { success: true }
  }

  /**
   * 创建项目前的数据处理
   */
  async beforeCreate(data) {
    // 生成项目ID
    data.id = data.id || `proj_${Date.now()}`

    // 设置默认值
    data.type = data.type || 'residential'
    data.status = data.status || 'planning'
    data.progress = data.progress || 0

    return data
  }

  /**
   * 创建项目后的处理
   */
  async afterCreate(project) {
    // 记录审计日志
    await this.auditService.log({
      userId: project.created_by || 'system',
      module: 'project',
      action: 'create',
      resourceType: 'project',
      resourceId: project.id,
      resourceName: project.name,
      newValue: project,
      status: 'success'
    })

    return project
  }

  /**
   * 更新项目前的验证
   */
  async validateUpdate(projectId, data) {
    // 如果要更新项目编号，检查是否重复
    if (data.code) {
      const existingProject = await this.projectRepository.findOne({ code: data.code })
      if (existingProject && existingProject.id !== projectId) {
        return {
          success: false,
          message: '项目编号已存在'
        }
      }
    }

    // 验证日期
    if (data.start_date && data.end_date) {
      const startDate = new Date(data.start_date)
      const endDate = new Date(data.end_date)
      if (endDate < startDate) {
        return {
          success: false,
          message: '结束日期不能早于开始日期'
        }
      }
    }

    // 验证进度
    if (data.progress !== undefined) {
      if (data.progress < 0 || data.progress > 100) {
        return {
          success: false,
          message: '进度必须在0-100之间'
        }
      }
    }

    return { success: true }
  }

  /**
   * 更新项目前的数据处理
   */
  async beforeUpdate(projectId, data) {
    // 移除不应该更新的字段
    delete data.id
    delete data.created_at
    delete data.created_by

    return data
  }

  /**
   * 更新项目后的处理
   */
  async afterUpdate(projectId, oldProject, newProject) {
    // 记录审计日志
    await this.auditService.log({
      userId: newProject.updated_by || 'system',
      module: 'project',
      action: 'update',
      resourceType: 'project',
      resourceId: projectId,
      resourceName: newProject.name,
      oldValue: oldProject,
      newValue: newProject,
      status: 'success'
    })

    return newProject
  }

  /**
   * 删除项目前的检查
   */
  async canDelete(projectId, project) {
    // 检查项目状态
    if (project.status === 'in_progress' || project.status === 'construction') {
      return {
        success: false,
        message: '进行中的项目不能删除'
      }
    }

    // 检查是否有关联数据（如知识库文档）
    const knowledgeDocs = await this.projectRepository.db('knowledge_documents')
      .where('project_id', projectId)
      .count('* as count')
      .first()

    if (knowledgeDocs && parseInt(knowledgeDocs.count) > 0) {
      return {
        success: false,
        message: `项目下有${knowledgeDocs.count}个知识库文档，无法删除`
      }
    }

    return { success: true }
  }

  /**
   * 删除项目后的处理
   */
  async afterDelete(projectId, project) {
    // 记录审计日志
    await this.auditService.log({
      userId: 'system',
      module: 'project',
      action: 'delete',
      resourceType: 'project',
      resourceId: projectId,
      resourceName: project.name,
      oldValue: project,
      status: 'success'
    })
  }

  /**
   * 更新项目状态
   */
  async updateStatus(projectId, status, userId = null) {
    try {
      const project = await this.projectRepository.findById(projectId)
      
      if (!project) {
        return {
          success: false,
          message: '项目不存在'
        }
      }

      // 状态转换验证
      const validTransitions = {
        'planning': ['design', 'cancelled'],
        'design': ['construction', 'planning', 'cancelled'],
        'construction': ['completed', 'paused', 'cancelled'],
        'paused': ['construction', 'cancelled'],
        'completed': ['archived'],
        'cancelled': [],
        'archived': []
      }

      const currentStatus = project.status
      const allowedStatuses = validTransitions[currentStatus] || []
      
      if (!allowedStatuses.includes(status)) {
        return {
          success: false,
          message: `不能从${currentStatus}状态转换到${status}状态`
        }
      }

      // 更新状态
      const result = await this.projectRepository.updateStatus(projectId, status)

      // 记录审计日志
      await this.auditService.log({
        userId: userId || 'system',
        module: 'project',
        action: 'update_status',
        resourceType: 'project',
        resourceId: projectId,
        resourceName: project.name,
        oldValue: { status: currentStatus },
        newValue: { status },
        status: 'success'
      })

      return {
        success: true,
        data: result
      }
    } catch (error) {
      console.error('更新项目状态失败:', error)
      return {
        success: false,
        message: '更新项目状态失败',
        error: error.message
      }
    }
  }

  /**
   * 获取项目统计信息
   */
  async getStatistics() {
    try {
      const stats = await this.projectRepository.getStatistics()
      
      // 计算额外的统计信息
      stats.completionRate = stats.total > 0 
        ? ((stats.byStatus.completed || 0) / stats.total * 100).toFixed(2) + '%'
        : '0%'
      
      stats.activeProjects = (stats.byStatus.planning || 0) + 
                             (stats.byStatus.design || 0) + 
                             (stats.byStatus.construction || 0)

      return {
        success: true,
        data: stats
      }
    } catch (error) {
      console.error('获取项目统计失败:', error)
      return {
        success: false,
        message: '获取项目统计失败',
        error: error.message
      }
    }
  }

  /**
   * 根据部门获取项目
   */
  async getProjectsByDepartment(departmentId) {
    try {
      const projects = await this.projectRepository.findByDepartmentId(departmentId)
      
      return {
        success: true,
        data: projects
      }
    } catch (error) {
      console.error('获取部门项目失败:', error)
      return {
        success: false,
        message: '获取部门项目失败',
        error: error.message
      }
    }
  }

  /**
   * 根据管理者获取项目
   */
  async getProjectsByManager(managerId) {
    try {
      const projects = await this.projectRepository.findByManagerId(managerId)
      
      return {
        success: true,
        data: projects
      }
    } catch (error) {
      console.error('获取管理者项目失败:', error)
      return {
        success: false,
        message: '获取管理者项目失败',
        error: error.message
      }
    }
  }

  /**
   * 获取即将到期的项目
   */
  async getExpiringProjects(days = 30) {
    try {
      const projects = await this.projectRepository.getExpiringProjects(days)
      
      return {
        success: true,
        data: projects
      }
    } catch (error) {
      console.error('获取即将到期项目失败:', error)
      return {
        success: false,
        message: '获取即将到期项目失败',
        error: error.message
      }
    }
  }

  /**
   * 批量更新项目状态
   */
  async batchUpdateStatus(projectIds, status, userId = null) {
    try {
      const results = []
      const errors = []

      for (const projectId of projectIds) {
        const result = await this.updateStatus(projectId, status, userId)
        if (result.success) {
          results.push(projectId)
        } else {
          errors.push({
            projectId,
            error: result.message
          })
        }
      }

      return {
        success: true,
        message: `成功更新${results.length}个项目，失败${errors.length}个`,
        data: {
          updated: results,
          failed: errors
        }
      }
    } catch (error) {
      console.error('批量更新项目状态失败:', error)
      return {
        success: false,
        message: '批量更新项目状态失败',
        error: error.message
      }
    }
  }

  /**
   * 克隆项目
   */
  async cloneProject(projectId, newData = {}) {
    try {
      const sourceProject = await this.projectRepository.findById(projectId)
      
      if (!sourceProject) {
        return {
          success: false,
          message: '源项目不存在'
        }
      }

      // 创建新项目数据
      const clonedProject = {
        ...sourceProject,
        ...newData,
        id: `proj_${Date.now()}`,
        code: newData.code || `${sourceProject.code}_CLONE_${Date.now()}`,
        name: newData.name || `${sourceProject.name} (复制)`,
        status: 'planning',
        progress: 0,
        created_at: new Date(),
        updated_at: new Date()
      }

      // 删除不需要的字段
      delete clonedProject.id

      // 创建克隆项目
      const result = await this.create(clonedProject)

      if (result.success) {
        // 记录审计日志
        await this.auditService.log({
          userId: newData.created_by || 'system',
          module: 'project',
          action: 'clone',
          resourceType: 'project',
          resourceId: result.data.id,
          resourceName: result.data.name,
          oldValue: { sourceProjectId: projectId },
          newValue: result.data,
          status: 'success'
        })
      }

      return result
    } catch (error) {
      console.error('克隆项目失败:', error)
      return {
        success: false,
        message: '克隆项目失败',
        error: error.message
      }
    }
  }

  /**
   * 导出项目数据
   */
  async exportProjects(format = 'json', conditions = {}) {
    try {
      const projects = await this.projectRepository.findAllWithRelations(conditions)
      
      if (format === 'json') {
        return {
          success: true,
          data: projects
        }
      }

      // CSV格式
      if (format === 'csv') {
        const headers = ['ID', '编号', '名称', '类型', '状态', '部门', '项目经理', '开始日期', '结束日期', '进度', '创建时间']
        const rows = projects.map(proj => [
          proj.id,
          proj.code,
          proj.name,
          proj.type,
          proj.status,
          proj.department_name || '',
          proj.manager_name || '',
          proj.start_date || '',
          proj.end_date || '',
          proj.progress || 0,
          proj.created_at
        ])

        return {
          success: true,
          data: {
            headers,
            rows
          }
        }
      }

      return {
        success: false,
        message: '不支持的导出格式'
      }
    } catch (error) {
      console.error('导出项目失败:', error)
      return {
        success: false,
        message: '导出项目失败',
        error: error.message
      }
    }
  }
}

module.exports = ProjectService