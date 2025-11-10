const BaseService = require('../BaseService')
const { WorkflowRepository, WorkflowExecutionRepository, WorkflowTemplateRepository } = require('../../repositories/WorkflowRepository')
const WorkflowExecutor = require('../workflow/WorkflowExecutor')

/**
 * 工作流服务
 */
class WorkflowService extends BaseService {
  constructor() {
    const workflowRepository = new WorkflowRepository()
    super(workflowRepository)
    this.workflowRepository = workflowRepository
    this.executionRepository = new WorkflowExecutionRepository()
    this.templateRepository = new WorkflowTemplateRepository()
    this.executor = new WorkflowExecutor()
  }

  /**
   * 创建工作流
   */
  async create(data) {
    try {
      // 验证数据
      const validation = await this.validateCreate(data)
      if (!validation.valid) {
        return {
          success: false,
          message: validation.message
        }
      }

      // 创建工作流
      const workflow = await this.workflowRepository.create({
        name: data.name,
        description: data.description,
        type: data.type || 'general',
        config: JSON.stringify(data.config || {}),
        status: 'draft',
        visibility: data.visibility || 'private',
        created_by: data.created_by,
        organization_id: data.organization_id,
        template_id: data.template_id
      })

      // 如果有节点和边，保存定义
      if (data.nodes || data.edges) {
        await this.workflowRepository.saveDefinition(workflow.id, {
          nodes: data.nodes,
          edges: data.edges
        })
      }

      return {
        success: true,
        data: workflow
      }
    } catch (error) {
      console.error('Create workflow error:', error)
      return {
        success: false,
        message: '创建工作流失败',
        error: error.message
      }
    }
  }

  /**
   * 获取工作流列表
   */
  async list(userId, options = {}) {
    try {
      const workflows = await this.workflowRepository.findByUser(userId, options)
      
      return {
        success: true,
        data: workflows
      }
    } catch (error) {
      console.error('List workflows error:', error)
      return {
        success: false,
        message: '获取工作流列表失败',
        error: error.message
      }
    }
  }

  /**
   * 获取工作流详情
   */
  async getById(workflowId) {
    try {
      const workflow = await this.workflowRepository.findByIdWithNodes(workflowId)
      
      if (!workflow) {
        return {
          success: false,
          message: '工作流不存在'
        }
      }

      // 解析JSON字段
      if (workflow.config) {
        workflow.config = JSON.parse(workflow.config)
      }
      
      if (workflow.nodes) {
        workflow.nodes = workflow.nodes.map(node => ({
          ...node,
          config: JSON.parse(node.config || '{}')
        }))
      }

      return {
        success: true,
        data: workflow
      }
    } catch (error) {
      console.error('Get workflow error:', error)
      return {
        success: false,
        message: '获取工作流详情失败',
        error: error.message
      }
    }
  }

  /**
   * 更新工作流
   */
  async update(workflowId, data) {
    try {
      const workflow = await this.workflowRepository.findById(workflowId)
      
      if (!workflow) {
        return {
          success: false,
          message: '工作流不存在'
        }
      }

      // 更新基本信息
      const updates = {}
      if (data.name) updates.name = data.name
      if (data.description) updates.description = data.description
      if (data.config) updates.config = JSON.stringify(data.config)
      if (data.status) updates.status = data.status
      if (data.visibility) updates.visibility = data.visibility

      await this.workflowRepository.update(workflowId, updates)

      // 更新节点和边
      if (data.nodes !== undefined || data.edges !== undefined) {
        await this.workflowRepository.saveDefinition(workflowId, {
          nodes: data.nodes,
          edges: data.edges
        })
      }

      return {
        success: true,
        message: '工作流更新成功'
      }
    } catch (error) {
      console.error('Update workflow error:', error)
      return {
        success: false,
        message: '更新工作流失败',
        error: error.message
      }
    }
  }

  /**
   * 删除工作流
   */
  async delete(workflowId) {
    try {
      const workflow = await this.workflowRepository.findById(workflowId)
      
      if (!workflow) {
        return {
          success: false,
          message: '工作流不存在'
        }
      }

      // 检查是否有正在运行的执行
      const runningExecutions = await this.executionRepository.findByWorkflowId(
        workflowId,
        { status: 'running' }
      )

      if (runningExecutions.length > 0) {
        return {
          success: false,
          message: '工作流有正在运行的任务，无法删除'
        }
      }

      await this.workflowRepository.delete(workflowId)

      return {
        success: true,
        message: '工作流删除成功'
      }
    } catch (error) {
      console.error('Delete workflow error:', error)
      return {
        success: false,
        message: '删除工作流失败',
        error: error.message
      }
    }
  }

  /**
   * 复制工作流
   */
  async duplicate(workflowId, userId) {
    try {
      const newWorkflow = await this.workflowRepository.duplicate(workflowId, userId)
      
      if (!newWorkflow) {
        return {
          success: false,
          message: '原工作流不存在'
        }
      }

      return {
        success: true,
        data: newWorkflow
      }
    } catch (error) {
      console.error('Duplicate workflow error:', error)
      return {
        success: false,
        message: '复制工作流失败',
        error: error.message
      }
    }
  }

  /**
   * 执行工作流
   */
  async execute(workflowId, userId, inputs = {}) {
    try {
      const workflow = await this.workflowRepository.findByIdWithNodes(workflowId)
      
      if (!workflow) {
        return {
          success: false,
          message: '工作流不存在'
        }
      }

      if (workflow.status !== 'active') {
        return {
          success: false,
          message: '工作流未激活'
        }
      }

      // 创建执行记录
      const execution = await this.executionRepository.createExecution(
        workflowId,
        userId,
        inputs
      )

      // 异步执行工作流
      this.runWorkflowAsync(workflow, execution, inputs)

      return {
        success: true,
        data: {
          executionId: execution.id,
          status: 'running',
          message: '工作流已开始执行'
        }
      }
    } catch (error) {
      console.error('Execute workflow error:', error)
      return {
        success: false,
        message: '执行工作流失败',
        error: error.message
      }
    }
  }

  /**
   * 异步执行工作流
   */
  async runWorkflowAsync(workflow, execution, inputs) {
    try {
      // 解析配置
      workflow.config = JSON.parse(workflow.config || '{}')
      workflow.nodes = workflow.nodes.map(node => ({
        ...node,
        config: JSON.parse(node.config || '{}')
      }))

      // 执行工作流
      const result = await this.executor.execute(workflow, inputs, {
        executionId: execution.id,
        onNodeStart: async (nodeId) => {
          await this.executionRepository.recordStep(execution.id, nodeId, 'running', {
            startedAt: new Date()
          })
        },
        onNodeComplete: async (nodeId, outputs) => {
          await this.executionRepository.recordStep(execution.id, nodeId, 'completed', {
            outputs,
            completedAt: new Date()
          })
        },
        onNodeError: async (nodeId, error) => {
          await this.executionRepository.recordStep(execution.id, nodeId, 'failed', {
            error: error.message,
            completedAt: new Date()
          })
        }
      })

      // 更新执行状态
      await this.executionRepository.updateStatus(
        execution.id,
        'completed',
        result.outputs
      )
    } catch (error) {
      console.error('Workflow execution error:', error)
      
      // 更新执行状态为失败
      await this.executionRepository.updateStatus(
        execution.id,
        'failed',
        null,
        error.message
      )
    }
  }

  /**
   * 获取执行历史
   */
  async getExecutions(workflowId, options = {}) {
    try {
      const executions = await this.executionRepository.findByWorkflowId(
        workflowId,
        options
      )

      return {
        success: true,
        data: executions
      }
    } catch (error) {
      console.error('Get executions error:', error)
      return {
        success: false,
        message: '获取执行历史失败',
        error: error.message
      }
    }
  }

  /**
   * 获取执行详情
   */
  async getExecutionById(executionId) {
    try {
      const execution = await this.executionRepository.findByIdWithSteps(executionId)
      
      if (!execution) {
        return {
          success: false,
          message: '执行记录不存在'
        }
      }

      // 解析JSON字段
      if (execution.inputs) {
        execution.inputs = JSON.parse(execution.inputs)
      }
      if (execution.outputs) {
        execution.outputs = JSON.parse(execution.outputs)
      }
      
      if (execution.steps) {
        execution.steps = execution.steps.map(step => ({
          ...step,
          inputs: JSON.parse(step.inputs || '{}'),
          outputs: JSON.parse(step.outputs || '{}')
        }))
      }

      return {
        success: true,
        data: execution
      }
    } catch (error) {
      console.error('Get execution error:', error)
      return {
        success: false,
        message: '获取执行详情失败',
        error: error.message
      }
    }
  }

  /**
   * 停止执行
   */
  async stopExecution(executionId) {
    try {
      const execution = await this.executionRepository.findById(executionId)
      
      if (!execution) {
        return {
          success: false,
          message: '执行记录不存在'
        }
      }

      if (execution.status !== 'running') {
        return {
          success: false,
          message: '执行已结束'
        }
      }

      // 停止执行器
      await this.executor.stop(executionId)

      // 更新状态
      await this.executionRepository.updateStatus(
        executionId,
        'cancelled',
        null,
        '用户取消执行'
      )

      return {
        success: true,
        message: '执行已停止'
      }
    } catch (error) {
      console.error('Stop execution error:', error)
      return {
        success: false,
        message: '停止执行失败',
        error: error.message
      }
    }
  }

  /**
   * 获取工作流统计
   */
  async getStatistics(workflowId) {
    try {
      const stats = await this.workflowRepository.getStatistics(workflowId)
      
      return {
        success: true,
        data: stats
      }
    } catch (error) {
      console.error('Get statistics error:', error)
      return {
        success: false,
        message: '获取统计信息失败',
        error: error.message
      }
    }
  }

  /**
   * 获取模板列表
   */
  async getTemplates(options = {}) {
    try {
      const templates = await this.templateRepository.findAll(options)
      
      return {
        success: true,
        data: templates
      }
    } catch (error) {
      console.error('Get templates error:', error)
      return {
        success: false,
        message: '获取模板列表失败',
        error: error.message
      }
    }
  }

  /**
   * 从模板创建工作流
   */
  async createFromTemplate(templateId, data) {
    try {
      const template = await this.templateRepository.findById(templateId)
      
      if (!template) {
        return {
          success: false,
          message: '模板不存在'
        }
      }

      // 创建工作流
      const workflowData = {
        name: data.name || template.name,
        description: data.description || template.description,
        type: template.type,
        config: template.definition,
        template_id: templateId,
        created_by: data.created_by,
        organization_id: data.organization_id
      }

      return await this.create(workflowData)
    } catch (error) {
      console.error('Create from template error:', error)
      return {
        success: false,
        message: '从模板创建工作流失败',
        error: error.message
      }
    }
  }

  /**
   * 保存为模板
   */
  async saveAsTemplate(workflowId, templateData) {
    try {
      const template = await this.templateRepository.createFromWorkflow(
        workflowId,
        templateData
      )
      
      if (!template) {
        return {
          success: false,
          message: '工作流不存在'
        }
      }

      return {
        success: true,
        data: template
      }
    } catch (error) {
      console.error('Save as template error:', error)
      return {
        success: false,
        message: '保存模板失败',
        error: error.message
      }
    }
  }

  /**
   * 验证创建数据
   */
  async validateCreate(data) {
    if (!data.name) {
      return {
        valid: false,
        message: '工作流名称不能为空'
      }
    }

    if (!data.created_by) {
      return {
        valid: false,
        message: '创建者不能为空'
      }
    }

    if (!data.organization_id) {
      return {
        valid: false,
        message: '组织ID不能为空'
      }
    }

    return { valid: true }
  }
}

module.exports = WorkflowService