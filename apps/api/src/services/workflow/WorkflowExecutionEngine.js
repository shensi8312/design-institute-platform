/**
 * 工作流执行引擎
 * 负责解析、调度和执行工作流
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const db = require('../../config/database');
const LangExtractService = require('../knowledge/LangExtractService');
const { getInstance: getRustAccelerator } = require('../system/RustAcceleratorService');

// 节点状态枚举
const NodeStatus = {
    PENDING: 'pending',
    RUNNING: 'running',
    SUCCESS: 'success',
    FAILED: 'failed',
    SKIPPED: 'skipped'
};

// 工作流状态枚举
const WorkflowStatus = {
    CREATED: 'created',
    RUNNING: 'running',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

/**
 * 工作流执行引擎
 */
class WorkflowExecutionEngine extends EventEmitter {
    constructor() {
        super();
        
        // 执行实例缓存
        this.executions = new Map();
        
        // 节点执行器注册表
        this.nodeExecutors = new Map();
        
        // 注册内置节点执行器
        this.registerBuiltinExecutors();
        
        // 性能统计
        this.stats = {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            averageExecutionTime: 0
        };
    }

    /**
     * 注册内置节点执行器
     */
    registerBuiltinExecutors() {
        // LangExtract节点
        this.registerNodeExecutor('langextract', this.executeLangExtractNode.bind(this));
        
        // GraphRAG节点
        this.registerNodeExecutor('graphrag', this.executeGraphRAGNode.bind(this));
        
        // Agent节点
        this.registerNodeExecutor('agent', this.executeAgentNode.bind(this));
        
        // 条件节点
        this.registerNodeExecutor('condition', this.executeConditionNode.bind(this));
        
        // 并行节点
        this.registerNodeExecutor('parallel', this.executeParallelNode.bind(this));
        
        // 向量搜索节点
        this.registerNodeExecutor('vector_search', this.executeVectorSearchNode.bind(this));
        
        // 人工审核节点
        this.registerNodeExecutor('human_review', this.executeHumanReviewNode.bind(this));
        
        // 数据转换节点
        this.registerNodeExecutor('transform', this.executeTransformNode.bind(this));
        
        // HTTP请求节点
        this.registerNodeExecutor('http', this.executeHttpNode.bind(this));
        
        // 脚本节点
        this.registerNodeExecutor('script', this.executeScriptNode.bind(this));
    }

    /**
     * 注册节点执行器
     */
    registerNodeExecutor(nodeType, executor) {
        this.nodeExecutors.set(nodeType, executor);
        console.log(`[WorkflowEngine] 注册节点执行器: ${nodeType}`);
    }

    /**
     * 创建工作流执行实例
     */
    async createExecution(workflow, context = {}) {
        const executionId = uuidv4();
        
        const execution = {
            id: executionId,
            workflow: workflow,
            status: WorkflowStatus.CREATED,
            context: {
                ...context,
                executionId,
                startTime: new Date(),
                variables: {},
                results: {}
            },
            nodeStates: this.initializeNodeStates(workflow),
            currentNodes: [],
            completedNodes: [],
            failedNodes: [],
            logs: []
        };
        
        // 保存到缓存
        this.executions.set(executionId, execution);
        
        // 保存到数据库
        await this.saveExecutionToDB(execution);
        
        // 发送事件
        this.emit('execution:created', execution);
        
        return execution;
    }

    /**
     * 初始化节点状态
     */
    initializeNodeStates(workflow) {
        const states = {};
        
        for (const node of workflow.nodes) {
            states[node.id] = {
                nodeId: node.id,
                nodeType: node.type,
                status: NodeStatus.PENDING,
                startTime: null,
                endTime: null,
                result: null,
                error: null,
                retryCount: 0
            };
        }
        
        return states;
    }

    /**
     * 执行工作流
     */
    async executeWorkflow(workflowId, context = {}) {
        try {
            // 获取工作流定义
            const workflow = await this.loadWorkflow(workflowId);
            
            if (!workflow) {
                throw new Error(`工作流不存在: ${workflowId}`);
            }
            
            // 创建执行实例
            const execution = await this.createExecution(workflow, context);
            
            console.log(`[WorkflowEngine] 开始执行工作流: ${execution.id}`);
            
            // 更新状态为运行中
            execution.status = WorkflowStatus.RUNNING;
            this.emit('execution:started', execution);
            
            // 获取入口节点
            const entryNodes = this.getEntryNodes(workflow);
            
            // 开始执行
            await this.executeNodes(execution, entryNodes);
            
            // 检查最终状态
            if (execution.failedNodes.length > 0) {
                execution.status = WorkflowStatus.FAILED;
            } else {
                execution.status = WorkflowStatus.COMPLETED;
            }
            
            // 记录结束时间
            execution.context.endTime = new Date();
            execution.context.executionTime = 
                execution.context.endTime - execution.context.startTime;
            
            // 更新统计
            this.updateStats(execution);
            
            // 保存最终状态
            await this.saveExecutionToDB(execution);
            
            // 发送完成事件
            this.emit('execution:completed', execution);
            
            console.log(`[WorkflowEngine] 工作流执行完成: ${execution.id}`);
            
            return execution;
            
        } catch (error) {
            console.error(`[WorkflowEngine] 工作流执行失败:`, error);
            throw error;
        }
    }

    /**
     * 执行节点集合
     */
    async executeNodes(execution, nodeIds) {
        const promises = [];
        
        for (const nodeId of nodeIds) {
            // 检查节点是否可以执行
            if (this.canExecuteNode(execution, nodeId)) {
                promises.push(this.executeNode(execution, nodeId));
            }
        }
        
        // 等待所有节点完成
        await Promise.all(promises);
    }

    /**
     * 执行单个节点
     */
    async executeNode(execution, nodeId) {
        const node = execution.workflow.nodes.find(n => n.id === nodeId);
        const nodeState = execution.nodeStates[nodeId];
        
        if (!node || !nodeState) {
            console.error(`[WorkflowEngine] 节点不存在: ${nodeId}`);
            return;
        }
        
        console.log(`[WorkflowEngine] 执行节点: ${nodeId} (${node.type})`);
        
        // 更新节点状态
        nodeState.status = NodeStatus.RUNNING;
        nodeState.startTime = new Date();
        execution.currentNodes.push(nodeId);
        
        // 发送节点开始事件
        this.emit('node:started', { execution, nodeId });
        
        try {
            // 获取节点执行器
            const executor = this.nodeExecutors.get(node.type);
            
            if (!executor) {
                throw new Error(`未知的节点类型: ${node.type}`);
            }
            
            // 执行节点
            const result = await executor(node, execution);
            
            // 更新节点状态
            nodeState.status = NodeStatus.SUCCESS;
            nodeState.result = result;
            nodeState.endTime = new Date();
            
            // 保存结果到上下文
            execution.context.results[nodeId] = result;
            
            // 添加到完成节点列表
            execution.completedNodes.push(nodeId);
            
            // 移除当前执行节点
            const index = execution.currentNodes.indexOf(nodeId);
            if (index > -1) {
                execution.currentNodes.splice(index, 1);
            }
            
            // 记录日志
            this.addLog(execution, 'info', `节点 ${nodeId} 执行成功`);
            
            // 发送节点完成事件
            this.emit('node:completed', { execution, nodeId, result });
            
            // 执行后续节点
            const nextNodes = this.getNextNodes(execution.workflow, nodeId);
            if (nextNodes.length > 0) {
                await this.executeNodes(execution, nextNodes);
            }
            
        } catch (error) {
            console.error(`[WorkflowEngine] 节点执行失败: ${nodeId}`, error);
            
            // 更新节点状态
            nodeState.status = NodeStatus.FAILED;
            nodeState.error = error.message;
            nodeState.endTime = new Date();
            
            // 添加到失败节点列表
            execution.failedNodes.push(nodeId);
            
            // 移除当前执行节点
            const index = execution.currentNodes.indexOf(nodeId);
            if (index > -1) {
                execution.currentNodes.splice(index, 1);
            }
            
            // 记录日志
            this.addLog(execution, 'error', `节点 ${nodeId} 执行失败: ${error.message}`);
            
            // 发送节点失败事件
            this.emit('node:failed', { execution, nodeId, error });
            
            // 处理错误策略
            await this.handleNodeError(execution, nodeId, error);
        }
    }

    /**
     * 检查节点是否可以执行
     */
    canExecuteNode(execution, nodeId) {
        const nodeState = execution.nodeStates[nodeId];
        
        // 已经执行过或正在执行
        if (nodeState.status !== NodeStatus.PENDING) {
            return false;
        }
        
        // 检查前置节点是否完成
        const dependencies = this.getNodeDependencies(execution.workflow, nodeId);
        for (const depId of dependencies) {
            const depState = execution.nodeStates[depId];
            if (depState.status !== NodeStatus.SUCCESS) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * 获取节点依赖
     */
    getNodeDependencies(workflow, nodeId) {
        const dependencies = [];
        
        for (const edge of workflow.edges) {
            if (edge.target === nodeId) {
                dependencies.push(edge.source);
            }
        }
        
        return dependencies;
    }

    /**
     * 获取入口节点
     */
    getEntryNodes(workflow) {
        const hasIncoming = new Set();
        
        for (const edge of workflow.edges) {
            hasIncoming.add(edge.target);
        }
        
        return workflow.nodes
            .filter(node => !hasIncoming.has(node.id))
            .map(node => node.id);
    }

    /**
     * 获取后续节点
     */
    getNextNodes(workflow, nodeId) {
        const nextNodes = [];
        
        for (const edge of workflow.edges) {
            if (edge.source === nodeId) {
                nextNodes.push(edge.target);
            }
        }
        
        return nextNodes;
    }

    /**
     * 处理节点错误
     */
    async handleNodeError(execution, nodeId, error) {
        const node = execution.workflow.nodes.find(n => n.id === nodeId);
        const nodeState = execution.nodeStates[nodeId];
        
        // 检查重试策略
        const maxRetries = node.config?.maxRetries || 0;
        
        if (nodeState.retryCount < maxRetries) {
            // 重试
            nodeState.retryCount++;
            nodeState.status = NodeStatus.PENDING;
            
            console.log(`[WorkflowEngine] 重试节点 ${nodeId} (${nodeState.retryCount}/${maxRetries})`);
            
            // 延迟后重试
            const retryDelay = node.config?.retryDelay || 1000;
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            
            // 重新执行
            await this.executeNode(execution, nodeId);
        } else {
            // 检查错误处理策略
            const errorStrategy = node.config?.errorStrategy || 'fail';
            
            if (errorStrategy === 'skip') {
                // 跳过节点，继续执行
                nodeState.status = NodeStatus.SKIPPED;
                const nextNodes = this.getNextNodes(execution.workflow, nodeId);
                if (nextNodes.length > 0) {
                    await this.executeNodes(execution, nextNodes);
                }
            } else if (errorStrategy === 'fallback' && node.config?.fallbackNode) {
                // 执行备用节点
                await this.executeNode(execution, node.config.fallbackNode);
            }
            // 默认策略是fail，不做处理，让工作流失败
        }
    }

    // ==================== 节点执行器实现 ====================

    /**
     * 执行LangExtract节点
     */
    async executeLangExtractNode(node, execution) {
        const config = node.config || {};
        const documentId = config.documentId || execution.context.documentId;
        
        if (!documentId) {
            throw new Error('LangExtract节点需要documentId');
        }
        
        const langExtractService = new LangExtractService();
        
        const result = await langExtractService.extractDocument(
            documentId,
            config.filePath || execution.context.filePath,
            {
                language: config.language || 'zh',
                extractTables: config.extractTables !== false,
                extractImages: config.extractImages !== false,
                enableDomainEnhancement: config.enableDomainEnhancement !== false
            }
        );
        
        return result;
    }

    /**
     * 执行GraphRAG节点
     */
    async executeGraphRAGNode(node, execution) {
        const config = node.config || {};
        
        // 获取输入数据
        const inputNodeId = config.inputNode || this.getNodeDependencies(execution.workflow, node.id)[0];
        const inputData = execution.context.results[inputNodeId];
        
        if (!inputData) {
            throw new Error('GraphRAG节点需要输入数据');
        }
        
        // 调用GraphRAG服务
        const response = await axios.post('http://localhost:8081/api/graph/analyze', {
            entities: inputData.entities || [],
            text: inputData.text || '',
            options: {
                buildGraph: config.buildGraph !== false,
                extractRelations: config.extractRelations !== false,
                communityDetection: config.communityDetection === true
            }
        });
        
        return response.data;
    }

    /**
     * 执行Agent节点
     */
    async executeAgentNode(node, execution) {
        const config = node.config || {};
        const agentType = config.agentType || 'default';
        
        // 获取输入数据
        const inputData = this.collectInputData(node, execution);
        
        // 根据Agent类型执行不同逻辑
        switch (agentType) {
            case 'summarizer':
                return await this.executeSummarizerAgent(inputData, config);
            
            case 'qa':
                return await this.executeQAAgent(inputData, config);
            
            case 'classifier':
                return await this.executeClassifierAgent(inputData, config);
            
            case 'extractor':
                return await this.executeExtractorAgent(inputData, config);
            
            default:
                throw new Error(`未知的Agent类型: ${agentType}`);
        }
    }

    /**
     * 执行条件节点
     */
    async executeConditionNode(node, execution) {
        const config = node.config || {};
        const condition = config.condition;
        
        if (!condition) {
            throw new Error('条件节点需要condition配置');
        }
        
        // 评估条件
        const result = await this.evaluateCondition(condition, execution.context);
        
        // 根据结果选择分支
        const branch = result ? 'true' : 'false';
        
        // 只执行选中的分支
        const edges = execution.workflow.edges.filter(e => 
            e.source === node.id && e.label === branch
        );
        
        for (const edge of edges) {
            await this.executeNode(execution, edge.target);
        }
        
        return { result, branch };
    }

    /**
     * 执行并行节点
     */
    async executeParallelNode(node, execution) {
        const config = node.config || {};
        const branches = config.branches || [];
        
        // 并行执行所有分支
        const promises = branches.map(branchNodeId => 
            this.executeNode(execution, branchNodeId)
        );
        
        const results = await Promise.allSettled(promises);
        
        return {
            branches: branches,
            results: results.map((r, i) => ({
                nodeId: branches[i],
                status: r.status,
                value: r.status === 'fulfilled' ? r.value : null,
                error: r.status === 'rejected' ? r.reason : null
            }))
        };
    }

    /**
     * 执行向量搜索节点
     */
    async executeVectorSearchNode(node, execution) {
        const config = node.config || {};
        const query = config.query || execution.context.query;
        
        if (!query) {
            throw new Error('向量搜索节点需要query');
        }
        
        // 使用Rust加速器进行向量搜索
        const rustAccelerator = getRustAccelerator();
        
        // 获取向量数据
        const vectors = await this.getVectors(execution.context.knowledgeBaseId);
        
        const result = await rustAccelerator.vectorSearch(
            query,
            vectors,
            config.topK || 10
        );
        
        return result;
    }

    /**
     * 执行人工审核节点
     */
    async executeHumanReviewNode(node, execution) {
        const config = node.config || {};
        
        // 创建审核任务
        const reviewTask = await db('review_tasks').insert({
            execution_id: execution.id,
            node_id: node.id,
            data: JSON.stringify(execution.context.results),
            status: 'pending',
            created_at: new Date()
        }).returning('*');
        
        // 发送通知
        this.emit('review:required', {
            taskId: reviewTask[0].id,
            execution,
            node
        });
        
        // 等待审核完成（设置超时）
        const timeout = config.timeout || 3600000; // 默认1小时
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            // 检查审核状态
            const task = await db('review_tasks')
                .where('id', reviewTask[0].id)
                .first();
            
            if (task.status === 'approved' || task.status === 'rejected') {
                return {
                    taskId: task.id,
                    status: task.status,
                    reviewResult: JSON.parse(task.review_result || '{}'),
                    reviewedBy: task.reviewed_by,
                    reviewedAt: task.reviewed_at
                };
            }
            
            // 等待5秒后重试
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        throw new Error('人工审核超时');
    }

    /**
     * 执行数据转换节点
     */
    async executeTransformNode(node, execution) {
        const config = node.config || {};
        const transformType = config.transformType || 'custom';
        
        // 获取输入数据
        const inputData = this.collectInputData(node, execution);
        
        // 执行转换
        let result;
        
        switch (transformType) {
            case 'json':
                result = JSON.parse(JSON.stringify(inputData));
                break;
            
            case 'filter':
                result = this.filterData(inputData, config.filter);
                break;
            
            case 'map':
                result = this.mapData(inputData, config.mapper);
                break;
            
            case 'reduce':
                result = this.reduceData(inputData, config.reducer);
                break;
            
            case 'custom':
                // 执行自定义转换脚本
                result = await this.executeCustomTransform(inputData, config.script);
                break;
            
            default:
                throw new Error(`未知的转换类型: ${transformType}`);
        }
        
        return result;
    }

    /**
     * 执行HTTP节点
     */
    async executeHttpNode(node, execution) {
        const config = node.config || {};
        
        const requestConfig = {
            method: config.method || 'GET',
            url: config.url,
            headers: config.headers || {},
            params: config.params || {},
            data: config.body || this.collectInputData(node, execution),
            timeout: config.timeout || 30000
        };
        
        try {
            const response = await axios(requestConfig);
            
            return {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                data: response.data
            };
        } catch (error) {
            if (error.response) {
                // 服务器响应了错误状态
                return {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    headers: error.response.headers,
                    data: error.response.data,
                    error: true
                };
            }
            throw error;
        }
    }

    /**
     * 执行脚本节点
     */
    async executeScriptNode(node, execution) {
        const config = node.config || {};
        const script = config.script;
        
        if (!script) {
            throw new Error('脚本节点需要script配置');
        }
        
        // 创建沙盒环境
        const sandbox = {
            input: this.collectInputData(node, execution),
            context: execution.context,
            console: console,
            require: require,
            Promise: Promise,
            Date: Date,
            Math: Math,
            JSON: JSON
        };
        
        // 执行脚本
        const vm = require('vm');
        const context = vm.createContext(sandbox);
        
        try {
            const result = vm.runInContext(script, context, {
                timeout: config.timeout || 5000
            });
            
            return result;
        } catch (error) {
            throw new Error(`脚本执行失败: ${error.message}`);
        }
    }

    // ==================== 辅助方法 ====================

    /**
     * 收集输入数据
     */
    collectInputData(node, execution) {
        const dependencies = this.getNodeDependencies(execution.workflow, node.id);
        
        if (dependencies.length === 0) {
            return execution.context.input || {};
        }
        
        if (dependencies.length === 1) {
            return execution.context.results[dependencies[0]] || {};
        }
        
        // 多个输入，合并结果
        const inputData = {};
        for (const depId of dependencies) {
            const result = execution.context.results[depId];
            if (result) {
                Object.assign(inputData, result);
            }
        }
        
        return inputData;
    }

    /**
     * 评估条件
     */
    async evaluateCondition(condition, context) {
        // 简单实现，支持JavaScript表达式
        try {
            const vm = require('vm');
            const sandbox = { context, result: false };
            vm.createContext(sandbox);
            vm.runInContext(`result = ${condition}`, sandbox);
            return sandbox.result;
        } catch (error) {
            console.error('条件评估失败:', error);
            return false;
        }
    }

    /**
     * 执行摘要Agent
     */
    async executeSummarizerAgent(inputData, config) {
        const text = inputData.text || '';
        const maxLength = config.maxLength || 200;
        
        // 简单实现，实际应该调用LLM
        const summary = text.substring(0, maxLength) + '...';
        
        return {
            summary,
            originalLength: text.length,
            summaryLength: summary.length
        };
    }

    /**
     * 执行问答Agent
     */
    async executeQAAgent(inputData, config) {
        const question = config.question || inputData.question;
        const context = inputData.text || '';
        
        // 调用LLM服务
        // 这里应该调用实际的LLM API
        
        return {
            question,
            answer: '这是一个模拟的答案',
            confidence: 0.85
        };
    }

    /**
     * 执行分类Agent
     */
    async executeClassifierAgent(inputData, config) {
        const text = inputData.text || '';
        const categories = config.categories || [];
        
        // 简单实现，随机分类
        const category = categories[Math.floor(Math.random() * categories.length)];
        
        return {
            text: text.substring(0, 100),
            category,
            confidence: Math.random()
        };
    }

    /**
     * 执行提取Agent
     */
    async executeExtractorAgent(inputData, config) {
        const text = inputData.text || '';
        const extractType = config.extractType || 'entities';
        
        // 根据提取类型执行不同逻辑
        return {
            extractType,
            results: []
        };
    }

    /**
     * 添加日志
     */
    addLog(execution, level, message, data = {}) {
        const log = {
            timestamp: new Date(),
            level,
            message,
            data
        };
        
        execution.logs.push(log);
        
        // 发送日志事件
        this.emit('log', { execution, log });
    }

    /**
     * 保存执行到数据库
     */
    async saveExecutionToDB(execution) {
        try {
            const exists = await db('workflow_executions')
                .where('id', execution.id)
                .first();
            
            const data = {
                workflow_id: execution.workflow.id,
                status: execution.status,
                context: JSON.stringify(execution.context),
                node_states: JSON.stringify(execution.nodeStates),
                logs: JSON.stringify(execution.logs),
                updated_at: new Date()
            };
            
            if (exists) {
                await db('workflow_executions')
                    .where('id', execution.id)
                    .update(data);
            } else {
                await db('workflow_executions')
                    .insert({
                        id: execution.id,
                        ...data,
                        created_at: new Date()
                    });
            }
        } catch (error) {
            console.error('保存执行状态失败:', error);
        }
    }

    /**
     * 加载工作流定义
     */
    async loadWorkflow(workflowId) {
        // 从数据库加载工作流
        const workflow = await db('workflows')
            .where('id', workflowId)
            .first();
        
        if (!workflow) {
            return null;
        }
        
        return {
            id: workflow.id,
            name: workflow.name,
            nodes: JSON.parse(workflow.nodes || '[]'),
            edges: JSON.parse(workflow.edges || '[]'),
            config: JSON.parse(workflow.config || '{}')
        };
    }

    /**
     * 获取向量数据
     */
    async getVectors(knowledgeBaseId) {
        // 从Milvus获取向量
        // 简化实现
        return [];
    }

    /**
     * 更新统计信息
     */
    updateStats(execution) {
        this.stats.totalExecutions++;
        
        if (execution.status === WorkflowStatus.COMPLETED) {
            this.stats.successfulExecutions++;
        } else if (execution.status === WorkflowStatus.FAILED) {
            this.stats.failedExecutions++;
        }
        
        // 更新平均执行时间
        const executionTime = execution.context.executionTime || 0;
        this.stats.averageExecutionTime = 
            (this.stats.averageExecutionTime * (this.stats.totalExecutions - 1) + executionTime) / 
            this.stats.totalExecutions;
    }

    /**
     * 获取执行状态
     */
    getExecution(executionId) {
        return this.executions.get(executionId);
    }

    /**
     * 暂停执行
     */
    async pauseExecution(executionId) {
        const execution = this.executions.get(executionId);
        
        if (!execution) {
            throw new Error(`执行实例不存在: ${executionId}`);
        }
        
        execution.status = WorkflowStatus.PAUSED;
        await this.saveExecutionToDB(execution);
        
        this.emit('execution:paused', execution);
    }

    /**
     * 恢复执行
     */
    async resumeExecution(executionId) {
        const execution = this.executions.get(executionId);
        
        if (!execution) {
            throw new Error(`执行实例不存在: ${executionId}`);
        }
        
        if (execution.status !== WorkflowStatus.PAUSED) {
            throw new Error('只能恢复暂停的执行');
        }
        
        execution.status = WorkflowStatus.RUNNING;
        
        // 继续执行未完成的节点
        const pendingNodes = Object.entries(execution.nodeStates)
            .filter(([_, state]) => state.status === NodeStatus.PENDING)
            .map(([nodeId, _]) => nodeId);
        
        await this.executeNodes(execution, pendingNodes);
        
        this.emit('execution:resumed', execution);
    }

    /**
     * 取消执行
     */
    async cancelExecution(executionId) {
        const execution = this.executions.get(executionId);
        
        if (!execution) {
            throw new Error(`执行实例不存在: ${executionId}`);
        }
        
        execution.status = WorkflowStatus.CANCELLED;
        await this.saveExecutionToDB(execution);
        
        this.emit('execution:cancelled', execution);
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            ...this.stats,
            activeExecutions: Array.from(this.executions.values())
                .filter(e => e.status === WorkflowStatus.RUNNING).length
        };
    }
}

// 单例模式
let instance = null;

module.exports = {
    getInstance: () => {
        if (!instance) {
            instance = new WorkflowExecutionEngine();
        }
        return instance;
    },
    WorkflowExecutionEngine,
    NodeStatus,
    WorkflowStatus
};