/**
 * 工作流节点管理路由
 * 统一管理引擎、服务、Agent等所有节点类型
 */

const express = require('express');
const router = express.Router();
const { authenticate: authMiddleware } = require('../middleware/auth');
const db = require('../config/database');

// 节点注册表
const nodeRegistry = {
  // 服务节点
  services: [
    {
      id: 'ocr-service',
      name: '文档OCR识别',
      nodeType: 'service',
      category: 'recognition',
      status: 'active',
      endpoint: '/api/services/ocr',
      description: '识别图片和PDF中的文字',
      inputs: {
        file: { type: 'file', required: true, description: '文件' },
        language: { type: 'string', default: 'zh', description: '语言' }
      },
      outputs: {
        text: { type: 'string', description: '识别的文本' },
        confidence: { type: 'number', description: '置信度' },
        metadata: { type: 'object', description: '元数据' }
      }
    },
    {
      id: 'redis-queue',
      name: 'Redis队列服务',
      nodeType: 'service',
      category: 'queue',
      status: 'active',
      endpoint: '/api/services/redis',
      description: '任务队列管理',
      inputs: {
        action: { type: 'string', enum: ['enqueue', 'dequeue'], required: true },
        queue: { type: 'string', required: true },
        data: { type: 'object', required: false }
      },
      outputs: {
        success: { type: 'boolean' },
        taskId: { type: 'string' },
        queueLength: { type: 'number' }
      }
    },
    {
      id: 'milvus-vector',
      name: '向量存储服务',
      nodeType: 'service',
      category: 'storage',
      status: 'active',
      endpoint: '/api/services/milvus',
      description: '向量化存储和检索',
      inputs: {
        action: { type: 'string', enum: ['insert', 'search', 'delete'], required: true },
        collection: { type: 'string', required: true },
        text: { type: 'string', required: false },
        vectors: { type: 'array', required: false }
      },
      outputs: {
        vectorIds: { type: 'array', description: '向量ID列表' },
        results: { type: 'array', description: '搜索结果' }
      }
    },
    {
      id: 'sketch-recognition',
      name: '草图识别服务',
      nodeType: 'service',
      category: 'recognition',
      status: 'active',
      endpoint: '/api/services/sketch',
      description: '识别手绘草图并转换为结构化数据',
      inputs: {
        image: { type: 'file', required: true },
        mode: { type: 'string', enum: ['architectural', 'flowchart', 'freeform'] }
      },
      outputs: {
        elements: { type: 'array', description: '识别的元素' },
        svg: { type: 'string', description: 'SVG输出' }
      }
    }
  ],
  
  // Agent节点
  agents: [
    {
      id: 'langextract-agent',
      name: 'LangExtract智能学习',
      nodeType: 'agent',
      category: 'learning',
      status: 'active',
      endpoint: '/api/agents/langextract',
      description: '自学习推理，构建知识图谱',
      capabilities: ['实体识别', '关系推理', '知识图谱构建', '增量学习'],
      inputs: {
        text: { type: 'string', required: true, description: '待处理文本' },
        context: { type: 'object', description: '上下文信息' },
        mode: { type: 'string', enum: ['extract', 'learn', 'query'] }
      },
      outputs: {
        entities: { type: 'array', description: '识别的实体' },
        relations: { type: 'array', description: '推理的关系' },
        graph: { type: 'object', description: '知识图谱' }
      }
    },
    {
      id: 'design-agent',
      name: '建筑设计Agent',
      nodeType: 'agent',
      category: 'design',
      status: 'active',
      description: '自主完成建筑设计任务',
      capabilities: ['需求分析', '方案生成', '布局优化', '规范检查'],
      inputs: {
        requirements: { type: 'object', required: true },
        constraints: { type: 'array' },
        style: { type: 'string' }
      },
      outputs: {
        design: { type: 'object', description: '设计方案' },
        visualizations: { type: 'array', description: '可视化效果' },
        compliance: { type: 'object', description: '合规性报告' }
      }
    },
    {
      id: 'review-agent',
      name: '合规审查Agent',
      nodeType: 'agent',
      category: 'compliance',
      status: 'active',
      description: '自动审查设计是否符合规范',
      capabilities: ['规范检查', '问题诊断', '修改建议', '报告生成'],
      inputs: {
        design: { type: 'object', required: true },
        standards: { type: 'array' }
      },
      outputs: {
        issues: { type: 'array', description: '发现的问题' },
        suggestions: { type: 'array', description: '修改建议' },
        report: { type: 'object', description: '审查报告' }
      }
    }
  ],
  
  // 函数节点
  functions: [
    {
      id: 'file-upload',
      name: '文件上传',
      nodeType: 'function',
      category: 'io',
      status: 'active',
      description: '接收并处理文件上传',
      inputs: {
        file: { type: 'file', required: true }
      },
      outputs: {
        fileId: { type: 'string' },
        filePath: { type: 'string' },
        metadata: { type: 'object' }
      }
    },
    {
      id: 'text-splitter',
      name: '文本分块',
      nodeType: 'function',
      category: 'processing',
      status: 'active',
      description: '将长文本分割成块',
      inputs: {
        text: { type: 'string', required: true },
        chunkSize: { type: 'number', default: 1000 },
        overlap: { type: 'number', default: 200 }
      },
      outputs: {
        chunks: { type: 'array' }
      }
    },
    {
      id: 'format-converter',
      name: '格式转换',
      nodeType: 'function',
      category: 'processing',
      status: 'active',
      description: '数据格式转换',
      inputs: {
        data: { type: 'any', required: true },
        fromFormat: { type: 'string', required: true },
        toFormat: { type: 'string', required: true }
      },
      outputs: {
        converted: { type: 'any' }
      }
    }
  ],
  
  // 规则节点（从引擎中提取的单一规则）
  rules: [
    {
      id: 'height-check',
      name: '建筑高度检查',
      nodeType: 'rule',
      category: 'validation',
      status: 'active',
      description: '检查建筑高度是否符合规范',
      inputs: {
        height: { type: 'number', required: true },
        zoning: { type: 'string', required: true }
      },
      outputs: {
        valid: { type: 'boolean' },
        message: { type: 'string' }
      }
    }
  ]
};

// 获取节点类型
router.get('/types', authMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      data: [
        { id: 'service', name: '服务节点', description: '调用外部服务' },
        { id: 'agent', name: 'Agent节点', description: '智能Agent处理' },
        { id: 'function', name: '函数节点', description: '内置函数处理' },
        { id: 'rule', name: '规则节点', description: '规则引擎处理' },
        { id: 'engine', name: '引擎节点', description: '自定义引擎处理' }
      ]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取节点类型失败',
      error: error.message
    });
  }
});

// 获取所有节点
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { type, category, status } = req.query;
    
    // 合并所有节点
    let allNodes = [
      ...nodeRegistry.services,
      ...nodeRegistry.agents,
      ...nodeRegistry.functions,
      ...nodeRegistry.rules
    ];
    
    // 从数据库获取引擎节点
    let engineNodes = { rows: [] };
    try {
      const engines = await db('engines')
        .select('id', 'name', 'domain as category', 'status', 'description', 'methods', 'config', 'rule_count')
        .whereNull('deleted_at');
      engineNodes.rows = engines;
    } catch (dbError) {
      console.log('获取引擎节点失败:', dbError.message);
      // 继续返回其他节点，不中断
    }
    
    // 转换引擎为节点格式
    const engines = engineNodes.rows.map(engine => ({
      id: engine.id,
      name: engine.name,
      nodeType: 'engine',
      category: engine.category,
      status: engine.status,
      description: engine.description,
      rule_count: engine.rule_count || 0,
      methods: engine.methods,
      config: engine.config
    }));
    
    allNodes = [...allNodes, ...engines];
    
    // 过滤
    if (type) {
      allNodes = allNodes.filter(node => node.nodeType === type);
    }
    if (category) {
      allNodes = allNodes.filter(node => node.category === category);
    }
    if (status) {
      allNodes = allNodes.filter(node => node.status === status);
    }
    
    res.json({
      success: true,
      data: allNodes,
      count: allNodes.length
    });
  } catch (error) {
    console.error('获取节点失败:', error);
    res.status(500).json({
      success: false,
      error: '获取节点失败'
    });
  }
});

// 获取节点详情
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 在所有节点中查找
    const allNodes = [
      ...nodeRegistry.services,
      ...nodeRegistry.agents,
      ...nodeRegistry.functions,
      ...nodeRegistry.rules
    ];
    
    let node = allNodes.find(n => n.id === id);
    
    // 如果不是预定义节点，从数据库查找引擎
    if (!node) {
      try {
        const engine = await db('engines')
          .where('id', id)
          .whereNull('deleted_at')
          .first();
        
        if (engine) {
          node = {
            ...engine,
            nodeType: 'engine',
            category: engine.domain
          };
        }
      } catch (dbError) {
        console.log('查找引擎节点失败:', dbError.message);
      }
    }
    
    if (!node) {
      return res.status(404).json({
        success: false,
        error: '节点不存在'
      });
    }
    
    res.json({
      success: true,
      data: node
    });
  } catch (error) {
    console.error('获取节点详情失败:', error);
    res.status(500).json({
      success: false,
      error: '获取节点详情失败'
    });
  }
});

// 执行节点
router.post('/:id/execute', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { input, context } = req.body;
    
    // 查找节点
    const allNodes = [
      ...nodeRegistry.services,
      ...nodeRegistry.agents,
      ...nodeRegistry.functions,
      ...nodeRegistry.rules
    ];
    
    const node = allNodes.find(n => n.id === id);
    
    if (!node) {
      // 尝试作为引擎执行
      return require('./engines').executeEngine(req, res);
    }
    
    // 根据节点类型执行
    let result;
    switch (node.nodeType) {
      case 'service':
        // 调用服务端点
        result = await callServiceEndpoint(node.endpoint, input);
        break;
      
      case 'agent':
        // 执行Agent
        result = await executeAgent(node.id, input, context);
        break;
      
      case 'function':
        // 执行函数
        result = await executeFunction(node.id, input);
        break;
      
      case 'rule':
        // 执行规则
        result = await executeRule(node.id, input);
        break;
      
      default:
        throw new Error(`不支持的节点类型: ${node.nodeType}`);
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('执行节点失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 辅助函数
async function callServiceEndpoint(endpoint, input) {
  // 这里实际调用服务端点
  // 示例实现
  return {
    executed: true,
    endpoint,
    input,
    output: { success: true }
  };
}

async function executeAgent(agentId, input, context) {
  // 执行Agent逻辑
  // 根据不同的Agent ID执行不同的逻辑
  if (agentId === 'langextract-agent') {
    const LangExtractAgent = require('../services/langextract/langextract_integration');
    const agent = new LangExtractAgent();
    return await agent.process(input);
  }
  
  return {
    executed: true,
    agentId,
    input,
    output: { success: true }
  };
}

async function executeFunction(functionId, input) {
  // 执行函数逻辑
  const functions = {
    'file-upload': (input) => ({
      fileId: `file_${Date.now()}`,
      filePath: `/uploads/${input.file.name}`,
      metadata: { size: input.file.size, type: input.file.type }
    }),
    'text-splitter': (input) => {
      const { text, chunkSize = 1000, overlap = 200 } = input;
      const chunks = [];
      for (let i = 0; i < text.length; i += chunkSize - overlap) {
        chunks.push(text.slice(i, i + chunkSize));
      }
      return { chunks };
    },
    'format-converter': (input) => {
      // 简单的格式转换示例
      return { converted: JSON.stringify(input.data) };
    }
  };
  
  const fn = functions[functionId];
  if (!fn) {
    throw new Error(`未找到函数: ${functionId}`);
  }
  
  return fn(input);
}

async function executeRule(ruleId, input) {
  // 执行规则逻辑
  const rules = {
    'height-check': (input) => {
      const { height, zoning } = input;
      const limits = {
        'R1': 24,
        'R2': 54,
        'R3': 80,
        'C1': 100
      };
      const limit = limits[zoning] || 100;
      const valid = height <= limit;
      return {
        valid,
        message: valid ? '高度符合规范' : `超过${zoning}区域限高${limit}米`
      };
    }
  };
  
  const rule = rules[ruleId];
  if (!rule) {
    throw new Error(`未找到规则: ${ruleId}`);
  }
  
  return rule(input);
}

module.exports = router;