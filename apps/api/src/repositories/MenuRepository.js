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
   */
  async getUserMenus(userId) {
    const menus = await this.db('menus')
      .select('menus.*')
      .leftJoin('role_permissions', 'menus.permission_code', 'role_permissions.permission_code')
      .leftJoin('users', 'role_permissions.role_id', 'users.role_id')
      .where('users.id', userId)
      .where('menus.visible', true)
      .where('menus.status', 'active')
      .orderBy('menus.sort_order', 'asc')
    
    return this.buildTree(menus)
  }

  /**
   * 获取角色菜单
   */
  async getRoleMenus(roleId) {
    const menus = await this.db('menus')
      .select('menus.*')
      .leftJoin('role_permissions', 'menus.permission_code', 'role_permissions.permission_code')
      .where('role_permissions.role_id', roleId)
      .where('menus.visible', true)
      .where('menus.status', 'active')
      .orderBy('menus.sort_order', 'asc')
    
    return this.buildTree(menus)
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