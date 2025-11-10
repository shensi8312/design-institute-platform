/**
 * GraphRAG服务 - 知识图谱提取与查询
 * 连接真实的GraphRAG服务
 */

const axios = require('axios');

class GraphRAGService {
    constructor() {
        this.baseUrl = process.env.GRAPHRAG_URL || 'http://localhost:8081';
    }
    
    /**
     * 从文本提取知识图谱
     */
    async extractGraph(text, metadata = {}) {
        try {
            const response = await axios.post(`${this.baseUrl}/api/extract`, {
                text,
                metadata
            });
            return response.data;
        } catch (error) {
            console.error('GraphRAG extraction failed:', error.message);
            throw new Error('知识图谱提取失败');
        }
    }
    
    /**
     * 查询知识图谱
     */
    async queryGraph(query, options = {}) {
        try {
            const response = await axios.post(`${this.baseUrl}/api/query`, {
                query,
                ...options
            });
            return response.data;
        } catch (error) {
            console.error('GraphRAG query failed:', error.message);
            throw new Error('知识图谱查询失败');
        }
    }
    
    /**
     * 添加节点到图谱
     */
    async addNode(node) {
        try {
            const response = await axios.post(`${this.baseUrl}/api/node`, node);
            return response.data;
        } catch (error) {
            console.error('Failed to add node:', error.message);
            throw new Error('添加节点失败');
        }
    }
    
    /**
     * 添加边到图谱
     */
    async addEdge(edge) {
        try {
            const response = await axios.post(`${this.baseUrl}/api/edge`, edge);
            return response.data;
        } catch (error) {
            console.error('Failed to add edge:', error.message);
            throw new Error('添加关系失败');
        }
    }
}

module.exports = new GraphRAGService()