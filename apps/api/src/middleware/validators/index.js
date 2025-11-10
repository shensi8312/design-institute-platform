const Joi = require('joi')

/**
 * 通用验证中间件工厂
 * @param {Joi.Schema} schema - Joi验证模式
 * @param {string} property - 要验证的属性 ('body', 'query', 'params')
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // 返回所有错误，不是第一个就停止
      stripUnknown: true // 移除未知字段
    })

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))

      return res.status(400).json({
        success: false,
        message: '数据验证失败',
        errors
      })
    }

    // 用验证后的值替换原始值（会移除未知字段，转换类型等）
    req[property] = value
    next()
  }
}

/**
 * 通用的分页参数验证
 */
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(10),
  orderBy: Joi.string(),
  order: Joi.string().valid('asc', 'desc').default('desc'),
  search: Joi.string().allow('').optional()
})

/**
 * ID参数验证
 */
const idParamSchema = Joi.object({
  id: Joi.string().required()
})

/**
 * 批量ID验证
 */
const batchIdsSchema = Joi.object({
  ids: Joi.array().items(Joi.string()).min(1).required()
})

module.exports = {
  validate,
  paginationSchema,
  idParamSchema,
  batchIdsSchema
}