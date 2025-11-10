const RoleService = require('../services/system/RoleService')

/**
 * 角色Controller - 重构版
 * 使用Service层架构
 */
class RoleController {
  constructor() {
    this.roleService = new RoleService()
  }

  /**
   * 获取角色列表
   */
  async getList(req, res) {
    try {
      const result = await this.roleService.getList(req.query)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取角色列表失败:', error)
      res.status(500).json({
        success: false,
        message: '获取角色列表失败',
        error: error.message
      })
    }
  }

  /**
   * 获取角色详情
   */
  async getById(req, res) {
    try {
      const { id } = req.params
      const result = await this.roleService.getById(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('获取角色详情失败:', error)
      res.status(500).json({
        success: false,
        message: '获取角色详情失败',
        error: error.message
      })
    }
  }

  /**
   * 创建角色
   */
  async create(req, res) {
    try {
      // 添加创建者信息
      const data = {
        ...req.body,
        created_by: req.user?.id
      }
      
      const result = await this.roleService.create(data)
      
      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('创建角色失败:', error)
      res.status(500).json({
        success: false,
        message: '创建角色失败',
        error: error.message
      })
    }
  }

  /**
   * 更新角色
   */
  async update(req, res) {
    try {
      const { id } = req.params
      const data = {
        ...req.body,
        updated_by: req.user?.id
      }
      
      const result = await this.roleService.update(id, data)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('更新角色失败:', error)
      res.status(500).json({
        success: false,
        message: '更新角色失败',
        error: error.message
      })
    }
  }

  /**
   * 删除角色
   */
  async delete(req, res) {
    try {
      const { id } = req.params
      const result = await this.roleService.delete(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('删除角色失败:', error)
      res.status(500).json({
        success: false,
        message: '删除角色失败',
        error: error.message
      })
    }
  }

  /**
   * 分配权限
   */
  async assignPermissions(req, res) {
    try {
      const { id } = req.params
      const { permissions } = req.body
      
      if (!Array.isArray(permissions)) {
        return res.status(400).json({
          success: false,
          message: '权限列表必须是数组'
        })
      }
      
      const result = await this.roleService.assignPermissions(id, permissions)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('分配权限失败:', error)
      res.status(500).json({
        success: false,
        message: '分配权限失败',
        error: error.message
      })
    }
  }

  /**
   * 获取角色权限
   */
  async getPermissions(req, res) {
    try {
      const { id } = req.params
      const result = await this.roleService.getRolePermissions(id)
      
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
   * 复制角色
   */
  async clone(req, res) {
    try {
      const { id } = req.params
      const { name, code } = req.body
      
      if (!name || !code) {
        return res.status(400).json({
          success: false,
          message: '请提供新角色的名称和代码'
        })
      }
      
      const result = await this.roleService.cloneRole(id, { name, code })
      
      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('复制角色失败:', error)
      res.status(500).json({
        success: false,
        message: '复制角色失败',
        error: error.message
      })
    }
  }

  /**
   * 获取角色用户列表
   */
  async getUsers(req, res) {
    try {
      const { id } = req.params
      const result = await this.roleService.getRoleUsers(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取角色用户失败:', error)
      res.status(500).json({
        success: false,
        message: '获取角色用户失败',
        error: error.message
      })
    }
  }

  /**
   * 批量分配用户到角色
   */
  async assignUsers(req, res) {
    try {
      const { id } = req.params
      const { userIds } = req.body
      
      if (!Array.isArray(userIds)) {
        return res.status(400).json({
          success: false,
          message: '用户ID列表必须是数组'
        })
      }
      
      const result = await this.roleService.assignUsersToRole(id, userIds)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('分配用户到角色失败:', error)
      res.status(500).json({
        success: false,
        message: '分配用户到角色失败',
        error: error.message
      })
    }
  }

  /**
   * 批量导入角色
   */
  async batchImport(req, res) {
    try {
      const { roles } = req.body
      
      if (!Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供要导入的角色数据'
        })
      }
      
      const results = []
      const errors = []
      
      for (const role of roles) {
        const result = await this.roleService.create({
          ...role,
          created_by: req.user?.id
        })
        
        if (result.success) {
          results.push(result.data)
        } else {
          errors.push({
            data: role,
            error: result.message
          })
        }
      }
      
      res.json({
        success: true,
        message: `成功导入${results.length}个角色，失败${errors.length}个`,
        data: {
          imported: results,
          failed: errors
        }
      })
    } catch (error) {
      console.error('批量导入角色失败:', error)
      res.status(500).json({
        success: false,
        message: '批量导入角色失败',
        error: error.message
      })
    }
  }

  /**
   * 导出角色数据
   */
  async export(req, res) {
    try {
      const { format = 'json' } = req.query
      
      const result = await this.roleService.getList({
        pageSize: 10000 // 导出所有
      })
      
      if (!result.success) {
        return res.status(400).json(result)
      }
      
      const roles = result.data.list
      
      if (format === 'csv') {
        // 转换为CSV格式
        const headers = ['ID', '角色名称', '角色代码', '权限数量', '用户数量', '状态', '创建时间']
        const rows = roles.map(role => [
          role.id,
          role.name,
          role.code,
          role.permissions_count || 0,
          role.users_count || 0,
          role.status,
          role.created_at
        ])
        
        const csvContent = [headers, ...rows]
          .map(row => row.join(','))
          .join('\n')
        
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', 'attachment; filename=roles.csv')
        res.send(csvContent)
      } else {
        // JSON格式
        res.json({
          success: true,
          data: roles
        })
      }
    } catch (error) {
      console.error('导出角色失败:', error)
      res.status(500).json({
        success: false,
        message: '导出角色失败',
        error: error.message
      })
    }
  }

  /**
   * 获取角色统计信息
   */
  async getStatistics(req, res) {
    try {
      const result = await this.roleService.getRoleStatistics()
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取角色统计失败:', error)
      res.status(500).json({
        success: false,
        message: '获取角色统计失败',
        error: error.message
      })
    }
  }

  /**
   * 检查角色权限
   */
  async checkPermission(req, res) {
    try {
      const { id } = req.params
      const { permission } = req.query
      
      if (!permission) {
        return res.status(400).json({
          success: false,
          message: '请提供要检查的权限代码'
        })
      }
      
      const result = await this.roleService.checkRolePermission(id, permission)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('检查角色权限失败:', error)
      res.status(500).json({
        success: false,
        message: '检查角色权限失败',
        error: error.message
      })
    }
  }
}

// 创建实例并导出
const controller = new RoleController()

module.exports = {
  getList: (req, res) => controller.getList(req, res),
  getById: (req, res) => controller.getById(req, res),
  create: (req, res) => controller.create(req, res),
  update: (req, res) => controller.update(req, res),
  delete: (req, res) => controller.delete(req, res),
  assignPermissions: (req, res) => controller.assignPermissions(req, res),
  getPermissions: (req, res) => controller.getPermissions(req, res),
  clone: (req, res) => controller.clone(req, res),
  getUsers: (req, res) => controller.getUsers(req, res),
  assignUsers: (req, res) => controller.assignUsers(req, res),
  batchImport: (req, res) => controller.batchImport(req, res),
  export: (req, res) => controller.export(req, res),
  getStatistics: (req, res) => controller.getStatistics(req, res),
  checkPermission: (req, res) => controller.checkPermission(req, res)
}