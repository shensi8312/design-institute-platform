/**
 * 创建错误对象
 */
const createError = (status, message, code = null) => {
  const error = new Error(message)
  error.status = status
  error.code = code
  return error
}

/**
 * 错误处理中间件
 */
const errorHandler = (err, req, res, _next) => {
  let status = err.status || 500
  let message = err.message || '服务器内部错误'
  let code = err.code || 'INTERNAL_ERROR'
  
  // 数据库错误处理
  if (err.code === '23505') { // PostgreSQL唯一约束违反
    status = 400
    message = '数据已存在，请检查唯一性约束'
    code = 'DUPLICATE_ERROR'
  } else if (err.code === '23503') { // PostgreSQL外键约束违反
    status = 400
    message = '关联数据不存在'
    code = 'FOREIGN_KEY_ERROR'
  } else if (err.code === '23502') { // PostgreSQL非空约束违反
    status = 400
    message = '必填字段不能为空'
    code = 'NOT_NULL_ERROR'
  }
  
  // JWT错误处理
  if (err.name === 'JsonWebTokenError') {
    status = 401
    message = '无效的认证令牌'
    code = 'INVALID_TOKEN'
  } else if (err.name === 'TokenExpiredError') {
    status = 401
    message = '认证令牌已过期'
    code = 'TOKEN_EXPIRED'
  }
  
  // 验证错误处理
  if (err.name === 'ValidationError') {
    status = 400
    message = err.details ? err.details.map(d => d.message).join(', ') : '参数验证失败'
    code = 'VALIDATION_ERROR'
  }
  
  // 开发环境输出详细错误信息
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', err)
  }
  
  res.status(status).json({
    code: status,
    message,
    error: code,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
}

/**
 * 404错误处理
 */
const notFound = (req, res) => {
  res.status(404).json({
    code: 404,
    message: '请求的资源不存在',
    error: 'NOT_FOUND'
  })
}

module.exports = {
  createError,
  errorHandler,
  notFound
}
