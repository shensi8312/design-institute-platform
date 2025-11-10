const ProjectService = require('../services/system/ProjectService')

/**
 * 项目Controller - 重构版
 * 使用Service层架构
 */
class ProjectController {
  constructor() {
    this.projectService = new ProjectService()
  }

  /**
   * 获取项目列表
   */
  async getList(req, res) {
    try {
      const result = await this.projectService.getList(req.query)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取项目列表失败:', error)
      res.status(500).json({
        success: false,
        message: '获取项目列表失败',
        error: error.message
      })
    }
  }

  /**
   * 获取项目详情
   */
  async getDetail(req, res) {
    try {
      const { id } = req.params
      const result = await this.projectService.getProjectDetail(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('获取项目详情失败:', error)
      res.status(500).json({
        success: false,
        message: '获取项目详情失败',
        error: error.message
      })
    }
  }

  /**
   * 创建项目
   */
  async create(req, res) {
    try {
      const data = {
        ...req.body,
        created_by: req.user?.id,
        organization_id: req.user?.organization_id || 'org_default'
      }
      
      const result = await this.projectService.create(data)
      
      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('创建项目失败:', error)
      res.status(500).json({
        success: false,
        message: '创建项目失败',
        error: error.message
      })
    }
  }

  /**
   * 更新项目
   */
  async update(req, res) {
    try {
      const { id } = req.params
      const data = {
        ...req.body,
        updated_by: req.user?.id
      }
      
      const result = await this.projectService.update(id, data)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('更新项目失败:', error)
      res.status(500).json({
        success: false,
        message: '更新项目失败',
        error: error.message
      })
    }
  }

  /**
   * 删除项目
   */
  async delete(req, res) {
    try {
      const { id } = req.params
      const result = await this.projectService.delete(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('删除项目失败:', error)
      res.status(500).json({
        success: false,
        message: '删除项目失败',
        error: error.message
      })
    }
  }

  /**
   * 更新项目状态
   */
  async updateStatus(req, res) {
    try {
      const { id } = req.params
      const { status } = req.body
      
      if (!status) {
        return res.status(400).json({
          success: false,
          message: '状态不能为空'
        })
      }
      
      const result = await this.projectService.updateStatus(id, status, req.user?.id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('更新项目状态失败:', error)
      res.status(500).json({
        success: false,
        message: '更新项目状态失败',
        error: error.message
      })
    }
  }

  /**
   * 批量更新项目状态
   */
  async batchUpdateStatus(req, res) {
    try {
      const { projectIds, status } = req.body
      
      if (!Array.isArray(projectIds) || projectIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供要更新的项目ID列表'
        })
      }
      
      if (!status) {
        return res.status(400).json({
          success: false,
          message: '状态不能为空'
        })
      }
      
      const result = await this.projectService.batchUpdateStatus(projectIds, status, req.user?.id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('批量更新项目状态失败:', error)
      res.status(500).json({
        success: false,
        message: '批量更新项目状态失败',
        error: error.message
      })
    }
  }

  /**
   * 获取项目统计
   */
  async getStatistics(req, res) {
    try {
      const result = await this.projectService.getStatistics()
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取项目统计失败:', error)
      res.status(500).json({
        success: false,
        message: '获取项目统计失败',
        error: error.message
      })
    }
  }

  /**
   * 获取部门项目
   */
  async getByDepartment(req, res) {
    try {
      const { departmentId } = req.params
      const result = await this.projectService.getProjectsByDepartment(departmentId)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取部门项目失败:', error)
      res.status(500).json({
        success: false,
        message: '获取部门项目失败',
        error: error.message
      })
    }
  }

  /**
   * 获取管理者项目
   */
  async getByManager(req, res) {
    try {
      const { managerId } = req.params
      const result = await this.projectService.getProjectsByManager(managerId)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取管理者项目失败:', error)
      res.status(500).json({
        success: false,
        message: '获取管理者项目失败',
        error: error.message
      })
    }
  }

  /**
   * 获取即将到期的项目
   */
  async getExpiring(req, res) {
    try {
      const { days = 30 } = req.query
      const result = await this.projectService.getExpiringProjects(parseInt(days))
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取即将到期项目失败:', error)
      res.status(500).json({
        success: false,
        message: '获取即将到期项目失败',
        error: error.message
      })
    }
  }

  /**
   * 克隆项目
   */
  async clone(req, res) {
    try {
      const { id } = req.params
      const newData = {
        ...req.body,
        created_by: req.user?.id
      }
      
      const result = await this.projectService.cloneProject(id, newData)
      
      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('克隆项目失败:', error)
      res.status(500).json({
        success: false,
        message: '克隆项目失败',
        error: error.message
      })
    }
  }

  /**
   * 导出项目数据
   */
  async export(req, res) {
    try {
      const { format = 'json' } = req.query
      const conditions = {}
      
      // 可以根据查询参数添加筛选条件
      if (req.query.status && req.query.status !== 'all') {
        conditions['projects.status'] = req.query.status
      }
      if (req.query.type && req.query.type !== 'all') {
        conditions['projects.type'] = req.query.type
      }
      if (req.query.departmentId && req.query.departmentId !== 'all') {
        conditions['projects.department_id'] = req.query.departmentId
      }
      
      const result = await this.projectService.exportProjects(format, conditions)
      
      if (!result.success) {
        return res.status(400).json(result)
      }
      
      if (format === 'csv') {
        // 转换为CSV格式
        const csvContent = [result.data.headers, ...result.data.rows]
          .map(row => row.join(','))
          .join('\n')
        
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', 'attachment; filename=projects.csv')
        res.send(csvContent)
      } else {
        // JSON格式
        res.json({
          success: true,
          data: result.data
        })
      }
    } catch (error) {
      console.error('导出项目失败:', error)
      res.status(500).json({
        success: false,
        message: '导出项目失败',
        error: error.message
      })
    }
  }

  /**
   * 管理项目团队（占位方法，待实现）
   */
  async manageTeam(req, res) {
    try {
      // TODO: 实现团队管理功能
      res.json({
        success: true,
        message: '团队管理功能待实现'
      })
    } catch (error) {
      console.error('管理团队失败:', error)
      res.status(500).json({
        success: false,
        message: '管理团队失败',
        error: error.message
      })
    }
  }

  /**
   * 设置项目权限（占位方法，待实现）
   */
  async setPermissions(req, res) {
    try {
      // TODO: 实现权限设置功能
      res.json({
        success: true,
        message: '权限设置功能待实现'
      })
    } catch (error) {
      console.error('设置权限失败:', error)
      res.status(500).json({
        success: false,
        message: '设置权限失败',
        error: error.message
      })
    }
  }

  /**
   * 获取我的项目
   */
  async getMyProjects(req, res) {
    try {
      const userId = req.user?.id
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '用户未登录'
        })
      }
      
      // 获取用户作为项目经理的项目
      const result = await this.projectService.getProjectsByManager(userId)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取我的项目失败:', error)
      res.status(500).json({
        success: false,
        message: '获取我的项目失败',
        error: error.message
      })
    }
  }

  /**
   * 批量删除项目
   */
  async batchDelete(req, res) {
    try {
      const { projectIds } = req.body
      
      if (!Array.isArray(projectIds) || projectIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供要删除的项目ID列表'
        })
      }
      
      const results = []
      const errors = []
      
      for (const id of projectIds) {
        const result = await this.projectService.delete(id)
        if (result.success) {
          results.push(id)
        } else {
          errors.push({
            id,
            error: result.message
          })
        }
      }
      
      res.json({
        success: true,
        message: `成功删除${results.length}个项目，失败${errors.length}个`,
        data: {
          deleted: results,
          failed: errors
        }
      })
    } catch (error) {
      console.error('批量删除项目失败:', error)
      res.status(500).json({
        success: false,
        message: '批量删除项目失败',
        error: error.message
      })
    }
  }

  /**
   * 搜索项目
   */
  async search(req, res) {
    try {
      const { keyword, ...otherParams } = req.query
      
      if (!keyword) {
        return res.status(400).json({
          success: false,
          message: '搜索关键词不能为空'
        })
      }
      
      const result = await this.projectService.getList({
        search: keyword,
        ...otherParams
      })
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('搜索项目失败:', error)
      res.status(500).json({
        success: false,
        message: '搜索项目失败',
        error: error.message
      })
    }
  }
}

// 创建实例并导出
const controller = new ProjectController()

module.exports = {
  getList: (req, res) => controller.getList(req, res),
  getDetail: (req, res) => controller.getDetail(req, res),
  create: (req, res) => controller.create(req, res),
  update: (req, res) => controller.update(req, res),
  delete: (req, res) => controller.delete(req, res),
  updateStatus: (req, res) => controller.updateStatus(req, res),
  batchUpdateStatus: (req, res) => controller.batchUpdateStatus(req, res),
  getStatistics: (req, res) => controller.getStatistics(req, res),
  getByDepartment: (req, res) => controller.getByDepartment(req, res),
  getByManager: (req, res) => controller.getByManager(req, res),
  getExpiring: (req, res) => controller.getExpiring(req, res),
  clone: (req, res) => controller.clone(req, res),
  export: (req, res) => controller.export(req, res),
  manageTeam: (req, res) => controller.manageTeam(req, res),
  setPermissions: (req, res) => controller.setPermissions(req, res),
  getMyProjects: (req, res) => controller.getMyProjects(req, res),
  batchDelete: (req, res) => controller.batchDelete(req, res),
  search: (req, res) => controller.search(req, res),
  // 添加缺失的方法映射
  archive: (req, res) => controller.updateStatus(req, res),  // 使用updateStatus实现
  restore: (req, res) => controller.updateStatus(req, res),  // 使用updateStatus实现
  getMembers: (req, res) => controller.manageTeam(req, res),  // 使用manageTeam实现
  addMember: (req, res) => controller.manageTeam(req, res),  // 使用manageTeam实现
  removeMember: (req, res) => controller.manageTeam(req, res)  // 使用manageTeam实现
}