const express = require('express')
const AuthController = require('../controllers/AuthController')
const { authenticate } = require('../middleware/auth')
const { validateRequest } = require('../middleware/validation')
const { body } = require('express-validator')

const router = express.Router()

/**
 * 登录验证规则
 */
const loginValidation = [
  body('username')
    .notEmpty()
    .withMessage('用户名不能为空')
    .isLength({ min: 3, max: 50 })
    .withMessage('用户名长度应在3-50个字符之间'),
    
  body('password')
    .notEmpty()
    .withMessage('密码不能为空')
    .isLength({ min: 6 })
    .withMessage('密码至少6位'),
    
  body('organizationCode')
    .optional()
    .isLength({ min: 2, max: 20 })
    .withMessage('组织编码长度应在2-20个字符之间')
]

/**
 * 注册验证规则
 */
const registerValidation = [
  body('username')
    .notEmpty()
    .withMessage('用户名不能为空')
    .isLength({ min: 3, max: 50 })
    .withMessage('用户名长度应在3-50个字符之间'),
    
  body('password')
    .notEmpty()
    .withMessage('密码不能为空')
    .isLength({ min: 6 })
    .withMessage('密码至少6位'),
    
  body('name')
    .notEmpty()
    .withMessage('姓名不能为空')
    .isLength({ min: 2, max: 50 })
    .withMessage('姓名长度应在2-50个字符之间'),
    
  body('email')
    .optional()
    .isEmail()
    .withMessage('邮箱格式不正确'),
    
  body('phone')
    .optional()
    .matches(/^1[3-9]\d{9}$/)
    .withMessage('手机号格式不正确')
]

/**
 * 修改密码验证规则
 */
const changePasswordValidation = [
  body('oldPassword')
    .notEmpty()
    .withMessage('旧密码不能为空'),
    
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('新密码至少8位')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
    .withMessage('新密码必须包含字母和数字')
]

/**
 * 更新资料验证规则
 */
const updateProfileValidation = [
  body('realName')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('真实姓名长度应在2-50个字符之间'),
    
  body('phone')
    .optional()
    .matches(/^1[3-9]\d{9}$/)
    .withMessage('手机号格式不正确'),
    
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('个人简介不能超过500个字符')
]

// 用户注册
router.post('/register', registerValidation, validateRequest, AuthController.register)

// 用户登录
router.post('/login', loginValidation, validateRequest, AuthController.login)

// 刷新令牌
router.post('/refresh', AuthController.refreshToken)

// 用户登出
router.post('/logout', authenticate, AuthController.logout)

// 获取当前用户信息
router.get('/me', authenticate, AuthController.getCurrentUser)

// 修改密码
router.put('/password', authenticate, changePasswordValidation, validateRequest, AuthController.changePassword)

// 更新个人资料
router.put('/profile', authenticate, updateProfileValidation, validateRequest, AuthController.updateProfile)

module.exports = router