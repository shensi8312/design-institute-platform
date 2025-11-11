const BaseService = require('../BaseService')
const MenuRepository = require('../../repositories/MenuRepository')

/**
 * 菜单Service
 */
class MenuService extends BaseService {
  constructor() {
    const repository = new MenuRepository()
    super(repository)
    this.menuRepository = repository
  }

  /**
   * 获取菜单列表
   */
  async getList(params = {}) {
    try {
      const {
        page,
        pageSize,
        search,
        parentId,
        status,
        orderBy = 'sort_order',
        order = 'asc'
      } = params

      // 构建查询条件
      const conditions = {}
      if (status) conditions.status = status
      if (parentId !== undefined) conditions.parent_id = parentId

      // 如果有搜索关键词
      if (search) {
        const menus = await this.menuRepository.search(
          search,
          ['name', 'path', 'component'],
          conditions
        )
        return {
          success: true,
          data: {
            list: menus,
            total: menus.length
          }
        }
      }

      // 如果没有分页参数，返回所有菜单
      if (!page && !pageSize) {
        const menus = await this.menuRepository.findAll(conditions, {
          orderBy,
          order
        })
        return {
          success: true,
          data: {
            list: menus,
            total: menus.length
          }
        }
      }

      // 获取总数
      const total = await this.menuRepository.count(conditions)

      // 获取分页数据
      const offset = (page - 1) * pageSize
      const menus = await this.menuRepository.findAll(conditions, {
        orderBy,
        order,
        limit: pageSize,
        offset
      })

      return {
        success: true,
        data: {
          list: menus,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        }
      }
    } catch (error) {
      console.error('获取菜单列表失败:', error)
      return {
        success: false,
        message: '获取菜单列表失败',
        error: error.message
      }
    }
  }

  /**
   * 获取菜单树
   */
  async getTree(roleId = null) {
    try {
      let menus
      
      if (roleId) {
        // 获取角色菜单
        menus = await this.menuRepository.getRoleMenus(roleId)
      } else {
        // 获取所有菜单
        menus = await this.menuRepository.findAll(
          { status: 'active' },
          { orderBy: 'sort_order', order: 'asc' }
        )
      }

      // 构建树形结构
      const tree = await this.menuRepository.buildTree(menus)

      return {
        success: true,
        data: tree
      }
    } catch (error) {
      console.error('获取菜单树失败:', error)
      return {
        success: false,
        message: '获取菜单树失败',
        error: error.message
      }
    }
  }

  /**
   * 获取用户菜单
   */
  async getUserMenus(userId) {
    try {
      const menus = await this.menuRepository.getUserMenus(userId)
      const tree = await this.menuRepository.buildTree(menus)

      return {
        success: true,
        data: tree
      }
    } catch (error) {
      console.error('获取用户菜单失败:', error)
      return {
        success: false,
        message: '获取用户菜单失败',
        error: error.message
      }
    }
  }

  /**
   * 创建菜单前的验证
   */
  async validateCreate(data) {
    // 验证必填字段
    if (!data.name || !data.path) {
      return {
        success: false,
        message: '菜单名称和路径不能为空'
      }
    }

    // 检查路径是否已存在
    const existingMenu = await this.menuRepository.findOne({ path: data.path })
    if (existingMenu) {
      return {
        success: false,
        message: '菜单路径已存在'
      }
    }

    // 如果有父菜单，检查父菜单是否存在
    if (data.parent_id) {
      const parentMenu = await this.menuRepository.findById(data.parent_id)
      if (!parentMenu) {
        return {
          success: false,
          message: '父菜单不存在'
        }
      }
    }

    return { success: true }
  }

  /**
   * 创建菜单前的数据处理
   */
  async beforeCreate(data) {
    // 生成菜单ID
    data.id = data.id || `menu_${Date.now()}`

    // 设置默认值
    data.status = data.status || 'active'
    data.visible = data.visible !== false
    data.sort_order = data.sort_order || 999
    data.icon = data.icon || ''
    data.component = data.component || ''
    data.meta = data.meta ? JSON.stringify(data.meta) : '{}'

    return data
  }

  /**
   * 更新菜单前的验证
   */
  async validateUpdate(menuId, data) {
    // 如果要更新路径，检查是否重复
    if (data.path) {
      const existingMenu = await this.menuRepository.findOne({ path: data.path })
      if (existingMenu && existingMenu.id !== menuId) {
        return {
          success: false,
          message: '菜单路径已存在'
        }
      }
    }

    // 如果要更新父菜单，检查是否会造成循环引用
    if (data.parent_id) {
      if (data.parent_id === menuId) {
        return {
          success: false,
          message: '不能将菜单设置为自己的父菜单'
        }
      }

      // 检查是否会造成循环引用
      const isDescendant = await this.checkIsDescendant(menuId, data.parent_id)
      if (isDescendant) {
        return {
          success: false,
          message: '不能将菜单移动到其子菜单下'
        }
      }
    }

    return { success: true }
  }

  /**
   * 更新菜单前的数据处理
   */
  async beforeUpdate(menuId, data) {
    // 处理meta字段
    if (data.meta && typeof data.meta === 'object') {
      data.meta = JSON.stringify(data.meta)
    }

    // 移除不应该更新的字段
    delete data.id
    delete data.created_at

    return data
  }

  /**
   * 删除菜单前的检查
   */
  async canDelete(menuId, _menu) {
    // 检查是否有子菜单
    const children = await this.menuRepository.findAll({ parent_id: menuId })
    if (children.length > 0) {
      return {
        success: false,
        message: '该菜单下还有子菜单，无法删除'
      }
    }

    return { success: true }
  }

  /**
   * 检查是否是子菜单
   */
  async checkIsDescendant(parentId, childId) {
    const children = await this.menuRepository.findAll({ parent_id: parentId })
    
    for (const child of children) {
      if (child.id === childId) {
        return true
      }
      
      const isDescendant = await this.checkIsDescendant(child.id, childId)
      if (isDescendant) {
        return true
      }
    }
    
    return false
  }

  /**
   * 移动菜单
   */
  async moveMenu(menuId, newParentId, newSortOrder = null) {
    try {
      const menu = await this.menuRepository.findById(menuId)
      
      if (!menu) {
        return {
          success: false,
          message: '菜单不存在'
        }
      }

      // 验证新父菜单
      if (newParentId) {
        const validation = await this.validateUpdate(menuId, { parent_id: newParentId })
        if (!validation.success) {
          return validation
        }
      }

      // 更新菜单
      const updateData = { parent_id: newParentId }
      if (newSortOrder !== null) {
        updateData.sort_order = newSortOrder
      }

      await this.menuRepository.update(menuId, updateData)

      return {
        success: true,
        message: '菜单移动成功'
      }
    } catch (error) {
      console.error('移动菜单失败:', error)
      return {
        success: false,
        message: '移动菜单失败',
        error: error.message
      }
    }
  }

  /**
   * 更新菜单排序
   */
  async updateSort(menuIds) {
    try {
      const updates = menuIds.map((id, index) => ({
        id,
        sort_order: index + 1
      }))

      await this.menuRepository.transaction(async (trx) => {
        for (const update of updates) {
          await trx('menus')
            .where('id', update.id)
            .update({ sort_order: update.sort_order })
        }
      })

      return {
        success: true,
        message: '排序更新成功'
      }
    } catch (error) {
      console.error('更新排序失败:', error)
      return {
        success: false,
        message: '更新排序失败',
        error: error.message
      }
    }
  }

  /**
   * 批量更新菜单状态
   */
  async updateStatus(menuIds, status) {
    try {
      await this.menuRepository.updateWhere(
        { id: menuIds },
        { status }
      )

      return {
        success: true,
        message: `成功更新${menuIds.length}个菜单的状态`
      }
    } catch (error) {
      console.error('批量更新状态失败:', error)
      return {
        success: false,
        message: '批量更新状态失败',
        error: error.message
      }
    }
  }

  /**
   * 复制菜单
   */
  async cloneMenu(menuId, newData) {
    try {
      const menu = await this.menuRepository.findById(menuId)
      
      if (!menu) {
        return {
          success: false,
          message: '源菜单不存在'
        }
      }

      // 创建新菜单
      const clonedMenu = {
        ...menu,
        ...newData,
        id: `menu_${Date.now()}`,
        created_at: new Date(),
        updated_at: new Date()
      }

      delete clonedMenu.id // 让create方法生成新ID

      const result = await this.create(clonedMenu)

      if (result.success) {
        // 递归复制子菜单
        const children = await this.menuRepository.findAll({ parent_id: menuId })
        for (const child of children) {
          await this.cloneMenu(child.id, {
            parent_id: result.data.id,
            name: child.name,
            path: `${child.path}_copy`
          })
        }
      }

      return result
    } catch (error) {
      console.error('复制菜单失败:', error)
      return {
        success: false,
        message: '复制菜单失败',
        error: error.message
      }
    }
  }

  /**
   * 获取菜单统计信息
   */
  async getMenuStatistics() {
    try {
      const [total, active, topLevel, hasChildren] = await Promise.all([
        this.menuRepository.count(),
        this.menuRepository.count({ status: 'active' }),
        this.menuRepository.count({ parent_id: null }),
        this.menuRepository.db('menus')
          .whereIn('id', function() {
            this.select('parent_id').from('menus').whereNotNull('parent_id')
          })
          .count('* as count')
      ])

      return {
        success: true,
        data: {
          total,
          active,
          inactive: total - active,
          topLevel,
          hasChildren: hasChildren[0].count,
          leafNodes: total - hasChildren[0].count
        }
      }
    } catch (error) {
      console.error('获取菜单统计失败:', error)
      return {
        success: false,
        message: '获取菜单统计失败',
        error: error.message
      }
    }
  }
}

module.exports = MenuService
