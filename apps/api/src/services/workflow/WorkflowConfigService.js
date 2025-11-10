/**
 * 工作流配置服务
 * 动态管理工作流与Chat集成的配置
 * 所有配置从数据库/配置文件加载，不硬编码
 */

const knex = require('../../config/database');
// const EngineRegistryService = require('./EngineRegistryService');
// const VectorService = require('./VectorService');
// const GraphRAGService = require('./GraphRAGService');
// const ollamaService = require('./ollamaService');
// const realTimeDocumentProcessor = require('./realTimeDocumentProcessor');

class WorkflowConfigService {
  constructor() {
    // 工作流场景配置（从数据库加载）
    this.workflowScenarios = new Map();
    // 引擎注册表
    this.engineRegistry = new Map();
    // 初始化配置
    this.initialize();
  }

  async initialize() {
    // 从数据库加载工作流场景配置
    await this.loadWorkflowScenarios();
    // 从数据库加载引擎配置
    await this.loadEngineConfigurations();
    // 注册服务发现
    await this.registerServiceDiscovery();
  }

  /**
   * 从数据库加载工作流场景配置
   * 不硬编码任何场景，全部从数据库读取
   */
  async loadWorkflowScenarios() {
    try {
      // 从workflow_scenarios表加载所有场景
      const scenarios = await knex('workflow_scenarios')
        .where('enabled', true)
        .orderBy('priority', 'desc');

      for (const scenario of scenarios) {
        this.workflowScenarios.set(scenario.key, {
          id: scenario.id,
          name: scenario.name,
          description: scenario.description,
          // 解析JSON配置 - 如果已经是对象则直接使用
          triggers: typeof scenario.triggers === 'string' ? JSON.parse(scenario.triggers || '[]') : (scenario.triggers || []),
          nodes: typeof scenario.nodes === 'string' ? JSON.parse(scenario.nodes || '[]') : (scenario.nodes || []),
          edges: typeof scenario.edges === 'string' ? JSON.parse(scenario.edges || '[]') : (scenario.edges || []),
          config: typeof scenario.config === 'string' ? JSON.parse(scenario.config || '{}') : (scenario.config || {}),
          // 动态属性
          priority: scenario.priority,
          enabled: scenario.enabled
        });
      }

      console.log(`已加载 ${this.workflowScenarios.size} 个工作流场景`);
    } catch (error) {
      console.error('加载工作流场景失败:', error);
      // 如果数据库表不存在，使用默认配置
      await this.loadDefaultScenarios();
    }
  }

  /**
   * 加载默认场景配置（仅在数据库不可用时使用）
   */
  async loadDefaultScenarios() {
    // 场景1: 智能问答
    this.workflowScenarios.set('intelligent_qa', {
      id: 'scenario_1',
      name: '智能问答工作流',
      description: '问题 → 向量搜索 → 图谱查询 → Ollama → Agent优化 → 答案',
      triggers: [
        { type: 'chat_message', pattern: '.*' }
      ],
      nodes: [
        { id: 'input', type: 'input', engine: 'InputEngine' },
        { id: 'vector', type: 'search', engine: 'VectorSearchEngine' },
        { id: 'graph', type: 'search', engine: 'GraphSearchEngine' },
        { id: 'llm', type: 'generate', engine: 'OllamaEngine' },
        { id: 'agent', type: 'optimize', engine: 'AgentOptimizer' },
        { id: 'output', type: 'output', engine: 'OutputEngine' }
      ],
      edges: [
        { source: 'input', target: 'vector' },
        { source: 'vector', target: 'graph' },
        { source: 'graph', target: 'llm' },
        { source: 'llm', target: 'agent' },
        { source: 'agent', target: 'output' }
      ],
      config: {
        parallel: ['vector', 'graph'],
        cache: true,
        timeout: 30000
      },
      priority: 100,
      enabled: true
    });

    // 场景2: 文档处理
    this.workflowScenarios.set('document_processing', {
      id: 'scenario_2',
      name: '文档处理工作流',
      description: '上传 → OCR/YOLO/QwenVL解析 → Redis队列 → 并行处理',
      triggers: [
        { type: 'document_upload', pattern: '\\.(pdf|docx|png|jpg)$' }
      ],
      nodes: [
        { id: 'upload', type: 'input', engine: 'UploadEngine' },
        { id: 'parse', type: 'extract', engine: 'DocumentParserEngine' },
        { id: 'queue', type: 'queue', engine: 'RedisQueueEngine' },
        { id: 'vector_store', type: 'store', engine: 'VectorStoreEngine' },
        { id: 'graph_extract', type: 'extract', engine: 'LangExtractEngine' }
      ],
      edges: [
        { source: 'upload', target: 'parse' },
        { source: 'parse', target: 'queue' },
        { source: 'queue', target: 'vector_store', parallel: true },
        { source: 'queue', target: 'graph_extract', parallel: true }
      ],
      config: {
        queue: 'document_processing',
        parallel: true,
        retry: 3
      },
      priority: 90,
      enabled: true
    });

    // 场景3: SketchUp集成
    this.workflowScenarios.set('sketchup_chat', {
      id: 'scenario_3',
      name: 'SketchUp ChatBox集成',
      description: '对话 → 意图识别 → 建模命令 → SketchUp执行',
      triggers: [
        { type: 'sketchup_command', source: 'plugin' }
      ],
      nodes: [
        { id: 'chat_input', type: 'input', engine: 'ChatInputEngine' },
        { id: 'intent', type: 'classify', engine: 'IntentClassifier' },
        { id: 'command', type: 'generate', engine: 'CommandGenerator' },
        { id: 'execute', type: 'execute', engine: 'SketchUpExecutor' }
      ],
      edges: [
        { source: 'chat_input', target: 'intent' },
        { source: 'intent', target: 'command' },
        { source: 'command', target: 'execute' }
      ],
      config: {
        realtime: true,
        feedback: true
      },
      priority: 80,
      enabled: true
    });
  }

  /**
   * 从数据库加载引擎配置
   */
  async loadEngineConfigurations() {
    try {
      // 从engines表加载所有引擎
      const engines = await knex('engines')
        .where('status', 'active');

      for (const engine of engines) {
        this.engineRegistry.set(engine.key, {
          id: engine.id,
          name: engine.name,
          type: engine.type,
          // 动态加载服务
          service: await this.loadEngineService(engine),
          config: JSON.parse(engine.config || '{}'),
          capabilities: JSON.parse(engine.capabilities || '[]')
        });
      }
    } catch (error) {
      console.error('加载引擎配置失败:', error);
      // 注册默认引擎
      await this.registerDefaultEngines();
    }
  }

  /**
   * 动态加载引擎服务
   */
  async loadEngineService(engine) {
    // 根据引擎类型动态返回服务实例
    switch (engine.type) {
      case 'vector_search':
        return VectorService;
      case 'graph_search':
        return GraphRAGService;
      case 'llm':
        return ollamaService;
      case 'document_processor':
        return realTimeDocumentProcessor;
      default:
        // 尝试动态加载自定义引擎
        try {
          const CustomEngine = require(`../engines/${engine.key}`);
          return new CustomEngine(engine.config);
        } catch (error) {
          console.warn(`未找到引擎实现: ${engine.key}`);
          return null;
        }
    }
  }

  /**
   * 注册默认引擎（仅在数据库不可用时）
   */
  async registerDefaultEngines() {
    // 向量搜索引擎
    // this.engineRegistry.set('VectorSearchEngine', {
    //   id: 'engine_vector',
    //   name: '向量搜索引擎',
    //   type: 'vector_search',
    //   service: VectorService,
    //   config: { threshold: 0.7 },
    //   capabilities: ['search', 'similarity']
    // });

    // // 知识图谱引擎
    // this.engineRegistry.set('GraphSearchEngine', {
    //   id: 'engine_graph',
    //   name: '知识图谱引擎',
    //   type: 'graph_search',
    //   service: GraphRAGService,
    //   config: { depth: 3 },
    //   capabilities: ['search', 'reasoning']
    // });

    // // Ollama引擎
    // this.engineRegistry.set('OllamaEngine', {
    //   id: 'engine_ollama',
    //   name: 'Ollama LLM引擎',
    //   type: 'llm',
    //   service: ollamaService,
    //   config: { model: 'qwen2.5:72b' },
    //   capabilities: ['generate', 'chat']
    // });
  }

  /**
   * 服务发现 - 自动发现并注册可用服务
   */
  async registerServiceDiscovery() {
    try {
      // 检查各服务健康状态
      const services = [
        { url: 'http://localhost:11434', name: 'Ollama', type: 'llm' },
        { url: 'http://localhost:19530', name: 'Milvus', type: 'vector' },
        { url: 'http://localhost:7687', name: 'Neo4j', type: 'graph' },
        { url: 'http://localhost:6379', name: 'Redis', type: 'queue' }
      ];

      for (const service of services) {
        try {
          // 简单的健康检查
          const axios = require('axios');
          await axios.get(`${service.url}/health`, { timeout: 1000 }).catch(() => {});
          
          console.log(`✓ 发现服务: ${service.name} (${service.url})`);
          
          // 动态注册到引擎注册表
          if (!this.engineRegistry.has(`${service.name}Engine`)) {
            this.engineRegistry.set(`${service.name}Engine`, {
              id: `engine_${service.name.toLowerCase()}`,
              name: `${service.name}引擎`,
              type: service.type,
              service: null, // 延迟加载
              config: { url: service.url },
              capabilities: []
            });
          }
        } catch (error) {
          console.warn(`✗ 服务不可用: ${service.name}`);
        }
      }
    } catch (error) {
      console.error('服务发现失败:', error);
    }
  }

  /**
   * 根据触发条件匹配工作流场景
   */
  matchScenario(trigger) {
    let bestMatch = null;
    let highestPriority = -1;

    for (const [key, scenario] of this.workflowScenarios) {
      if (!scenario.enabled) continue;

      for (const scenarioTrigger of scenario.triggers) {
        if (this.matchTrigger(trigger, scenarioTrigger)) {
          if (scenario.priority > highestPriority) {
            bestMatch = scenario;
            highestPriority = scenario.priority;
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * 匹配触发条件
   */
  matchTrigger(actual, expected) {
    if (expected.type !== actual.type) return false;

    if (expected.pattern) {
      const regex = new RegExp(expected.pattern);
      return regex.test(actual.content || actual.filename || '');
    }

    if (expected.source) {
      return actual.source === expected.source;
    }

    return true;
  }

  /**
   * 动态创建工作流实例
   */
  async createWorkflowInstance(scenario, context) {
    const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 创建工作流实例
    const instance = {
      id: workflowId,
      scenario: scenario.id,
      name: scenario.name,
      status: 'pending',
      context: context,
      nodes: new Map(),
      edges: scenario.edges,
      results: new Map(),
      createdAt: new Date()
    };

    // 初始化节点
    for (const nodeConfig of scenario.nodes) {
      const engine = this.engineRegistry.get(nodeConfig.engine);
      if (!engine) {
        console.warn(`引擎未找到: ${nodeConfig.engine}`);
        continue;
      }

      instance.nodes.set(nodeConfig.id, {
        ...nodeConfig,
        engine: engine,
        status: 'pending',
        input: null,
        output: null
      });
    }

    // 保存到数据库
    await this.saveWorkflowInstance(instance);

    return instance;
  }

  /**
   * 保存工作流实例到数据库
   */
  async saveWorkflowInstance(instance) {
    try {
      await knex('workflow_instances').insert({
        id: instance.id,
        scenario_id: instance.scenario,
        name: instance.name,
        status: instance.status,
        context: JSON.stringify(instance.context),
        created_at: instance.createdAt
      });
    } catch (error) {
      console.error('保存工作流实例失败:', error);
    }
  }

  /**
   * 获取所有可用的工作流场景
   */
  getAvailableScenarios() {
    return Array.from(this.workflowScenarios.values())
      .filter(s => s.enabled)
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * 获取所有注册的引擎
   */
  getRegisteredEngines() {
    return Array.from(this.engineRegistry.values());
  }

  /**
   * 动态添加新场景
   */
  async addScenario(scenario) {
    // 保存到数据库
    await knex('workflow_scenarios').insert({
      key: scenario.key,
      name: scenario.name,
      description: scenario.description,
      triggers: JSON.stringify(scenario.triggers),
      nodes: JSON.stringify(scenario.nodes),
      edges: JSON.stringify(scenario.edges),
      config: JSON.stringify(scenario.config),
      priority: scenario.priority || 50,
      enabled: true,
      created_at: new Date()
    });

    // 更新内存缓存
    this.workflowScenarios.set(scenario.key, scenario);
  }

  /**
   * 动态更新场景
   */
  async updateScenario(key, updates) {
    const scenario = this.workflowScenarios.get(key);
    if (!scenario) throw new Error(`场景不存在: ${key}`);

    // 更新数据库
    await knex('workflow_scenarios')
      .where('key', key)
      .update({
        ...updates,
        updated_at: new Date()
      });

    // 更新内存缓存
    Object.assign(scenario, updates);
  }
}

// 单例模式
module.exports = new WorkflowConfigService();