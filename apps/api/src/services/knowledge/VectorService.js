/**
 * 向量服务 - 连接Milvus进行向量化和检索
 */

const axios = require('axios');
const MilvusService = require('../rag/MilvusService');
const EmbeddingService = require('../rag/EmbeddingService');
const db = require('../../config/database');

class VectorService {
    constructor() {
        this.baseUrl = process.env.RAGFLOW_URL || 'http://localhost:8080';
        this.milvusService = new MilvusService();
        this.embeddingService = new EmbeddingService();
    }

    /**
     * 搜索相似文本块（用于智能问答）
     */
    async searchSimilarChunks(query, options = {}) {
        try {
            const { scope = 'all', userId, topK = 5, threshold = 0.7 } = options;

            console.log(`[VectorService] 搜索: "${query}", topK=${topK}, threshold=${threshold}`);

            // 1. 生成查询向量
            const embResult = await this.embeddingService.generateEmbedding(query);
            if (!embResult.success) {
                console.error('[VectorService] 生成查询向量失败:', embResult.error);
                return [];
            }
            const queryEmbedding = embResult.embedding;

            // 2. 在Milvus中搜索
            const milvusResult = await this.milvusService.search(queryEmbedding, topK * 2); // 多取候选

            if (!milvusResult.success || !milvusResult.results || milvusResult.results.length === 0) {
                console.log('[VectorService] Milvus未返回结果');
                return [];
            }

            const milvusResults = milvusResult.results;
            console.log(`[VectorService] Milvus返回 ${milvusResults.length} 条结果`);

            // 3. 过滤低分结果
            const filteredResults = milvusResults.filter(r => r.score >= threshold);
            console.log(`[VectorService] 过滤后剩余 ${filteredResults.length} 条 (score >= ${threshold})`);

            // 4. 获取文档信息
            const documentIds = [...new Set(filteredResults.map(r => r.document_id))];
            const documents = await db('knowledge_documents')
                .whereIn('id', documentIds)
                .select('id', 'name', 'kb_id', 'file_type');

            const docMap = {};
            documents.forEach(doc => {
                docMap[doc.id] = doc;
            });

            // 5. 组装结果
            const results = filteredResults
                .filter(r => docMap[r.document_id]) // 确保文档存在
                .slice(0, topK) // 限制最终返回数量
                .map(r => ({
                    content: r.chunk_text || '',
                    documentId: r.document_id,
                    documentName: docMap[r.document_id]?.name || '未知文档',
                    score: r.score,
                    chunkIndex: r.chunk_index,
                    metadata: {
                        document_id: r.document_id,
                        chunk_index: r.chunk_index,
                        kb_id: docMap[r.document_id]?.kb_id,
                        file_type: docMap[r.document_id]?.file_type
                    }
                }));

            console.log(`[VectorService] 返回 ${results.length} 条最终结果`);

            return results;

        } catch (error) {
            console.error('[VectorService] searchSimilarChunks失败:', error);
            throw error;
        }
    }

    /**
     * 向量搜索（供DeepSearchService使用）
     */
    async search(query, options = {}) {
        try {
            const { limit = 10, collection = 'knowledge_base' } = options;

            // 生成查询向量
            const embResult = await this.embeddingService.generateEmbedding(query);

            if (!embResult.success) {
                console.error('[VectorService] 生成查询向量失败:', embResult.error);
                return {
                    success: false,
                    error: embResult.error,
                    data: []
                };
            }

            // 在Milvus中搜索
            const milvusResult = await this.milvusService.search(embResult.embedding, limit);

            if (!milvusResult.success || !milvusResult.results || milvusResult.results.length === 0) {
                return {
                    success: true,
                    data: []
                };
            }

            // 格式化结果
            const formattedResults = milvusResult.results.map(r => ({
                id: r.id,
                content: r.chunk_text || '',
                score: r.score,
                metadata: {
                    document_id: r.document_id,
                    chunk_index: r.chunk_index
                }
            }));

            return {
                success: true,
                data: formattedResults
            };

        } catch (error) {
            console.error('[VectorService] search失败:', error);
            return {
                success: false,
                error: error.message,
                data: []
            };
        }
    }

    /**
     * 向量化文本并索引
     */
    async index(text, metadata = {}) {
        try {
            const response = await axios.post(`${this.baseUrl}/api/index`, {
                text,
                metadata
            });
            return response.data;
        } catch (error) {
            console.error('Vector indexing failed:', error.message);
            throw new Error('向量索引失败');
        }
    }

    /**
     * 删除向量
     */
    async delete(id) {
        try {
            const response = await axios.delete(`${this.baseUrl}/api/vectors/${id}`);
            return response.data;
        } catch (error) {
            console.error('Vector deletion failed:', error.message);
            throw new Error('向量删除失败');
        }
    }
}

module.exports = new VectorService()
