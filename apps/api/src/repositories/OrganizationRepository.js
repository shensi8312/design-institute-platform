const BaseRepository = require('./BaseRepository')

/**
 * 组织Repository
 */
class OrganizationRepository extends BaseRepository {
  constructor() {
    super('organizations')
  }

  /**
   * 获取组织列表（包含统计信息）
   */
  async findAllWithStats(conditions = {}, options = {}) {
    let query = this.db('organizations')
      .select([
        'organizations.*',
        this.db.raw('(SELECT COUNT(*) FROM departments WHERE departments.organization_id = organizations.id) as department_count'),
        this.db.raw('(SELECT COUNT(*) FROM users WHERE users.organization_id = organizations.id) as user_count')
      ])
    
    // 应用条件
    if (Object.keys(conditions).length > 0) {
      query = query.where(conditions)
    }
    
    // 排序
    if (options.orderBy) {
      query = query.orderBy(options.orderBy, options.order || 'desc')
    } else {
      query = query.orderBy('created_at', 'desc')
    }
    
    return await query
  }

  /**
   * 获取组织的部门列表
   */
  async getDepartments(organizationId) {
    return await this.db('departments')
      .where('organization_id', organizationId)
      .orderBy('sort_order', 'asc')
  }

  /**
   * 获取组织的用户列表
   */
  async getUsers(organizationId) {
    return await this.db('users')
      .where('organization_id', organizationId)
      .orderBy('created_at', 'desc')
  }

  /**
   * 检查组织是否有子数据
   */
  async hasChildren(organizationId) {
    const departmentCount = await this.db('departments')
      .where('organization_id', organizationId)
      .count('* as count')
      .first()
    
    const userCount = await this.db('users')
      .where('organization_id', organizationId)
      .count('* as count')
      .first()
    
    return {
      hasDepartments: parseInt(departmentCount.count) > 0,
      hasUsers: parseInt(userCount.count) > 0,
      total: parseInt(departmentCount.count) + parseInt(userCount.count)
    }
  }

  /**
   * 根据编码查找组织
   */
  async findByCode(code) {
    return await this.findOne({ code })
  }
}

module.exports = OrganizationRepository