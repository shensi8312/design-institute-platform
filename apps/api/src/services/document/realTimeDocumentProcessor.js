/**
 * 实时文档处理服务
 * 在文档上传时立即进行识别、向量化和知识图谱提取
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const db = require('../../config/database');
const logger = console;

// 服务配置
const SERVICE_CONFIG = {
  // [PE-enhancement] 优先使用LangExtract主服务，降级到原有服务
  langExtractMain: process.env.LANGEXTRACT_MAIN_URL || 'http://localhost:8092',  // LangExtract主服务（新）
  docRecognition: process.env.DOC_RECOGNITION_URL || 'http://localhost:8086',     // 原文档识别（备用）
  vectorService: process.env.VECTOR_SERVICE_URL || 'http://localhost:8085',
  graphRAG: process.env.GRAPHRAG_URL || 'http://localhost:8081',
  timeout: 180000,  // 3分钟超时，适应大型扫描版PDF的OCR处理
  useLangExtract: process.env.USE_LANGEXTRACT !== 'false'  // 默认启用LangExtract
};

// 处理状态枚举
const ProcessStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

class RealTimeDocumentProcessor extends EventEmitter {
  constructor() {
    super();
    this.processingQueue = new Map();
  }

  /**
   * 处理上传的文档
   * @param {Object} document - 文档信息
   * @param {string} document.id - 文档ID
   * @param {string} document.name - 文档名称
   * @param {string} document.filePath - 文件路径
   * @param {string} document.kbId - 知识库ID
   * @param {Object} options - 处理选项
   * @returns {Promise<Object>} 处理结果
   */
  async processDocument(document, options = {}) {
    const {
      enableOCR = true,
      enableVector = true,
      enableGraph = true,
      extractEntities = true,
      async = false
    } = options;

    const processId = `process_${document.id}_${Date.now()}`;
    const processInfo = {
      id: processId,
      documentId: document.id,
      documentName: document.name,
      status: ProcessStatus.PENDING,
      steps: {
        recognition: { status: ProcessStatus.PENDING },
        vectorization: { status: ProcessStatus.PENDING },
        graphExtraction: { status: ProcessStatus.PENDING }
      },
      startTime: new Date(),
      results: {}
    };

    this.processingQueue.set(processId, processInfo);

    // 如果是异步处理，立即返回处理ID
    if (async) {
      this._processAsync(document, processInfo, { enableOCR, enableVector, enableGraph, extractEntities });
      return {
        success: true,
        processId,
        message: '文档已加入处理队列',
        status: ProcessStatus.PROCESSING
      };
    }

    // 同步处理
    try {
      const result = await this._processSync(document, processInfo, { 
        enableOCR, 
        enableVector, 
        enableGraph, 
        extractEntities 
      });
      return result;
    } catch (error) {
      logger.error('文档处理失败:', error);
      processInfo.status = ProcessStatus.FAILED;
      processInfo.error = error.message;
      return {
        success: false,
        processId,
        error: error.message,
        status: ProcessStatus.FAILED
      };
    }
  }

  /**
   * 同步处理文档
   */
  async _processSync(document, processInfo, options) {
    processInfo.status = ProcessStatus.PROCESSING;
    this.emit('process:start', processInfo);

    const results = {
      recognition: null,
      vectorization: null,
      graphExtraction: null,
      entities: []
    };

    try {
      // Step 1: 文档识别和文本提取
      logger.info(`[1/3] 开始文档识别: ${document.name}`);
      processInfo.steps.recognition.status = ProcessStatus.PROCESSING;
      this.emit('step:start', { processId: processInfo.id, step: 'recognition' });

      const recognitionResult = await this._recognizeDocument(document);
      results.recognition = recognitionResult;
      
      // 从recognition结果中提取文本 - 兼容新旧格式
      let extractedText = '';
      let structuredExtraction = null;  // [PE-enhancement] 保存结构化提取数据
      
      // 检查是否来自LangExtract主服务（新格式）
      if (recognitionResult.text) {
        extractedText = recognitionResult.text;
        logger.info(`✅ 使用LangExtract处理结果: ${extractedText.length} 字符`);
        
        // 保存结构化提取数据
        if (recognitionResult.structured_extraction) {
          structuredExtraction = recognitionResult.structured_extraction;
          logger.info(`📊 结构化数据: ${structuredExtraction.extraction_count}条信息，类型: ${structuredExtraction.extraction_types?.join(', ')}`);
        }
      }
      // 兼容旧格式
      else if (recognitionResult.data) {
        // 优先使用统一的text字段（新格式）
        if (recognitionResult.data.text) {
          extractedText = recognitionResult.data.text;
          logger.info(`使用统一text字段: ${extractedText.length} 字符`);
        }
        // 兼容旧格式 - 从pages/recognition字段提取
        else if (recognitionResult.data.pages) {
          // 直接的pages数组（某些旧版本）
          extractedText = recognitionResult.data.pages
            .map(page => page.text || '')
            .join('\n')
            .trim();
          logger.info(`从pages数组提取: ${extractedText.length} 字符`);
        }
        else if (recognitionResult.data.recognition) {
          const recognition = recognitionResult.data.recognition;
          
          // 处理PDF格式 - 从pages数组中提取文本
          if (recognition.type === 'pdf' && recognition.pages) {
            extractedText = recognition.pages
              .map(page => page.text || '')
              .join('\n')
              .trim();
          }
          // 处理其他格式 - 直接从text字段获取
          else if (recognition.text) {
            extractedText = recognition.text;
          }
          // 处理Word格式 - 从paragraphs中提取
          else if (recognition.paragraphs) {
            extractedText = recognition.paragraphs
              .map(p => p.text || '')
              .join('\n')
              .trim();
          }
        }
      }
      
      processInfo.steps.recognition.status = ProcessStatus.COMPLETED;
      processInfo.steps.recognition.result = {
        textLength: extractedText.length,
        hasImages: recognitionResult.data?.recognition?.pages?.some(p => p.images?.length > 0) || false,
        hasTables: recognitionResult.data?.recognition?.pages?.some(p => p.tables?.length > 0) || false
      };
      this.emit('step:complete', { processId: processInfo.id, step: 'recognition', result: recognitionResult });

      // 如果没有文本内容，直接失败
      if (!extractedText) {
        const errorMsg = `文档识别失败：未能从 ${document.name} 中提取到文本内容`;
        logger.error(errorMsg);
        
        // 更新数据库状态为失败，保存错误原因
        await db('knowledge_documents')
          .where('id', document.id)
          .update({ 
            recognition_status: 'failed',
            vector_status: 'failed',
            graph_status: 'failed',
            recognition_error: errorMsg,
            vector_error: '由于文档识别失败，未进行向量化',
            graph_error: '由于文档识别失败，未进行图谱提取',
            updated_at: new Date()
          });
        
        throw new Error(errorMsg);
      }

      // Step 2: 向量化处理（并行）
      const promises = [];

      if (options.enableVector) {
        logger.info(`[2/3] 开始向量化处理: ${document.name}`);
        processInfo.steps.vectorization.status = ProcessStatus.PROCESSING;
        this.emit('step:start', { processId: processInfo.id, step: 'vectorization' });

        promises.push(
          this._vectorizeDocument(document.id, extractedText, document.kbId)
            .then(result => {
              results.vectorization = result;
              processInfo.steps.vectorization.status = ProcessStatus.COMPLETED;
              processInfo.steps.vectorization.result = {
                vectorCount: result.vector_count || 0,
                success: result.success
              };
              this.emit('step:complete', { processId: processInfo.id, step: 'vectorization', result });
            })
            .catch(async error => {
              logger.error('向量化失败:', error);
              processInfo.steps.vectorization.status = ProcessStatus.FAILED;
              processInfo.steps.vectorization.error = error.message;
              results.vectorization = { success: false, error: error.message };
              
              // 更新数据库状态
              try {
                await db('knowledge_documents')
                  .where('id', document.id)
                  .update({ 
                    vector_status: 'failed',
                    vector_error: error.message,
                    updated_at: new Date()
                  });
              } catch (dbError) {
                logger.error('更新向量化状态失败:', dbError);
              }
              // 不要抛出错误，让其他处理继续
            })
        );
      }

      // Step 3: 知识图谱提取（并行）
      if (options.enableGraph && options.extractEntities) {
        logger.info(`[3/3] 开始知识图谱提取: ${document.name}`);
        processInfo.steps.graphExtraction.status = ProcessStatus.PROCESSING;
        this.emit('step:start', { processId: processInfo.id, step: 'graphExtraction' });

        promises.push(
          this._extractEntitiesAndRelations(document.id, extractedText)
            .then(result => {
              results.graphExtraction = result;
              results.entities = result.entities || [];
              processInfo.steps.graphExtraction.status = ProcessStatus.COMPLETED;
              processInfo.steps.graphExtraction.result = {
                entityCount: result.entities?.length || 0,
                relationCount: result.relations?.length || 0
              };
              this.emit('step:complete', { processId: processInfo.id, step: 'graphExtraction', result });
            })
            .catch(async error => {
              logger.error('图谱提取失败:', error);
              processInfo.steps.graphExtraction.status = ProcessStatus.FAILED;
              processInfo.steps.graphExtraction.error = error.message;
              results.graphExtraction = { success: false, error: error.message };
              results.entities = [];
              
              // 更新数据库状态
              try {
                await db('knowledge_documents')
                  .where('id', document.id)
                  .update({ 
                    graph_status: 'failed',
                    graph_error: error.message,
                    updated_at: new Date()
                  });
              } catch (dbError) {
                logger.error('更新图谱状态失败:', dbError);
              }
              // 图谱提取失败不影响整体流程
            })
        );
      }

      // 等待所有并行任务完成
      await Promise.allSettled(promises);

      // 更新处理状态
      processInfo.status = ProcessStatus.COMPLETED;
      processInfo.endTime = new Date();
      processInfo.duration = processInfo.endTime - processInfo.startTime;
      processInfo.results = results;

      // 更新数据库状态为completed
      try {
        const updateData = {
          vector_status: results.vectorization?.success ? 'completed' : 'failed',
          graph_status: results.graphExtraction?.success ? 'completed' : 'failed',
          updated_at: new Date()
        };
        
        // [PE-enhancement] 如果有结构化提取数据，保存到数据库
        if (structuredExtraction) {
          updateData.structured_data = JSON.stringify(structuredExtraction.structured_data);
          updateData.has_structured_extraction = true;
          updateData.extraction_count = structuredExtraction.extraction_count;
          updateData.extraction_types = structuredExtraction.extraction_types;
          updateData.extraction_confidence = structuredExtraction.confidence_score;
        }
        
        await db('knowledge_documents')
          .where('id', document.id)
          .update(updateData);
          
        logger.info(`✅ 文档处理完成，状态已更新: ${document.id}`);
        if (structuredExtraction) {
          logger.info(`📊 已保存结构化数据: ${structuredExtraction.extraction_count}条`);
        }

        // 自动提取设计规则（如果图谱提取成功）
        if (results.graphExtraction?.success && results.graphExtraction?.nodes_count > 0) {
          try {
            logger.info(`🔍 开始自动提取设计规则...`);
            const RuleExtractionService = require('../rules/RuleExtractionService');
            const ruleService = new RuleExtractionService();
            const ruleResult = await ruleService.extractRulesFromGraph(document.id);

            if (ruleResult.success) {
              const rulesCount = ruleResult.data?.extracted_count || 0;
              logger.info(`✅ 规则提取完成: 提取了${rulesCount}条规则`);
              processInfo.rulesExtracted = rulesCount;
            } else {
              logger.warn(`⚠️ 规则提取失败: ${ruleResult.message}`);
            }
          } catch (ruleError) {
            logger.error('规则提取异常:', ruleError.message);
            // 规则提取失败不影响整体流程
          }
        }
      } catch (dbError) {
        logger.error('更新最终状态失败:', dbError);
      }

      this.emit('process:complete', processInfo);

      // 返回处理结果
      return {
        success: true,
        processId: processInfo.id,
        documentId: document.id,
        status: ProcessStatus.COMPLETED,
        results: {
          textExtracted: extractedText.length > 0,
          textLength: extractedText.length,
          vectorized: results.vectorization?.success || false,
          vectorCount: results.vectorization?.vector_count || 0,
          entitiesExtracted: results.entities.length,
          entities: results.entities.slice(0, 10), // 返回前10个实体作为预览
          relationsExtracted: results.graphExtraction?.relations?.length || 0,
          processingTime: processInfo.duration,
          // [PE-enhancement] 新增结构化提取信息
          structuredExtraction: structuredExtraction ? {
            enabled: true,
            extractionCount: structuredExtraction.extraction_count,
            extractionTypes: structuredExtraction.extraction_types,
            documentType: structuredExtraction.document_type,
            confidence: structuredExtraction.confidence_score,
            coverage: structuredExtraction.coverage_score
          } : null
        },
        steps: processInfo.steps
      };

    } catch (error) {
      processInfo.status = ProcessStatus.FAILED;
      processInfo.error = error.message;
      processInfo.endTime = new Date();
      this.emit('process:error', { processId: processInfo.id, error: error.message });
      throw error;
    }
  }

  /**
   * 异步处理文档
   */
  async _processAsync(document, processInfo, options) {
    // 在后台处理
    setImmediate(async () => {
      try {
        await this._processSync(document, processInfo, options);
      } catch (error) {
        logger.error('异步处理失败:', error);
      }
    });
  }

  /**
   * 文档识别 - 优先使用LangExtract主服务
   */
  async _recognizeDocument(document) {
    const startTime = Date.now();
    
    // [PE-enhancement] 优先使用LangExtract主服务
    if (SERVICE_CONFIG.useLangExtract) {
      try {
        logger.info(`🚀 尝试使用LangExtract主服务: ${SERVICE_CONFIG.langExtractMain}/api/process`);
        
        const formData = new FormData();
        formData.append('file', fs.createReadStream(document.filePath));
        
        const response = await axios.post(
          `${SERVICE_CONFIG.langExtractMain}/api/process`,
          formData,
          {
            headers: formData.getHeaders(),
            timeout: SERVICE_CONFIG.timeout,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          }
        );

        const duration = Date.now() - startTime;
        
        if (response.data.success) {
          logger.info(`✅ LangExtract处理成功，耗时: ${duration}ms`);
          logger.info(`📊 提取统计: ${response.data.extraction_metrics?.total_extractions || 0}条结构化信息`);
          
          // 转换为兼容的格式
          return {
            success: true,
            type: response.data.file_info?.type || 'unknown',
            text: response.data.raw_content?.text || '',
            images: response.data.raw_content?.images || [],
            tables: response.data.raw_content?.tables || [],
            metadata: response.data.file_info || {},
            // 新增的结构化数据
            structured_extraction: {
              extraction_count: response.data.extraction_metrics?.total_extractions || 0,
              extraction_types: response.data.extraction_metrics?.extraction_types || [],
              structured_data: response.data.structured_data || {},
              document_type: response.data.document_type,
              key_information: response.data.key_information,
              summary: response.data.summary,
              compliance_check: response.data.compliance_check,
              relationships: response.data.relationships,
              confidence_score: response.data.extraction_metrics?.confidence_score || 0,
              coverage_score: response.data.extraction_metrics?.coverage_score || 0
            },
            // 为下游服务准备的数据
            vector_ready: response.data.vector_ready,
            graph_ready: response.data.graph_ready
          };
        } else {
          throw new Error(response.data.error || 'LangExtract处理失败');
        }
      } catch (langExtractError) {
        logger.warn(`⚠️ LangExtract服务不可用，降级到原有服务: ${langExtractError.message}`);
        // 继续执行原有逻辑
      }
    }
    
    // 降级到原有文档识别服务
    try {
      await this._checkServiceHealth('docRecognition', SERVICE_CONFIG.docRecognition);
      
      const formData = new FormData();
      formData.append('file', fs.createReadStream(document.filePath));
      formData.append('doc_id', document.id);
      formData.append('enable_ocr', 'true');
      formData.append('extract_images', 'true');
      formData.append('extract_tables', 'true');

      logger.info(`调用原文档识别服务: ${SERVICE_CONFIG.docRecognition}/api/recognize`);
      
      const response = await axios.post(
        `${SERVICE_CONFIG.docRecognition}/api/recognize`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: SERVICE_CONFIG.timeout,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      const duration = Date.now() - startTime;
      logger.info(`文档识别完成，耗时: ${duration}ms`);

      if (response.data.success) {
        return response.data;
      } else {
        throw new Error(response.data.error || '文档识别失败');
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorInfo = {
        service: 'docRecognition',
        url: `${SERVICE_CONFIG.docRecognition}/api/recognize`,
        document: document.name,
        duration,
        error: {
          message: error.message,
          code: error.code,
          response: error.response?.data,
          status: error.response?.status
        }
      };
      
      logger.error('文档识别服务调用失败:', JSON.stringify(errorInfo, null, 2));
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`文档识别服务未启动。请运行: cd services/langextract && python3 main_document_processor.py 或 cd services/document-recognition && python3 app.py`);
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error(`文档识别服务响应超时 (${SERVICE_CONFIG.timeout}ms)`);
      }
      
      throw error;
    }
  }

  /**
   * 检查服务健康状态
   */
  async _checkServiceHealth(serviceName, serviceUrl) {
    // 跳过健康检查，因为有些服务没有health端点
    // 实际调用时如果失败会有更详细的错误信息
    logger.info(`➡️ 准备调用 ${serviceName} 服务: ${serviceUrl}`);
    return true;
  }

  /**
   * 向量化处理
   */
  async _vectorizeDocument(docId, text, kbId) {
    const startTime = Date.now();
    try {
      // 先检查服务是否可用
      await this._checkServiceHealth('vectorService', SERVICE_CONFIG.vectorService);
      
      logger.info(`调用向量服务: ${SERVICE_CONFIG.vectorService}/api/vectorize`);
      logger.info(`文本长度: ${text.length}, 知识库ID: ${kbId}`);
      
      const response = await axios.post(
        `${SERVICE_CONFIG.vectorService}/api/vectorize`,
        {
          doc_id: docId,
          content: text,
          kb_id: kbId,
          chunk_size: 500,
          chunk_overlap: 50
        },
        {
          timeout: SERVICE_CONFIG.timeout
        }
      );

      const duration = Date.now() - startTime;
      logger.info(`向量化完成，耗时: ${duration}ms`);
      
      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorInfo = {
        service: 'vectorService',
        url: `${SERVICE_CONFIG.vectorService}/api/vectorize`,
        docId,
        textLength: text?.length,
        duration,
        error: {
          message: error.message,
          code: error.code,
          response: error.response?.data
        }
      };
      
      logger.error('向量服务调用失败:', JSON.stringify(errorInfo, null, 2));
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`向量服务未启动 (${SERVICE_CONFIG.vectorService})。请运行: cd services/vector-service && python3 app.py`);
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error(`向量服务响应超时 (${SERVICE_CONFIG.timeout}ms)`);
      }
      
      throw error;
    }
  }

  /**
   * 实体关系提取
   */
  async _extractEntitiesAndRelations(docId, text) {
    const startTime = Date.now();
    try {
      // 先检查服务是否可用
      await this._checkServiceHealth('graphRAG', SERVICE_CONFIG.graphRAG);
      
      const textToProcess = text.substring(0, 5000); // 限制文本长度
      logger.info(`调用GraphRAG服务: ${SERVICE_CONFIG.graphRAG}/api/extract`);
      logger.info(`处理文本长度: ${textToProcess.length}`);
      
      const response = await axios.post(
        `${SERVICE_CONFIG.graphRAG}/api/extract`,
        {
          text: textToProcess,
          doc_id: docId,
          use_ollama: true,
          extract_relations: true
        },
        {
          timeout: SERVICE_CONFIG.timeout
        }
      );

      const duration = Date.now() - startTime;
      logger.info(`知识图谱提取完成，耗时: ${duration}ms`);
      
      // GraphRAG服务现在直接返回实体和关系，不需要success字段
      if (response.data && response.data.entities) {
        const result = {
          entities: response.data.entities || [],
          relations: response.data.relations || []
        };
        logger.info(`提取结果: ${result.entities.length} 个实体, ${result.relations.length} 个关系`);
        return result;
      }

      throw new Error('GraphRAG服务返回数据格式错误');
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorInfo = {
        service: 'graphRAG',
        url: `${SERVICE_CONFIG.graphRAG}/api/extract`,
        docId,
        textLength: text?.length,
        duration,
        error: {
          message: error.message,
          code: error.code,
          response: error.response?.data
        }
      };
      
      logger.error('GraphRAG服务调用失败:', JSON.stringify(errorInfo, null, 2));
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`GraphRAG服务未启动 (${SERVICE_CONFIG.graphRAG})。请运行: cd graph-rag && python3 start_real_graphrag.py`);
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error(`GraphRAG服务响应超时 (${SERVICE_CONFIG.timeout}ms)`);
      }
      
      throw error;
    }
  }

  /**
   * 获取所有服务状态
   */
  async checkAllServices() {
    const services = [
      { name: 'docRecognition', url: SERVICE_CONFIG.docRecognition },
      { name: 'vectorService', url: SERVICE_CONFIG.vectorService },
      { name: 'graphRAG', url: SERVICE_CONFIG.graphRAG }
    ];
    
    const results = {};
    
    for (const service of services) {
      try {
        await axios.get(`${service.url}/health`, { timeout: 3000 });
        results[service.name] = {
          status: 'online',
          url: service.url
        };
      } catch (error) {
        results[service.name] = {
          status: 'offline',
          url: service.url,
          error: error.message
        };
      }
    }
    
    return results;
  }

  /**
   * 获取处理状态
   */
  getProcessStatus(processId) {
    return this.processingQueue.get(processId);
  }

  /**
   * 获取所有处理任务
   */
  getAllProcesses() {
    return Array.from(this.processingQueue.values());
  }

  /**
   * 清理已完成的任务
   */
  cleanupCompleted(olderThanMinutes = 30) {
    const cutoffTime = Date.now() - (olderThanMinutes * 60 * 1000);
    
    for (const [processId, processInfo] of this.processingQueue.entries()) {
      if (processInfo.status === ProcessStatus.COMPLETED && 
          processInfo.endTime && 
          processInfo.endTime.getTime() < cutoffTime) {
        this.processingQueue.delete(processId);
      }
    }
  }
}

// 创建单例实例
const processor = new RealTimeDocumentProcessor();

// 定期清理已完成的任务
setInterval(() => {
  processor.cleanupCompleted(30);
}, 60 * 60 * 1000); // 每小时清理一次

module.exports = processor;