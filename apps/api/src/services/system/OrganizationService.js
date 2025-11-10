const BaseService = require('../BaseService')
const OrganizationRepository = require('../../repositories/OrganizationRepository')

/**
 * 组织Service
 */
class OrganizationService extends BaseService {
  constructor() {
    const repository = new OrganizationRepository()
    super(repository)
    this.organizationRepository = repository
  }

  /**
   * 获取组织列表（包含统计信息）
   */
  async getList(params = {}) {
    try {
      const {
        search,
        type,
        status,
        orderBy = 'created_at',
        order = 'desc'
      } = params

      // 构建查询条件
      const conditions = {}
      if (type) conditions.type = type
      if (status) conditions.status = status

      // 如果有搜索关键词
      if (search) {
        const organizations = await this.organizationRepository.search(
          search,
          ['name', 'code'],
          conditions
        )
        
        // 获取统计信息
        const orgsWithStats = await Promise.all(
          organizations.map(async (org) => {
            const children = await this.organizationRepository.hasChildren(org.id)
            return {
              ...org,
              department_count: children.hasDepartments ? children.total : 0,
              user_count: children.hasUsers ? children.total : 0
            }
          })
        )
        
        return {
          success: true,
          data: {
            list: orgsWithStats,
            total: orgsWithStats.length
          }
        }
      }

      // 获取带统计信息的列表
      const organizations = await this.organizationRepository.findAllWithStats(
        conditions,
        { orderBy, order }
      )

      return {
        success: true,
        data: {
          list: organizations,
          flatList: organizations,
          total: organizations.length
        }
      }
    } catch (error) {
      console.error('获取组织列表失败:', error)
      return {
        success: false,
        message: '获取组织列表失败',
        error: error.message
      }
    }
  }

  /**
   * 获取组织详情
   */
  async getById(organizationId) {
    try {
      const organization = await this.organizationRepository.findById(organizationId)
      
      if (!organization) {
        return {
          success: false,
          message: '组织不存在'
        }
      }

      // 获取部门和用户
      const departments = await this.organizationRepository.getDepartments(organizationId)
      const users = await this.organizationRepository.getUsers(organizationId)

      return {
        success: true,
        data: {
          ...organization,
          departments,
          users,
          department_count: departments.length,
          user_count: users.length
        }
      }
    } catch (error) {
      console.error('获取组织详情失败:', error)
      return {
        success: false,
        message: '获取组织详情失败',
        error: error.message
      }
    }
  }

  /**
   * 创建组织前的验证
   */
  async validateCreate(data) {
    // 验证必填字段
    if (!data.name) {
      return {
        success: false,
        message: '组织名称不能为空'
      }
    }

    // 检查编码是否重复
    if (data.code) {
      const existing = await this.organizationRepository.findByCode(data.code)
      if (existing) {
        return {
          success: false,
          message: '组织编码已存在'
        }
      }
    }

    return { success: true }
  }

  /**
   * 创建组织前的数据处理
   */
  async beforeCreate(data) {
    // 生成组织ID
    data.id = data.id || `org_${Date.now()}`
    
    // 生成编码（如果没有提供）
    if (!data.code) {
      data.code = data.id
    }

    // 设置默认值
    data.type = data.type || 'company'
    data.status = data.status || 'active'

    return data
  }

  /**
   * 更新组织前的验证
   */
  async validateUpdate(organizationId, data) {
    // 如果要更新编码，检查是否重复
    if (data.code) {
      const existing = await this.organizationRepository.findByCode(data.code)
      if (existing && existing.id !== organizationId) {
        return {
          success: false,
          message: '组织编码已存在'
        }
      }
    }

    return { success: true }
  }

  /**
   * 删除组织前的检查
   */
  async canDelete(organizationId, _organization) {
    const children = await this.organizationRepository.hasChildren(organizationId)
    
    if (children.hasDepartments) {
      return {
        success: false,
        message: '该组织下还有部门，无法删除'
      }
    }

    if (children.hasUsers) {
      return {
        success: false,
        message: '该组织下还有用户，无法删除'
      }
    }

    return { success: true }
  }

  /**
   * 获取组织的部门树
   */
  async getDepartmentTree(organizationId) {
    try {
      const DepartmentRepository = require('../../repositories/DepartmentRepository')
      const deptRepo = new DepartmentRepository()
      
      const tree = await deptRepo.getTreeByOrganization(organizationId)
      
      return {
        success: true,
        data: tree
      }
    } catch (error) {
      console.error('获取部门树失败:', error)
      return {
        success: false,
        message: '获取部门树失败',
        error: error.message
      }
    }
  }

  /**
   * 批量导入组织
   */
  async bulkImport(organizations) {
    try {
      const results = []
      const errors = []

      for (const org of organizations) {
        // 验证每个组织
        const validation = await this.validateCreate(org)
        if (!validation.success) {
          errors.push({
            data: org,
            error: validation.message
          })
          continue
        }

        // 处理数据
        const processedData = await this.beforeCreate(org)
        
        // 创建组织
        try {
          const result = await this.organizationRepository.create(processedData)
          results.push(result)
        } catch (error) {
          errors.push({
            data: org,
            error: error.message
          })
        }
      }

      return {
        success: errors.length === 0,
        message: `成功导入${results.length}个组织，失败${errors.length}个`,
        data: {
          success: results,
          failed: errors
        }
      }
    } catch (error) {
      console.error('批量导入组织失败:', error)
      return {
        success: false,
        message: '批量导入失败',
        error: error.message
      }
    }
  }
}

module.exports = OrganizationService
