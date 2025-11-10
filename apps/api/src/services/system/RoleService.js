const BaseService = require('../BaseService')
const RoleRepository = require('../../repositories/RoleRepository')

/**
 * 角色Service
 */
class RoleService extends BaseService {
  constructor() {
    const repository = new RoleRepository()
    super(repository)
    this.roleRepository = repository
  }

  /**
   * 获取角色列表（包含用户数统计）
   */
  async getList(params = {}) {
    try {
      const {
        search,
        status = 'active',
        page = 1,
        pageSize = 10
      } = params

      // 构建查询条件
      const conditions = {}
      if (status) conditions.status = status

      // 搜索
      if (search) {
        const roles = await this.roleRepository.search(
          search,
          ['name', 'code', 'description'],
          conditions
        )
        
        // 添加用户数统计
        const rolesWithStats = await Promise.all(
          roles.map(async (role) => {
            const hasUsers = await this.roleRepository.hasUsers(role.id)
            return {
              ...role,
              user_count: hasUsers ? 1 : 0 // 这里简化了，实际应该获取准确数量
            }
          })
        )
        
        return {
          success: true,
          data: {
            list: rolesWithStats,
            total: rolesWithStats.length
          }
        }
      }

      // 获取带统计信息的角色列表
      const roles = await this.roleRepository.findAllWithStats(conditions)
      
      // 分页处理
      const offset = (page - 1) * pageSize
      const paginatedRoles = roles.slice(offset, offset + pageSize)
      
      return {
        success: true,
        data: {
          list: paginatedRoles,
          pagination: {
            page,
            pageSize,
            total: roles.length,
            totalPages: Math.ceil(roles.length / pageSize)
          }
        }
      }
    } catch (error) {
      console.error('获取角色列表失败:', error)
      return {
        success: false,
        message: '获取角色列表失败',
        error: error.message
      }
    }
  }

  /**
   * 创建角色前的验证
   */
  async validateCreate(data) {
    // 验证必填字段
    if (!data.code || !data.name) {
      return {
        success: false,
        message: '角色编码和名称不能为空'
      }
    }

    // 检查编码是否重复
    const existing = await this.roleRepository.findByCode(data.code)
    if (existing) {
      return {
        success: false,
        message: '角色编码已存在'
      }
    }

    return { success: true }
  }

  /**
   * 创建角色前的数据处理
   */
  async beforeCreate(data) {
    // 生成角色ID
    data.id = data.id || `role_${Date.now()}`
    
    // 处理权限数组
    if (data.permissions && Array.isArray(data.permissions)) {
      data.permissions = JSON.stringify(data.permissions)
    } else {
      data.permissions = JSON.stringify([])
    }

    // 设置默认值
    data.status = data.status || 'active'

    return data
  }

  /**
   * 更新角色前的验证
   */
  async validateUpdate(roleId, data) {
    // 如果要更新编码，检查是否重复
    if (data.code) {
      const existing = await this.roleRepository.findByCode(data.code)
      if (existing && existing.id !== roleId) {
        return {
          success: false,
          message: '角色编码已存在'
        }
      }
    }

    return { success: true }
  }

  /**
   * 更新角色前的数据处理
   */
  async beforeUpdate(roleId, data) {
    // 处理权限数组
    if (data.permissions && Array.isArray(data.permissions)) {
      data.permissions = JSON.stringify(data.permissions)
    }

    return data
  }

  /**
   * 删除角色前的检查
   */
  async canDelete(roleId, role) {
    // 检查是否有用户使用此角色
    if (await this.roleRepository.hasUsers(roleId)) {
      return {
        success: false,
        message: '该角色下还有用户，无法删除'
      }
    }

    // 检查是否是系统角色（不允许删除）
    if (role.code === 'admin' || role.code === 'super_admin') {
      return {
        success: false,
        message: '系统角色不能删除'
      }
    }

    return { success: true }
  }


  /**
   * 更新角色权限
   */
  async updatePermissions(roleId, permissions) {
    try {
      // 验证角色是否存在
      const role = await this.roleRepository.findById(roleId)
      if (!role) {
        return {
          success: false,
          message: '角色不存在'
        }
      }

      // 更新权限
      await this.roleRepository.updatePermissions(roleId, permissions)

      return {
        success: true,
        message: '权限更新成功'
      }
    } catch (error) {
      console.error('更新权限失败:', error)
      return {
        success: false,
        message: '更新权限失败',
        error: error.message
      }
    }
  }

  /**
   * 批量分配权限
   */
  async bulkAssignPermissions(roleIds, permissions) {
    try {
      await this.roleRepository.bulkAssignPermissions(roleIds, permissions)
      
      return {
        success: true,
        message: `成功为${roleIds.length}个角色分配权限`
      }
    } catch (error) {
      console.error('批量分配权限失败:', error)
      return {
        success: false,
        message: '批量分配权限失败',
        error: error.message
      }
    }
  }

  /**
   * 克隆角色
   */
  async clone(roleId, newCode, newName) {
    try {
      // 验证新编码是否已存在
      const existing = await this.roleRepository.findByCode(newCode)
      if (existing) {
        return {
          success: false,
          message: '角色编码已存在'
        }
      }

      // 执行克隆
      const newRole = await this.roleRepository.clone(roleId, newCode, newName)

      return {
        success: true,
        message: '角色克隆成功',
        data: newRole
      }
    } catch (error) {
      console.error('克隆角色失败:', error)
      return {
        success: false,
        message: '克隆角色失败',
        error: error.message
      }
    }
  }

  /**
   * 获取角色的用户列表
   */
  async getRoleUsers(roleId) {
    try {
      const users = await this.roleRepository.getUsers(roleId)
      
      return {
        success: true,
        data: users
      }
    } catch (error) {
      console.error('获取角色用户失败:', error)
      return {
        success: false,
        message: '获取角色用户失败',
        error: error.message
      }
    }
  }
}

module.exports = RoleService