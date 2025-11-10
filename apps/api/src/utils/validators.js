/**
 * 邮箱格式验证
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 密码强度验证
 * 至少8位，包含字母和数字
 */
const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return false
  }
  
  // 检查是否包含字母
  const hasLetter = /[a-zA-Z]/.test(password)
  // 检查是否包含数字
  const hasNumber = /\d/.test(password)
  
  return hasLetter && hasNumber
}

/**
 * 手机号格式验证（中国大陆）
 */
const validatePhone = (phone) => {
  const phoneRegex = /^1[3-9]\d{9}$/
  return phoneRegex.test(phone)
}

/**
 * 用户名格式验证
 * 3-20位，只能包含字母、数字、下划线
 */
const validateUsername = (username) => {
  if (!username || username.length < 3 || username.length > 20) {
    return false
  }
  
  const usernameRegex = /^[a-zA-Z0-9_]+$/
  return usernameRegex.test(username)
}

/**
 * URL格式验证
 */
const validateUrl = (url) => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * UUID格式验证
 */
const validateUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * 分页参数验证
 */
const validatePagination = (page, pageSize) => {
  const p = parseInt(page) || 1
  const ps = parseInt(pageSize) || 10
  
  return {
    page: Math.max(1, p),
    pageSize: Math.min(100, Math.max(1, ps)) // 限制最大100条
  }
}

/**
 * 排序参数验证
 */
const validateSort = (sort, allowedFields = []) => {
  if (!sort) return null
  
  const [field, order = 'asc'] = sort.split(':')
  
  if (!allowedFields.includes(field)) {
    return null
  }
  
  if (!['asc', 'desc'].includes(order.toLowerCase())) {
    return null
  }
  
  return { field, order: order.toLowerCase() }
}

/**
 * 日期格式验证
 */
const validateDate = (dateString) => {
  const date = new Date(dateString)
  return date instanceof Date && !isNaN(date)
}

/**
 * 编码格式验证（用于组织编码、部门编码等）
 * 2-20位，只能包含字母、数字、连字符
 */
const validateCode = (code) => {
  if (!code || code.length < 2 || code.length > 20) {
    return false
  }
  
  const codeRegex = /^[a-zA-Z0-9-]+$/
  return codeRegex.test(code)
}

/**
 * 权限代码验证
 * 格式：模块:操作:资源 例如：system:user:create
 */
const validatePermissionCode = (permissionCode) => {
  if (!permissionCode) return false
  
  const parts = permissionCode.split(':')
  if (parts.length < 2 || parts.length > 4) {
    return false
  }
  
  // 检查每部分是否只包含字母、数字、下划线
  const validPart = /^[a-zA-Z0-9_*]+$/
  return parts.every(part => validPart.test(part))
}

module.exports = {
  validateEmail,
  validatePassword,
  validatePhone,
  validateUsername,
  validateUrl,
  validateUUID,
  validatePagination,
  validateSort,
  validateDate,
  validateCode,
  validatePermissionCode
}