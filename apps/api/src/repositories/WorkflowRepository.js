const BaseRepository = require('./BaseRepository')

/**
 * 工作流Repository
 */
class WorkflowRepository extends BaseRepository {
  constructor() {
    super('workflows')
  }

  /**
   * 获取用户的工作流列表
   */
  async findByUser(userId, options = {}) {
    let query = this.db('workflows')
      .select([
        'workflows.*',
        'users.name as creator_name',
        this.db.raw('COUNT(DISTINCT workflow_executions.id) as execution_count')
      ])
      .leftJoin('users', 'workflows.created_by', 'users.id')
      .leftJoin('workflow_executions', 'workflows.id', 'workflow_executions.workflow_id')
      .where('workflows.created_by', userId)
      .orWhere('workflows.visibility', 'public')
      .groupBy('workflows.id', 'users.name')
    
    if (options.status) {
      query = query.where('workflows.status', options.status)
    }
    
    if (options.type) {
      query = query.where('workflows.type', options.type)
    }
    
    return await query.orderBy('workflows.updated_at', 'desc')
  }

  /**
   * 获取工作流详情（包含节点）
   */
  async findByIdWithNodes(workflowId) {
    const workflow = await this.findById(workflowId)
    
    if (workflow) {
      // 获取工作流节点
      workflow.nodes = await this.db('workflow_nodes')
        .where('workflow_id', workflowId)
        .orderBy('position')
      
      // 获取工作流连接
      workflow.edges = await this.db('workflow_edges')
        .where('workflow_id', workflowId)
    }
    
    return workflow
  }

  /**
   * 保存工作流定义
   */
  async saveDefinition(workflowId, definition) {
    const { nodes, edges, ...workflowData } = definition
    
    // 开启事务
    return await this.db.transaction(async (trx) => {
      // 更新工作流基本信息
      await trx('workflows')
        .where('id', workflowId)
        .update({
          ...workflowData,
          updated_at: new Date()
        })
      
      // 删除旧的节点和边
      await trx('workflow_nodes').where('workflow_id', workflowId).delete()
      await trx('workflow_edges').where('workflow_id', workflowId).delete()
      
      // 插入新节点
      if (nodes && nodes.length > 0) {
        const nodeRecords = nodes.map((node, index) => ({
          id: node.id,
          workflow_id: workflowId,
          type: node.type,
          name: node.name,
          config: JSON.stringify(node.config || {}),
          position: index,
          x: node.x,
          y: node.y
        }))
        await trx('workflow_nodes').insert(nodeRecords)
      }
      
      // 插入新边
      if (edges && edges.length > 0) {
        const edgeRecords = edges.map(edge => ({
          id: edge.id,
          workflow_id: workflowId,
          source_node_id: edge.source,
          target_node_id: edge.target,
          source_handle: edge.sourceHandle,
          target_handle: edge.targetHandle,
          condition: edge.condition
        }))
        await trx('workflow_edges').insert(edgeRecords)
      }
      
      return { success: true }
    })
  }

  /**
   * 复制工作流
   */
  async duplicate(workflowId, userId) {
    const original = await this.findByIdWithNodes(workflowId)
    if (!original) return null
    
    return await this.db.transaction(async (trx) => {
      // 创建新工作流
      const newWorkflow = await trx('workflows').insert({
        name: `${original.name} (副本)`,
        description: original.description,
        type: original.type,
        config: original.config,
        status: 'draft',
        visibility: 'private',
        created_by: userId,
        organization_id: original.organization_id
      }).returning('*')
      
      // 复制节点
      if (original.nodes) {
        const nodeMap = {}
        for (const node of original.nodes) {
          const newNodeId = this.generateId()
          nodeMap[node.id] = newNodeId
          
          await trx('workflow_nodes').insert({
            id: newNodeId,
            workflow_id: newWorkflow[0].id,
            type: node.type,
            name: node.name,
            config: node.config,
            position: node.position,
            x: node.x,
            y: node.y
          })
        }
        
        // 复制边（更新节点ID引用）
        if (original.edges) {
          for (const edge of original.edges) {
            await trx('workflow_edges').insert({
              id: this.generateId(),
              workflow_id: newWorkflow[0].id,
              source_node_id: nodeMap[edge.source_node_id],
              target_node_id: nodeMap[edge.target_node_id],
              source_handle: edge.source_handle,
              target_handle: edge.target_handle,
              condition: edge.condition
            })
          }
        }
      }
      
      return newWorkflow[0]
    })
  }

  /**
   * 获取工作流统计
   */
  async getStatistics(workflowId) {
    const stats = await this.db('workflow_executions')
      .select([
        this.db.raw('COUNT(*) as total_executions'),
        this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as successful', ['completed']),
        this.db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as failed', ['failed']),
        this.db.raw('AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration')
      ])
      .where('workflow_id', workflowId)
      .first()
    
    return stats
  }

  generateId() {
    return require('crypto').randomUUID()
  }
}

/**
 * 工作流执行Repository
 */
class WorkflowExecutionRepository extends BaseRepository {
  constructor() {
    super('workflow_executions')
  }

  /**
   * 获取执行历史
   */
  async findByWorkflowId(workflowId, options = {}) {
    let query = this.db('workflow_executions')
      .select([
        'workflow_executions.*',
        'users.name as triggered_by_name'
      ])
      .leftJoin('users', 'workflow_executions.triggered_by', 'users.id')
      .where('workflow_id', workflowId)
    
    if (options.status) {
      query = query.where('workflow_executions.status', options.status)
    }
    
    return await query
      .orderBy('workflow_executions.started_at', 'desc')
      .limit(options.limit || 50)
  }

  /**
   * 获取执行详情（包含步骤）
   */
  async findByIdWithSteps(executionId) {
    const execution = await this.findById(executionId)
    
    if (execution) {
      // 获取执行步骤
      execution.steps = await this.db('workflow_execution_steps')
        .where('execution_id', executionId)
        .orderBy('started_at', 'asc')
    }
    
    return execution
  }

  /**
   * 创建执行记录
   */
  async createExecution(workflowId, userId, inputs = {}) {
    return await this.create({
      workflow_id: workflowId,
      triggered_by: userId,
      status: 'running',
      inputs: JSON.stringify(inputs),
      started_at: new Date()
    })
  }

  /**
   * 更新执行状态
   */
  async updateStatus(executionId, status, outputs = null, error = null) {
    const updates = {
      status,
      updated_at: new Date()
    }
    
    if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date()
    }
    
    if (outputs) {
      updates.outputs = JSON.stringify(outputs)
    }
    
    if (error) {
      updates.error = error
    }
    
    return await this.update(executionId, updates)
  }

  /**
   * 记录执行步骤
   */
  async recordStep(executionId, nodeId, status, data = {}) {
    return await this.db('workflow_execution_steps').insert({
      execution_id: executionId,
      node_id: nodeId,
      status,
      inputs: JSON.stringify(data.inputs || {}),
      outputs: JSON.stringify(data.outputs || {}),
      error: data.error,
      started_at: data.startedAt || new Date(),
      completed_at: data.completedAt
    })
  }
}

/**
 * 工作流模板Repository
 */
class WorkflowTemplateRepository extends BaseRepository {
  constructor() {
    super('workflow_templates')
  }

  /**
   * 获取模板列表
   */
  async findAll(options = {}) {
    let query = this.db('workflow_templates')
      .select([
        'workflow_templates.*',
        this.db.raw('COUNT(workflows.id) as usage_count')
      ])
      .leftJoin('workflows', 'workflow_templates.id', 'workflows.template_id')
      .groupBy('workflow_templates.id')
    
    if (options.category) {
      query = query.where('workflow_templates.category', options.category)
    }
    
    if (options.tags) {
      query = query.whereRaw('tags @> ?', [JSON.stringify(options.tags)])
    }
    
    return await query.orderBy('workflow_templates.usage_count', 'desc')
  }

  /**
   * 从工作流创建模板
   */
  async createFromWorkflow(workflowId, templateData) {
    const workflow = await this.db('workflows')
      .where('id', workflowId)
      .first()
    
    if (!workflow) return null
    
    return await this.db.transaction(async (trx) => {
      // 创建模板
      const template = await trx('workflow_templates').insert({
        name: templateData.name,
        description: templateData.description,
        category: templateData.category,
        tags: JSON.stringify(templateData.tags || []),
        icon: templateData.icon,
        definition: workflow.config,
        created_by: templateData.userId
      }).returning('*')
      
      // 复制节点和边定义
      const nodes = await trx('workflow_nodes')
        .where('workflow_id', workflowId)
      
      const edges = await trx('workflow_edges')
        .where('workflow_id', workflowId)
      
      template[0].nodes = nodes
      template[0].edges = edges
      
      return template[0]
    })
  }
}

module.exports = {
  WorkflowRepository,
  WorkflowExecutionRepository,
  WorkflowTemplateRepository
}