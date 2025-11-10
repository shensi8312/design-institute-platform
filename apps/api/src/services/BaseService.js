/**
 * 基础Service类 - 提供通用的业务逻辑
 * 所有Service都应该继承此类
 */
class BaseService {
  constructor(repository) {
    if (!repository) {
      throw new Error('Service必须指定Repository')
    }
    this.repository = repository
  }

  /**
   * 获取列表
   * @param {Object} params - 查询参数
   */
  async getList(params = {}) {
    const {
      page = 1,
      pageSize = 10,
      search,
      searchFields = [],
      orderBy = 'created_at',
      order = 'desc',
      ...conditions
    } = params

    try {
      // 如果有搜索关键词
      if (search && searchFields.length > 0) {
        const data = await this.repository.search(search, searchFields, conditions)
        return {
          success: true,
          data: {
            list: data,
            total: data.length
          }
        }
      }

      // 如果需要分页
      if (page && pageSize) {
        const result = await this.repository.paginate(
          page,
          pageSize,
          conditions,
          { orderBy, order }
        )
        
        return {
          success: true,
          data: {
            list: result.data,
            pagination: result.pagination
          }
        }
      }

      // 普通查询
      const list = await this.repository.findAll(conditions, { orderBy, order })
      return {
        success: true,
        data: {
          list,
          total: list.length
        }
      }
    } catch (error) {
      console.error(`获取列表失败:`, error)
      return {
        success: false,
        message: '获取列表失败',
        error: error.message
      }
    }
  }

  /**
   * 获取详情
   * @param {string} id - 记录ID
   */
  async getById(id) {
    try {
      const data = await this.repository.findById(id)
      
      if (!data) {
        return {
          success: false,
          message: '记录不存在'
        }
      }

      return {
        success: true,
        data
      }
    } catch (error) {
      console.error(`获取详情失败:`, error)
      return {
        success: false,
        message: '获取详情失败',
        error: error.message
      }
    }
  }

  /**
   * 创建记录
   * @param {Object} data - 要创建的数据
   */
  async create(data) {
    try {
      // 验证必填字段（子类可覆盖）
      const validation = await this.validateCreate(data)
      if (!validation.success) {
        return validation
      }

      // 处理数据（子类可覆盖）
      const processedData = await this.beforeCreate(data)

      // 创建记录
      const result = await this.repository.create(processedData)

      // 创建后处理（子类可覆盖）
      await this.afterCreate(result)

      return {
        success: true,
        message: '创建成功',
        data: result
      }
    } catch (error) {
      console.error(`创建失败:`, error)
      return {
        success: false,
        message: '创建失败',
        error: error.message
      }
    }
  }

  /**
   * 更新记录
   * @param {string} id - 记录ID
   * @param {Object} data - 要更新的数据
   */
  async update(id, data) {
    try {
      // 检查记录是否存在
      const exists = await this.repository.exists({ id })
      if (!exists) {
        return {
          success: false,
          message: '记录不存在'
        }
      }

      // 验证更新数据（子类可覆盖）
      const validation = await this.validateUpdate(id, data)
      if (!validation.success) {
        return validation
      }

      // 处理数据（子类可覆盖）
      const processedData = await this.beforeUpdate(id, data)

      // 更新记录
      const result = await this.repository.update(id, processedData)

      // 更新后处理（子类可覆盖）
      await this.afterUpdate(result)

      return {
        success: true,
        message: '更新成功',
        data: result
      }
    } catch (error) {
      console.error(`更新失败:`, error)
      return {
        success: false,
        message: '更新失败',
        error: error.message
      }
    }
  }

  /**
   * 删除记录
   * @param {string} id - 记录ID
   * @param {boolean} soft - 是否软删除
   */
  async delete(id, soft = false) {
    try {
      // 检查记录是否存在
      const record = await this.repository.findById(id)
      if (!record) {
        return {
          success: false,
          message: '记录不存在'
        }
      }

      // 检查是否可以删除（子类可覆盖）
      const canDelete = await this.canDelete(id, record)
      if (!canDelete.success) {
        return canDelete
      }

      // 删除前处理（子类可覆盖）
      await this.beforeDelete(id, record)

      // 执行删除
      if (soft) {
        await this.repository.softDelete(id)
      } else {
        await this.repository.delete(id)
      }

      // 删除后处理（子类可覆盖）
      await this.afterDelete(id, record)

      return {
        success: true,
        message: '删除成功'
      }
    } catch (error) {
      console.error(`删除失败:`, error)
      return {
        success: false,
        message: '删除失败',
        error: error.message
      }
    }
  }

  /**
   * 批量删除
   * @param {Array} ids - ID数组
   * @param {boolean} soft - 是否软删除
   */
  async bulkDelete(ids, soft = false) {
    try {
      const results = await this.repository.transaction(async (_trx) => {
        const deleteResults = []
        for (const id of ids) {
          const result = await this.delete(id, soft)
          deleteResults.push({ id, ...result })
        }
        return deleteResults
      })

      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length

      return {
        success: failCount === 0,
        message: `成功删除${successCount}条，失败${failCount}条`,
        data: {
          successCount,
          failCount,
          results
        }
      }
    } catch (error) {
      console.error(`批量删除失败:`, error)
      return {
        success: false,
        message: '批量删除失败',
        error: error.message
      }
    }
  }

  /**
   * 批量创建
   * @param {Array} dataList - 数据数组
   */
  async bulkCreate(dataList) {
    try {
      // 验证所有数据
      for (const data of dataList) {
        const validation = await this.validateCreate(data)
        if (!validation.success) {
          return {
            success: false,
            message: `数据验证失败: ${validation.message}`,
            error: validation.error
          }
        }
      }

      // 处理所有数据
      const processedDataList = []
      for (const data of dataList) {
        const processed = await this.beforeCreate(data)
        processedDataList.push(processed)
      }

      // 批量创建
      const result = await this.repository.bulkCreate(processedDataList)

      return {
        success: true,
        message: `成功创建${dataList.length}条记录`,
        data: result
      }
    } catch (error) {
      console.error(`批量创建失败:`, error)
      return {
        success: false,
        message: '批量创建失败',
        error: error.message
      }
    }
  }

  /**
   * 批量更新
   * @param {Array} updates - [{id: 1, data: {...}}, ...]
   */
  async bulkUpdate(updates) {
    try {
      // 验证所有更新
      for (const { id, data } of updates) {
        const validation = await this.validateUpdate(id, data)
        if (!validation.success) {
          return {
            success: false,
            message: `数据验证失败: ${validation.message}`,
            error: validation.error
          }
        }
      }

      // 处理所有更新
      const processedUpdates = []
      for (const { id, data } of updates) {
        const processed = await this.beforeUpdate(id, data)
        processedUpdates.push({ id, data: processed })
      }

      // 批量更新
      const result = await this.repository.bulkUpdate(processedUpdates)

      return {
        success: true,
        message: `成功更新${updates.length}条记录`,
        data: result
      }
    } catch (error) {
      console.error(`批量更新失败:`, error)
      return {
        success: false,
        message: '批量更新失败',
        error: error.message
      }
    }
  }

  // ============ 钩子方法（子类可重写） ============

  /**
   * 创建前的数据验证
   * @param {Object} data - 要创建的数据
   */
  async validateCreate(_data) {
    return { success: true }
  }

  /**
   * 更新前的数据验证
   * @param {string} id - 记录ID
   * @param {Object} data - 要更新的数据
   */
  async validateUpdate(_id, _data) {
    return { success: true }
  }

  /**
   * 创建前的数据处理
   * @param {Object} data - 要创建的数据
   */
  async beforeCreate(data) {
    return data
  }

  /**
   * 更新前的数据处理
   * @param {string} id - 记录ID
   * @param {Object} data - 要更新的数据
   */
  async beforeUpdate(_id, data) {
    return data
  }

  /**
   * 删除前的检查
   * @param {string} id - 记录ID
   * @param {Object} record - 记录数据
   */
  async canDelete(_id, _record) {
    return { success: true }
  }

  /**
   * 删除前的处理
   * @param {string} id - 记录ID
   * @param {Object} record - 记录数据
   */
  async beforeDelete(_id, _record) {
    // 子类可重写
  }

  /**
   * 创建后的处理
   * @param {Object} result - 创建的记录
   */
  async afterCreate(_result) {
    // 子类可重写
  }

  /**
   * 更新后的处理
   * @param {Object} result - 更新后的记录
   */
  async afterUpdate(_result) {
    // 子类可重写
  }

  /**
   * 删除后的处理
   * @param {string} id - 记录ID
   * @param {Object} record - 原记录数据
   */
  async afterDelete(_id, _record) {
    // 子类可重写
  }

  /**
   * 执行事务
   * @param {Function} callback - 事务回调
   */
  async transaction(callback) {
    return await this.repository.transaction(callback)
  }
}

module.exports = BaseService
