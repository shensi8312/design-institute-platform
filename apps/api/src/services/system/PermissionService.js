const BaseService = require('../BaseService')
const PermissionRepository = require('../../repositories/PermissionRepository')

/**
 * 权限Service
 */
class PermissionService extends BaseService {
  constructor() {
    const repository = new PermissionRepository()
    super(repository)
    this.permissionRepository = repository
  }

  /**
   * 获取权限列表
   */
  async getList(params = {}) {
    try {
      const {
        page = 1,
        pageSize = 20,
        search,
        module,
        type,
        status,
        orderBy = 'created_at',
        order = 'desc'
      } = params

      // 构建查询条件
      const conditions = {}
      if (status) conditions.status = status
      if (module) conditions.module = module
      if (type) conditions.type = type

      // 如果有搜索关键词
      if (search) {
        const permissions = await this.permissionRepository.search(
          search,
          ['name', 'code', 'description'],
          conditions
        )
        return {
          success: true,
          data: {
            list: permissions,
            total: permissions.length
          }
        }
      }

      // 获取总数
      const total = await this.permissionRepository.count(conditions)

      // 获取分页数据
      const offset = (page - 1) * pageSize
      const permissions = await this.permissionRepository.findAll(conditions, {
        orderBy,
        order,
        limit: pageSize,
        offset
      })

      return {
        success: true,
        data: {
          list: permissions,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        }
      }
    } catch (error) {
      console.error('获取权限列表失败:', error)
      return {
        success: false,
        message: '获取权限列表失败',
        error: error.message
      }
    }
  }

  /**
   * 获取权限树（按模块分组）
   */
  async getPermissionTree() {
    try {
      const permissions = await this.permissionRepository.findAll(
        { status: 'active' },
        { orderBy: 'module, sort_order' }
      )

      // 按模块分组
      const tree = {}
      permissions.forEach(perm => {
        const module = perm.module || '其他'
        if (!tree[module]) {
          tree[module] = {
            module,
            name: this.getModuleName(module),
            permissions: []
          }
        }
        tree[module].permissions.push(perm)
      })

      // 转换为数组
      const result = Object.values(tree)

      return {
        success: true,
        data: result
      }
    } catch (error) {
      console.error('获取权限树失败:', error)
      return {
        success: false,
        message: '获取权限树失败',
        error: error.message
      }
    }
  }

  /**
   * 获取模块名称
   */
  getModuleName(module) {
    const moduleNames = {
      user: '用户管理',
      role: '角色管理',
      menu: '菜单管理',
      permission: '权限管理',
      department: '部门管理',
      organization: '组织管理',
      project: '项目管理',
      knowledge: '知识库',
      chat: '对话管理',
      workflow: '工作流',
      audit: '审计日志',
      system: '系统设置'
    }
    return moduleNames[module] || module
  }

  /**
   * 获取用户权限
   */
  async getUserPermissions(userId) {
    try {
      const permissions = await this.permissionRepository.getUserPermissions(userId)

      return {
        success: true,
        data: permissions
      }
    } catch (error) {
      console.error('获取用户权限失败:', error)
      return {
        success: false,
        message: '获取用户权限失败',
        error: error.message
      }
    }
  }

  /**
   * 获取角色权限
   */
  async getRolePermissions(roleId) {
    try {
      const permissions = await this.permissionRepository.getRolePermissions(roleId)

      return {
        success: true,
        data: permissions
      }
    } catch (error) {
      console.error('获取角色权限失败:', error)
      return {
        success: false,
        message: '获取角色权限失败',
        error: error.message
      }
    }
  }

  /**
   * 创建权限前的验证
   */
  async validateCreate(data) {
    // 验证必填字段
    if (!data.name || !data.code) {
      return {
        success: false,
        message: '权限名称和代码不能为空'
      }
    }

    // 检查代码是否已存在
    const existingPermission = await this.permissionRepository.findOne({ code: data.code })
    if (existingPermission) {
      return {
        success: false,
        message: '权限代码已存在'
      }
    }

    // 验证权限代码格式（模块.操作）
    if (!data.code.includes('.')) {
      return {
        success: false,
        message: '权限代码格式错误，应为"模块.操作"格式'
      }
    }

    return { success: true }
  }

  /**
   * 创建权限前的数据处理
   */
  async beforeCreate(data) {
    // 生成权限ID
    data.id = data.id || `perm_${Date.now()}`

    // 从代码中提取模块和操作
    const [module, action] = data.code.split('.')
    data.module = data.module || module
    data.action = data.action || action

    // 设置默认值
    data.type = data.type || 'operation'
    data.status = data.status || 'active'
    data.sort_order = data.sort_order || 999

    return data
  }

  /**
   * 更新权限前的验证
   */
  async validateUpdate(permissionId, data) {
    // 如果要更新代码，检查是否重复
    if (data.code) {
      const existingPermission = await this.permissionRepository.findOne({ code: data.code })
      if (existingPermission && existingPermission.id !== permissionId) {
        return {
          success: false,
          message: '权限代码已存在'
        }
      }

      // 验证权限代码格式
      if (!data.code.includes('.')) {
        return {
          success: false,
          message: '权限代码格式错误，应为"模块.操作"格式'
        }
      }
    }

    return { success: true }
  }

  /**
   * 更新权限前的数据处理
   */
  async beforeUpdate(permissionId, data) {
    // 如果更新了代码，重新提取模块和操作
    if (data.code) {
      const [module, action] = data.code.split('.')
      data.module = module
      data.action = action
    }

    // 移除不应该更新的字段
    delete data.id
    delete data.created_at

    return data
  }

  /**
   * 删除权限前的检查
   */
  async canDelete(permissionId, permission) {
    // 检查是否有角色在使用此权限
    const roles = await this.permissionRepository.db('roles')
      .whereRaw('permissions::jsonb @> ?', [JSON.stringify([permission.code])])

    if (roles.length > 0) {
      return {
        success: false,
        message: `有${roles.length}个角色正在使用此权限，无法删除`
      }
    }

    return { success: true }
  }

  /**
   * 批量创建权限
   */
  async batchCreate(permissions) {
    try {
      const results = []
      const errors = []

      for (const perm of permissions) {
        const result = await this.create(perm)
        if (result.success) {
          results.push(result.data)
        } else {
          errors.push({
            data: perm,
            error: result.message
          })
        }
      }

      return {
        success: true,
        message: `成功创建${results.length}个权限，失败${errors.length}个`,
        data: {
          created: results,
          failed: errors
        }
      }
    } catch (error) {
      console.error('批量创建权限失败:', error)
      return {
        success: false,
        message: '批量创建权限失败',
        error: error.message
      }
    }
  }

  /**
   * 检查用户权限
   */
  async checkUserPermission(userId, permissionCode) {
    try {
      const permissions = await this.permissionRepository.getUserPermissions(userId)
      const hasPermission = permissions.some(p => p.code === permissionCode)

      return {
        success: true,
        data: {
          hasPermission,
          permissionCode
        }
      }
    } catch (error) {
      console.error('检查用户权限失败:', error)
      return {
        success: false,
        message: '检查用户权限失败',
        error: error.message
      }
    }
  }

  /**
   * 同步权限
   * 从路由和代码中自动发现并同步权限
   */
  async syncPermissions(discoveredPermissions) {
    try {
      const existingPermissions = await this.permissionRepository.findAll()
      const existingCodes = new Set(existingPermissions.map(p => p.code))
      
      const toCreate = []
      const toUpdate = []
      
      for (const perm of discoveredPermissions) {
        if (!existingCodes.has(perm.code)) {
          toCreate.push(perm)
        } else {
          // 检查是否需要更新
          const existing = existingPermissions.find(p => p.code === perm.code)
          if (existing && (existing.name !== perm.name || existing.description !== perm.description)) {
            toUpdate.push({
              id: existing.id,
              ...perm
            })
          }
        }
      }

      // 批量创建新权限
      let created = []
      if (toCreate.length > 0) {
        const result = await this.batchCreate(toCreate)
        created = result.data.created
      }

      // 批量更新权限
      let updated = []
      for (const perm of toUpdate) {
        const result = await this.update(perm.id, perm)
        if (result.success) {
          updated.push(result.data)
        }
      }

      return {
        success: true,
        message: `同步完成：创建${created.length}个，更新${updated.length}个权限`,
        data: {
          created,
          updated,
          total: existingPermissions.length + created.length
        }
      }
    } catch (error) {
      console.error('同步权限失败:', error)
      return {
        success: false,
        message: '同步权限失败',
        error: error.message
      }
    }
  }

  /**
   * 获取权限统计信息
   */
  async getPermissionStatistics() {
    try {
      const [total, active, byModule, byType] = await Promise.all([
        this.permissionRepository.count(),
        this.permissionRepository.count({ status: 'active' }),
        this.permissionRepository.db('permissions')
          .select('module')
          .count('* as count')
          .groupBy('module'),
        this.permissionRepository.db('permissions')
          .select('type')
          .count('* as count')
          .groupBy('type')
      ])

      const moduleStats = {}
      byModule.forEach(item => {
        moduleStats[item.module] = parseInt(item.count)
      })

      const typeStats = {}
      byType.forEach(item => {
        typeStats[item.type] = parseInt(item.count)
      })

      return {
        success: true,
        data: {
          total,
          active,
          inactive: total - active,
          byModule: moduleStats,
          byType: typeStats
        }
      }
    } catch (error) {
      console.error('获取权限统计失败:', error)
      return {
        success: false,
        message: '获取权限统计失败',
        error: error.message
      }
    }
  }

  /**
   * 初始化默认权限
   */
  async initializeDefaultPermissions() {
    try {
      const defaultPermissions = [
        // 用户管理
        { code: 'user.view', name: '查看用户', module: 'user', action: 'view' },
        { code: 'user.create', name: '创建用户', module: 'user', action: 'create' },
        { code: 'user.update', name: '更新用户', module: 'user', action: 'update' },
        { code: 'user.delete', name: '删除用户', module: 'user', action: 'delete' },
        
        // 角色管理
        { code: 'role.view', name: '查看角色', module: 'role', action: 'view' },
        { code: 'role.create', name: '创建角色', module: 'role', action: 'create' },
        { code: 'role.update', name: '更新角色', module: 'role', action: 'update' },
        { code: 'role.delete', name: '删除角色', module: 'role', action: 'delete' },
        { code: 'role.assign', name: '分配角色', module: 'role', action: 'assign' },
        
        // 菜单管理
        { code: 'menu.view', name: '查看菜单', module: 'menu', action: 'view' },
        { code: 'menu.create', name: '创建菜单', module: 'menu', action: 'create' },
        { code: 'menu.update', name: '更新菜单', module: 'menu', action: 'update' },
        { code: 'menu.delete', name: '删除菜单', module: 'menu', action: 'delete' },
        
        // 权限管理
        { code: 'permission.view', name: '查看权限', module: 'permission', action: 'view' },
        { code: 'permission.create', name: '创建权限', module: 'permission', action: 'create' },
        { code: 'permission.update', name: '更新权限', module: 'permission', action: 'update' },
        { code: 'permission.delete', name: '删除权限', module: 'permission', action: 'delete' },
        { code: 'permission.assign', name: '分配权限', module: 'permission', action: 'assign' },
        
        // 部门管理
        { code: 'department.view', name: '查看部门', module: 'department', action: 'view' },
        { code: 'department.create', name: '创建部门', module: 'department', action: 'create' },
        { code: 'department.update', name: '更新部门', module: 'department', action: 'update' },
        { code: 'department.delete', name: '删除部门', module: 'department', action: 'delete' },
        
        // 组织管理
        { code: 'organization.view', name: '查看组织', module: 'organization', action: 'view' },
        { code: 'organization.create', name: '创建组织', module: 'organization', action: 'create' },
        { code: 'organization.update', name: '更新组织', module: 'organization', action: 'update' },
        { code: 'organization.delete', name: '删除组织', module: 'organization', action: 'delete' },
        
        // 审计日志
        { code: 'audit.view', name: '查看审计日志', module: 'audit', action: 'view' },
        { code: 'audit.export', name: '导出审计日志', module: 'audit', action: 'export' },
        { code: 'audit.clean', name: '清理审计日志', module: 'audit', action: 'clean' }
      ]

      const result = await this.syncPermissions(defaultPermissions)
      
      return result
    } catch (error) {
      console.error('初始化默认权限失败:', error)
      return {
        success: false,
        message: '初始化默认权限失败',
        error: error.message
      }
    }
  }
}

module.exports = PermissionService