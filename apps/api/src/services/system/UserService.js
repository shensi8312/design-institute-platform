const BaseService = require('../BaseService')
const UserRepository = require('../../repositories/UserRepository')
const bcrypt = require('bcryptjs')

/**
 * 用户Service
 */
class UserService extends BaseService {
  constructor() {
    const repository = new UserRepository()
    super(repository)
    this.userRepository = repository
  }

  /**
   * 获取用户列表（包含关联信息）
   */
  async getList(params = {}) {
    try {
      const {
        page = 1,
        pageSize = 10,
        search,
        departmentId,
        organizationId,
        roleId,
        status,
        orderBy = 'created_at',
        order = 'desc'
      } = params

      // 构建查询条件
      const conditions = {}
      if (status) conditions['users.status'] = status
      if (departmentId) conditions['users.department_id'] = departmentId
      if (organizationId) conditions['users.organization_id'] = organizationId
      if (roleId) conditions['users.role_id'] = roleId

      // 如果有搜索关键词
      if (search) {
        const users = await this.userRepository.searchUsers(search, conditions)
        return {
          success: true,
          data: {
            list: users,
            total: users.length
          }
        }
      }

      // 获取总数
      const total = await this.userRepository.count(conditions)

      // 获取分页数据
      const offset = (page - 1) * pageSize
      const users = await this.userRepository.findAllWithRelations(
        conditions,
        { orderBy, order, limit: pageSize, offset }
      )

      return {
        success: true,
        data: {
          list: users,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        }
      }
    } catch (error) {
      console.error('获取用户列表失败:', error)
      return {
        success: false,
        message: '获取用户列表失败',
        error: error.message
      }
    }
  }

  /**
   * 获取用户详情
   */
  async getById(userId) {
    try {
      const user = await this.userRepository.findByIdWithRelations(userId)
      
      if (!user) {
        return {
          success: false,
          message: '用户不存在'
        }
      }

      // 移除密码字段
      delete user.password

      return {
        success: true,
        data: user
      }
    } catch (error) {
      console.error('获取用户详情失败:', error)
      return {
        success: false,
        message: '获取用户详情失败',
        error: error.message
      }
    }
  }

  /**
   * 创建用户前的验证
   */
  async validateCreate(data) {
    // 验证必填字段
    if (!data.username || !data.password) {
      return {
        success: false,
        message: '用户名和密码不能为空'
      }
    }

    // 检查用户名是否已存在
    const existingUser = await this.userRepository.findByUsername(data.username)
    if (existingUser) {
      return {
        success: false,
        message: '用户名已存在'
      }
    }

    // 检查邮箱是否已存在
    if (data.email) {
      const existingEmail = await this.userRepository.findByEmail(data.email)
      if (existingEmail) {
        return {
          success: false,
          message: '邮箱已被使用'
        }
      }
    }

    return { success: true }
  }

  /**
   * 创建用户前的数据处理
   */
  async beforeCreate(data) {
    // 生成用户ID
    data.id = data.id || `user_${Date.now()}`

    // 加密密码并转换字段名
    if (data.password) {
      data.password_hash = await bcrypt.hash(data.password, 10)
      delete data.password  // 删除password字段，使用password_hash
    }

    // 设置默认值
    data.status = data.status || 'active'
    data.is_admin = data.is_admin || false

    return data
  }

  /**
   * 创建用户后的处理
   */
  async afterCreate(user) {
    // 如果有部门ID数组，设置用户部门关系
    if (user.departmentIds && Array.isArray(user.departmentIds)) {
      await this.userRepository.setUserDepartments(
        user.id,
        user.departmentIds,
        user.department_id
      )
    }
  }

  /**
   * 创建用户（重写以支持多部门）
   */
  async create(data) {
    try {
      // 提取部门ID数组
      const { departmentIds, ...userData } = data

      // 验证
      const validation = await this.validateCreate(userData)
      if (!validation.success) {
        return validation
      }

      // 处理数据
      const processedData = await this.beforeCreate(userData)

      // 使用事务创建用户和部门关系
      const result = await this.userRepository.transaction(async (trx) => {
        // 创建用户
        const [user] = await trx('users')
          .insert(processedData)
          .returning('*')

        // 设置部门关系
        if (departmentIds && departmentIds.length > 0) {
          const userDepartments = departmentIds.map((deptId, index) => ({
            user_id: user.id,
            department_id: deptId,
            is_primary: index === 0 || deptId === userData.department_id,
            created_at: new Date()
          }))

          await trx('user_departments').insert(userDepartments)
        }

        return user
      })

      // 移除密码字段
      delete result.password_hash

      return {
        success: true,
        message: '用户创建成功',
        data: result
      }
    } catch (error) {
      console.error('创建用户失败:', error)
      return {
        success: false,
        message: '创建用户失败',
        error: error.message
      }
    }
  }

  /**
   * 更新用户前的验证
   */
  async validateUpdate(userId, data) {
    // 如果要更新用户名，检查是否重复
    if (data.username) {
      const existingUser = await this.userRepository.findByUsername(data.username)
      if (existingUser && existingUser.id !== userId) {
        return {
          success: false,
          message: '用户名已存在'
        }
      }
    }

    // 如果要更新邮箱，检查是否重复
    if (data.email) {
      const existingEmail = await this.userRepository.findByEmail(data.email)
      if (existingEmail && existingEmail.id !== userId) {
        return {
          success: false,
          message: '邮箱已被使用'
        }
      }
    }

    return { success: true }
  }

  /**
   * 更新用户前的数据处理
   */
  async beforeUpdate(userId, data) {
    // 如果要更新密码，需要加密并转换字段名
    if (data.password) {
      data.password_hash = await bcrypt.hash(data.password, 10)
      delete data.password  // 删除password字段，使用password_hash
    }

    // 移除不应该更新的字段
    delete data.id
    delete data.created_at

    return data
  }

  /**
   * 更新用户（重写以支持多部门）
   */
  async update(userId, data) {
    try {
      // 提取部门ID数组
      const { departmentIds, ...userData } = data

      // 基础更新
      const result = await super.update(userId, userData)

      // 如果需要更新部门关系
      if (departmentIds !== undefined) {
        await this.userRepository.setUserDepartments(
          userId,
          departmentIds,
          userData.department_id || departmentIds[0]
        )
      }

      return result
    } catch (error) {
      console.error('更新用户失败:', error)
      return {
        success: false,
        message: '更新用户失败',
        error: error.message
      }
    }
  }

  /**
   * 删除用户前的检查
   */
  async canDelete(userId, user) {
    // 检查是否是管理员
    if (user.is_admin) {
      // 检查是否是最后一个管理员
      const adminCount = await this.userRepository.count({ is_admin: true })
      if (adminCount <= 1) {
        return {
          success: false,
          message: '不能删除最后一个管理员'
        }
      }
    }

    return { success: true }
  }

  /**
   * 重置密码
   */
  async resetPassword(userId, newPassword) {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10)
      await this.userRepository.updatePassword(userId, hashedPassword)

      return {
        success: true,
        message: '密码重置成功'
      }
    } catch (error) {
      console.error('重置密码失败:', error)
      return {
        success: false,
        message: '重置密码失败',
        error: error.message
      }
    }
  }

  /**
   * 修改密码
   */
  async changePassword(userId, oldPassword, newPassword) {
    try {
      const user = await this.userRepository.findById(userId)
      
      if (!user) {
        return {
          success: false,
          message: '用户不存在'
        }
      }

      // 验证旧密码
      const isValid = await bcrypt.compare(oldPassword, user.password_hash)
      if (!isValid) {
        return {
          success: false,
          message: '原密码错误'
        }
      }

      // 更新密码
      return await this.resetPassword(userId, newPassword)
    } catch (error) {
      console.error('修改密码失败:', error)
      return {
        success: false,
        message: '修改密码失败',
        error: error.message
      }
    }
  }

  /**
   * 批量更新用户状态
   */
  async updateStatus(userIds, status) {
    try {
      await this.userRepository.updateStatus(userIds, status)
      
      return {
        success: true,
        message: `成功更新${userIds.length}个用户的状态`
      }
    } catch (error) {
      console.error('批量更新状态失败:', error)
      return {
        success: false,
        message: '批量更新状态失败',
        error: error.message
      }
    }
  }

  /**
   * 分配角色
   */
  async assignRole(userId, roleId) {
    try {
      await this.userRepository.update(userId, { role_id: roleId })
      
      return {
        success: true,
        message: '角色分配成功'
      }
    } catch (error) {
      console.error('分配角色失败:', error)
      return {
        success: false,
        message: '分配角色失败',
        error: error.message
      }
    }
  }

  /**
   * 登录验证
   */
  async login(identifier, password) {
    try {
      // 支持用户名或邮箱登录
      let user = await this.userRepository.findByUsername(identifier)
      if (!user) {
        user = await this.userRepository.findByEmail(identifier)
      }
      
      if (!user) {
        return {
          success: false,
          message: '用户名或密码错误'
        }
      }

      // 检查用户状态
      if (user.status !== 'active') {
        return {
          success: false,
          message: '用户已被禁用'
        }
      }

      // 验证密码
      const isValid = await bcrypt.compare(password, user.password_hash)
      if (!isValid) {
        return {
          success: false,
          message: '用户名或密码错误'
        }
      }

      // 更新最后登录时间
      await this.userRepository.updateLastLogin(user.id)

      // 获取用户详细信息
      const userInfo = await this.userRepository.findByIdWithRelations(user.id)
      
      // 移除密码字段
      delete userInfo.password_hash

      return {
        success: true,
        data: userInfo
      }
    } catch (error) {
      console.error('登录失败:', error)
      return {
        success: false,
        message: '登录失败',
        error: error.message
      }
    }
  }
}

module.exports = UserService
