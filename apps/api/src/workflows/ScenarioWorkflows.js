/**
 * 场景化工作流实现
 * 基于现有服务实现三个核心场景
 */

const VectorService = require('../services/VectorService');
const GraphRAGService = require('../services/GraphRAGService');
const UnifiedLLMService = require('../services/llm/UnifiedLLMService');
const realTimeDocumentProcessor = require('../services/realTimeDocumentProcessor');
const LangExtractService = require('../services/LangExtractService');
const redis = require('../config/redis');
const db = require('../config/database');
const { EventEmitter } = require('events');

class ScenarioWorkflows extends EventEmitter {
    constructor() {
        super();
    }

    /**
     * 场景1: 智能问答工作流
     * 用户提问 → 向量搜索服务 → 图谱查询服务 → Ollama推理 → Agent优化 → 返回答案
     */
    async executeIntelligentQA(question, context = {}) {
        const workflowId = `qa_${Date.now()}`;
        console.log(`[场景1] 开始执行智能问答工作流: ${workflowId}`);
        
        try {
            // Step 1: 向量搜索 - 从知识库检索相关内容
            this.emit('step:start', { workflowId, step: 'vector_search' });
            const vectorResults = await VectorService.search({
                query: question,
                collection: context.collection || 'knowledge_base',
                topK: context.topK || 10,
                scoreThreshold: 0.7
            });
            
            const relevantDocs = vectorResults.results || [];
            console.log(`[向量搜索] 找到 ${relevantDocs.length} 个相关文档`);

            // Step 2: 图谱查询 - 获取实体关系
            this.emit('step:start', { workflowId, step: 'graph_query' });
            const entities = this.extractEntities(question);
            const graphData = await GraphRAGService.queryByEntities({
                entities,
                hops: context.graphHops || 2,
                relationTypes: ['规定', '要求', '包含', '属于']
            });
            
            console.log(`[图谱查询] 找到 ${graphData.nodes?.length || 0} 个节点，${graphData.edges?.length || 0} 条关系`);

            // Step 3: 构建增强上下文
            const enhancedContext = this.buildEnhancedContext(question, relevantDocs, graphData);

            // Step 4: Ollama推理
            this.emit('step:start', { workflowId, step: 'ollama_inference' });
            const llmPrompt = `
基于以下知识回答用户问题：

相关文档：
${relevantDocs.map(doc => doc.content).join('\n---\n')}

知识图谱信息：
${this.formatGraphData(graphData)}

用户问题：${question}

请提供准确、专业的回答，如果涉及规范条文，请引用具体条款。
`;

            const response = await UnifiedLLMService.generate(llmPrompt, {
                temperature: 0.7,
                max_tokens: 2000
            });
            const llmResponse = { response: response.content };

            // Step 5: Agent优化 - 对回答进行后处理和优化
            this.emit('step:start', { workflowId, step: 'agent_optimization' });
            const optimizedAnswer = await this.optimizeAnswer(llmResponse.response, {
                question,
                sources: relevantDocs,
                graphInfo: graphData
            });

            // 记录到数据库
            await this.saveQAHistory({
                workflowId,
                question,
                answer: optimizedAnswer,
                sources: relevantDocs.map(d => d.id),
                context
            });

            this.emit('workflow:complete', { workflowId });
            
            return {
                success: true,
                workflowId,
                answer: optimizedAnswer,
                sources: relevantDocs.slice(0, 3), // 返回前3个最相关的源
                confidence: this.calculateConfidence(relevantDocs, graphData),
                executionTime: Date.now() - parseInt(workflowId.split('_')[1])
            };

        } catch (error) {
            console.error(`[场景1] 工作流执行失败:`, error);
            this.emit('workflow:error', { workflowId, error });
            throw error;
        }
    }

    /**
     * 场景2: 文档处理工作流
     * 文件上传 → 解析(OCR+YOLO+QwenVL2.5) → 入Redis → 
     * 消费Redis入知识向量库(同步并行LangExtract学习关系进知识图谱库)
     */
    async executeDocumentProcessing(file, options = {}) {
        const workflowId = `doc_${Date.now()}`;
        console.log(`[场景2] 开始执行文档处理工作流: ${workflowId}`);

        try {
            // Step 1: 文档解析 - 使用realTimeDocumentProcessor
            this.emit('step:start', { workflowId, step: 'document_parsing' });
            const parseResult = await realTimeDocumentProcessor.processDocument({
                id: file.id || `doc_${Date.now()}`,
                name: file.name,
                filePath: file.path,
                kbId: options.knowledgeBaseId || 'default'
            }, {
                enableOCR: true,
                enableVector: false, // 先不向量化，等处理完再统一
                enableGraph: false,
                extractEntities: true
            });

            console.log(`[文档解析] 完成，提取文本长度: ${parseResult.text?.length || 0}`);

            // Step 2: 入Redis队列
            this.emit('step:start', { workflowId, step: 'redis_queue' });
            const queueData = {
                workflowId,
                documentId: parseResult.documentId,
                text: parseResult.text,
                entities: parseResult.entities,
                metadata: {
                    fileName: file.name,
                    fileType: file.type,
                    processTime: new Date()
                }
            };

            await redis.lpush('document_processing_queue', JSON.stringify(queueData));
            console.log(`[Redis队列] 文档已加入处理队列`);

            // Step 3: 并行处理 - 向量化和知识图谱提取
            this.emit('step:start', { workflowId, step: 'parallel_processing' });
            
            // 启动消费者处理
            const processingResults = await Promise.all([
                // 3.1 向量化处理
                this.processVectorization(queueData),
                
                // 3.2 LangExtract知识提取
                this.processKnowledgeExtraction(queueData)
            ]);

            const [vectorResult, extractResult] = processingResults;

            // Step 4: 更新文档状态
            await db('knowledge_documents')
                .where('id', parseResult.documentId)
                .update({
                    vector_status: 'completed',
                    graph_status: 'completed',
                    vector_count: vectorResult.vectorCount,
                    entity_count: extractResult.entityCount,
                    relation_count: extractResult.relationCount,
                    processed_at: new Date()
                });

            this.emit('workflow:complete', { workflowId });

            return {
                success: true,
                workflowId,
                documentId: parseResult.documentId,
                results: {
                    text: parseResult.text?.substring(0, 500) + '...',
                    vectorCount: vectorResult.vectorCount,
                    entities: extractResult.entityCount,
                    relations: extractResult.relationCount
                },
                executionTime: Date.now() - parseInt(workflowId.split('_')[1])
            };

        } catch (error) {
            console.error(`[场景2] 工作流执行失败:`, error);
            this.emit('workflow:error', { workflowId, error });
            throw error;
        }
    }

    /**
     * 场景3: SketchUp强排工作流
     * SketchUp插件调用 → 强排规则引擎 → 生成3D白模
     */
    async executeSketchupLayout(params) {
        const workflowId = `skp_${Date.now()}`;
        console.log(`[场景3] 开始执行SketchUp强排工作流: ${workflowId}`);

        try {
            // Step 1: 获取项目参数
            this.emit('step:start', { workflowId, step: 'get_params' });
            const projectParams = {
                siteArea: params.siteArea,
                buildingType: params.buildingType || '住宅',
                maxHeight: params.maxHeight,
                far: params.far || 2.5, // 容积率
                coverage: params.coverage || 0.3, // 建筑密度
                location: params.location || '上海'
            };

            // Step 2: 查询强排规则
            this.emit('step:start', { workflowId, step: 'query_rules' });
            
            // 从知识库获取相关规范
            const rules = await this.getLayoutRules(projectParams);
            console.log(`[规则查询] 获取到 ${rules.length} 条强排规则`);

            // Step 3: 执行强排计算
            this.emit('step:start', { workflowId, step: 'layout_calculation' });
            const layoutResult = this.calculateLayout(projectParams, rules);

            // Step 4: 生成3D模型数据
            this.emit('step:start', { workflowId, step: 'generate_3d' });
            const modelData = {
                buildings: layoutResult.buildings.map(building => ({
                    id: building.id,
                    type: building.type,
                    position: building.position,
                    dimensions: {
                        width: building.width,
                        length: building.length,
                        height: building.height
                    },
                    floors: building.floors,
                    rotation: building.rotation || 0
                })),
                roads: layoutResult.roads,
                greenSpace: layoutResult.greenSpace,
                metadata: {
                    totalArea: projectParams.siteArea,
                    buildingArea: layoutResult.totalBuildingArea,
                    far: layoutResult.actualFAR,
                    coverage: layoutResult.actualCoverage,
                    greenRate: layoutResult.greenRate
                }
            };

            // 保存结果
            await this.saveLayoutResult(workflowId, modelData);

            this.emit('workflow:complete', { workflowId });

            return {
                success: true,
                workflowId,
                modelData,
                statistics: {
                    buildingCount: modelData.buildings.length,
                    totalFloorArea: layoutResult.totalFloorArea,
                    far: layoutResult.actualFAR,
                    coverage: layoutResult.actualCoverage,
                    greenRate: layoutResult.greenRate
                },
                executionTime: Date.now() - parseInt(workflowId.split('_')[1])
            };

        } catch (error) {
            console.error(`[场景3] 工作流执行失败:`, error);
            this.emit('workflow:error', { workflowId, error });
            throw error;
        }
    }

    // ============= 辅助方法 =============

    /**
     * 提取实体
     */
    extractEntities(text) {
        // 简单的实体提取，实际应该使用NLP服务
        const entities = [];
        const patterns = [
            /建筑|住宅|办公楼|商业/g,
            /容积率|建筑密度|高度/g,
            /防火|间距|退线/g
        ];
        
        patterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) entities.push(...matches);
        });
        
        return [...new Set(entities)];
    }

    /**
     * 构建增强上下文
     */
    buildEnhancedContext(question, docs, graphData) {
        return {
            question,
            relevantDocuments: docs.map(d => ({
                id: d.id,
                content: d.content,
                score: d.score
            })),
            graphContext: {
                entities: graphData.nodes || [],
                relations: graphData.edges || []
            }
        };
    }

    /**
     * 格式化图谱数据
     */
    formatGraphData(graphData) {
        if (!graphData || !graphData.nodes) return '无相关图谱信息';
        
        let formatted = '实体：\n';
        graphData.nodes.forEach(node => {
            formatted += `- ${node.label}: ${node.properties?.description || ''}\n`;
        });
        
        if (graphData.edges && graphData.edges.length > 0) {
            formatted += '\n关系：\n';
            graphData.edges.forEach(edge => {
                formatted += `- ${edge.source} ${edge.type} ${edge.target}\n`;
            });
        }
        
        return formatted;
    }

    /**
     * 优化答案
     */
    async optimizeAnswer(rawAnswer, context) {
        // 添加来源引用
        let optimized = rawAnswer;
        
        if (context.sources && context.sources.length > 0) {
            optimized += '\n\n参考来源：\n';
            context.sources.slice(0, 3).forEach((source, idx) => {
                optimized += `[${idx + 1}] ${source.title || source.name || '文档' + source.id}\n`;
            });
        }
        
        return optimized;
    }

    /**
     * 计算置信度
     */
    calculateConfidence(docs, graphData) {
        let confidence = 0;
        
        // 基于文档相关性
        if (docs && docs.length > 0) {
            const avgScore = docs.reduce((sum, d) => sum + (d.score || 0), 0) / docs.length;
            confidence = avgScore * 0.6;
        }
        
        // 基于图谱数据
        if (graphData && graphData.nodes && graphData.nodes.length > 0) {
            confidence += 0.4;
        }
        
        return Math.min(confidence, 1.0);
    }

    /**
     * 向量化处理
     */
    async processVectorization(data) {
        const chunks = this.splitTextIntoChunks(data.text);
        let vectorCount = 0;
        
        for (const chunk of chunks) {
            await VectorService.insert({
                collection: 'knowledge_base',
                vectors: [chunk],
                metadata: {
                    documentId: data.documentId,
                    chunkIndex: vectorCount
                }
            });
            vectorCount++;
        }
        
        return { vectorCount };
    }

    /**
     * 知识提取处理
     */
    async processKnowledgeExtraction(data) {
        const extractResult = await LangExtractService.extract({
            text: data.text,
            mode: 'comprehensive',
            extractTypes: ['entities', 'relations', 'rules']
        });
        
        // 存入图谱
        if (extractResult.entities && extractResult.entities.length > 0) {
            await GraphRAGService.insertEntities(extractResult.entities);
        }
        
        if (extractResult.relations && extractResult.relations.length > 0) {
            await GraphRAGService.insertRelations(extractResult.relations);
        }
        
        return {
            entityCount: extractResult.entities?.length || 0,
            relationCount: extractResult.relations?.length || 0
        };
    }

    /**
     * 文本分块
     */
    splitTextIntoChunks(text, chunkSize = 500) {
        const chunks = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.substring(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * 获取强排规则
     */
    async getLayoutRules(params) {
        // 从知识库查询相关规则
        const rules = await db('engine_rules')
            .where('domain', 'architecture')
            .where('category', 'layout')
            .where('enabled', true)
            .select('*');
        
        return rules.map(r => ({
            ...r,
            conditions: JSON.parse(r.conditions || '{}'),
            actions: JSON.parse(r.actions || '{}')
        }));
    }

    /**
     * 计算强排布局
     */
    calculateLayout(params, rules) {
        // 基础计算
        const maxBuildingArea = params.siteArea * params.far;
        const maxCoverageArea = params.siteArea * params.coverage;
        
        // 应用规则计算建筑布局
        const buildings = [];
        let currentArea = 0;
        let buildingId = 1;
        
        // 简单的网格布局算法
        const gridSize = Math.sqrt(params.siteArea);
        const buildingSize = 60; // 标准建筑尺寸
        const spacing = 20; // 建筑间距
        
        for (let x = spacing; x < gridSize - buildingSize; x += buildingSize + spacing) {
            for (let y = spacing; y < gridSize - buildingSize; y += buildingSize + spacing) {
                if (currentArea >= maxCoverageArea) break;
                
                buildings.push({
                    id: `building_${buildingId++}`,
                    type: params.buildingType,
                    position: { x, y, z: 0 },
                    width: buildingSize,
                    length: buildingSize * 0.8,
                    height: params.maxHeight || 54,
                    floors: Math.floor((params.maxHeight || 54) / 3)
                });
                
                currentArea += buildingSize * buildingSize * 0.8;
            }
        }
        
        return {
            buildings,
            roads: this.generateRoads(params.siteArea),
            greenSpace: this.generateGreenSpace(params.siteArea, buildings),
            totalBuildingArea: currentArea,
            totalFloorArea: currentArea * Math.floor((params.maxHeight || 54) / 3),
            actualFAR: (currentArea * Math.floor((params.maxHeight || 54) / 3)) / params.siteArea,
            actualCoverage: currentArea / params.siteArea,
            greenRate: 0.35
        };
    }

    /**
     * 生成道路
     */
    generateRoads(siteArea) {
        const gridSize = Math.sqrt(siteArea);
        return [
            { type: 'main', width: 12, points: [[0, gridSize/2], [gridSize, gridSize/2]] },
            { type: 'main', width: 12, points: [[gridSize/2, 0], [gridSize/2, gridSize]] }
        ];
    }

    /**
     * 生成绿地
     */
    generateGreenSpace(siteArea, buildings) {
        // 简单的绿地生成
        return [
            { type: 'central', area: siteArea * 0.1, position: { x: Math.sqrt(siteArea)/2, y: Math.sqrt(siteArea)/2 } }
        ];
    }

    /**
     * 保存问答历史
     */
    async saveQAHistory(data) {
        await db('qa_history').insert({
            workflow_id: data.workflowId,
            question: data.question,
            answer: data.answer,
            sources: JSON.stringify(data.sources),
            context: JSON.stringify(data.context),
            created_at: new Date()
        });
    }

    /**
     * 保存强排结果
     */
    async saveLayoutResult(workflowId, modelData) {
        await db('layout_results').insert({
            workflow_id: workflowId,
            model_data: JSON.stringify(modelData),
            created_at: new Date()
        });
    }
}

module.exports = new ScenarioWorkflows();