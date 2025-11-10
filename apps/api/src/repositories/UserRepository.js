const BaseRepository = require('./BaseRepository')

/**
 * 用户Repository
 */
class UserRepository extends BaseRepository {
  constructor() {
    super('users')
  }

  /**
   * 获取用户列表（包含关联信息）
   */
  async findAllWithRelations(conditions = {}, options = {}) {
    let query = this.db('users')
      .select([
        'users.*',
        'roles.name as role_name',
        'departments.name as department_name',
        'organizations.name as organization_name'
      ])
      .leftJoin('roles', 'users.role_id', 'roles.id')
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .leftJoin('organizations', 'users.organization_id', 'organizations.id')
    
    // 应用条件
    if (Object.keys(conditions).length > 0) {
      Object.keys(conditions).forEach(key => {
        // 处理带表名的条件
        if (key.includes('.')) {
          query = query.where(key, conditions[key])
        } else {
          query = query.where(`users.${key}`, conditions[key])
        }
      })
    }
    
    // 排序
    if (options.orderBy) {
      const order = options.order || 'desc'
      query = query.orderBy(options.orderBy, order)
    } else {
      query = query.orderBy('users.created_at', 'desc')
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
   * 根据用户名查找用户
   */
  async findByUsername(username) {
    return await this.findOne({ username })
  }

  /**
   * 根据邮箱查找用户
   */
  async findByEmail(email) {
    return await this.findOne({ email })
  }

  /**
   * 获取用户详情（包含所有关联信息）
   */
  async findByIdWithRelations(userId) {
    const user = await this.db('users')
      .select([
        'users.*',
        'roles.name as role_name',
        'roles.code as role_code',
        'roles.permissions as role_permissions',
        'departments.name as department_name',
        'organizations.name as organization_name'
      ])
      .leftJoin('roles', 'users.role_id', 'roles.id')
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .leftJoin('organizations', 'users.organization_id', 'organizations.id')
      .where('users.id', userId)
      .first()
    
    if (user) {
      // 获取用户的多个部门
      const departments = await this.getUserDepartments(userId)
      user.departments = departments
    }
    
    return user
  }

  /**
   * 获取用户的所有部门
   */
  async getUserDepartments(userId) {
    return await this.db('user_departments')
      .select([
        'departments.*',
        'user_departments.is_primary'
      ])
      .leftJoin('departments', 'user_departments.department_id', 'departments.id')
      .where('user_departments.user_id', userId)
  }

  /**
   * 设置用户部门（支持多部门）
   */
  async setUserDepartments(userId, departmentIds, primaryDepartmentId = null) {
    return await this.transaction(async (trx) => {
      // 删除现有部门关联
      await trx('user_departments')
        .where('user_id', userId)
        .delete()
      
      // 添加新的部门关联
      if (departmentIds && departmentIds.length > 0) {
        const userDepartments = departmentIds.map(deptId => ({
          user_id: userId,
          department_id: deptId,
          is_primary: deptId === (primaryDepartmentId || departmentIds[0]),
          created_at: new Date()
        }))
        
        await trx('user_departments').insert(userDepartments)
      }
      
      return true
    })
  }

  /**
   * 根据部门ID获取用户列表
   */
  async findByDepartmentId(departmentId) {
    return await this.db('users')
      .select('users.*')
      .leftJoin('user_departments', 'users.id', 'user_departments.user_id')
      .where('user_departments.department_id', departmentId)
  }

  /**
   * 根据角色ID获取用户列表
   */
  async findByRoleId(roleId) {
    return await this.findAll({ role_id: roleId })
  }

  /**
   * 根据组织ID获取用户列表
   */
  async findByOrganizationId(organizationId) {
    return await this.findAll({ organization_id: organizationId })
  }

  /**
   * 更新用户密码
   */
  async updatePassword(userId, hashedPassword) {
    return await this.update(userId, { 
      password_hash: hashedPassword,
      updated_at: new Date()  // 使用 updated_at 而不是 password_updated_at
    })
  }

  /**
   * 更新最后登录时间
   */
  async updateLastLogin(userId) {
    return await this.update(userId, {
      last_login_at: new Date()
    }, false)
  }

  /**
   * 搜索用户
   */
  async searchUsers(keyword, additionalConditions = {}) {
    return await this.search(
      keyword,
      ['username', 'name', 'email', 'phone'],
      additionalConditions
    )
  }

  /**
   * 批量更新用户状态
   */
  async updateStatus(userIds, status) {
    return await this.db('users')
      .whereIn('id', userIds)
      .update({ 
        status,
        updated_at: new Date()
      })
  }

  /**
   * 统计部门用户数
   */
  async countByDepartment() {
    const result = await this.db('user_departments')
      .select('department_id')
      .count('* as count')
      .groupBy('department_id')
    
    return result.reduce((acc, item) => {
      acc[item.department_id] = parseInt(item.count)
      return acc
    }, {})
  }

  /**
   * 统计角色用户数
   */
  async countByRole() {
    const result = await this.db('users')
      .select('role_id')
      .count('* as count')
      .groupBy('role_id')
    
    return result.reduce((acc, item) => {
      acc[item.role_id] = parseInt(item.count)
      return acc
    }, {})
  }
}

module.exports = UserRepository