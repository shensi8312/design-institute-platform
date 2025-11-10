const BaseRepository = require('./BaseRepository')

/**
 * 角色Repository
 */
class RoleRepository extends BaseRepository {
  constructor() {
    super('roles')
  }

  /**
   * 获取角色列表（包含用户数统计）
   */
  async findAllWithStats(conditions = {}, options = {}) {
    let query = this.db('roles')
      .select([
        'roles.*',
        this.db.raw('(SELECT COUNT(*) FROM users WHERE users.role_id = roles.id) as user_count')
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
   * 根据角色编码查找
   */
  async findByCode(code) {
    return await this.findOne({ code })
  }

  /**
   * 获取角色的用户列表
   */
  async getUsers(roleId) {
    return await this.db('users')
      .select('id', 'username', 'name', 'email', 'status')
      .where('role_id', roleId)
      .orderBy('created_at', 'desc')
  }

  /**
   * 更新角色权限
   */
  async updatePermissions(roleId, permissions) {
    return await this.update(roleId, {
      permissions: JSON.stringify(permissions)
    })
  }

  /**
   * 获取角色权限
   */
  async getPermissions(roleId) {
    const role = await this.findById(roleId, ['permissions'])
    if (role && role.permissions) {
      try {
        return JSON.parse(role.permissions)
      } catch (e) {
        return []
      }
    }
    return []
  }

  /**
   * 批量分配权限
   */
  async bulkAssignPermissions(roleIds, permissions) {
    const updates = roleIds.map(roleId => ({
      id: roleId,
      data: { permissions: JSON.stringify(permissions) }
    }))
    
    return await this.bulkUpdate(updates)
  }

  /**
   * 检查角色是否有用户
   */
  async hasUsers(roleId) {
    const count = await this.db('users')
      .where('role_id', roleId)
      .count('* as count')
      .first()
    
    return parseInt(count.count) > 0
  }

  /**
   * 克隆角色
   */
  async clone(roleId, newCode, newName) {
    const sourceRole = await this.findById(roleId)
    
    if (!sourceRole) {
      throw new Error('源角色不存在')
    }
    
    delete sourceRole.id
    sourceRole.code = newCode
    sourceRole.name = newName
    sourceRole.created_at = new Date()
    sourceRole.updated_at = new Date()
    
    return await this.create(sourceRole)
  }
}

module.exports = RoleRepository