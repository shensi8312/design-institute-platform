const BaseRepository = require('./BaseRepository')

/**
 * 部门Repository
 */
class DepartmentRepository extends BaseRepository {
  constructor() {
    super('departments')
  }

  /**
   * 获取部门列表（包含关联信息）
   */
  async findAllWithRelations(conditions = {}, options = {}) {
    let query = this.db('departments')
      .select([
        'departments.*',
        'users.name as manager_name',
        'organizations.name as organization_name',
        this.db.raw('(SELECT COUNT(*) FROM users WHERE users.department_id = departments.id) as member_count')
      ])
      .leftJoin('users', 'departments.manager_id', 'users.id')
      .leftJoin('organizations', 'departments.organization_id', 'organizations.id')
    
    // 应用条件
    if (Object.keys(conditions).length > 0) {
      Object.keys(conditions).forEach(key => {
        if (key.includes('.')) {
          query = query.where(key, conditions[key])
        } else {
          query = query.where(`departments.${key}`, conditions[key])
        }
      })
    }
    
    // 排序
    if (options.orderBy) {
      query = query.orderBy(options.orderBy, options.order || 'desc')
    } else {
      query = query.orderBy('departments.created_at', 'desc')
    }
    
    return await query
  }

  /**
   * 获取部门详情（包含成员和子部门）
   */
  async findByIdWithDetails(departmentId) {
    const department = await this.db('departments')
      .select([
        'departments.*',
        'users.name as manager_name',
        'organizations.name as organization_name'
      ])
      .leftJoin('users', 'departments.manager_id', 'users.id')
      .leftJoin('organizations', 'departments.organization_id', 'organizations.id')
      .where('departments.id', departmentId)
      .first()
    
    if (department) {
      // 获取部门成员
      department.members = await this.getMembers(departmentId)
      // 获取子部门
      department.children = await this.getChildren(departmentId)
    }
    
    return department
  }

  /**
   * 获取部门成员
   */
  async getMembers(departmentId) {
    return await this.db('users')
      .select('id', 'username', 'name', 'email', 'phone', 'role_id')
      .where('department_id', departmentId)
  }

  /**
   * 获取子部门
   */
  async getChildren(parentId) {
    return await this.db('departments')
      .select('id', 'name', 'code', 'status')
      .where('parent_id', parentId)
      .orderBy('sort_order', 'asc')
  }

  /**
   * 检查部门是否有子部门
   */
  async hasChildren(departmentId) {
    const count = await this.count({ parent_id: departmentId })
    return count > 0
  }

  /**
   * 检查部门是否有成员
   */
  async hasMembers(departmentId) {
    const count = await this.db('users')
      .where('department_id', departmentId)
      .count('* as count')
      .first()
    
    return parseInt(count.count) > 0
  }

  /**
   * 根据组织ID获取部门树
   */
  async getTreeByOrganization(organizationId) {
    const departments = await this.findAll(
      { organization_id: organizationId, status: 'active' },
      { orderBy: 'sort_order', order: 'asc' }
    )
    
    return this.buildTree(departments)
  }

  /**
   * 构建部门树
   */
  buildTree(departments, parentId = null) {
    const tree = []
    
    for (const dept of departments) {
      if (dept.parent_id === parentId) {
        const children = this.buildTree(departments, dept.id)
        if (children.length > 0) {
          dept.children = children
        }
        tree.push(dept)
      }
    }
    
    return tree
  }

  /**
   * 根据编码查找部门
   */
  async findByCode(code) {
    return await this.findOne({ code })
  }

  /**
   * 更新部门排序
   */
  async updateSortOrder(departmentId, sortOrder) {
    return await this.update(departmentId, { sort_order: sortOrder }, false)
  }

  /**
   * 移动部门到新的父部门
   */
  async move(departmentId, newParentId) {
    return await this.update(departmentId, { parent_id: newParentId })
  }
}

module.exports = DepartmentRepository