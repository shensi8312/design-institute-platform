const db = require('../../config/database')

/**
 * 权限服务类
 * 处理复杂的权限逻辑和数据权限控制
 */
class PermissionService {
  
  /**
   * 检查用户是否有指定权限
   */
  static async hasPermission(userId, permission) {
    if (!userId || !permission) return false
    
    const userPermissions = await this.getUserPermissions(userId)
    
    // 超级管理员拥有所有权限
    if (userPermissions.includes('*')) return true
    
    // 检查具体权限
    if (Array.isArray(permission)) {
      return permission.some(p => userPermissions.includes(p))
    }
    
    return userPermissions.includes(permission)
  }
  
  /**
   * 获取用户所有权限
   */
  static async getUserPermissions(userId) {
    const roles = await db('user_roles')
      .select('roles.permissions')
      .join('roles', 'user_roles.role_id', 'roles.id')
      .where('user_roles.user_id', userId)
      .where('roles.status', 'active')
      .where('roles.deleted_at', null)
      .where(function() {
        this.whereNull('user_roles.expires_at')
          .orWhere('user_roles.expires_at', '>', new Date())
      })
    
    const permissions = new Set()
    roles.forEach(role => {
      if (Array.isArray(role.permissions)) {
        role.permissions.forEach(permission => permissions.add(permission))
      }
    })
    
    return Array.from(permissions)
  }
  
  /**
   * 检查数据权限
   * @param {Object} user 用户信息
   * @param {Object} resource 资源信息
   * @param {string} action 操作类型 (read/write/delete)
   */
  static checkDataPermission(user, resource, action = 'read') {
    if (!user || !resource) {
      return { canAccess: false, reason: '参数缺失' }
    }
    
    // 1. 组织级权限检查
    if (resource.organizationId !== user.organization_id) {
      return { canAccess: false, reason: '不属于同一组织' }
    }
    
    // 2. 根据资源权限级别检查
    switch (resource.permissionLevel) {
      case 'personal':
        return this._checkPersonalPermission(user, resource, action)
        
      case 'project':
        return this._checkProjectPermission(user, resource, action)
        
      case 'department':
        return this._checkDepartmentPermission(user, resource, action)
        
      case 'organization':
        return this._checkOrganizationPermission(user, resource, action)
        
      default:
        return { canAccess: false, reason: '未知权限级别' }
    }
  }
  
  /**
   * 检查个人权限
   */
  static _checkPersonalPermission(user, resource, action) {
    const isOwner = user.id === resource.ownerId
    
    return {
      canAccess: isOwner,
      canRead: isOwner,
      canWrite: isOwner,
      canDelete: isOwner,
      reason: isOwner ? undefined : '只能访问自己的数据'
    }
  }
  
  /**
   * 检查项目权限
   */
  static _checkProjectPermission(user, resource, action) {
    if (!resource.projectId) {
      return { canAccess: false, reason: '资源未绑定项目' }
    }
    
    const membership = user.projectMemberships?.find(m => m.projectId === resource.projectId)
    if (!membership) {
      return { canAccess: false, reason: '不是项目成员' }
    }
    
    // 项目经理拥有所有权限
    if (membership.roleName === '项目经理') {
      return {
        canAccess: true,
        canRead: true,
        canWrite: true,
        canDelete: true
      }
    }
    
    // 检查知识库分类权限
    const permissions = membership.customPermissions || membership.knowledgePermissions
    const canAccess = permissions.includes('*') || permissions.includes(resource.categoryId || '')
    
    return {
      canAccess,
      canRead: canAccess,
      canWrite: canAccess && permissions.includes('write'),
      canDelete: false, // 普通成员不能删除
      reason: canAccess ? undefined : '没有该分类的访问权限'
    }
  }
  
  /**
   * 检查部门权限
   */
  static _checkDepartmentPermission(user, resource, action) {
    const isSameDept = user.department_id === resource.departmentId
    const isOwner = user.id === resource.ownerId
    
    return {
      canAccess: isSameDept || isOwner,
      canRead: isSameDept || isOwner,
      canWrite: isOwner,
      canDelete: isOwner,
      reason: (isSameDept || isOwner) ? undefined : '只能访问本部门数据'
    }
  }
  
  /**
   * 检查组织权限
   */
  static _checkOrganizationPermission(user, resource, action) {
    const isOwner = user.id === resource.ownerId
    
    return {
      canAccess: true, // 同组织都可访问
      canRead: true,
      canWrite: isOwner,
      canDelete: isOwner,
      reason: undefined
    }
  }
  
  /**
   * 检查知识库权限
   */
  static checkKnowledgePermission(user, document) {
    // 个人文档：只有作者可以访问
    if (document.permissionLevel === 'personal') {
      return user.id === document.ownerId
    }
    
    // 项目文档：需要在项目中且有对应分类权限
    if (document.permissionLevel === 'project' && document.projectId) {
      const membership = user.projectMemberships?.find(m => m.projectId === document.projectId)
      if (!membership) return false
      
      // 检查知识库分类权限
      const permissions = membership.customPermissions || membership.knowledgePermissions
      return permissions.includes('*') || permissions.includes(document.categoryId || '')
    }
    
    // 部门文档：同部门可访问
    if (document.permissionLevel === 'department') {
      return user.department_id === document.departmentId
    }
    
    // 组织文档：同组织可访问
    if (document.permissionLevel === 'organization') {
      return true
    }
    
    return false
  }
  
  /**
   * 构建数据查询过滤条件
   */
  static buildDataFilter(user, resourceType) {
    const baseFilter = {
      organization_id: user.organization_id,
      deleted_at: null
    }
    
    // 超级管理员或有全局权限的用户
    if (user.permissions.includes('*') || user.permissions.includes(`${resourceType}:list:all`)) {
      return baseFilter
    }
    
    const conditions = []
    
    // 个人数据
    conditions.push({ owner_id: user.id })
    
    // 项目数据
    if (user.projectIds?.length > 0) {
      conditions.push({
        permission_level: 'project',
        project_id: user.projectIds
      })
    }
    
    // 部门数据
    if (user.department_id) {
      conditions.push({
        permission_level: 'department',
        department_id: user.department_id
      })
    }
    
    // 组织数据
    conditions.push({
      permission_level: 'organization'
    })
    
    return {
      ...baseFilter,
      $or: conditions
    }
  }
  
  /**
   * 过滤用户列表（根据用户权限）
   */
  static filterUserList(currentUser, users) {
    if (currentUser.permissions.includes('*') || 
        currentUser.permissions.includes('system:user:list:all')) {
      return users // 可以查看所有用户
    }
    
    if (currentUser.permissions.includes('system:user:list:department')) {
      // 可以查看本部门用户
      return users.filter(user => 
        user.department_id === currentUser.department_id || 
        user.id === currentUser.id
      )
    }
    
    if (currentUser.permissions.includes('system:user:list:project')) {
      // 可以查看项目相关用户
      return users.filter(user => 
        currentUser.projectIds.some(projectId => 
          user.projectIds?.includes(projectId)
        ) || user.id === currentUser.id
      )
    }
    
    // 只能查看自己
    return users.filter(user => user.id === currentUser.id)
  }
  
  /**
   * 生成权限SQL查询条件
   */
  static generatePermissionQuery(user, tableName = '') {
    const prefix = tableName ? `${tableName}.` : ''
    
    return function() {
      // 个人数据
      this.where(`${prefix}owner_id`, user.id)
      
      // 项目数据
      if (user.projectIds?.length > 0) {
        this.orWhere(function() {
          this.where(`${prefix}permission_level`, 'project')
            .whereIn(`${prefix}project_id`, user.projectIds)
        })
      }
      
      // 部门数据
      if (user.department_id) {
        this.orWhere(function() {
          this.where(`${prefix}permission_level`, 'department')
            .where(`${prefix}department_id`, user.department_id)
        })
      }
      
      // 组织数据
      this.orWhere(`${prefix}permission_level`, 'organization')
    }
  }
}

module.exports = PermissionService