const Joi = require('joi')
const { validate } = require('./index')

/**
 * 用户数据验证规则
 */

// 创建用户验证
const createUserSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': '用户名只能包含字母和数字',
      'string.min': '用户名至少3个字符',
      'string.max': '用户名最多30个字符',
      'any.required': '用户名不能为空'
    }),
  
  password: Joi.string()
    .min(6)
    .max(100)
    .required()
    .messages({
      'string.min': '密码至少6个字符',
      'any.required': '密码不能为空'
    }),
  
  name: Joi.string()
    .min(2)
    .max(50)
    .optional()
    .messages({
      'string.min': '姓名至少2个字符',
      'string.max': '姓名最多50个字符'
    }),
  
  email: Joi.string()
    .email()
    .optional()
    .messages({
      'string.email': '邮箱格式不正确'
    }),
  
  phone: Joi.string()
    .pattern(/^1[3-9]\d{9}$/)
    .optional()
    .messages({
      'string.pattern.base': '手机号格式不正确'
    }),
  
  role_id: Joi.string().optional(),
  department_id: Joi.string().optional(),
  departmentIds: Joi.array().items(Joi.string()).optional(),
  organization_id: Joi.string().optional(),
  is_admin: Joi.boolean().default(false),
  status: Joi.string().valid('active', 'inactive').default('active')
})

// 更新用户验证
const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string().pattern(/^1[3-9]\d{9}$/).optional(),
  role_id: Joi.string().optional(),
  department_id: Joi.string().optional(),
  departmentIds: Joi.array().items(Joi.string()).optional(),
  organization_id: Joi.string().optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  is_admin: Joi.boolean().optional()
})

// 登录验证
const loginSchema = Joi.object({
  username: Joi.string().required().messages({
    'any.required': '用户名不能为空'
  }),
  password: Joi.string().required().messages({
    'any.required': '密码不能为空'
  })
})

// 修改密码验证
const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required().messages({
    'any.required': '原密码不能为空'
  }),
  newPassword: Joi.string().min(6).required().messages({
    'string.min': '新密码至少6个字符',
    'any.required': '新密码不能为空'
  })
})

// 重置密码验证
const resetPasswordSchema = Joi.object({
  password: Joi.string().min(6).required().messages({
    'string.min': '密码至少6个字符',
    'any.required': '密码不能为空'
  })
})

// 批量更新状态验证
const updateStatusSchema = Joi.object({
  ids: Joi.array().items(Joi.string()).min(1).required().messages({
    'array.min': '至少选择一个用户',
    'any.required': '用户ID列表不能为空'
  }),
  status: Joi.string().valid('active', 'inactive').required().messages({
    'any.required': '状态不能为空',
    'any.only': '状态只能是active或inactive'
  })
})

module.exports = {
  validateCreateUser: validate(createUserSchema),
  validateUpdateUser: validate(updateUserSchema),
  validateLogin: validate(loginSchema),
  validateChangePassword: validate(changePasswordSchema),
  validateResetPassword: validate(resetPasswordSchema),
  validateUpdateStatus: validate(updateStatusSchema)
}