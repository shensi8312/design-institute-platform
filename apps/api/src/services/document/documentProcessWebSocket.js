/**
 * WebSocket服务 - 实时推送文档处理进度
 */

const WebSocket = require('ws');
const realTimeProcessor = require('./realTimeDocumentProcessor');

class DocumentProcessWebSocket {
    constructor(server) {
        this.wss = new WebSocket.Server({ 
            server,
            path: '/ws/document-process'
        });
        
        this.clients = new Map(); // userId -> WebSocket
        
        this.initialize();
        this.setupProcessorListeners();
    }
    
    initialize() {
        this.wss.on('connection', (ws, req) => {
            console.log('新的WebSocket连接');
            
            // 解析用户信息（简化版，实际应该验证token）
            const userId = this.getUserIdFromRequest(req);
            
            if (userId) {
                this.clients.set(userId, ws);
                
                // 发送连接成功消息
                ws.send(JSON.stringify({
                    type: 'connected',
                    message: '已连接到文档处理服务',
                    timestamp: new Date().toISOString()
                }));
                
                // 处理客户端消息
                ws.on('message', (data) => {
                    this.handleClientMessage(userId, data);
                });
                
                // 处理断开连接
                ws.on('close', () => {
                    console.log(`用户 ${userId} 断开连接`);
                    this.clients.delete(userId);
                });
                
                // 处理错误
                ws.on('error', (error) => {
                    console.error(`WebSocket错误 (用户 ${userId}):`, error);
                });
                
                // 定期发送心跳
                const heartbeatInterval = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.ping();
                    } else {
                        clearInterval(heartbeatInterval);
                    }
                }, 30000);
            } else {
                ws.close(1008, '未授权');
            }
        });
    }
    
    setupProcessorListeners() {
        // 监听处理器事件
        realTimeProcessor.on('process:start', (processInfo) => {
            this.broadcastToAll({
                type: 'process:start',
                processId: processInfo.id,
                documentId: processInfo.documentId,
                documentName: processInfo.documentName,
                timestamp: new Date().toISOString()
            });
        });
        
        realTimeProcessor.on('step:start', (data) => {
            this.broadcastToAll({
                type: 'step:start',
                processId: data.processId,
                step: data.step,
                stepName: this.getStepName(data.step),
                timestamp: new Date().toISOString()
            });
        });
        
        realTimeProcessor.on('step:complete', (data) => {
            this.broadcastToAll({
                type: 'step:complete',
                processId: data.processId,
                step: data.step,
                stepName: this.getStepName(data.step),
                result: this.sanitizeResult(data.result),
                timestamp: new Date().toISOString()
            });
        });
        
        realTimeProcessor.on('process:complete', (processInfo) => {
            this.broadcastToAll({
                type: 'process:complete',
                processId: processInfo.id,
                documentId: processInfo.documentId,
                documentName: processInfo.documentName,
                duration: processInfo.duration,
                results: {
                    textExtracted: processInfo.results?.recognition?.text?.length > 0,
                    textLength: processInfo.results?.recognition?.text?.length || 0,
                    vectorized: processInfo.results?.vectorization?.success || false,
                    entitiesExtracted: processInfo.results?.entities?.length || 0,
                    relationsExtracted: processInfo.results?.graphExtraction?.relations?.length || 0
                },
                timestamp: new Date().toISOString()
            });
        });
        
        realTimeProcessor.on('process:error', (data) => {
            this.broadcastToAll({
                type: 'process:error',
                processId: data.processId,
                error: data.error,
                timestamp: new Date().toISOString()
            });
        });
    }
    
    handleClientMessage(userId, data) {
        try {
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'subscribe':
                    // 订阅特定文档的处理进度
                    this.subscribeToDocument(userId, message.documentId);
                    break;
                    
                case 'unsubscribe':
                    // 取消订阅
                    this.unsubscribeFromDocument(userId, message.documentId);
                    break;
                    
                case 'get:status':
                    // 获取处理状态
                    this.sendProcessStatus(userId, message.processId);
                    break;
                    
                case 'ping':
                    // 响应ping
                    this.sendToUser(userId, { type: 'pong' });
                    break;
                    
                default:
                    console.log('未知消息类型:', message.type);
            }
        } catch (error) {
            console.error('处理客户端消息失败:', error);
        }
    }
    
    subscribeToDocument(userId, documentId) {
        // 实现订阅逻辑
        this.sendToUser(userId, {
            type: 'subscribed',
            documentId,
            message: `已订阅文档 ${documentId} 的处理进度`
        });
    }
    
    unsubscribeFromDocument(userId, documentId) {
        // 实现取消订阅逻辑
        this.sendToUser(userId, {
            type: 'unsubscribed',
            documentId,
            message: `已取消订阅文档 ${documentId}`
        });
    }
    
    sendProcessStatus(userId, processId) {
        const status = realTimeProcessor.getProcessStatus(processId);
        
        if (status) {
            this.sendToUser(userId, {
                type: 'status',
                processId,
                status: status.status,
                steps: status.steps,
                results: status.results,
                timestamp: new Date().toISOString()
            });
        } else {
            this.sendToUser(userId, {
                type: 'status:notfound',
                processId,
                message: '未找到处理任务'
            });
        }
    }
    
    sendToUser(userId, message) {
        const ws = this.clients.get(userId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
    
    broadcastToAll(message) {
        const messageStr = JSON.stringify(message);
        
        this.clients.forEach((ws, userId) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(messageStr);
            }
        });
    }
    
    broadcastToUsers(userIds, message) {
        const messageStr = JSON.stringify(message);
        
        userIds.forEach(userId => {
            const ws = this.clients.get(userId);
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(messageStr);
            }
        });
    }
    
    getUserIdFromRequest(req) {
        // 简化版：从查询参数获取userId
        // 实际应该从JWT token中解析
        const url = new URL(req.url, `http://${req.headers.host}`);
        return url.searchParams.get('userId');
    }
    
    getStepName(step) {
        const stepNames = {
            'recognition': '文档识别',
            'vectorization': '向量化',
            'graphExtraction': '知识图谱提取'
        };
        return stepNames[step] || step;
    }
    
    sanitizeResult(result) {
        // 清理结果，只返回必要信息
        if (!result) return null;
        
        return {
            success: result.success,
            textLength: result.text?.length,
            vectorCount: result.vector_count,
            entityCount: result.entities?.length,
            relationCount: result.relations?.length
        };
    }
    
    getConnectedClients() {
        return Array.from(this.clients.keys());
    }
    
    getClientCount() {
        return this.clients.size;
    }
}

module.exports = DocumentProcessWebSocket;