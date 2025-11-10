const DepartmentService = require('../services/system/DepartmentService')

/**
 * 部门Controller - 重构版
 * 使用Service层架构
 */
class DepartmentController {
  constructor() {
    this.departmentService = new DepartmentService()
  }

  /**
   * 获取部门列表
   */
  async getList(req, res) {
    try {
      const result = await this.departmentService.getList(req.query)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取部门列表失败:', error)
      res.status(500).json({
        success: false,
        message: '获取部门列表失败',
        error: error.message
      })
    }
  }

  /**
   * 获取部门树形结构
   */
  async getTree(req, res) {
    try {
      const { organizationId } = req.query
      const result = await this.departmentService.getTree(organizationId)

      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取部门树失败:', error)
      res.status(500).json({
        success: false,
        message: '获取部门树失败',
        error: error.message
      })
    }
  }

  /**
   * 获取部门树形选择器数据
   */
  async getTreeSelect(req, res) {
    try {
      const { organizationId } = req.query
      const result = await this.departmentService.getTreeSelect(organizationId)

      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取部门树选择器失败:', error)
      res.status(500).json({
        success: false,
        message: '获取部门树失败',
        error: error.message
      })
    }
  }

  /**
   * 获取部门详情
   */
  async getById(req, res) {
    try {
      const { id } = req.params
      const result = await this.departmentService.getById(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('获取部门详情失败:', error)
      res.status(500).json({
        success: false,
        message: '获取部门详情失败',
        error: error.message
      })
    }
  }

  /**
   * 创建部门
   */
  async create(req, res) {
    try {
      // 添加创建者信息
      const data = {
        ...req.body,
        created_by: req.user?.id
      }
      
      const result = await this.departmentService.create(data)
      
      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('创建部门失败:', error)
      res.status(500).json({
        success: false,
        message: '创建部门失败',
        error: error.message
      })
    }
  }

  /**
   * 更新部门
   */
  async update(req, res) {
    try {
      const { id } = req.params
      const data = {
        ...req.body,
        updated_by: req.user?.id
      }
      
      const result = await this.departmentService.update(id, data)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('更新部门失败:', error)
      res.status(500).json({
        success: false,
        message: '更新部门失败',
        error: error.message
      })
    }
  }

  /**
   * 删除部门
   */
  async delete(req, res) {
    try {
      const { id } = req.params
      const result = await this.departmentService.delete(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('删除部门失败:', error)
      res.status(500).json({
        success: false,
        message: '删除部门失败',
        error: error.message
      })
    }
  }

  /**
   * 移动部门
   */
  async move(req, res) {
    try {
      const { id } = req.params
      const { parentId } = req.body
      
      const result = await this.departmentService.moveDepartment(id, parentId)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('移动部门失败:', error)
      res.status(500).json({
        success: false,
        message: '移动部门失败',
        error: error.message
      })
    }
  }

  /**
   * 合并部门
   */
  async merge(req, res) {
    try {
      const { sourceId, targetId } = req.body
      
      const result = await this.departmentService.mergeDepartments(sourceId, targetId)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('合并部门失败:', error)
      res.status(500).json({
        success: false,
        message: '合并部门失败',
        error: error.message
      })
    }
  }

  /**
   * 获取部门成员
   */
  async getMembers(req, res) {
    try {
      const { id } = req.params
      const result = await this.departmentService.getDepartmentMembers(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取部门成员失败:', error)
      res.status(500).json({
        success: false,
        message: '获取部门成员失败',
        error: error.message
      })
    }
  }

  /**
   * 批量导入部门
   */
  async batchImport(req, res) {
    try {
      const { departments } = req.body
      
      if (!Array.isArray(departments) || departments.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供要导入的部门数据'
        })
      }
      
      const results = []
      const errors = []
      
      for (const dept of departments) {
        const result = await this.departmentService.create({
          ...dept,
          created_by: req.user?.id
        })
        
        if (result.success) {
          results.push(result.data)
        } else {
          errors.push({
            data: dept,
            error: result.message
          })
        }
      }
      
      res.json({
        success: true,
        message: `成功导入${results.length}个部门，失败${errors.length}个`,
        data: {
          imported: results,
          failed: errors
        }
      })
    } catch (error) {
      console.error('批量导入部门失败:', error)
      res.status(500).json({
        success: false,
        message: '批量导入部门失败',
        error: error.message
      })
    }
  }

  /**
   * 导出部门数据
   */
  async export(req, res) {
    try {
      const { organizationId, format = 'json' } = req.query
      
      const result = await this.departmentService.getList({
        organizationId,
        pageSize: 10000 // 导出所有
      })
      
      if (!result.success) {
        return res.status(400).json(result)
      }
      
      const departments = result.data.list
      
      if (format === 'csv') {
        // 转换为CSV格式
        const headers = ['ID', '部门名称', '部门代码', '上级部门', '负责人', '成员数', '状态', '创建时间']
        const rows = departments.map(dept => [
          dept.id,
          dept.name,
          dept.code || '',
          dept.parent_name || '',
          dept.manager_name || '',
          dept.member_count || 0,
          dept.status,
          dept.created_at
        ])
        
        const csvContent = [headers, ...rows]
          .map(row => row.join(','))
          .join('\n')
        
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', 'attachment; filename=departments.csv')
        res.send(csvContent)
      } else {
        // JSON格式
        res.json({
          success: true,
          data: departments
        })
      }
    } catch (error) {
      console.error('导出部门失败:', error)
      res.status(500).json({
        success: false,
        message: '导出部门失败',
        error: error.message
      })
    }
  }

  /**
   * 获取部门统计信息
   */
  async getStatistics(req, res) {
    try {
      const { id } = req.params
      
      const result = await this.departmentService.getDepartmentStatistics(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取部门统计失败:', error)
      res.status(500).json({
        success: false,
        message: '获取部门统计失败',
        error: error.message
      })
    }
  }
}

// 创建实例并导出
const controller = new DepartmentController()

module.exports = {
  getList: (req, res) => controller.getList(req, res),
  getTree: (req, res) => controller.getTree(req, res),
  getTreeSelect: (req, res) => controller.getTreeSelect(req, res),
  getById: (req, res) => controller.getById(req, res),
  getDetail: (req, res) => controller.getById(req, res),  // getDetail别名
  create: (req, res) => controller.create(req, res),
  update: (req, res) => controller.update(req, res),
  delete: (req, res) => controller.delete(req, res),
  move: (req, res) => controller.move(req, res),
  merge: (req, res) => controller.merge(req, res),
  getMembers: (req, res) => controller.getMembers(req, res),
  batchImport: (req, res) => controller.batchImport(req, res),
  export: (req, res) => controller.export(req, res),
  getStatistics: (req, res) => controller.getStatistics(req, res)
}