const jwt = require('jsonwebtoken')
const UserService = require('./UserService')
const SystemAuditService = require('./SystemAuditService')

/**
 * 认证Service
 */
class AuthService {
  constructor() {
    this.userService = new UserService()
    this.auditService = new SystemAuditService()
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key'
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h'
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
  }

  /**
   * 用户登录
   */
  async login(username, password, ipAddress = null, userAgent = null) {
    const startTime = Date.now()
    
    try {
      // 使用UserService验证登录
      const result = await this.userService.login(username, password)
      
      if (!result.success) {
        // 记录失败的登录尝试
        await this.auditService.log({
          userId: 'anonymous',
          module: 'auth',
          action: 'login_failed',
          resourceType: 'user',
          resourceName: username,
          ipAddress,
          userAgent,
          status: 'failed',
          errorMessage: result.message,
          startTime
        })
        
        return result
      }

      const user = result.data

      // 生成JWT token
      const token = this.generateToken(user)
      const refreshToken = this.generateRefreshToken(user)

      // 记录成功的登录
      await this.auditService.log({
        userId: user.id,
        module: 'auth',
        action: 'login',
        resourceType: 'user',
        resourceId: user.id,
        resourceName: user.username,
        ipAddress,
        userAgent,
        status: 'success',
        startTime
      })

      return {
        success: true,
        message: '登录成功',
        data: {
          token,
          refreshToken,
          user: this.sanitizeUser(user)
        }
      }
    } catch (error) {
      console.error('登录失败:', error)
      
      // 记录异常
      await this.auditService.log({
        userId: 'anonymous',
        module: 'auth',
        action: 'login_error',
        resourceType: 'user',
        resourceName: username,
        ipAddress,
        userAgent,
        status: 'error',
        errorMessage: error.message,
        startTime
      })
      
      return {
        success: false,
        message: '登录失败',
        error: error.message
      }
    }
  }

  /**
   * 用户登出
   */
  async logout(userId, token, ipAddress = null) {
    try {
      // 可以在这里将token加入黑名单
      // await this.addTokenToBlacklist(token)

      // 记录登出
      await this.auditService.log({
        userId,
        module: 'auth',
        action: 'logout',
        resourceType: 'user',
        resourceId: userId,
        ipAddress,
        status: 'success'
      })

      return {
        success: true,
        message: '登出成功'
      }
    } catch (error) {
      console.error('登出失败:', error)
      return {
        success: false,
        message: '登出失败',
        error: error.message
      }
    }
  }

  /**
   * 注册新用户
   */
  async register(userData, ipAddress = null) {
    const startTime = Date.now()
    
    try {
      // 使用UserService创建用户
      const result = await this.userService.create(userData)
      
      if (!result.success) {
        return result
      }

      const user = result.data

      // 生成token
      const token = this.generateToken(user)
      const refreshToken = this.generateRefreshToken(user)

      // 记录注册
      await this.auditService.log({
        userId: user.id,
        module: 'auth',
        action: 'register',
        resourceType: 'user',
        resourceId: user.id,
        resourceName: user.username,
        newValue: { username: user.username, email: user.email },
        ipAddress,
        status: 'success',
        startTime
      })

      return {
        success: true,
        message: '注册成功',
        data: {
          token,
          refreshToken,
          user: this.sanitizeUser(user)
        }
      }
    } catch (error) {
      console.error('注册失败:', error)
      
      await this.auditService.log({
        userId: 'anonymous',
        module: 'auth',
        action: 'register_failed',
        resourceType: 'user',
        resourceName: userData.username,
        ipAddress,
        status: 'failed',
        errorMessage: error.message,
        startTime
      })
      
      return {
        success: false,
        message: '注册失败',
        error: error.message
      }
    }
  }

  /**
   * 刷新Token
   */
  async refreshToken(refreshToken) {
    try {
      // 验证refresh token
      const decoded = jwt.verify(refreshToken, this.jwtSecret)
      
      // 获取最新的用户信息
      const result = await this.userService.getById(decoded.userId)
      
      if (!result.success) {
        return {
          success: false,
          message: '用户不存在'
        }
      }

      const user = result.data

      // 检查用户状态
      if (user.status !== 'active') {
        return {
          success: false,
          message: '用户已被禁用'
        }
      }

      // 生成新的token
      const newToken = this.generateToken(user)
      const newRefreshToken = this.generateRefreshToken(user)

      return {
        success: true,
        data: {
          token: newToken,
          refreshToken: newRefreshToken
        }
      }
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return {
          success: false,
          message: 'Refresh token已过期'
        }
      }
      
      if (error.name === 'JsonWebTokenError') {
        return {
          success: false,
          message: '无效的refresh token'
        }
      }
      
      console.error('刷新token失败:', error)
      return {
        success: false,
        message: '刷新token失败',
        error: error.message
      }
    }
  }

  /**
   * 验证Token
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret)
      
      // 获取用户信息
      const result = await this.userService.getById(decoded.userId)
      
      if (!result.success) {
        return {
          success: false,
          message: '用户不存在'
        }
      }

      const user = result.data

      // 检查用户状态
      if (user.status !== 'active') {
        return {
          success: false,
          message: '用户已被禁用'
        }
      }

      return {
        success: true,
        data: {
          user: this.sanitizeUser(user),
          decoded
        }
      }
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return {
          success: false,
          message: 'Token已过期'
        }
      }
      
      if (error.name === 'JsonWebTokenError') {
        return {
          success: false,
          message: '无效的token'
        }
      }
      
      console.error('验证token失败:', error)
      return {
        success: false,
        message: '验证token失败',
        error: error.message
      }
    }
  }

  /**
   * 修改密码
   */
  async changePassword(userId, oldPassword, newPassword, ipAddress = null) {
    const startTime = Date.now()
    
    try {
      // 使用UserService修改密码
      const result = await this.userService.changePassword(userId, oldPassword, newPassword)
      
      if (result.success) {
        // 记录密码修改
        await this.auditService.log({
          userId,
          module: 'auth',
          action: 'change_password',
          resourceType: 'user',
          resourceId: userId,
          ipAddress,
          status: 'success',
          startTime
        })
      }
      
      return result
    } catch (error) {
      console.error('修改密码失败:', error)
      
      await this.auditService.log({
        userId,
        module: 'auth',
        action: 'change_password_failed',
        resourceType: 'user',
        resourceId: userId,
        ipAddress,
        status: 'failed',
        errorMessage: error.message,
        startTime
      })
      
      return {
        success: false,
        message: '修改密码失败',
        error: error.message
      }
    }
  }

  /**
   * 重置密码
   */
  async resetPassword(userId, newPassword, ipAddress = null) {
    const startTime = Date.now()
    
    try {
      // 使用UserService重置密码
      const result = await this.userService.resetPassword(userId, newPassword)
      
      if (result.success) {
        // 记录密码重置
        await this.auditService.log({
          userId: 'system',
          module: 'auth',
          action: 'reset_password',
          resourceType: 'user',
          resourceId: userId,
          ipAddress,
          status: 'success',
          startTime
        })
      }
      
      return result
    } catch (error) {
      console.error('重置密码失败:', error)
      
      await this.auditService.log({
        userId: 'system',
        module: 'auth',
        action: 'reset_password_failed',
        resourceType: 'user',
        resourceId: userId,
        ipAddress,
        status: 'failed',
        errorMessage: error.message,
        startTime
      })
      
      return {
        success: false,
        message: '重置密码失败',
        error: error.message
      }
    }
  }

  /**
   * 忘记密码
   */
  async forgotPassword(email) {
    try {
      // 查找用户
      const user = await this.userService.userRepository.findByEmail(email)
      
      if (!user) {
        // 为了安全，即使用户不存在也返回成功
        return {
          success: true,
          message: '如果该邮箱已注册，您将收到密码重置邮件'
        }
      }

      // 生成重置token
      const resetToken = this.generatePasswordResetToken(user)
      
      // TODO: 发送重置密码邮件
      // await this.emailService.sendPasswordResetEmail(user.email, resetToken)

      // 记录操作
      await this.auditService.log({
        userId: user.id,
        module: 'auth',
        action: 'forgot_password',
        resourceType: 'user',
        resourceId: user.id,
        resourceName: user.email,
        status: 'success'
      })

      return {
        success: true,
        message: '如果该邮箱已注册，您将收到密码重置邮件',
        data: {
          resetToken // 在开发环境返回token，生产环境应该通过邮件发送
        }
      }
    } catch (error) {
      console.error('忘记密码处理失败:', error)
      return {
        success: false,
        message: '处理失败',
        error: error.message
      }
    }
  }

  /**
   * 通过重置token重置密码
   */
  async resetPasswordByToken(resetToken, newPassword) {
    try {
      // 验证reset token
      const decoded = jwt.verify(resetToken, this.jwtSecret)
      
      if (decoded.type !== 'password_reset') {
        return {
          success: false,
          message: '无效的重置token'
        }
      }

      // 重置密码
      const result = await this.userService.resetPassword(decoded.userId, newPassword)
      
      if (result.success) {
        await this.auditService.log({
          userId: decoded.userId,
          module: 'auth',
          action: 'reset_password_by_token',
          resourceType: 'user',
          resourceId: decoded.userId,
          status: 'success'
        })
      }
      
      return result
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return {
          success: false,
          message: '重置链接已过期'
        }
      }
      
      console.error('通过token重置密码失败:', error)
      return {
        success: false,
        message: '重置密码失败',
        error: error.message
      }
    }
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(userId) {
    try {
      const result = await this.userService.getById(userId)
      
      if (result.success) {
        result.data = this.sanitizeUser(result.data)
      }
      
      return result
    } catch (error) {
      console.error('获取当前用户信息失败:', error)
      return {
        success: false,
        message: '获取用户信息失败',
        error: error.message
      }
    }
  }

  /**
   * 更新当前用户资料
   */
  async updateProfile(userId, profileData) {
    try {
      // 移除不允许用户自己修改的字段
      delete profileData.is_admin
      delete profileData.role_id
      delete profileData.status
      delete profileData.organization_id
      delete profileData.department_id
      
      const result = await this.userService.update(userId, profileData)
      
      if (result.success) {
        result.data = this.sanitizeUser(result.data)
        
        await this.auditService.log({
          userId,
          module: 'auth',
          action: 'update_profile',
          resourceType: 'user',
          resourceId: userId,
          oldValue: profileData,
          status: 'success'
        })
      }
      
      return result
    } catch (error) {
      console.error('更新用户资料失败:', error)
      return {
        success: false,
        message: '更新用户资料失败',
        error: error.message
      }
    }
  }

  /**
   * 生成JWT Token
   */
  generateToken(user) {
    const payload = {
      userId: user.id,
      username: user.username,
      isAdmin: user.is_admin,
      roleId: user.role_id
    }
    
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    })
  }

  /**
   * 生成Refresh Token
   */
  generateRefreshToken(user) {
    const payload = {
      userId: user.id,
      type: 'refresh'
    }
    
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.refreshTokenExpiresIn
    })
  }

  /**
   * 生成密码重置Token
   */
  generatePasswordResetToken(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      type: 'password_reset'
    }
    
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: '1h'
    })
  }

  /**
   * 清理敏感用户信息
   */
  sanitizeUser(user) {
    const sanitized = { ...user }
    delete sanitized.password_hash
    delete sanitized.password
    delete sanitized.deleted_at
    return sanitized
  }

  /**
   * 验证权限
   */
  async checkPermission(_userId, _permissionCode) {
    try {
      // TODO: 实现权限检查逻辑
      // 这里可以调用PermissionService
    } catch (error) {
      console.error('检查权限失败:', error)
      return {
        success: false,
        hasPermission: false,
        error: error.message
      }
    }

    return {
      success: true,
      hasPermission: true
    }
  }
}

module.exports = AuthService
