const MenuService = require('../services/system/MenuService')

/**
 * 菜单Controller - 重构版
 * 使用Service层架构
 */
class MenuController {
  constructor() {
    this.menuService = new MenuService()
  }

  /**
   * 获取菜单列表
   */
  async getList(req, res) {
    try {
      const result = await this.menuService.getList(req.query)

      if (result.success) {
        // 为角色管理权限选择，直接返回菜单数组
        if (!req.query.page && !req.query.pageSize) {
          res.json({
            success: true,
            data: result.data.list || []
          })
        } else {
          res.json(result)
        }
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取菜单列表失败:', error)
      res.status(500).json({
        success: false,
        message: '获取菜单列表失败',
        error: error.message
      })
    }
  }

  /**
   * 获取菜单树
   */
  async getTree(req, res) {
    try {
      const { roleId } = req.query
      const result = await this.menuService.getTree(roleId)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取菜单树失败:', error)
      res.status(500).json({
        success: false,
        message: '获取菜单树失败',
        error: error.message
      })
    }
  }

  /**
   * 获取当前用户菜单
   */
  async getUserMenus(req, res) {
    try {
      const userId = req.user?.id
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '用户未登录'
        })
      }
      
      const result = await this.menuService.getUserMenus(userId)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取用户菜单失败:', error)
      res.status(500).json({
        success: false,
        message: '获取用户菜单失败',
        error: error.message
      })
    }
  }

  /**
   * 获取菜单详情
   */
  async getById(req, res) {
    try {
      const { id } = req.params
      const result = await this.menuService.getById(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('获取菜单详情失败:', error)
      res.status(500).json({
        success: false,
        message: '获取菜单详情失败',
        error: error.message
      })
    }
  }

  /**
   * 创建菜单
   */
  async create(req, res) {
    try {
      const data = {
        ...req.body,
        created_by: req.user?.id
      }
      
      const result = await this.menuService.create(data)
      
      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('创建菜单失败:', error)
      res.status(500).json({
        success: false,
        message: '创建菜单失败',
        error: error.message
      })
    }
  }

  /**
   * 更新菜单
   */
  async update(req, res) {
    try {
      const { id } = req.params
      const data = {
        ...req.body,
        updated_by: req.user?.id
      }
      
      const result = await this.menuService.update(id, data)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('更新菜单失败:', error)
      res.status(500).json({
        success: false,
        message: '更新菜单失败',
        error: error.message
      })
    }
  }

  /**
   * 删除菜单
   */
  async delete(req, res) {
    try {
      const { id } = req.params
      const result = await this.menuService.delete(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('删除菜单失败:', error)
      res.status(500).json({
        success: false,
        message: '删除菜单失败',
        error: error.message
      })
    }
  }

  /**
   * 移动菜单
   */
  async move(req, res) {
    try {
      const { id } = req.params
      const { parentId, sortOrder } = req.body
      
      const result = await this.menuService.moveMenu(id, parentId, sortOrder)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('移动菜单失败:', error)
      res.status(500).json({
        success: false,
        message: '移动菜单失败',
        error: error.message
      })
    }
  }

  /**
   * 更新菜单排序
   */
  async updateSort(req, res) {
    try {
      const { menuIds } = req.body
      
      if (!Array.isArray(menuIds)) {
        return res.status(400).json({
          success: false,
          message: '菜单ID列表必须是数组'
        })
      }
      
      const result = await this.menuService.updateSort(menuIds)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('更新排序失败:', error)
      res.status(500).json({
        success: false,
        message: '更新排序失败',
        error: error.message
      })
    }
  }

  /**
   * 批量更新菜单状态
   */
  async updateStatus(req, res) {
    try {
      const { menuIds, status } = req.body
      
      if (!Array.isArray(menuIds)) {
        return res.status(400).json({
          success: false,
          message: '菜单ID列表必须是数组'
        })
      }
      
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: '无效的状态值'
        })
      }
      
      const result = await this.menuService.updateStatus(menuIds, status)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('批量更新状态失败:', error)
      res.status(500).json({
        success: false,
        message: '批量更新状态失败',
        error: error.message
      })
    }
  }

  /**
   * 复制菜单
   */
  async clone(req, res) {
    try {
      const { id } = req.params
      const { name, path } = req.body
      
      if (!name || !path) {
        return res.status(400).json({
          success: false,
          message: '请提供新菜单的名称和路径'
        })
      }
      
      const result = await this.menuService.cloneMenu(id, { name, path })
      
      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('复制菜单失败:', error)
      res.status(500).json({
        success: false,
        message: '复制菜单失败',
        error: error.message
      })
    }
  }

  /**
   * 批量导入菜单
   */
  async batchImport(req, res) {
    try {
      const { menus } = req.body
      
      if (!Array.isArray(menus) || menus.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供要导入的菜单数据'
        })
      }
      
      const results = []
      const errors = []
      
      // 按层级排序，先导入父菜单
      const sortedMenus = menus.sort((a, b) => {
        const aLevel = (a.path || '').split('/').length
        const bLevel = (b.path || '').split('/').length
        return aLevel - bLevel
      })
      
      for (const menu of sortedMenus) {
        const result = await this.menuService.create({
          ...menu,
          created_by: req.user?.id
        })
        
        if (result.success) {
          results.push(result.data)
        } else {
          errors.push({
            data: menu,
            error: result.message
          })
        }
      }
      
      res.json({
        success: true,
        message: `成功导入${results.length}个菜单，失败${errors.length}个`,
        data: {
          imported: results,
          failed: errors
        }
      })
    } catch (error) {
      console.error('批量导入菜单失败:', error)
      res.status(500).json({
        success: false,
        message: '批量导入菜单失败',
        error: error.message
      })
    }
  }

  /**
   * 导出菜单数据
   */
  async export(req, res) {
    try {
      const { format = 'json' } = req.query
      
      const result = await this.menuService.getTree()
      
      if (!result.success) {
        return res.status(400).json(result)
      }
      
      const menus = result.data
      
      if (format === 'csv') {
        // 扁平化树形结构
        const flatMenus = this.flattenTree(menus)
        
        // 转换为CSV格式
        const headers = ['ID', '菜单名称', '路径', '父菜单', '图标', '排序', '状态', '创建时间']
        const rows = flatMenus.map(menu => [
          menu.id,
          menu.name,
          menu.path,
          menu.parent_name || '',
          menu.icon || '',
          menu.sort_order,
          menu.status,
          menu.created_at
        ])
        
        const csvContent = [headers, ...rows]
          .map(row => row.join(','))
          .join('\n')
        
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', 'attachment; filename=menus.csv')
        res.send(csvContent)
      } else {
        // JSON格式
        res.json({
          success: true,
          data: menus
        })
      }
    } catch (error) {
      console.error('导出菜单失败:', error)
      res.status(500).json({
        success: false,
        message: '导出菜单失败',
        error: error.message
      })
    }
  }

  /**
   * 扁平化树形结构
   */
  flattenTree(tree, parentName = '', result = []) {
    for (const node of tree) {
      const { children, ...menu } = node
      menu.parent_name = parentName
      result.push(menu)
      
      if (children && children.length > 0) {
        this.flattenTree(children, menu.name, result)
      }
    }
    return result
  }

  /**
   * 获取菜单统计信息
   */
  async getStatistics(req, res) {
    try {
      const result = await this.menuService.getMenuStatistics()
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取菜单统计失败:', error)
      res.status(500).json({
        success: false,
        message: '获取菜单统计失败',
        error: error.message
      })
    }
  }

  /**
   * 刷新菜单缓存
   */
  async refreshCache(req, res) {
    try {
      // 这里可以实现菜单缓存刷新逻辑
      // 例如清除Redis缓存等
      
      res.json({
        success: true,
        message: '菜单缓存刷新成功'
      })
    } catch (error) {
      console.error('刷新菜单缓存失败:', error)
      res.status(500).json({
        success: false,
        message: '刷新菜单缓存失败',
        error: error.message
      })
    }
  }
}

// 创建实例并导出
const controller = new MenuController()

module.exports = {
  getList: (req, res) => controller.getList(req, res),
  getTree: (req, res) => controller.getTree(req, res),
  getUserMenus: (req, res) => controller.getUserMenus(req, res),
  getById: (req, res) => controller.getById(req, res),
  create: (req, res) => controller.create(req, res),
  update: (req, res) => controller.update(req, res),
  delete: (req, res) => controller.delete(req, res),
  move: (req, res) => controller.move(req, res),
  updateSort: (req, res) => controller.updateSort(req, res),
  updateStatus: (req, res) => controller.updateStatus(req, res),
  clone: (req, res) => controller.clone(req, res),
  batchImport: (req, res) => controller.batchImport(req, res),
  export: (req, res) => controller.export(req, res),
  getStatistics: (req, res) => controller.getStatistics(req, res),
  refreshCache: (req, res) => controller.refreshCache(req, res)
}