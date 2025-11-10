const UserService = require('../services/system/UserService')
const jwt = require('jsonwebtoken')

/**
 * 用户控制器 - 重构版
 * 使用Service层处理业务逻辑
 */
class UserController {
  constructor() {
    this.userService = new UserService()
  }

  /**
   * 获取用户列表
   */
  async getList(req, res) {
    try {
      const result = await this.userService.getList(req.query)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('Controller error:', error)
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      })
    }
  }

  /**
   * 获取用户详情
   */
  async getDetail(req, res) {
    try {
      const { id } = req.params
      const result = await this.userService.getById(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message === '用户不存在' ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('Controller error:', error)
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      })
    }
  }

  /**
   * 创建用户
   */
  async create(req, res) {
    try {
      const result = await this.userService.create(req.body)
      
      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('Controller error:', error)
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      })
    }
  }

  /**
   * 更新用户
   */
  async update(req, res) {
    try {
      const { id } = req.params
      const result = await this.userService.update(id, req.body)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message === '记录不存在' ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('Controller error:', error)
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      })
    }
  }

  /**
   * 删除用户
   */
  async delete(req, res) {
    try {
      const { id } = req.params
      const result = await this.userService.delete(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message === '记录不存在' ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('Controller error:', error)
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      })
    }
  }

  /**
   * 批量删除用户
   */
  async bulkDelete(req, res) {
    try {
      const { ids } = req.body
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供要删除的用户ID列表'
        })
      }

      const result = await this.userService.bulkDelete(ids)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('Controller error:', error)
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      })
    }
  }

  /**
   * 重置密码
   */
  async resetPassword(req, res) {
    try {
      const { id } = req.params
      const { password } = req.body
      
      if (!password) {
        return res.status(400).json({
          success: false,
          message: '新密码不能为空'
        })
      }

      const result = await this.userService.resetPassword(id, password)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('Controller error:', error)
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      })
    }
  }

  /**
   * 修改密码
   */
  async changePassword(req, res) {
    try {
      const { id } = req.params
      const { oldPassword, newPassword } = req.body
      
      if (!oldPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: '原密码和新密码不能为空'
        })
      }

      const result = await this.userService.changePassword(id, oldPassword, newPassword)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('Controller error:', error)
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      })
    }
  }

  /**
   * 批量更新状态
   */
  async updateStatus(req, res) {
    try {
      const { ids, status } = req.body
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供要更新的用户ID列表'
        })
      }

      if (!status) {
        return res.status(400).json({
          success: false,
          message: '请提供状态值'
        })
      }

      const result = await this.userService.updateStatus(ids, status)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('Controller error:', error)
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      })
    }
  }

  /**
   * 分配角色
   */
  async assignRole(req, res) {
    try {
      const { id } = req.params
      const { roleId } = req.body
      
      if (!roleId) {
        return res.status(400).json({
          success: false,
          message: '请提供角色ID'
        })
      }

      const result = await this.userService.assignRole(id, roleId)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('Controller error:', error)
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      })
    }
  }

  /**
   * 用户登录
   */
  async login(req, res) {
    try {
      const { username, password } = req.body
      
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: '用户名和密码不能为空'
        })
      }

      const result = await this.userService.login(username, password)
      
      if (result.success) {
        // 生成JWT token
        const token = jwt.sign(
          { 
            id: result.data.id,
            username: result.data.username,
            role_id: result.data.role_id
          },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '24h' }
        )

        res.json({
          success: true,
          message: '登录成功',
          data: {
            token,
            user: result.data
          }
        })
      } else {
        res.status(401).json(result)
      }
    } catch (error) {
      console.error('Controller error:', error)
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      })
    }
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(req, res) {
    try {
      // 从JWT中间件获取用户ID
      const userId = req.user?.id
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '未登录'
        })
      }

      const result = await this.userService.getById(userId)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(404).json(result)
      }
    } catch (error) {
      console.error('Controller error:', error)
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      })
    }
  }
}

// 创建单例实例
const userController = new UserController()

// 导出绑定了this的方法
module.exports = {
  getList: userController.getList.bind(userController),
  getDetail: userController.getDetail.bind(userController),
  create: userController.create.bind(userController),
  update: userController.update.bind(userController),
  delete: userController.delete.bind(userController),
  bulkDelete: userController.bulkDelete.bind(userController),
  resetPassword: userController.resetPassword.bind(userController),
  changePassword: userController.changePassword.bind(userController),
  updateStatus: userController.updateStatus.bind(userController),
  assignRole: userController.assignRole.bind(userController),
  login: userController.login.bind(userController),
  getCurrentUser: userController.getCurrentUser.bind(userController)
}