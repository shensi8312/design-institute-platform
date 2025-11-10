/**
 * ServiceEngineAdapter - 将现有微服务适配为引擎节点
 */

const axios = require('axios');
const db = require('../../config/database');
const EngineCore = require('../core/EngineCore');

class ServiceEngineAdapter {
    constructor() {
        // 已注册的服务映射
        this.services = new Map();
        this.initialize();
    }

    async initialize() {
        // 扫描并注册所有现有服务
        await this.discoverServices();
    }

    /**
     * 发现并注册现有的微服务
     */
    async discoverServices() {
        // 1. 扫描本地服务
        const localServices = [
            {
                id: 'doc_recognition',
                name: '文档识别服务',
                endpoint: 'http://localhost:5001/api/recognize',
                category: '文档处理',
                description: 'YOLO + OCR 文档识别',
                inputs: {
                    file: { type: 'file', required: true },
                    mode: { type: 'string', enum: ['fast', 'accurate'], default: 'fast' }
                },
                outputs: {
                    text: { type: 'string' },
                    entities: { type: 'array' },
                    confidence: { type: 'number' }
                }
            },
            {
                id: 'langextract',
                name: 'LangExtract服务',
                endpoint: 'http://localhost:5002/api/extract',
                category: '知识提取',
                description: '智能文档信息提取',
                inputs: {
                    document: { type: 'string', required: true },
                    extractionType: { type: 'string', enum: ['rules', 'entities', 'all'] }
                },
                outputs: {
                    rules: { type: 'array' },
                    entities: { type: 'array' },
                    relations: { type: 'array' }
                }
            },
            {
                id: 'vector_search',
                name: '向量搜索服务',
                endpoint: 'http://localhost:3000/api/vector/search',
                category: 'RAG',
                description: 'Milvus向量相似度搜索',
                inputs: {
                    query: { type: 'string', required: true },
                    collection: { type: 'string', default: 'knowledge_base' },
                    topK: { type: 'number', default: 10 }
                },
                outputs: {
                    results: { type: 'array' },
                    scores: { type: 'array' }
                }
            },
            {
                id: 'graph_query',
                name: '图谱查询服务',
                endpoint: 'http://localhost:3000/api/graph/query',
                category: 'RAG',
                description: 'Neo4j知识图谱查询',
                inputs: {
                    cypher: { type: 'string' },
                    entityId: { type: 'string' },
                    hops: { type: 'number', default: 2 }
                },
                outputs: {
                    nodes: { type: 'array' },
                    edges: { type: 'array' }
                }
            },
            {
                id: 'ollama_inference',
                name: 'Ollama推理服务',
                endpoint: 'http://localhost:11434/api/generate',
                category: 'AI',
                description: '本地LLM推理',
                inputs: {
                    prompt: { type: 'string', required: true },
                    model: { type: 'string', default: 'qwen2' },
                    temperature: { type: 'number', default: 0.7 }
                },
                outputs: {
                    response: { type: 'string' },
                    tokens: { type: 'number' }
                }
            },
            {
                id: 'cad_parser',
                name: 'CAD解析服务',
                endpoint: 'http://localhost:5003/api/parse-cad',
                category: '建筑',
                description: 'DXF/DWG文件解析',
                inputs: {
                    file: { type: 'file', required: true },
                    extractLayers: { type: 'boolean', default: true }
                },
                outputs: {
                    entities: { type: 'array' },
                    layers: { type: 'array' },
                    metadata: { type: 'object' }
                }
            }
        ];

        // 2. 从数据库加载用户定义的服务
        const customServices = await db('custom_services').select('*');
        
        // 3. 合并并注册所有服务
        const allServices = [...localServices, ...customServices];
        
        for (const service of allServices) {
            await this.registerService(service);
        }

        console.log(`已发现并注册 ${allServices.length} 个服务`);
    }

    /**
     * 注册服务为引擎
     */
    async registerService(serviceConfig) {
        // 创建引擎定义
        const engineDefinition = {
            id: `service_${serviceConfig.id}`,
            metadata: {
                name: serviceConfig.name,
                version: '1.0',
                domain: serviceConfig.category,
                author: 'system',
                description: serviceConfig.description,
                icon: this.getIconForCategory(serviceConfig.category),
                tags: ['service', serviceConfig.category]
            },
            
            schema: {
                inputs: serviceConfig.inputs,
                outputs: serviceConfig.outputs
            },
            
            config: {
                endpoint: serviceConfig.endpoint,
                timeout: serviceConfig.timeout || 30000,
                retries: serviceConfig.retries || 3
            },
            
            // 执行函数
            processFunction: this.createServiceExecutor(serviceConfig)
        };

        // 注册到引擎核心
        await EngineCore.registerEngine(engineDefinition);
        
        // 保存到内存
        this.services.set(serviceConfig.id, serviceConfig);
    }

    /**
     * 创建服务执行器
     */
    createServiceExecutor(serviceConfig) {
        return async function(input, context) {
            try {
                // 调用实际的微服务
                const response = await axios({
                    method: serviceConfig.method || 'POST',
                    url: serviceConfig.endpoint,
                    data: input,
                    headers: {
                        'Content-Type': 'application/json',
                        ...context.headers
                    },
                    timeout: serviceConfig.timeout || 30000
                });

                return {
                    success: true,
                    data: response.data,
                    serviceId: serviceConfig.id,
                    executionTime: Date.now() - context.startTime
                };
            } catch (error) {
                console.error(`服务调用失败: ${serviceConfig.id}`, error);
                
                // 错误处理策略
                if (serviceConfig.fallback) {
                    // 降级处理
                    return serviceConfig.fallback(input, context);
                }
                
                throw error;
            }
        };
    }

    /**
     * 动态添加新服务
     */
    async addService(serviceConfig) {
        // 验证服务配置
        this.validateServiceConfig(serviceConfig);
        
        // 测试服务可用性
        const isAvailable = await this.testService(serviceConfig);
        if (!isAvailable) {
            throw new Error(`服务不可用: ${serviceConfig.endpoint}`);
        }
        
        // 保存到数据库
        await db('custom_services').insert({
            id: serviceConfig.id,
            name: serviceConfig.name,
            endpoint: serviceConfig.endpoint,
            category: serviceConfig.category,
            description: serviceConfig.description,
            config: JSON.stringify(serviceConfig),
            created_at: new Date()
        });
        
        // 注册为引擎
        await this.registerService(serviceConfig);
        
        return {
            success: true,
            engineId: `service_${serviceConfig.id}`
        };
    }

    /**
     * 测试服务可用性
     */
    async testService(serviceConfig) {
        try {
            // 发送健康检查请求
            const normalizedEndpoint = serviceConfig.endpoint.replace(/\/+$/, '');
            const healthEndpoint = serviceConfig.healthCheck ||
                                  normalizedEndpoint.replace(/[^/]+$/, 'health');
            
            const response = await axios.get(healthEndpoint, {
                timeout: 5000
            });
            
            return response.status === 200;
        } catch (error) {
            console.warn(`服务健康检查失败: ${serviceConfig.id}`);
            return false;
        }
    }

    /**
     * 获取服务类别图标
     */
    getIconForCategory(category) {
        const iconMap = {
            '文档处理': '📄',
            '知识提取': '🧠',
            'RAG': '🔍',
            'AI': '🤖',
            '建筑': '🏗️',
            '数据处理': '⚡',
            'API': '🔌'
        };
        
        return iconMap[category] || '⚙️';
    }

    /**
     * 验证服务配置
     */
    validateServiceConfig(config) {
        const required = ['id', 'name', 'endpoint', 'category'];
        for (const field of required) {
            if (!config[field]) {
                throw new Error(`缺少必填字段: ${field}`);
            }
        }
        
        if (!config.inputs || typeof config.inputs !== 'object') {
            throw new Error('服务必须定义输入参数');
        }
        
        if (!config.outputs || typeof config.outputs !== 'object') {
            throw new Error('服务必须定义输出格式');
        }
    }

    /**
     * 获取所有可用服务
     */
    async getAvailableServices() {
        const services = [];
        
        for (const [id, config] of this.services) {
            const isHealthy = await this.testService(config);
            services.push({
                ...config,
                engineId: `service_${id}`,
                status: isHealthy ? 'healthy' : 'unhealthy'
            });
        }
        
        return services;
    }

    /**
     * 组合多个服务为复合引擎
     */
    async createCompositeEngine(config) {
        const { name, description, services, flow } = config;
        
        // 创建复合引擎定义
        const compositeEngine = {
            id: `composite_${Date.now()}`,
            metadata: {
                name,
                version: '1.0',
                domain: 'composite',
                description,
                icon: '🔗',
                tags: ['composite', 'service-chain']
            },
            
            schema: {
                inputs: this.mergeInputSchemas(services),
                outputs: this.mergeOutputSchemas(services)
            },
            
            processFunction: async (input, context) => {
                let currentData = input;
                const results = [];
                
                // 按照flow定义的顺序执行服务
                for (const step of flow) {
                    const service = this.services.get(step.serviceId);
                    if (!service) {
                        throw new Error(`服务未找到: ${step.serviceId}`);
                    }
                    
                    // 数据转换
                    if (step.transform) {
                        currentData = step.transform(currentData);
                    }
                    
                    // 调用服务
                    const result = await this.createServiceExecutor(service)(
                        currentData, 
                        context
                    );
                    
                    results.push(result);
                    currentData = result.data;
                }
                
                return {
                    success: true,
                    results,
                    finalOutput: currentData
                };
            }
        };
        
        // 注册复合引擎
        await EngineCore.registerEngine(compositeEngine);
        
        return compositeEngine.id;
    }

    /**
     * 合并输入schema
     */
    mergeInputSchemas(services) {
        const merged = {};
        for (const service of services) {
            Object.assign(merged, service.inputs);
        }
        return merged;
    }

    /**
     * 合并输出schema
     */
    mergeOutputSchemas(services) {
        const merged = {};
        for (const service of services) {
            Object.assign(merged, service.outputs);
        }
        return merged;
    }
}

module.exports = new ServiceEngineAdapter();
