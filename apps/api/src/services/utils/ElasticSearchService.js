/**
 * ElasticSearch 服务
 * 提供全文搜索、日志分析、结构化查询等功能
 */

const { Client } = require('@elastic/elasticsearch');

class ElasticSearchService {
  constructor() {
    this.client = null;
    this.initialize();
  }

  async initialize() {
    try {
      this.client = new Client({
        node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
        auth: {
          username: process.env.ELASTICSEARCH_USER || 'elastic',
          password: process.env.ELASTICSEARCH_PASSWORD || 'elastic123'
        }
      });

      // 测试连接
      const health = await this.client.cluster.health();
      console.log('✅ ElasticSearch 连接成功:', health.cluster_name);
      
      // 确保必要的索引存在
      await this.ensureIndices();
    } catch (error) {
      console.error('❌ ElasticSearch 连接失败:', error.message);
    }
  }

  async ensureIndices() {
    const indices = [
      {
        name: 'knowledge_documents',
        mappings: {
          properties: {
            title: { type: 'text', analyzer: 'ik_max_word' },
            content: { type: 'text', analyzer: 'ik_max_word' },
            summary: { type: 'text', analyzer: 'ik_smart' },
            tags: { type: 'keyword' },
            category: { type: 'keyword' },
            file_type: { type: 'keyword' },
            created_at: { type: 'date' },
            vector_id: { type: 'keyword' }, // Milvus向量ID
            graph_nodes: { type: 'keyword' }, // Neo4j节点ID列表
            metadata: { type: 'object' }
          }
        }
      },
      {
        name: 'design_specs',
        mappings: {
          properties: {
            spec_number: { type: 'keyword' },
            title: { type: 'text', analyzer: 'ik_max_word' },
            content: { type: 'text', analyzer: 'ik_max_word' },
            version: { type: 'keyword' },
            effective_date: { type: 'date' },
            category: { type: 'keyword' },
            requirements: { type: 'nested' }
          }
        }
      },
      {
        name: 'chat_history',
        mappings: {
          properties: {
            conversation_id: { type: 'keyword' },
            user_id: { type: 'keyword' },
            message: { type: 'text', analyzer: 'ik_max_word' },
            response: { type: 'text', analyzer: 'ik_max_word' },
            timestamp: { type: 'date' },
            workflow_used: { type: 'keyword' },
            sources: { type: 'nested' }
          }
        }
      }
    ];

    for (const index of indices) {
      const exists = await this.client.indices.exists({ index: index.name });
      if (!exists) {
        await this.client.indices.create({
          index: index.name,
          body: { mappings: index.mappings }
        });
        console.log(`✅ 创建索引: ${index.name}`);
      }
    }
  }

  /**
   * 全文搜索
   */
  async search(query, options = {}) {
    const {
      index = 'knowledge_documents',
      size = 10,
      from = 0,
      fields = ['title', 'content', 'summary'],
      filters = {}
    } = options;

    try {
      const searchBody = {
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query,
                  fields,
                  type: 'best_fields',
                  analyzer: 'ik_smart'
                }
              }
            ],
            filter: []
          }
        },
        highlight: {
          fields: {
            content: { fragment_size: 150, number_of_fragments: 3 },
            title: {},
            summary: {}
          }
        },
        size,
        from
      };

      // 添加过滤条件
      if (filters.category) {
        searchBody.query.bool.filter.push({
          term: { category: filters.category }
        });
      }
      if (filters.file_type) {
        searchBody.query.bool.filter.push({
          term: { file_type: filters.file_type }
        });
      }
      if (filters.date_range) {
        searchBody.query.bool.filter.push({
          range: {
            created_at: {
              gte: filters.date_range.start,
              lte: filters.date_range.end
            }
          }
        });
      }

      const result = await this.client.search({
        index,
        body: searchBody
      });

      return {
        total: result.hits.total.value,
        hits: result.hits.hits.map(hit => ({
          id: hit._id,
          score: hit._score,
          source: hit._source,
          highlight: hit.highlight
        }))
      };
    } catch (error) {
      console.error('ElasticSearch 搜索失败:', error);
      throw error;
    }
  }

  /**
   * 混合搜索 - 结合ES全文搜索 + Milvus向量搜索 + Neo4j图谱搜索
   */
  async hybridSearch(query, options = {}) {
    const { kb_id, use_vector = true, use_graph = true } = options;

    // 1. ES全文搜索
    const esResults = await this.search(query, {
      index: 'knowledge_documents',
      size: 20
    });

    // 2. 获取向量ID和图谱节点ID
    const vectorIds = [];
    const graphNodeIds = [];
    
    esResults.hits.forEach(hit => {
      if (hit.source.vector_id) {
        vectorIds.push(hit.source.vector_id);
      }
      if (hit.source.graph_nodes) {
        graphNodeIds.push(...hit.source.graph_nodes);
      }
    });

    // 3. 返回混合结果
    return {
      es_results: esResults,
      vector_ids: vectorIds,  // 供Milvus进一步查询
      graph_node_ids: graphNodeIds, // 供Neo4j进一步查询
      total: esResults.total
    };
  }

  /**
   * 索引文档
   */
  async indexDocument(doc) {
    const {
      id,
      title,
      content,
      summary,
      category,
      file_type,
      vector_id,
      graph_nodes,
      metadata
    } = doc;

    try {
      await this.client.index({
        index: 'knowledge_documents',
        id,
        body: {
          title,
          content,
          summary,
          category,
          file_type,
          vector_id,
          graph_nodes,
          metadata,
          created_at: new Date()
        }
      });

      // 刷新索引使文档立即可搜索
      await this.client.indices.refresh({ index: 'knowledge_documents' });
      
      return { success: true, id };
    } catch (error) {
      console.error('索引文档失败:', error);
      throw error;
    }
  }

  /**
   * 批量索引
   */
  async bulkIndex(documents, index = 'knowledge_documents') {
    const body = documents.flatMap(doc => [
      { index: { _index: index, _id: doc.id } },
      doc
    ]);

    try {
      const result = await this.client.bulk({ body });
      
      if (result.errors) {
        console.error('批量索引有错误:', result.items.filter(item => item.index.error));
      }
      
      return {
        success: !result.errors,
        indexed: result.items.filter(item => item.index.status === 201).length,
        errors: result.items.filter(item => item.index.error)
      };
    } catch (error) {
      console.error('批量索引失败:', error);
      throw error;
    }
  }

  /**
   * 聚合分析
   */
  async aggregate(index, aggregations) {
    try {
      const result = await this.client.search({
        index,
        body: {
          size: 0,
          aggs: aggregations
        }
      });

      return result.aggregations;
    } catch (error) {
      console.error('聚合分析失败:', error);
      throw error;
    }
  }

  /**
   * 删除文档
   */
  async deleteDocument(id, index = 'knowledge_documents') {
    try {
      await this.client.delete({
        index,
        id
      });
      return { success: true };
    } catch (error) {
      console.error('删除文档失败:', error);
      throw error;
    }
  }
}

module.exports = new ElasticSearchService();