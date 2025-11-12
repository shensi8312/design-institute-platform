const BaseRepository = require('./BaseRepository')

/**
 * 菜单Repository
 */
class MenuRepository extends BaseRepository {
  constructor() {
    super('menus')
  }

  /**
   * 获取菜单列表（包含层级关系）
   */
  async findAllWithHierarchy(conditions = {}, options = {}) {
    let query = this.db('menus')
      .select('*')
      .where('status', 'active')
    
    // 应用条件
    if (Object.keys(conditions).length > 0) {
      query = query.where(conditions)
    }
    
    // 排序
    query = query.orderBy('sort_order', 'asc')
    
    const menus = await query
    return this.buildTree(menus)
  }

  /**
   * 构建菜单树
   */
  buildTree(menus, parentId = null) {
    const tree = []
    
    for (const menu of menus) {
      if (menu.parent_id === parentId) {
        const children = this.buildTree(menus, menu.id)
        if (children.length > 0) {
          menu.children = children
        }
        tree.push(menu)
      }
    }
    
    return tree
  }

  /**
   * 获取用户菜单（根据权限）
   * 修复：同时支持users.role_id和user_roles表
   */
  async getUserMenus(userId) {
    // 1. 获取用户的直接角色（users.role_id）
    const user = await this.db('users')
      .where('id', userId)
      .select('role_id')
      .first()

    const roleIds = []
    if (user && user.role_id) {
      roleIds.push(user.role_id)
    }

    // 2. 获取用户的额外角色（user_roles表）
    const userRoles = await this.db('user_roles')
      .where('user_id', userId)
      .select('role_id')

    userRoles.forEach(r => {
      if (!roleIds.includes(r.role_id)) {
        roleIds.push(r.role_id)
      }
    })

    if (roleIds.length === 0) {
      // 用户没有角色，返回空菜单
      return []
    }

    // 3. 获取这些角色的所有权限（permissions是JSONB字段）
    const roles = await this.db('roles')
      .whereIn('id', roleIds)
      .where('status', 'active')
      .select('permissions')

    // 4. 合并所有权限code
    const permissionCodes = new Set()
    for (const role of roles) {
      let perms = role.permissions
      // permissions可能是字符串（JSON）或已解析的数组
      if (typeof perms === 'string') {
        try {
          perms = JSON.parse(perms)
        } catch (e) {
          console.warn('解析角色权限失败:', e)
          perms = []
        }
      }
      if (!Array.isArray(perms)) {
        perms = []
      }
      perms.forEach(code => permissionCodes.add(code))
    }

    console.log(`[MenuRepository] 用户${userId}的角色:`, roleIds)
    console.log(`[MenuRepository] 用户${userId}的权限codes:`, Array.from(permissionCodes))

    // 5. 获取这些权限对应的菜单
    const menus = await this.db('menus')
      .where('menus.visible', true)
      .where('menus.status', 'active')
      .where(function() {
        if (permissionCodes.size > 0) {
          // 包含用户权限的菜单 OR 没有权限要求的菜单（public菜单）
          this.whereIn('permission_code', Array.from(permissionCodes))
            .orWhereNull('permission_code')
        } else {
          // 没有任何权限，只显示public菜单
          this.whereNull('permission_code')
        }
      })
      .orderBy('menus.sort_order', 'asc')

    console.log(`[MenuRepository] 查询到${menus.length}个菜单`)

    return menus
  }

  /**
   * 获取角色菜单
   * [PE-why] 修复权限查询逻辑：从roles.permissions JSONB字段读取权限列表
   */
  async getRoleMenus(roleId) {
    // 1. 获取角色的权限列表
    const role = await this.db('roles')
      .where('id', roleId)
      .where('status', 'active')
      .select('permissions')
      .first()

    if (!role) {
      return []
    }

    // 2. 解析permissions
    let perms = role.permissions
    if (typeof perms === 'string') {
      try {
        perms = JSON.parse(perms)
      } catch (e) {
        console.warn('解析角色权限失败:', e)
        perms = []
      }
    }
    if (!Array.isArray(perms)) {
      perms = []
    }

    // 3. 获取菜单
    const menus = await this.db('menus')
      .where('menus.visible', true)
      .where('menus.status', 'active')
      .where(function() {
        if (perms.length > 0) {
          this.whereIn('permission_code', perms)
            .orWhereNull('permission_code')
        } else {
          this.whereNull('permission_code')
        }
      })
      .orderBy('menus.sort_order', 'asc')

    return menus
  }

  /**
   * 检查菜单是否有子菜单
   */
  async hasChildren(menuId) {
    const count = await this.count({ parent_id: menuId })
    return count > 0
  }

  /**
   * 更新菜单排序
   */
  async updateSortOrder(menuId, sortOrder) {
    return await this.update(menuId, { sort_order: sortOrder }, false)
  }

  /**
   * 批量更新排序
   */
  async batchUpdateSortOrder(sortData) {
    return await this.transaction(async (trx) => {
      for (const { id, sort_order } of sortData) {
        await trx('menus')
          .where('id', id)
          .update({ sort_order, updated_at: new Date() })
      }
      return true
    })
  }

  /**
   * 切换菜单可见性
   */
  async toggleVisible(menuId) {
    const menu = await this.findById(menuId)
    if (menu) {
      return await this.update(menuId, { visible: !menu.visible })
    }
    return null
  }
}

module.exports = MenuRepository