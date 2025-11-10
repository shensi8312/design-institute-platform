const PermissionService = require('../services/system/PermissionService')

/**
 * 权限Controller - 重构版
 * 使用Service层架构
 */
class PermissionController {
  constructor() {
    this.permissionService = new PermissionService()
  }

  /**
   * 获取权限列表
   */
  async getList(req, res) {
    try {
      const result = await this.permissionService.getList(req.query)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取权限列表失败:', error)
      res.status(500).json({
        success: false,
        message: '获取权限列表失败',
        error: error.message
      })
    }
  }

  /**
   * 获取权限树
   */
  async getTree(req, res) {
    try {
      const result = await this.permissionService.getPermissionTree()
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取权限树失败:', error)
      res.status(500).json({
        success: false,
        message: '获取权限树失败',
        error: error.message
      })
    }
  }

  /**
   * 获取权限详情
   */
  async getById(req, res) {
    try {
      const { id } = req.params
      const result = await this.permissionService.getById(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('获取权限详情失败:', error)
      res.status(500).json({
        success: false,
        message: '获取权限详情失败',
        error: error.message
      })
    }
  }

  /**
   * 创建权限
   */
  async create(req, res) {
    try {
      const data = {
        ...req.body,
        created_by: req.user?.id
      }
      
      const result = await this.permissionService.create(data)
      
      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('创建权限失败:', error)
      res.status(500).json({
        success: false,
        message: '创建权限失败',
        error: error.message
      })
    }
  }

  /**
   * 更新权限
   */
  async update(req, res) {
    try {
      const { id } = req.params
      const data = {
        ...req.body,
        updated_by: req.user?.id
      }
      
      const result = await this.permissionService.update(id, data)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('更新权限失败:', error)
      res.status(500).json({
        success: false,
        message: '更新权限失败',
        error: error.message
      })
    }
  }

  /**
   * 删除权限
   */
  async delete(req, res) {
    try {
      const { id } = req.params
      const result = await this.permissionService.delete(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('删除权限失败:', error)
      res.status(500).json({
        success: false,
        message: '删除权限失败',
        error: error.message
      })
    }
  }

  /**
   * 批量创建权限
   */
  async batchCreate(req, res) {
    try {
      const { permissions } = req.body
      
      if (!Array.isArray(permissions) || permissions.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供要创建的权限数据'
        })
      }
      
      const result = await this.permissionService.batchCreate(permissions)
      
      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('批量创建权限失败:', error)
      res.status(500).json({
        success: false,
        message: '批量创建权限失败',
        error: error.message
      })
    }
  }

  /**
   * 获取用户权限
   */
  async getUserPermissions(req, res) {
    try {
      const { userId } = req.params
      const result = await this.permissionService.getUserPermissions(userId)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取用户权限失败:', error)
      res.status(500).json({
        success: false,
        message: '获取用户权限失败',
        error: error.message
      })
    }
  }

  /**
   * 获取角色权限
   */
  async getRolePermissions(req, res) {
    try {
      const { roleId } = req.params
      const result = await this.permissionService.getRolePermissions(roleId)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取角色权限失败:', error)
      res.status(500).json({
        success: false,
        message: '获取角色权限失败',
        error: error.message
      })
    }
  }

  /**
   * 检查用户权限
   */
  async checkUserPermission(req, res) {
    try {
      const { userId } = req.params
      const { permissionCode } = req.query
      
      if (!permissionCode) {
        return res.status(400).json({
          success: false,
          message: '请提供要检查的权限代码'
        })
      }
      
      const result = await this.permissionService.checkUserPermission(userId, permissionCode)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('检查用户权限失败:', error)
      res.status(500).json({
        success: false,
        message: '检查用户权限失败',
        error: error.message
      })
    }
  }

  /**
   * 检查当前用户权限
   */
  async checkMyPermission(req, res) {
    try {
      const userId = req.user?.id
      const { permissionCode } = req.query
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '用户未登录'
        })
      }
      
      if (!permissionCode) {
        return res.status(400).json({
          success: false,
          message: '请提供要检查的权限代码'
        })
      }
      
      const result = await this.permissionService.checkUserPermission(userId, permissionCode)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('检查权限失败:', error)
      res.status(500).json({
        success: false,
        message: '检查权限失败',
        error: error.message
      })
    }
  }

  /**
   * 同步权限
   */
  async syncPermissions(req, res) {
    try {
      const { permissions } = req.body
      
      if (!Array.isArray(permissions)) {
        return res.status(400).json({
          success: false,
          message: '请提供要同步的权限数据'
        })
      }
      
      const result = await this.permissionService.syncPermissions(permissions)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('同步权限失败:', error)
      res.status(500).json({
        success: false,
        message: '同步权限失败',
        error: error.message
      })
    }
  }

  /**
   * 初始化默认权限
   */
  async initializeDefault(req, res) {
    try {
      const result = await this.permissionService.initializeDefaultPermissions()
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('初始化默认权限失败:', error)
      res.status(500).json({
        success: false,
        message: '初始化默认权限失败',
        error: error.message
      })
    }
  }

  /**
   * 导出权限数据
   */
  async export(req, res) {
    try {
      const { format = 'json' } = req.query
      
      const result = await this.permissionService.getList({
        pageSize: 10000 // 导出所有
      })
      
      if (!result.success) {
        return res.status(400).json(result)
      }
      
      const permissions = result.data.list
      
      if (format === 'csv') {
        // 转换为CSV格式
        const headers = ['ID', '权限名称', '权限代码', '模块', '操作', '类型', '状态', '创建时间']
        const rows = permissions.map(perm => [
          perm.id,
          perm.name,
          perm.code,
          perm.module,
          perm.action,
          perm.type,
          perm.status,
          perm.created_at
        ])
        
        const csvContent = [headers, ...rows]
          .map(row => row.join(','))
          .join('\n')
        
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', 'attachment; filename=permissions.csv')
        res.send(csvContent)
      } else {
        // JSON格式
        res.json({
          success: true,
          data: permissions
        })
      }
    } catch (error) {
      console.error('导出权限失败:', error)
      res.status(500).json({
        success: false,
        message: '导出权限失败',
        error: error.message
      })
    }
  }

  /**
   * 获取权限统计信息
   */
  async getStatistics(req, res) {
    try {
      const result = await this.permissionService.getPermissionStatistics()
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取权限统计失败:', error)
      res.status(500).json({
        success: false,
        message: '获取权限统计失败',
        error: error.message
      })
    }
  }

  /**
   * 批量删除权限
   */
  async batchDelete(req, res) {
    try {
      const { permissionIds } = req.body
      
      if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供要删除的权限ID列表'
        })
      }
      
      const results = []
      const errors = []
      
      for (const id of permissionIds) {
        const result = await this.permissionService.delete(id)
        if (result.success) {
          results.push(id)
        } else {
          errors.push({
            id,
            error: result.message
          })
        }
      }
      
      res.json({
        success: true,
        message: `成功删除${results.length}个权限，失败${errors.length}个`,
        data: {
          deleted: results,
          failed: errors
        }
      })
    } catch (error) {
      console.error('批量删除权限失败:', error)
      res.status(500).json({
        success: false,
        message: '批量删除权限失败',
        error: error.message
      })
    }
  }
}

// 创建实例并导出
const controller = new PermissionController()

module.exports = {
  getList: (req, res) => controller.getList(req, res),
  getTree: (req, res) => controller.getTree(req, res),
  getById: (req, res) => controller.getById(req, res),
  create: (req, res) => controller.create(req, res),
  update: (req, res) => controller.update(req, res),
  delete: (req, res) => controller.delete(req, res),
  batchCreate: (req, res) => controller.batchCreate(req, res),
  batchDelete: (req, res) => controller.batchDelete(req, res),
  getUserPermissions: (req, res) => controller.getUserPermissions(req, res),
  getRolePermissions: (req, res) => controller.getRolePermissions(req, res),
  checkUserPermission: (req, res) => controller.checkUserPermission(req, res),
  checkMyPermission: (req, res) => controller.checkMyPermission(req, res),
  syncPermissions: (req, res) => controller.syncPermissions(req, res),
  initializeDefault: (req, res) => controller.initializeDefault(req, res),
  export: (req, res) => controller.export(req, res),
  getStatistics: (req, res) => controller.getStatistics(req, res)
}