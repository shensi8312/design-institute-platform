const BaseRepository = require('./BaseRepository')

/**
 * 项目Repository
 */
class ProjectRepository extends BaseRepository {
  constructor() {
    super('projects')
  }

  /**
   * 获取项目列表（包含关联信息）
   */
  async findAllWithRelations(conditions = {}, options = {}) {
    let query = this.db('projects')
      .select([
        'projects.*',
        'departments.name as department_name',
        'users.name as manager_name'
      ])
      .leftJoin('departments', 'projects.department_id', 'departments.id')
      .leftJoin('users', 'projects.manager_id', 'users.id')
    
    // 应用条件
    if (Object.keys(conditions).length > 0) {
      Object.keys(conditions).forEach(key => {
        if (key.includes('.')) {
          query = query.where(key, conditions[key])
        } else {
          query = query.where(`projects.${key}`, conditions[key])
        }
      })
    }
    
    // 排序
    if (options.orderBy) {
      query = query.orderBy(options.orderBy, options.order || 'desc')
    } else {
      query = query.orderBy('projects.created_at', 'desc')
    }
    
    // 分页
    if (options.limit) {
      query = query.limit(options.limit)
    }
    
    if (options.offset) {
      query = query.offset(options.offset)
    }
    
    return await query
  }

  /**
   * 根据部门获取项目
   */
  async findByDepartmentId(departmentId) {
    return await this.findAllWithRelations({ 'projects.department_id': departmentId })
  }

  /**
   * 根据管理者获取项目
   */
  async findByManagerId(managerId) {
    return await this.findAllWithRelations({ 'projects.manager_id': managerId })
  }

  /**
   * 根据状态获取项目
   */
  async findByStatus(status) {
    return await this.findAllWithRelations({ 'projects.status': status })
  }

  /**
   * 获取项目详情（包含所有关联信息）
   */
  async findByIdWithDetails(projectId) {
    const project = await this.db('projects')
      .select([
        'projects.*',
        'departments.name as department_name',
        'departments.code as department_code',
        'users.name as manager_name',
        'users.email as manager_email',
        'users.phone as manager_phone'
      ])
      .leftJoin('departments', 'projects.department_id', 'departments.id')
      .leftJoin('users', 'projects.manager_id', 'users.id')
      .where('projects.id', projectId)
      .first()
    
    if (project) {
      // 获取项目成员（如果有project_members表）
      // project.members = await this.getProjectMembers(projectId)
      
      // 获取项目文档（如果有project_documents表）
      // project.documents = await this.getProjectDocuments(projectId)
    }
    
    return project
  }

  /**
   * 更新项目状态
   */
  async updateStatus(projectId, status) {
    return await this.update(projectId, { 
      status,
      updated_at: new Date()
    })
  }

  /**
   * 获取项目统计信息
   */
  async getStatistics() {
    const stats = {}
    
    // 按状态统计
    const statusStats = await this.db('projects')
      .select('status')
      .count('* as count')
      .groupBy('status')
    
    stats.byStatus = statusStats.reduce((acc, item) => {
      acc[item.status] = parseInt(item.count)
      return acc
    }, {})
    
    // 按类型统计
    const typeStats = await this.db('projects')
      .select('type')
      .count('* as count')
      .groupBy('type')
    
    stats.byType = typeStats.reduce((acc, item) => {
      acc[item.type] = parseInt(item.count)
      return acc
    }, {})
    
    // 总数
    stats.total = await this.count()
    
    // 本月新增
    const thisMonth = new Date()
    thisMonth.setDate(1)
    stats.thisMonth = await this.count({
      created_at: this.db.raw('?? >= ?', ['created_at', thisMonth])
    })
    
    return stats
  }

  /**
   * 根据客户名称搜索项目
   */
  async searchByClient(clientName) {
    return await this.db('projects')
      .where('client_name', 'ilike', `%${clientName}%`)
      .orderBy('created_at', 'desc')
  }

  /**
   * 获取即将到期的项目
   */
  async getExpiringProjects(days = 30) {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + days)
    
    return await this.db('projects')
      .where('status', 'in_progress')
      .where('end_date', '<=', futureDate)
      .where('end_date', '>=', new Date())
      .orderBy('end_date', 'asc')
  }

  /**
   * 计算项目进度（如果有进度字段）
   */
  async calculateProgress(projectId) {
    // 这里可以根据实际业务逻辑计算进度
    // 例如：根据任务完成情况、时间进度等
    return 0
  }
}

module.exports = ProjectRepository