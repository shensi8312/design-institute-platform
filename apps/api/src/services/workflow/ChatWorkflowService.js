/**
 * Chat与工作流集成服务
 * 动态路由聊天消息到不同的工作流
 */

const WorkflowConfigService = require('./WorkflowConfigService');
const WorkflowExecutor = require('./WorkflowExecutor');
const knex = require('../../config/database');

class ChatWorkflowService {
  constructor() {
    this.activeWorkflows = new Map(); // 活跃的工作流实例
    this.userPreferences = new Map(); // 用户偏好设置
  }

  /**
   * 处理聊天消息，动态选择和执行工作流
   */
  async processMessage(message, context) {
    try {
      // 1. 分析消息意图
      const intent = await this.analyzeIntent(message, context);
      
      // 2. 根据意图和上下文匹配工作流
      const trigger = {
        type: intent.type || 'chat_message',
        content: message,
        source: context.source || 'web',
        user_id: context.user_id,
        conversation_id: context.conversation_id
      };
      
      const scenario = WorkflowConfigService.matchScenario(trigger);
      
      if (!scenario) {
        // 没有匹配的工作流，使用默认处理
        return this.defaultHandler(message, context);
      }
      
      // 3. 创建工作流实例
      const workflowInstance = await WorkflowConfigService.createWorkflowInstance(
        scenario,
        {
          message,
          intent,
          ...context
        }
      );
      
      // 4. 执行工作流
      const executor = new WorkflowExecutor(workflowInstance);
      const result = await executor.execute();
      
      // 5. 格式化返回结果
      return this.formatResponse(result, scenario);
    } catch (error) {
      console.error('处理消息失败:', error);
      return {
        success: false,
        error: error.message,
        fallback: await this.fallbackHandler(message, context)
      };
    }
  }

  /**
   * 分析消息意图
   */
  async analyzeIntent(message, context) {
    // 检查是否有文件上传
    if (context.files && context.files.length > 0) {
      return {
        type: 'document_upload',
        action: 'process_document',
        confidence: 0.95
      };
    }
    
    // 检查是否是SketchUp命令
    if (context.source === 'sketchup_plugin') {
      return {
        type: 'sketchup_command',
        action: 'execute_command',
        confidence: 0.9
      };
    }
    
    // 使用规则或AI分析普通聊天意图
    const patterns = [
      { regex: /设计|建筑|规范|材料/, type: 'knowledge_query' },
      { regex: /创建|生成|建模/, type: 'generate_model' },
      { regex: /分析|计算|评估/, type: 'analyze' },
      { regex: /上传|导入|文件/, type: 'document_request' }
    ];
    
    for (const pattern of patterns) {
      if (pattern.regex.test(message)) {
        return {
          type: pattern.type,
          action: 'process_query',
          confidence: 0.7
        };
      }
    }
    
    // 默认为普通查询
    return {
      type: 'general_query',
      action: 'chat',
      confidence: 0.5
    };
  }

  /**
   * 默认处理器 - 当没有匹配的工作流时
   */
  async defaultHandler(message, context) {
    // 使用基础的聊天服务
    const ChatService = require('../system/ChatService');
    const chatService = new ChatService();
    
    // 如果有会话ID，直接发送消息
    if (context.conversation_id) {
      return await chatService.sendMessage(
        context.conversation_id,
        context.user_id,
        message,
        { useWorkflow: false }
      );
    }
    
    // 如果没有会话，创建临时响应
    return {
      success: true,
      data: {
        content: `收到您的消息: "${message}"。请先创建会话后再进行对话。`,
        role: 'assistant',
        timestamp: new Date()
      }
    };
  }

  /**
   * 降级处理器 - 当工作流执行失败时
   */
  async fallbackHandler(message, context) {
    return {
      content: '抱歉，系统处理您的请求时遇到问题。我们已记录此问题，请稍后重试。',
      sources: [],
      type: 'fallback'
    };
  }

  /**
   * 格式化工作流执行结果
   */
  formatResponse(result, scenario) {
    const response = {
      success: true,
      data: {
        content: '',
        sources: [],
        workflow: {
          id: result.workflowId,
          name: scenario.name,
          nodes_executed: []
        }
      }
    };
    
    // 提取各节点的输出
    for (const [nodeId, nodeResult] of result.results) {
      if (nodeResult.output) {
        // 根据节点类型处理输出
        switch (nodeResult.type) {
          case 'output':
          case 'generate':
            response.data.content += nodeResult.output.content || nodeResult.output;
            break;
          
          case 'search':
            if (nodeResult.output.sources) {
              response.data.sources.push(...nodeResult.output.sources);
            }
            break;
        }
        
        response.data.workflow.nodes_executed.push({
          id: nodeId,
          type: nodeResult.type,
          duration: nodeResult.duration
        });
      }
    }
    
    return response;
  }

  /**
   * 获取用户的工作流偏好设置
   */
  async getUserPreferences(userId) {
    if (this.userPreferences.has(userId)) {
      return this.userPreferences.get(userId);
    }
    
    try {
      const preferences = await knex('user_workflow_preferences')
        .where('user_id', userId)
        .first();
      
      if (preferences) {
        const prefs = JSON.parse(preferences.preferences || '{}');
        this.userPreferences.set(userId, prefs);
        return prefs;
      }
    } catch (error) {
      console.error('获取用户偏好失败:', error);
    }
    
    return {
      preferred_scenarios: [],
      disabled_scenarios: [],
      custom_configs: {}
    };
  }

  /**
   * 更新用户的工作流偏好
   */
  async updateUserPreferences(userId, preferences) {
    try {
      await knex('user_workflow_preferences')
        .insert({
          user_id: userId,
          preferences: JSON.stringify(preferences),
          updated_at: new Date()
        })
        .onConflict('user_id')
        .merge();
      
      this.userPreferences.set(userId, preferences);
      return true;
    } catch (error) {
      console.error('更新用户偏好失败:', error);
      return false;
    }
  }

  /**
   * 获取工作流执行历史
   */
  async getWorkflowHistory(userId, limit = 10) {
    try {
      const history = await knex('workflow_instances')
        .where('user_id', userId)
        .orderBy('created_at', 'desc')
        .limit(limit);
      
      return history.map(record => ({
        id: record.id,
        scenario: record.scenario_id,
        status: record.status,
        created_at: record.created_at,
        duration: record.duration,
        result_summary: JSON.parse(record.result_summary || '{}')
      }));
    } catch (error) {
      console.error('获取历史失败:', error);
      return [];
    }
  }

  /**
   * 动态注册新的工作流场景
   */
  async registerScenario(scenario) {
    return await WorkflowConfigService.addScenario(scenario);
  }

  /**
   * 获取所有可用的工作流场景
   */
  getAvailableScenarios() {
    return WorkflowConfigService.getAvailableScenarios();
  }

  /**
   * 测试特定工作流场景
   */
  async testScenario(scenarioKey, testMessage, testContext = {}) {
    const scenario = WorkflowConfigService.workflowScenarios.get(scenarioKey);
    if (!scenario) {
      throw new Error(`场景不存在: ${scenarioKey}`);
    }
    
    // 创建测试实例
    const instance = await WorkflowConfigService.createWorkflowInstance(
      scenario,
      {
        message: testMessage,
        test_mode: true,
        ...testContext
      }
    );
    
    // 执行工作流
    const executor = new WorkflowExecutor(instance);
    const result = await executor.execute();
    
    return {
      scenario: scenarioKey,
      input: testMessage,
      result: this.formatResponse(result, scenario),
      execution_time: result.duration,
      nodes_executed: result.nodesExecuted
    };
  }
}

module.exports = new ChatWorkflowService();