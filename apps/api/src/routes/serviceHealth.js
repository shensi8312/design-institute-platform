/**
 * 服务健康检查和诊断路由
 * 用于检查所有AI服务的状态和诊断问题
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticate } = require('../middleware/auth');
const db = require('../config/database');
const realTimeProcessor = require('../services/document/realTimeDocumentProcessor');

// 服务配置
const SERVICES = {
  docRecognition: {
    name: '文档识别服务',
    url: 'http://localhost:8086',
    endpoints: ['/health', '/api/recognize'],
    startCommand: 'cd services/document-recognition && python3 app.py',
    description: 'OCR、PDF解析、图像识别'
  },
  vectorService: {
    name: '向量化服务',
    url: 'http://localhost:8085',
    endpoints: ['/health', '/api/vectorize', '/api/search'],
    startCommand: 'cd services/vector-service && python3 app.py',
    description: 'Embedding生成、Milvus存储'
  },
  graphRAG: {
    name: 'GraphRAG服务',
    url: 'http://localhost:8081',
    endpoints: ['/health', '/api/graph', '/api/extract'],
    startCommand: 'cd graph-rag && python3 start_real_graphrag.py',
    description: 'Microsoft GraphRAG、Neo4j图谱'
  },
  ollama: {
    name: 'Ollama服务',
    url: 'http://localhost:11434',
    endpoints: ['/api/tags', '/api/generate'],
    startCommand: 'ollama serve',
    description: '本地LLM服务'
  },
  neo4j: {
    name: 'Neo4j图数据库',
    url: 'http://localhost:7474',
    endpoints: ['/'],
    startCommand: 'docker start neo4j-design',
    description: '知识图谱存储'
  },
  milvus: {
    name: 'Milvus向量数据库',
    url: 'http://localhost:19530',
    endpoints: ['/health'],
    startCommand: 'docker start milvus-standalone',
    description: '向量存储'
  },
  minio: {
    name: 'MinIO对象存储',
    url: 'http://localhost:9000',
    endpoints: ['/minio/health/live'],
    startCommand: 'docker start mst-minio',
    description: '文件存储'
  }
};

/**
 * 检查单个服务健康状态
 */
async function checkService(serviceKey) {
  const service = SERVICES[serviceKey];
  const result = {
    key: serviceKey,
    name: service.name,
    description: service.description,
    url: service.url,
    status: 'offline',
    responseTime: null,
    endpoints: {},
    error: null,
    startCommand: service.startCommand
  };

  try {
    // 检查主健康端点
    const startTime = Date.now();
    const healthEndpoint = service.endpoints[0];
    const response = await axios.get(`${service.url}${healthEndpoint}`, {
      timeout: 3000,
      validateStatus: () => true // 接受任何状态码
    });
    
    result.responseTime = Date.now() - startTime;
    result.status = response.status < 500 ? 'online' : 'error';
    
    // 检查其他端点
    for (const endpoint of service.endpoints) {
      try {
        const epResponse = await axios.get(`${service.url}${endpoint}`, {
          timeout: 2000,
          validateStatus: () => true
        });
        result.endpoints[endpoint] = {
          status: epResponse.status,
          available: epResponse.status < 500
        };
      } catch (epError) {
        result.endpoints[endpoint] = {
          status: 0,
          available: false,
          error: epError.code
        };
      }
    }
  } catch (error) {
    result.status = 'offline';
    result.error = {
      code: error.code,
      message: error.message
    };
  }

  return result;
}

/**
 * 获取所有服务健康状态
 * GET /api/service-health
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const results = {};
    const promises = [];

    // 并行检查所有服务
    for (const serviceKey of Object.keys(SERVICES)) {
      promises.push(
        checkService(serviceKey).then(result => {
          results[serviceKey] = result;
        })
      );
    }

    await Promise.all(promises);

    // 统计信息
    const stats = {
      total: Object.keys(results).length,
      online: Object.values(results).filter(r => r.status === 'online').length,
      offline: Object.values(results).filter(r => r.status === 'offline').length,
      error: Object.values(results).filter(r => r.status === 'error').length
    };

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats,
      services: results
    });
  } catch (error) {
    console.error('健康检查失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取单个服务详细状态
 * GET /api/service-health/:service
 */
router.get('/:service', authenticate, async (req, res) => {
  const { service } = req.params;
  
  if (!SERVICES[service]) {
    return res.status(404).json({
      success: false,
      error: '服务不存在'
    });
  }

  try {
    const result = await checkService(service);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 诊断文档处理问题
 * POST /api/service-health/diagnose
 */
router.post('/diagnose', authenticate, async (req, res) => {
  const { documentId } = req.body;
  
  try {
    const diagnosis = {
      timestamp: new Date().toISOString(),
      document: null,
      services: {},
      recommendations: []
    };

    // 1. 获取文档信息
    if (documentId) {
      const [doc] = await db('knowledge_documents')
        .where('id', documentId)
        .limit(1);
      
      if (doc) {
        diagnosis.document = {
          id: doc.id,
          name: doc.name,
          status: {
            minio: doc.minio_status,
            vector: doc.vector_status,
            graph: doc.graph_status
          },
          error_details: doc.error_details ? JSON.parse(doc.error_details) : null
        };
      }
    }

    // 2. 检查所有服务状态
    const serviceStatus = await realTimeProcessor.checkAllServices();
    diagnosis.services = serviceStatus;

    // 3. 生成诊断建议
    const offlineServices = [];
    for (const [key, status] of Object.entries(serviceStatus)) {
      if (status.status === 'offline') {
        offlineServices.push(key);
        const service = SERVICES[key];
        if (service) {
          diagnosis.recommendations.push({
            type: 'error',
            service: key,
            message: `${service.name}未启动`,
            action: `请运行: ${service.startCommand}`
          });
        }
      }
    }

    // 4. 检查数据库连接
    try {
      await db.raw('SELECT 1');
      diagnosis.database = { status: 'online' };
    } catch (dbError) {
      diagnosis.database = { 
        status: 'offline', 
        error: dbError.message 
      };
      diagnosis.recommendations.push({
        type: 'error',
        service: 'database',
        message: 'PostgreSQL数据库连接失败',
        action: 'docker restart design-postgres'
      });
    }

    // 5. 检查文档具体问题
    if (diagnosis.document) {
      if (diagnosis.document.status.vector === 'failed' || diagnosis.document.status.vector === 'error') {
        diagnosis.recommendations.push({
          type: 'warning',
          service: 'vectorService',
          message: '文档向量化失败',
          action: '检查向量服务日志和Milvus连接'
        });
      }
      
      if (diagnosis.document.status.graph === 'failed' || diagnosis.document.status.graph === 'error') {
        diagnosis.recommendations.push({
          type: 'warning',
          service: 'graphRAG',
          message: '知识图谱提取失败',
          action: '检查GraphRAG服务和Neo4j连接'
        });
      }
    }

    // 6. 生成总体建议
    if (offlineServices.length === 0 && diagnosis.database.status === 'online') {
      diagnosis.recommendations.unshift({
        type: 'success',
        message: '所有服务运行正常',
        action: '可以正常处理文档'
      });
    } else {
      diagnosis.recommendations.unshift({
        type: 'error',
        message: `有 ${offlineServices.length} 个服务离线`,
        action: '请按照建议启动相应服务'
      });
    }

    res.json({
      success: true,
      diagnosis
    });

  } catch (error) {
    console.error('诊断失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取失败文档列表
 * GET /api/service-health/failed-documents
 */
router.get('/failed-documents', authenticate, async (req, res) => {
  try {
    const failedDocs = await db('knowledge_documents')
      .where(function() {
        this.where('vector_status', 'failed')
          .orWhere('vector_status', 'error')
          .orWhere('graph_status', 'failed')
          .orWhere('graph_status', 'error');
      })
      .orderBy('created_at', 'desc')
      .limit(20);

    const documents = failedDocs.map(doc => ({
      id: doc.id,
      name: doc.name,
      created_at: doc.created_at,
      status: {
        minio: doc.minio_status,
        vector: doc.vector_status,
        graph: doc.graph_status
      },
      error_details: doc.error_details ? JSON.parse(doc.error_details) : null
    }));

    res.json({
      success: true,
      count: documents.length,
      documents
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 重试失败的文档
 * POST /api/service-health/retry/:documentId
 */
router.post('/retry/:documentId', authenticate, async (req, res) => {
  const { documentId } = req.params;

  try {
    // 获取文档信息
    const [doc] = await db('knowledge_documents')
      .where('id', documentId)
      .limit(1);

    if (!doc) {
      return res.status(404).json({
        success: false,
        error: '文档不存在'
      });
    }

    // 检查服务状态
    const serviceStatus = await realTimeProcessor.checkAllServices();
    const offlineServices = Object.entries(serviceStatus)
      .filter(([_, status]) => status.status === 'offline')
      .map(([key, _]) => key);

    if (offlineServices.length > 0) {
      return res.status(400).json({
        success: false,
        error: '有服务离线，无法重试',
        offlineServices
      });
    }

    // 重置状态
    await db('knowledge_documents')
      .where('id', documentId)
      .update({
        vector_status: 'pending',
        graph_status: 'pending',
        error_details: null,
        updated_at: new Date()
      });

    // 触发重新处理
    const documentInfo = {
      id: doc.id,
      name: doc.name,
      filePath: doc.file_path,
      kbId: doc.kb_id
    };

    const processResult = await realTimeProcessor.processDocument(documentInfo, {
      enableOCR: true,
      enableVector: true,
      enableGraph: true,
      extractEntities: true,
      async: true  // 异步处理
    });

    res.json({
      success: true,
      message: '文档已加入重试队列',
      processId: processResult.processId
    });

  } catch (error) {
    console.error('重试失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;