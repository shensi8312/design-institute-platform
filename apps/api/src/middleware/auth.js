const jwt = require('jsonwebtoken')
const db = require('../config/database')
const { createError } = require('../utils/error')

/**
 * JWT认证中间件
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(createError(401, '缺少认证令牌'))
    }
    
    const token = authHeader.substring(7)
    
    // 处理演示模式token
    if (token.startsWith('demo-token-')) {
      // 演示模式：创建一个模拟的admin用户
      req.user = {
        id: 'demo-admin',
        username: 'admin',
        email: 'admin@demo.com',
        real_name: '演示管理员',
        avatar: '',
        organization_id: 'demo-org',
        department_id: 'demo-dept',
        status: 'active',
        department_name: '演示部门',
        organization_name: '演示组织',
        roles: [],
        roleNames: [],
        permissions: ['*'],
        projectMemberships: [],
        projectIds: []
      }
      return next()
    }
    
    // 验证JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
    // 查询用户信息
    const user = await db('users')
      .select([
        'users.id',
        'users.username',
        'users.email',
        'users.name as real_name',
        'users.phone as avatar',
        'users.organization_id',
        'users.department_id',
        'users.status',
        'users.is_admin',
        'departments.name as department_name',
        'organizations.name as organization_name'
      ])
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .leftJoin('organizations', 'users.organization_id', 'organizations.id')
      .where('users.id', decoded.userId)
      // .where('users.deleted_at', null) // 字段不存在，暂时注释
      .first()
    
    if (!user) {
      return next(createError(401, '用户不存在'))
    }
    
    if (user.status !== 'active') {
      return next(createError(401, '用户账号已被禁用'))
    }
    
    // 简化版：暂时跳过角色和权限查询
    const permissions = new Set(['*']) // 暂时给予所有权限
    
    // 构建用户上下文
    req.user = {
      ...user,
      roles: [],
      roleNames: [],
      permissions: Array.from(permissions),
      projectMemberships: [],
      projectIds: []
    }
    
    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(createError(401, '无效的认证令牌'))
    }
    if (error.name === 'TokenExpiredError') {
      return next(createError(401, '认证令牌已过期'))
    }
    next(error)
  }
}

/**
 * 可选认证中间件（不强制要求登录）
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      await authenticate(req, res, next)
    } else {
      req.user = null
      next()
    }
  } catch (error) {
    req.user = null
    next()
  }
}

/**
 * 权限检查中间件
 */
const authorize = (permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(createError(401, '需要登录'))
    }
    
    // 超级管理员拥有所有权限
    if (req.user.permissions.includes('*')) {
      return next()
    }
    
    // 检查权限
    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions]
    const hasPermission = requiredPermissions.some(permission => 
      req.user.permissions.includes(permission)
    )
    
    if (!hasPermission) {
      return next(createError(403, '权限不足'))
    }
    
    next()
  }
}

/**
 * 角色检查中间件
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(createError(401, '需要登录'))
    }
    
    const requiredRoles = Array.isArray(roles) ? roles : [roles]
    const hasRole = requiredRoles.some(role => 
      req.user.roleNames.includes(role)
    )
    
    if (!hasRole) {
      return next(createError(403, '角色权限不足'))
    }
    
    next()
  }
}

/**
 * 组织权限检查中间件
 */
const requireOrganization = (req, res, next) => {
  if (!req.user) {
    return next(createError(401, '需要登录'))
  }
  
  const { organizationId } = req.params
  if (organizationId && organizationId !== req.user.organization_id) {
    return next(createError(403, '无权限访问其他组织的资源'))
  }
  
  next()
}

module.exports = {
  authenticate,
  optionalAuth,
  authorize,
  requireRole,
  requireOrganization
}
