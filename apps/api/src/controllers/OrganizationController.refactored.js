const OrganizationService = require('../services/system/OrganizationService')

/**
 * 组织控制器 - 重构版
 * 使用Service层处理业务逻辑
 */
class OrganizationController {
  constructor() {
    this.organizationService = new OrganizationService()
  }

  /**
   * 获取组织列表
   */
  async getList(req, res) {
    try {
      const result = await this.organizationService.getList(req.query)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('Controller error:', error)
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      })
    }
  }

  /**
   * 获取组织详情
   */
  async getDetail(req, res) {
    try {
      const { id } = req.params
      const result = await this.organizationService.getById(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message === '组织不存在' ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('Controller error:', error)
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      })
    }
  }

  /**
   * 创建组织
   */
  async create(req, res) {
    try {
      const result = await this.organizationService.create(req.body)
      
      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('Controller error:', error)
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      })
    }
  }

  /**
   * 更新组织
   */
  async update(req, res) {
    try {
      const { id } = req.params
      const result = await this.organizationService.update(id, req.body)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message === '记录不存在' ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('Controller error:', error)
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      })
    }
  }

  /**
   * 删除组织
   */
  async delete(req, res) {
    try {
      const { id } = req.params
      const result = await this.organizationService.delete(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message === '记录不存在' ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('Controller error:', error)
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      })
    }
  }

  /**
   * 获取组织的部门树
   */
  async getDepartmentTree(req, res) {
    try {
      const { id } = req.params
      const result = await this.organizationService.getDepartmentTree(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('Controller error:', error)
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      })
    }
  }

  /**
   * 批量导入组织
   */
  async bulkImport(req, res) {
    try {
      const { organizations } = req.body
      
      if (!organizations || !Array.isArray(organizations)) {
        return res.status(400).json({
          success: false,
          message: '请提供要导入的组织数据'
        })
      }

      const result = await this.organizationService.bulkImport(organizations)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('Controller error:', error)
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      })
    }
  }

  /**
   * 获取组织统计信息
   */
  async getStatistics(req, res) {
    try {
      const organizations = await this.organizationService.getList({})
      
      if (organizations.success) {
        const stats = {
          total: organizations.data.total,
          byType: {},
          byStatus: {}
        }
        
        // 统计类型和状态
        organizations.data.list.forEach(org => {
          stats.byType[org.type] = (stats.byType[org.type] || 0) + 1
          stats.byStatus[org.status] = (stats.byStatus[org.status] || 0) + 1
        })
        
        res.json({
          success: true,
          data: stats
        })
      } else {
        res.status(400).json(organizations)
      }
    } catch (error) {
      console.error('Controller error:', error)
      res.status(500).json({
        success: false,
        message: '服务器错误',
        error: error.message
      })
    }
  }
}

// 创建单例实例
const organizationController = new OrganizationController()

// 导出绑定了this的方法
module.exports = {
  getList: organizationController.getList.bind(organizationController),
  getDetail: organizationController.getDetail.bind(organizationController),
  create: organizationController.create.bind(organizationController),
  update: organizationController.update.bind(organizationController),
  delete: organizationController.delete.bind(organizationController),
  getDepartmentTree: organizationController.getDepartmentTree.bind(organizationController),
  bulkImport: organizationController.bulkImport.bind(organizationController),
  getStatistics: organizationController.getStatistics.bind(organizationController)
}

// 也导出类，方便测试
module.exports.OrganizationController = OrganizationController