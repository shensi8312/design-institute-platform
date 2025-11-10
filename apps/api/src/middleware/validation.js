const { validationResult } = require('express-validator')

/**
 * 验证请求参数中间件
 * 使用express-validator进行参数验证
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req)
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }))
    
    return res.status(400).json({
      code: 400,
      message: '参数验证失败',
      error: 'VALIDATION_ERROR',
      details: errorMessages
    })
  }
  
  next()
}

/**
 * 自定义验证器：检查UUID格式
 */
const isValidUUID = (value) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(value)
}

/**
 * 自定义验证器：检查权限代码格式
 */
const isValidPermissionCode = (value) => {
  if (!value) return false
  
  const parts = value.split(':')
  if (parts.length < 2 || parts.length > 4) {
    return false
  }
  
  const validPart = /^[a-zA-Z0-9_*]+$/
  return parts.every(part => validPart.test(part))
}

/**
 * 自定义验证器：检查组织/部门编码格式
 */
const isValidCode = (value) => {
  if (!value || value.length < 2 || value.length > 20) {
    return false
  }
  
  const codeRegex = /^[a-zA-Z0-9-]+$/
  return codeRegex.test(value)
}

/**
 * 自定义验证器：检查密码强度
 */
const isStrongPassword = (value) => {
  if (!value || value.length < 8) {
    return false
  }
  
  // 检查是否包含字母
  const hasLetter = /[a-zA-Z]/.test(value)
  // 检查是否包含数字
  const hasNumber = /\d/.test(value)
  
  return hasLetter && hasNumber
}

/**
 * 数组验证：检查数组中的所有元素是否为有效UUID
 */
const isUUIDArray = (arr) => {
  if (!Array.isArray(arr)) return false
  return arr.every(item => isValidUUID(item))
}

/**
 * 数组验证：检查数组中的所有元素是否为有效权限代码
 */
const isPermissionCodeArray = (arr) => {
  if (!Array.isArray(arr)) return false
  return arr.every(item => isValidPermissionCode(item))
}

/**
 * 日期范围验证
 */
const isValidDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return true // 可选参数
  
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return false
  }
  
  return start <= end
}

/**
 * 枚举值验证
 */
const isInEnum = (value, enumValues) => {
  return enumValues.includes(value)
}

/**
 * 文件类型验证
 */
const isValidFileType = (mimetype, allowedTypes) => {
  return allowedTypes.includes(mimetype)
}

/**
 * 文件大小验证
 */
const isValidFileSize = (size, maxSize) => {
  return size <= maxSize
}

module.exports = {
  validateRequest,
  isValidUUID,
  isValidPermissionCode,
  isValidCode,
  isStrongPassword,
  isUUIDArray,
  isPermissionCodeArray,
  isValidDateRange,
  isInEnum,
  isValidFileType,
  isValidFileSize
}