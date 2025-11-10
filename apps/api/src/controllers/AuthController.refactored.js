const AuthService = require('../services/system/AuthService')

/**
 * 认证Controller - 重构版
 * 使用Service层架构
 */
class AuthController {
  constructor() {
    this.authService = new AuthService()
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
      
      // 获取客户端IP和User-Agent
      const ipAddress = req.ip || req.connection.remoteAddress
      const userAgent = req.headers['user-agent']
      
      const result = await this.authService.login(username, password, ipAddress, userAgent)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(401).json(result)
      }
    } catch (error) {
      console.error('登录失败:', error)
      res.status(500).json({
        success: false,
        message: '登录失败',
        error: error.message
      })
    }
  }

  /**
   * 用户登出
   */
  async logout(req, res) {
    try {
      const userId = req.user?.id
      const token = req.headers.authorization?.replace('Bearer ', '')
      const ipAddress = req.ip || req.connection.remoteAddress
      
      const result = await this.authService.logout(userId, token, ipAddress)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('登出失败:', error)
      res.status(500).json({
        success: false,
        message: '登出失败',
        error: error.message
      })
    }
  }

  /**
   * 用户注册
   */
  async register(req, res) {
    try {
      const userData = req.body
      const ipAddress = req.ip || req.connection.remoteAddress
      
      // 验证必填字段
      if (!userData.username || !userData.password) {
        return res.status(400).json({
          success: false,
          message: '用户名和密码不能为空'
        })
      }
      
      const result = await this.authService.register(userData, ipAddress)
      
      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('注册失败:', error)
      res.status(500).json({
        success: false,
        message: '注册失败',
        error: error.message
      })
    }
  }

  /**
   * 刷新Token
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body
      
      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token不能为空'
        })
      }
      
      const result = await this.authService.refreshToken(refreshToken)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(401).json(result)
      }
    } catch (error) {
      console.error('刷新token失败:', error)
      res.status(500).json({
        success: false,
        message: '刷新token失败',
        error: error.message
      })
    }
  }

  /**
   * 验证Token
   */
  async verifyToken(req, res) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '')
      
      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Token不能为空'
        })
      }
      
      const result = await this.authService.verifyToken(token)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(401).json(result)
      }
    } catch (error) {
      console.error('验证token失败:', error)
      res.status(500).json({
        success: false,
        message: '验证token失败',
        error: error.message
      })
    }
  }

  /**
   * 修改密码
   */
  async changePassword(req, res) {
    try {
      const userId = req.user?.id
      const { oldPassword, newPassword } = req.body
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '用户未登录'
        })
      }
      
      if (!oldPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: '旧密码和新密码不能为空'
        })
      }
      
      // 验证新密码强度
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: '新密码长度至少6位'
        })
      }
      
      const ipAddress = req.ip || req.connection.remoteAddress
      const result = await this.authService.changePassword(userId, oldPassword, newPassword, ipAddress)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('修改密码失败:', error)
      res.status(500).json({
        success: false,
        message: '修改密码失败',
        error: error.message
      })
    }
  }

  /**
   * 重置密码（管理员操作）
   */
  async resetPassword(req, res) {
    try {
      const { userId, newPassword } = req.body
      
      // 检查是否是管理员
      if (!req.user?.is_admin) {
        return res.status(403).json({
          success: false,
          message: '需要管理员权限'
        })
      }
      
      if (!userId || !newPassword) {
        return res.status(400).json({
          success: false,
          message: '用户ID和新密码不能为空'
        })
      }
      
      const ipAddress = req.ip || req.connection.remoteAddress
      const result = await this.authService.resetPassword(userId, newPassword, ipAddress)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('重置密码失败:', error)
      res.status(500).json({
        success: false,
        message: '重置密码失败',
        error: error.message
      })
    }
  }

  /**
   * 忘记密码
   */
  async forgotPassword(req, res) {
    try {
      const { email } = req.body
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: '邮箱不能为空'
        })
      }
      
      const result = await this.authService.forgotPassword(email)
      
      // 无论成功与否都返回200，避免暴露用户是否存在
      res.json(result)
    } catch (error) {
      console.error('忘记密码处理失败:', error)
      res.status(500).json({
        success: false,
        message: '处理失败',
        error: error.message
      })
    }
  }

  /**
   * 通过重置token重置密码
   */
  async resetPasswordByToken(req, res) {
    try {
      const { token, newPassword } = req.body
      
      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Token和新密码不能为空'
        })
      }
      
      // 验证新密码强度
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: '新密码长度至少6位'
        })
      }
      
      const result = await this.authService.resetPasswordByToken(token, newPassword)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('重置密码失败:', error)
      res.status(500).json({
        success: false,
        message: '重置密码失败',
        error: error.message
      })
    }
  }

  /**
   * 获取当前用户信息
   */
  async getProfile(req, res) {
    try {
      const userId = req.user?.id
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '用户未登录'
        })
      }
      
      const result = await this.authService.getCurrentUser(userId)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(404).json(result)
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
      res.status(500).json({
        success: false,
        message: '获取用户信息失败',
        error: error.message
      })
    }
  }

  /**
   * 更新当前用户资料
   */
  async updateProfile(req, res) {
    try {
      const userId = req.user?.id
      const profileData = req.body
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '用户未登录'
        })
      }
      
      const result = await this.authService.updateProfile(userId, profileData)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('更新用户资料失败:', error)
      res.status(500).json({
        success: false,
        message: '更新用户资料失败',
        error: error.message
      })
    }
  }

  /**
   * 检查权限
   */
  async checkPermission(req, res) {
    try {
      const userId = req.user?.id
      const { permission } = req.query
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '用户未登录'
        })
      }
      
      if (!permission) {
        return res.status(400).json({
          success: false,
          message: '权限代码不能为空'
        })
      }
      
      const result = await this.authService.checkPermission(userId, permission)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(403).json(result)
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
   * 获取登录历史
   */
  async getLoginHistory(req, res) {
    try {
      const userId = req.user?.id
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '用户未登录'
        })
      }
      
      // TODO: 从审计日志中获取登录历史
      
      res.json({
        success: true,
        data: []
      })
    } catch (error) {
      console.error('获取登录历史失败:', error)
      res.status(500).json({
        success: false,
        message: '获取登录历史失败',
        error: error.message
      })
    }
  }

  /**
   * 获取会话信息
   */
  async getSession(req, res) {
    try {
      const user = req.user
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: '用户未登录'
        })
      }
      
      res.json({
        success: true,
        data: {
          user,
          sessionId: req.sessionID,
          expiresAt: req.session?.cookie?.expires
        }
      })
    } catch (error) {
      console.error('获取会话信息失败:', error)
      res.status(500).json({
        success: false,
        message: '获取会话信息失败',
        error: error.message
      })
    }
  }
}

// 创建实例并导出
const controller = new AuthController()

module.exports = {
  login: (req, res) => controller.login(req, res),
  logout: (req, res) => controller.logout(req, res),
  register: (req, res) => controller.register(req, res),
  refreshToken: (req, res) => controller.refreshToken(req, res),
  verifyToken: (req, res) => controller.verifyToken(req, res),
  changePassword: (req, res) => controller.changePassword(req, res),
  resetPassword: (req, res) => controller.resetPassword(req, res),
  forgotPassword: (req, res) => controller.forgotPassword(req, res),
  resetPasswordByToken: (req, res) => controller.resetPasswordByToken(req, res),
  getProfile: (req, res) => controller.getProfile(req, res),
  updateProfile: (req, res) => controller.updateProfile(req, res),
  checkPermission: (req, res) => controller.checkPermission(req, res),
  getLoginHistory: (req, res) => controller.getLoginHistory(req, res),
  getSession: (req, res) => controller.getSession(req, res)
}