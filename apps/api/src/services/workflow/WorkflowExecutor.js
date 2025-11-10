/**
 * 工作流执行器
 * 负责执行工作流实例
 */

class WorkflowExecutor {
  constructor(workflowInstance) {
    this.instance = workflowInstance;
    this.executionLog = [];
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * 执行工作流
   */
  async execute() {
    this.startTime = Date.now();
    this.log('开始执行工作流', { workflowId: this.instance.id });
    
    try {
      // 更新状态为执行中
      this.instance.status = 'executing';
      
      // 找到起始节点
      const startNodes = this.findStartNodes();
      
      // 执行节点
      for (const nodeId of startNodes) {
        await this.executeNode(nodeId);
      }
      
      // 更新状态为完成
      this.instance.status = 'completed';
      this.endTime = Date.now();
      
      return {
        workflowId: this.instance.id,
        status: 'completed',
        results: this.instance.results,
        duration: this.endTime - this.startTime,
        nodesExecuted: this.executionLog.length
      };
    } catch (error) {
      this.instance.status = 'failed';
      this.endTime = Date.now();
      this.log('工作流执行失败', { error: error.message });
      
      throw error;
    }
  }

  /**
   * 找到起始节点（没有输入边的节点）
   */
  findStartNodes() {
    const hasIncoming = new Set();
    
    for (const edge of this.instance.edges) {
      hasIncoming.add(edge.target);
    }
    
    const startNodes = [];
    for (const [nodeId, node] of this.instance.nodes) {
      if (!hasIncoming.has(nodeId)) {
        startNodes.push(nodeId);
      }
    }
    
    return startNodes;
  }

  /**
   * 执行单个节点
   */
  async executeNode(nodeId) {
    const node = this.instance.nodes.get(nodeId);
    if (!node) {
      throw new Error(`节点不存在: ${nodeId}`);
    }
    
    // 检查是否已执行
    if (node.status === 'completed') {
      return node.output;
    }
    
    this.log('执行节点', { nodeId, type: node.type });
    
    try {
      // 获取输入数据
      const input = await this.collectNodeInput(nodeId);
      node.input = input;
      node.status = 'executing';
      
      // 执行引擎
      const output = await this.executeEngine(node.engine, input);
      
      // 保存输出
      node.output = output;
      node.status = 'completed';
      this.instance.results.set(nodeId, {
        type: node.type,
        input,
        output,
        duration: Date.now() - this.startTime
      });
      
      // 执行下游节点
      await this.executeDownstream(nodeId);
      
      return output;
    } catch (error) {
      node.status = 'failed';
      node.error = error.message;
      this.log('节点执行失败', { nodeId, error: error.message });
      throw error;
    }
  }

  /**
   * 收集节点的输入数据
   */
  async collectNodeInput(nodeId) {
    const inputs = [];
    
    // 找到所有输入边
    for (const edge of this.instance.edges) {
      if (edge.target === nodeId) {
        const sourceNode = this.instance.nodes.get(edge.source);
        
        // 如果源节点还未执行，先执行它
        if (sourceNode.status !== 'completed') {
          await this.executeNode(edge.source);
        }
        
        inputs.push(sourceNode.output);
      }
    }
    
    // 如果没有输入边，使用初始上下文
    if (inputs.length === 0) {
      return this.instance.context;
    }
    
    // 如果只有一个输入，直接返回
    if (inputs.length === 1) {
      return inputs[0];
    }
    
    // 多个输入，合并它们
    return this.mergeInputs(inputs);
  }

  /**
   * 合并多个输入
   */
  mergeInputs(inputs) {
    // 简单合并策略
    if (inputs.every(input => typeof input === 'object')) {
      // 对象合并
      return Object.assign({}, ...inputs);
    } else if (inputs.every(input => Array.isArray(input))) {
      // 数组合并
      return inputs.flat();
    } else {
      // 其他情况，返回数组
      return inputs;
    }
  }

  /**
   * 执行引擎
   */
  async executeEngine(engine, input) {
    if (!engine || !engine.service) {
      // 如果没有实际服务，返回模拟数据
      return this.mockEngineExecution(engine, input);
    }
    
    // 根据引擎类型执行不同的方法
    switch (engine.type) {
      case 'vector_search':
        return await engine.service.search(input.message || input, {
          kb_id: input.kb_id,
          limit: 5
        });
      
      case 'graph_search':
        return await engine.service.searchKnowledgeGraph(
          input.message || input,
          input.kb_id
        );
      
      case 'llm':
        return await engine.service.generateResponse({
          prompt: input.message || input,
          context: input.sources || [],
          model: engine.config.model
        });
      
      case 'document_processor':
        return await engine.service.processDocument(
          input.file || input,
          input.options
        );
      
      default:
        // 尝试调用通用execute方法
        if (engine.service && engine.service.execute) {
          return await engine.service.execute(input);
        }
        return this.mockEngineExecution(engine, input);
    }
  }

  /**
   * 模拟引擎执行（用于测试或引擎未实现时）
   */
  mockEngineExecution(engine, input) {
    this.log('使用模拟执行', { engine: engine?.name });
    
    // 根据引擎类型返回模拟数据
    if (engine?.type === 'vector_search') {
      return {
        sources: [
          {
            id: 'mock_1',
            title: '建筑设计规范',
            content: '模拟的向量搜索结果...',
            relevance: 0.85
          }
        ]
      };
    } else if (engine?.type === 'llm') {
      return {
        content: '这是模拟的AI生成响应。实际使用时会调用真实的LLM服务。'
      };
    }
    
    return { mock: true, input };
  }

  /**
   * 执行下游节点
   */
  async executeDownstream(nodeId) {
    const downstreamNodes = [];
    
    // 找到所有下游节点
    for (const edge of this.instance.edges) {
      if (edge.source === nodeId) {
        // 检查是否并行执行
        if (edge.parallel) {
          // 并行执行，稍后处理
          downstreamNodes.push({
            nodeId: edge.target,
            parallel: true
          });
        } else {
          // 串行执行
          downstreamNodes.push({
            nodeId: edge.target,
            parallel: false
          });
        }
      }
    }
    
    // 分组执行
    const serialNodes = downstreamNodes.filter(n => !n.parallel);
    const parallelNodes = downstreamNodes.filter(n => n.parallel);
    
    // 先执行串行节点
    for (const node of serialNodes) {
      await this.executeNode(node.nodeId);
    }
    
    // 并行执行其他节点
    if (parallelNodes.length > 0) {
      await Promise.all(
        parallelNodes.map(node => this.executeNode(node.nodeId))
      );
    }
  }

  /**
   * 记录日志
   */
  log(message, data = {}) {
    const logEntry = {
      timestamp: new Date(),
      message,
      data
    };
    
    this.executionLog.push(logEntry);
    console.log(`[WorkflowExecutor] ${message}`, data);
  }
}

module.exports = WorkflowExecutor;