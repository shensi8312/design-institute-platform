const WorkflowService = require('../services/system/WorkflowService')

/**
 * 工作流Controller - 重构版
 * 使用Service层架构
 */
class WorkflowController {
  constructor() {
    this.workflowService = new WorkflowService()
  }

  /**
   * 获取工作流列表
   */
  async getWorkflows(req, res) {
    try {
      const { page = 1, pageSize = 10, name, status, type } = req.query
      const userId = req.user.id
      
      const result = await this.workflowService.list(userId, {
        name,
        status,
        type
      })
      
      if (result.success) {
        // 分页处理
        const offset = (page - 1) * pageSize
        const paginatedData = result.data.slice(offset, offset + parseInt(pageSize))
        
        res.json({
          success: true,
          data: {
            list: paginatedData,
            total: result.data.length,
            page: parseInt(page),
            pageSize: parseInt(pageSize)
          }
        })
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取工作流列表失败:', error)
      res.status(500).json({
        success: false,
        message: '获取工作流列表失败',
        error: error.message
      })
    }
  }

  /**
   * 获取单个工作流
   */
  async getWorkflow(req, res) {
    try {
      const { id } = req.params
      const result = await this.workflowService.getById(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('获取工作流失败:', error)
      res.status(500).json({
        success: false,
        message: '获取工作流失败',
        error: error.message
      })
    }
  }

  /**
   * 创建工作流
   */
  async createWorkflow(req, res) {
    try {
      const data = {
        ...req.body,
        created_by: req.user.id,
        organization_id: req.user.organization_id
      }
      
      const result = await this.workflowService.create(data)
      
      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('创建工作流失败:', error)
      res.status(500).json({
        success: false,
        message: '创建工作流失败',
        error: error.message
      })
    }
  }

  /**
   * 更新工作流
   */
  async updateWorkflow(req, res) {
    try {
      const { id } = req.params
      const result = await this.workflowService.update(id, req.body)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('更新工作流失败:', error)
      res.status(500).json({
        success: false,
        message: '更新工作流失败',
        error: error.message
      })
    }
  }

  /**
   * 删除工作流
   */
  async deleteWorkflow(req, res) {
    try {
      const { id } = req.params
      const result = await this.workflowService.delete(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('删除工作流失败:', error)
      res.status(500).json({
        success: false,
        message: '删除工作流失败',
        error: error.message
      })
    }
  }

  /**
   * 复制工作流
   */
  async duplicateWorkflow(req, res) {
    try {
      const { id } = req.params
      const result = await this.workflowService.duplicate(id, req.user.id)
      
      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('复制工作流失败:', error)
      res.status(500).json({
        success: false,
        message: '复制工作流失败',
        error: error.message
      })
    }
  }

  /**
   * 执行工作流
   */
  async executeWorkflow(req, res) {
    try {
      const { id } = req.params
      const { inputs } = req.body
      
      const result = await this.workflowService.execute(id, req.user.id, inputs)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('执行工作流失败:', error)
      res.status(500).json({
        success: false,
        message: '执行工作流失败',
        error: error.message
      })
    }
  }

  /**
   * 获取执行历史
   */
  async getExecutions(req, res) {
    try {
      const { id } = req.params
      const { status, limit = 50 } = req.query
      
      const result = await this.workflowService.getExecutions(id, {
        status,
        limit: parseInt(limit)
      })
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取执行历史失败:', error)
      res.status(500).json({
        success: false,
        message: '获取执行历史失败',
        error: error.message
      })
    }
  }

  /**
   * 获取执行详情
   */
  async getExecution(req, res) {
    try {
      const { executionId } = req.params
      const result = await this.workflowService.getExecutionById(executionId)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('获取执行详情失败:', error)
      res.status(500).json({
        success: false,
        message: '获取执行详情失败',
        error: error.message
      })
    }
  }

  /**
   * 停止执行
   */
  async stopExecution(req, res) {
    try {
      const { executionId } = req.params
      const result = await this.workflowService.stopExecution(executionId)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('停止执行失败:', error)
      res.status(500).json({
        success: false,
        message: '停止执行失败',
        error: error.message
      })
    }
  }

  /**
   * 获取工作流统计
   */
  async getStatistics(req, res) {
    try {
      const { id } = req.params
      const result = await this.workflowService.getStatistics(id)
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取统计信息失败:', error)
      res.status(500).json({
        success: false,
        message: '获取统计信息失败',
        error: error.message
      })
    }
  }

  /**
   * 获取模板列表
   */
  async getTemplates(req, res) {
    try {
      const { category, tags } = req.query
      const result = await this.workflowService.getTemplates({
        category,
        tags: tags ? tags.split(',') : undefined
      })
      
      if (result.success) {
        res.json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('获取模板列表失败:', error)
      res.status(500).json({
        success: false,
        message: '获取模板列表失败',
        error: error.message
      })
    }
  }

  /**
   * 从模板创建工作流
   */
  async createFromTemplate(req, res) {
    try {
      const { templateId } = req.params
      const data = {
        ...req.body,
        created_by: req.user.id,
        organization_id: req.user.organization_id
      }
      
      const result = await this.workflowService.createFromTemplate(templateId, data)
      
      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('从模板创建工作流失败:', error)
      res.status(500).json({
        success: false,
        message: '从模板创建工作流失败',
        error: error.message
      })
    }
  }

  /**
   * 保存为模板
   */
  async saveAsTemplate(req, res) {
    try {
      const { id } = req.params
      const templateData = {
        ...req.body,
        userId: req.user.id
      }
      
      const result = await this.workflowService.saveAsTemplate(id, templateData)
      
      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(result.message.includes('不存在') ? 404 : 400).json(result)
      }
    } catch (error) {
      console.error('保存模板失败:', error)
      res.status(500).json({
        success: false,
        message: '保存模板失败',
        error: error.message
      })
    }
  }

  /**
   * 导出工作流
   */
  async exportWorkflow(req, res) {
    try {
      const { id } = req.params
      const result = await this.workflowService.getById(id)
      
      if (!result.success) {
        return res.status(404).json(result)
      }

      const workflow = result.data
      const exportData = {
        name: workflow.name,
        description: workflow.description,
        type: workflow.type,
        config: workflow.config,
        nodes: workflow.nodes,
        edges: workflow.edges,
        exportedAt: new Date().toISOString()
      }

      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="workflow_${id}.json"`)
      res.json(exportData)
    } catch (error) {
      console.error('导出工作流失败:', error)
      res.status(500).json({
        success: false,
        message: '导出工作流失败',
        error: error.message
      })
    }
  }

  /**
   * 导入工作流
   */
  async importWorkflow(req, res) {
    try {
      const importData = req.body
      const data = {
        name: importData.name || '导入的工作流',
        description: importData.description,
        type: importData.type,
        config: importData.config,
        nodes: importData.nodes,
        edges: importData.edges,
        created_by: req.user.id,
        organization_id: req.user.organization_id
      }
      
      const result = await this.workflowService.create(data)
      
      if (result.success) {
        res.status(201).json(result)
      } else {
        res.status(400).json(result)
      }
    } catch (error) {
      console.error('导入工作流失败:', error)
      res.status(500).json({
        success: false,
        message: '导入工作流失败',
        error: error.message
      })
    }
  }
}

// 创建实例并导出
const controller = new WorkflowController()

module.exports = {
  getWorkflows: (req, res) => controller.getWorkflows(req, res),
  getWorkflow: (req, res) => controller.getWorkflow(req, res),
  createWorkflow: (req, res) => controller.createWorkflow(req, res),
  updateWorkflow: (req, res) => controller.updateWorkflow(req, res),
  deleteWorkflow: (req, res) => controller.deleteWorkflow(req, res),
  duplicateWorkflow: (req, res) => controller.duplicateWorkflow(req, res),
  executeWorkflow: (req, res) => controller.executeWorkflow(req, res),
  getExecutions: (req, res) => controller.getExecutions(req, res),
  getExecution: (req, res) => controller.getExecution(req, res),
  stopExecution: (req, res) => controller.stopExecution(req, res),
  getStatistics: (req, res) => controller.getStatistics(req, res),
  getTemplates: (req, res) => controller.getTemplates(req, res),
  createFromTemplate: (req, res) => controller.createFromTemplate(req, res),
  saveAsTemplate: (req, res) => controller.saveAsTemplate(req, res),
  exportWorkflow: (req, res) => controller.exportWorkflow(req, res),
  importWorkflow: (req, res) => controller.importWorkflow(req, res)
}