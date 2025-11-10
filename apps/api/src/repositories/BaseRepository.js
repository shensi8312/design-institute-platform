const db = require('../config/database')

/**
 * 基础Repository类 - 提供通用的CRUD操作
 * 所有Repository都应该继承此类
 */
class BaseRepository {
  constructor(tableName) {
    if (!tableName) {
      throw new Error('Repository必须指定表名')
    }
    this.tableName = tableName
    this.db = db
  }

  /**
   * 查询所有记录
   * @param {Object} conditions - 查询条件
   * @param {Object} options - 查询选项 (orderBy, limit, offset, select)
   */
  async findAll(conditions = {}, options = {}) {
    let query = this.db(this.tableName)
    
    // 选择字段
    if (options.select) {
      query = query.select(options.select)
    } else {
      query = query.select('*')
    }
    
    // 应用查询条件
    if (Object.keys(conditions).length > 0) {
      query = query.where(conditions)
    }
    
    // 排序
    if (options.orderBy) {
      const order = options.order || 'asc'
      query = query.orderBy(options.orderBy, order)
    }
    
    // 分页
    if (options.limit) {
      query = query.limit(options.limit)
    }
    
    if (options.offset) {
      query = query.offset(options.offset)
    }
    
    return await query
  }

  /**
   * 根据ID查询单条记录
   * @param {string|number} id - 记录ID
   * @param {Array} select - 选择的字段
   */
  async findById(id, select = ['*']) {
    return await this.db(this.tableName)
      .select(select)
      .where('id', id)
      .first()
  }

  /**
   * 根据条件查询单条记录
   * @param {Object} conditions - 查询条件
   * @param {Array} select - 选择的字段
   */
  async findOne(conditions, select = ['*']) {
    return await this.db(this.tableName)
      .select(select)
      .where(conditions)
      .first()
  }

  /**
   * 创建记录
   * @param {Object} data - 要创建的数据
   * @param {boolean} returning - 是否返回创建的记录
   */
  async create(data, returning = true) {
    // 添加时间戳
    const timestamp = new Date()
    data.created_at = data.created_at || timestamp
    data.updated_at = data.updated_at || timestamp
    
    if (returning) {
      const [result] = await this.db(this.tableName)
        .insert(data)
        .returning('*')
      return result
    } else {
      await this.db(this.tableName).insert(data)
      return { success: true }
    }
  }

  /**
   * 批量创建记录
   * @param {Array} dataList - 要创建的数据数组
   * @param {boolean} returning - 是否返回创建的记录
   */
  async bulkCreate(dataList, returning = false) {
    const timestamp = new Date()
    const dataWithTimestamp = dataList.map(data => ({
      ...data,
      created_at: data.created_at || timestamp,
      updated_at: data.updated_at || timestamp
    }))
    
    if (returning) {
      return await this.db(this.tableName)
        .insert(dataWithTimestamp)
        .returning('*')
    } else {
      await this.db(this.tableName).insert(dataWithTimestamp)
      return { success: true, count: dataList.length }
    }
  }

  /**
   * 更新记录
   * @param {string|number} id - 记录ID
   * @param {Object} data - 要更新的数据
   * @param {boolean} returning - 是否返回更新后的记录
   */
  async update(id, data, returning = true) {
    // 添加更新时间戳
    data.updated_at = new Date()
    
    // 移除不应该更新的字段
    delete data.id
    delete data.created_at
    
    if (returning) {
      const [result] = await this.db(this.tableName)
        .where('id', id)
        .update(data)
        .returning('*')
      return result
    } else {
      const count = await this.db(this.tableName)
        .where('id', id)
        .update(data)
      return { success: count > 0, count }
    }
  }

  /**
   * 根据条件更新记录
   * @param {Object} conditions - 查询条件
   * @param {Object} data - 要更新的数据
   * @param {boolean} returning - 是否返回更新后的记录
   */
  async updateWhere(conditions, data, returning = false) {
    data.updated_at = new Date()
    delete data.id
    delete data.created_at
    
    if (returning) {
      return await this.db(this.tableName)
        .where(conditions)
        .update(data)
        .returning('*')
    } else {
      const count = await this.db(this.tableName)
        .where(conditions)
        .update(data)
      return { success: count > 0, count }
    }
  }

  /**
   * 删除记录（物理删除）
   * @param {string|number} id - 记录ID
   */
  async delete(id) {
    const count = await this.db(this.tableName)
      .where('id', id)
      .delete()
    return { success: count > 0, count }
  }

  /**
   * 软删除记录
   * @param {string|number} id - 记录ID
   */
  async softDelete(id) {
    return await this.update(id, { 
      status: 'deleted',
      deleted_at: new Date()
    }, false)
  }

  /**
   * 根据条件删除记录
   * @param {Object} conditions - 查询条件
   */
  async deleteWhere(conditions) {
    const count = await this.db(this.tableName)
      .where(conditions)
      .delete()
    return { success: count > 0, count }
  }

  /**
   * 统计记录数量
   * @param {Object} conditions - 查询条件
   */
  async count(conditions = {}) {
    const query = this.db(this.tableName).count('* as total')
    
    if (Object.keys(conditions).length > 0) {
      query.where(conditions)
    }
    
    const result = await query.first()
    return parseInt(result.total)
  }

  /**
   * 检查记录是否存在
   * @param {Object} conditions - 查询条件
   */
  async exists(conditions) {
    const count = await this.count(conditions)
    return count > 0
  }

  /**
   * 开启事务
   * @param {Function} callback - 事务回调函数
   */
  async transaction(callback) {
    return await this.db.transaction(callback)
  }

  /**
   * 执行原始SQL查询
   * @param {string} sql - SQL语句
   * @param {Array} params - 参数
   */
  async raw(sql, params = []) {
    return await this.db.raw(sql, params)
  }

  /**
   * 分页查询
   * @param {number} page - 页码（从1开始）
   * @param {number} pageSize - 每页数量
   * @param {Object} conditions - 查询条件
   * @param {Object} options - 查询选项
   */
  async paginate(page = 1, pageSize = 10, conditions = {}, options = {}) {
    const offset = (page - 1) * pageSize
    
    // 获取总数
    const total = await this.count(conditions)
    
    // 获取数据
    const data = await this.findAll(conditions, {
      ...options,
      limit: pageSize,
      offset
    })
    
    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  }

  /**
   * 批量更新（根据ID）
   * @param {Array} updates - [{id: 1, data: {...}}, ...]
   */
  async bulkUpdate(updates) {
    return await this.transaction(async (trx) => {
      const results = []
      for (const { id, data } of updates) {
        data.updated_at = new Date()
        delete data.id
        delete data.created_at
        
        const [result] = await trx(this.tableName)
          .where('id', id)
          .update(data)
          .returning('*')
        results.push(result)
      }
      return results
    })
  }

  /**
   * 搜索（模糊查询）
   * @param {string} keyword - 搜索关键词
   * @param {Array} searchFields - 搜索字段
   * @param {Object} additionalConditions - 额外条件
   */
  async search(keyword, searchFields = [], additionalConditions = {}) {
    let query = this.db(this.tableName)
    
    // 应用额外条件
    if (Object.keys(additionalConditions).length > 0) {
      query = query.where(additionalConditions)
    }
    
    // 应用搜索条件
    if (keyword && searchFields.length > 0) {
      query = query.where(function() {
        searchFields.forEach((field, index) => {
          if (index === 0) {
            this.where(field, 'ilike', `%${keyword}%`)
          } else {
            this.orWhere(field, 'ilike', `%${keyword}%`)
          }
        })
      })
    }
    
    return await query
  }
}

module.exports = BaseRepository