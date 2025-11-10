const BaseService = require('../BaseService')
const DepartmentRepository = require('../../repositories/DepartmentRepository')

/**
 * 部门Service
 */
class DepartmentService extends BaseService {
  constructor() {
    const repository = new DepartmentRepository()
    super(repository)
    this.departmentRepository = repository
  }

  /**
   * 获取部门列表（树形结构）
   */
  async getList(params = {}) {
    try {
      const {
        organizationId,
        search,
        flat = false
      } = params

      // 构建查询条件
      const conditions = { status: 'active' }
      if (organizationId) {
        conditions.organization_id = organizationId
      }

      // 搜索
      if (search) {
        const departments = await this.departmentRepository.search(
          search,
          ['name', 'code'],
          conditions
        )
        return {
          success: true,
          data: {
            list: flat ? departments : this.departmentRepository.buildTree(departments),
            flatList: departments,
            total: departments.length
          }
        }
      }

      // 获取部门列表
      const departments = await this.departmentRepository.findAllWithRelations(conditions)
      
      return {
        success: true,
        data: {
          list: flat ? departments : this.departmentRepository.buildTree(departments),
          flatList: departments,
          total: departments.length
        }
      }
    } catch (error) {
      console.error('获取部门列表失败:', error)
      return {
        success: false,
        message: '获取部门列表失败',
        error: error.message
      }
    }
  }

  /**
   * 获取部门详情
   */
  async getById(departmentId) {
    try {
      const department = await this.departmentRepository.findByIdWithDetails(departmentId)
      
      if (!department) {
        return {
          success: false,
          message: '部门不存在'
        }
      }

      return {
        success: true,
        data: department
      }
    } catch (error) {
      console.error('获取部门详情失败:', error)
      return {
        success: false,
        message: '获取部门详情失败',
        error: error.message
      }
    }
  }

  /**
   * 创建部门前的验证
   */
  async validateCreate(data) {
    // 验证必填字段
    if (!data.name || !data.organization_id) {
      return {
        success: false,
        message: '部门名称和所属组织不能为空'
      }
    }

    // 检查编码是否重复
    if (data.code) {
      const existing = await this.departmentRepository.findByCode(data.code)
      if (existing) {
        return {
          success: false,
          message: '部门编码已存在'
        }
      }
    }

    return { success: true }
  }

  /**
   * 创建部门前的数据处理
   */
  async beforeCreate(data) {
    // 生成部门ID
    data.id = data.id || `dept_${Date.now()}`
    
    // 生成编码（如果没有提供）
    if (!data.code) {
      data.code = data.id
    }

    // 设置默认值
    data.status = data.status || 'active'
    data.sort_order = data.sort_order || 0

    return data
  }

  /**
   * 更新部门前的验证
   */
  async validateUpdate(departmentId, data) {
    // 如果要更新编码，检查是否重复
    if (data.code) {
      const existing = await this.departmentRepository.findByCode(data.code)
      if (existing && existing.id !== departmentId) {
        return {
          success: false,
          message: '部门编码已存在'
        }
      }
    }

    // 如果要更新父部门，检查是否会形成循环
    if (data.parent_id) {
      if (data.parent_id === departmentId) {
        return {
          success: false,
          message: '部门不能作为自己的父部门'
        }
      }
      
      // TODO: 检查是否会形成循环引用
    }

    return { success: true }
  }

  /**
   * 删除部门前的检查
   */
  async canDelete(departmentId, _department) {
    // 检查是否有子部门
    if (await this.departmentRepository.hasChildren(departmentId)) {
      return {
        success: false,
        message: '该部门下还有子部门，无法删除'
      }
    }

    // 检查是否有成员
    if (await this.departmentRepository.hasMembers(departmentId)) {
      return {
        success: false,
        message: '该部门下还有成员，无法删除'
      }
    }

    return { success: true }
  }

  /**
   * 获取部门树形选择器数据
   */
  async getTreeSelect(organizationId) {
    try {
      const conditions = { status: 'active' }
      if (organizationId) {
        conditions.organization_id = organizationId
      }

      const departments = await this.departmentRepository.findAll(
        conditions,
        { orderBy: 'sort_order', order: 'asc' }
      )

      // 转换为选择器格式
      const treeData = departments.map(dept => ({
        value: dept.id,
        label: dept.name,
        parent_id: dept.parent_id
      }))

      // 构建树形结构
      const buildSelectTree = (items, parentId = null) => {
        const tree = []
        for (const item of items) {
          if (item.parent_id === parentId) {
            const node = {
              value: item.value,
              label: item.label
            }
            const children = buildSelectTree(items, item.value)
            if (children.length > 0) {
              node.children = children
            }
            tree.push(node)
          }
        }
        return tree
      }

      return {
        success: true,
        data: buildSelectTree(treeData)
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
   * 获取部门树（用于部门管理页面）
   */
  async getTree(organizationId) {
    try {
      const conditions = {}
      if (organizationId) {
        conditions.organization_id = organizationId
      }

      const departments = await this.departmentRepository.findAll(
        conditions,
        { orderBy: 'sort_order', order: 'asc' }
      )

      // 构建树形结构
      const buildTree = (items, parentId = null) => {
        const tree = []
        for (const item of items) {
          if (item.parent_id === parentId) {
            const node = {
              ...item,
              key: item.id,
              children: buildTree(items, item.id)
            }
            tree.push(node)
          }
        }
        return tree
      }

      return {
        success: true,
        data: buildTree(departments)
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
   * 移动部门
   */
  async move(departmentId, newParentId) {
    try {
      // 验证
      if (departmentId === newParentId) {
        return {
          success: false,
          message: '部门不能移动到自己'
        }
      }

      // 检查目标部门是否存在
      if (newParentId) {
        const parent = await this.departmentRepository.findById(newParentId)
        if (!parent) {
          return {
            success: false,
            message: '目标父部门不存在'
          }
        }
      }

      // 执行移动
      await this.departmentRepository.move(departmentId, newParentId)

      return {
        success: true,
        message: '部门移动成功'
      }
    } catch (error) {
      console.error('移动部门失败:', error)
      return {
        success: false,
        message: '移动部门失败',
        error: error.message
      }
    }
  }
}

module.exports = DepartmentService
