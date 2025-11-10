const BaseRepository = require('./BaseRepository')

/**
 * 权限Repository
 */
class PermissionRepository extends BaseRepository {
  constructor() {
    super('permissions')
  }

  /**
   * 根据类型获取权限
   */
  async findByType(type) {
    return await this.findAll({ type })
  }

  /**
   * 根据资源获取权限
   */
  async findByResource(resource) {
    return await this.findAll({ resource })
  }

  /**
   * 根据编码获取权限
   */
  async findByCode(code) {
    return await this.findOne({ code })
  }

  /**
   * 获取角色的权限列表
   */
  async getRolePermissions(roleId) {
    // 从角色表的permissions字段获取
    const role = await this.db('roles')
      .where('id', roleId)
      .first()
    
    if (role && role.permissions) {
      try {
        const permissionCodes = typeof role.permissions === 'string' 
          ? JSON.parse(role.permissions) 
          : role.permissions
        
        if (Array.isArray(permissionCodes) && permissionCodes.length > 0) {
          return await this.db('permissions')
            .whereIn('code', permissionCodes)
        }
      } catch (e) {
        console.error('解析权限失败:', e)
      }
    }
    
    return []
  }

  /**
   * 获取用户的权限列表
   */
  async getUserPermissions(userId) {
    const user = await this.db('users')
      .where('id', userId)
      .first()
    
    if (user && user.role_id) {
      return await this.getRolePermissions(user.role_id)
    }
    
    return []
  }

  /**
   * 批量创建权限
   */
  async bulkCreate(permissions) {
    return await this.transaction(async (trx) => {
      const results = []
      for (const permission of permissions) {
        // 检查是否已存在
        const existing = await trx('permissions')
          .where('code', permission.code)
          .first()
        
        if (!existing) {
          permission.id = permission.id || `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          permission.created_at = new Date()
          permission.updated_at = new Date()
          
          const [result] = await trx('permissions')
            .insert(permission)
            .returning('*')
          
          results.push(result)
        }
      }
      return results
    })
  }

  /**
   * 获取权限树（按资源分组）
   */
  async getPermissionTree() {
    const permissions = await this.findAll({ status: 'active' })
    
    // 按资源分组
    const grouped = {}
    permissions.forEach(perm => {
      if (!grouped[perm.resource]) {
        grouped[perm.resource] = {
          resource: perm.resource,
          permissions: []
        }
      }
      grouped[perm.resource].permissions.push(perm)
    })
    
    return Object.values(grouped)
  }

  /**
   * 检查用户是否有某个权限
   */
  async checkUserPermission(userId, permissionCode) {
    const permissions = await this.getUserPermissions(userId)
    return permissions.some(p => p.code === permissionCode)
  }

  /**
   * 分配权限给角色
   */
  async assignToRole(roleId, permissionCodes) {
    return await this.db('roles')
      .where('id', roleId)
      .update({
        permissions: JSON.stringify(permissionCodes),
        updated_at: new Date()
      })
  }
}

module.exports = PermissionRepository