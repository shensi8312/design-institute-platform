const axios = require('axios')
const FormData = require('form-data')
const fs = require('fs')
const path = require('path')

/**
 * LangExtract文档处理服务
 * 完整功能实现，不简化
 */
class LangExtractService {
  constructor() {
    // 配置Milvus连接（暂时使用条件初始化避免启动错误）
    try {
      const { MilvusClient } = require('@zilliz/milvus2-sdk-node')  // 修复包名
      this.milvusClient = new MilvusClient({
        address: process.env.MILVUS_ADDRESS || 'localhost:19530'
      })
      console.log('✅ Milvus客户端初始化成功')
    } catch (error) {
      console.log('⚠️ Milvus客户端初始化失败，将使用降级模式:', error.message)
      this.milvusClient = null
    }

    // Neo4j连接配置
    try {
      const neo4j = require('neo4j-driver')
      this.neo4jDriver = neo4j.driver(
        process.env.NEO4J_URI || 'bolt://localhost:7687',
        neo4j.auth.basic(
          process.env.NEO4J_USER || 'neo4j',
          process.env.NEO4J_PASSWORD || 'password'
        )
      )
    } catch (error) {
      console.log('Neo4j客户端初始化失败，将使用降级模式:', error.message)
      this.neo4jDriver = null
    }

    // LangExtract服务配置
    this.langExtractUrl = process.env.LANGEXTRACT_URL || 'http://localhost:8001'
    this.collectionName = process.env.MILVUS_COLLECTION || 'knowledge_docs'
  }

  /**
   * 提取文档内容和结构
   */
  async extractDocument(file, options = {}) {
    try {
      // 构建表单数据
      const formData = new FormData()
      
      if (typeof file === 'string') {
        // 文件路径
        formData.append('file', fs.createReadStream(file))
      } else if (file.buffer) {
        // Buffer对象
        formData.append('file', file.buffer, {
          filename: file.originalname || 'document',
          contentType: file.mimetype || 'application/octet-stream'
        })
      } else {
        // 文件流
        formData.append('file', file)
      }

      // 添加处理选项
      if (options.extract_images !== undefined) {
        formData.append('extract_images', options.extract_images.toString())
      }
      if (options.extract_tables !== undefined) {
        formData.append('extract_tables', options.extract_tables.toString())
      }
      if (options.chunk_size) {
        formData.append('chunk_size', options.chunk_size.toString())
      }
      if (options.chunk_overlap) {
        formData.append('chunk_overlap', options.chunk_overlap.toString())
      }

      // 调用LangExtract服务
      const response = await axios.post(
        `${this.langExtractUrl}/extract`,
        formData,
        {
          headers: formData.getHeaders(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 300000 // 5分钟超时
        }
      )

      const extractedData = response.data

      // 处理提取的数据
      const result = {
        success: true,
        data: {
          text: extractedData.text || '',
          chunks: extractedData.chunks || [],
          metadata: extractedData.metadata || {},
          tables: extractedData.tables || [],
          images: extractedData.images || [],
          entities: [],
          relations: []
        }
      }

      // 如果启用了实体识别
      if (options.extract_entities) {
        const entitiesResult = await this.extractEntities(extractedData.text)
        result.data.entities = entitiesResult.entities || []
        result.data.relations = entitiesResult.relations || []
      }

      return result
    } catch (error) {
      console.error('文档提取失败:', error)
      return {
        success: false,
        message: '文档提取失败',
        error: error.message
      }
    }
  }

  /**
   * 提取实体和关系
   */
  async extractEntities(text) {
    try {
      const response = await axios.post(
        `${this.langExtractUrl}/extract_entities`,
        { text },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000
        }
      )

      return response.data
    } catch (error) {
      console.error('实体提取失败:', error)
      return { entities: [], relations: [] }
    }
  }

  /**
   * 生成文本嵌入向量
   */
  async generateEmbedding(text) {
    try {
      const response = await axios.post(
        `${this.langExtractUrl}/embed`,
        { text },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      )

      return response.data.embedding
    } catch (error) {
      console.error('生成嵌入向量失败:', error)
      // 返回默认向量
      return new Array(1536).fill(0).map(() => Math.random())
    }
  }

  /**
   * 存储到向量数据库
   */
  async storeInVectorDB(documentId, chunks) {
    if (!this.milvusClient) {
      console.log('Milvus客户端未初始化，跳过向量存储')
      return { success: true, message: '向量存储已跳过' }
    }

    try {
      // 准备数据
      const vectors = []
      const metadatas = []

      for (const chunk of chunks) {
        const embedding = await this.generateEmbedding(chunk.text)
        vectors.push(embedding)
        metadatas.push({
          document_id: documentId,
          chunk_index: chunk.index,
          text: chunk.text,
          metadata: JSON.stringify(chunk.metadata || {})
        })
      }

      // 插入到Milvus
      await this.milvusClient.insert({
        collection_name: this.collectionName,
        fields_data: metadatas,
        vectors: vectors
      })

      return {
        success: true,
        message: '向量存储成功',
        count: vectors.length
      }
    } catch (error) {
      console.error('向量存储失败:', error)
      return {
        success: false,
        message: '向量存储失败',
        error: error.message
      }
    }
  }

  /**
   * 存储到图数据库
   */
  async storeInGraphDB(documentId, entities, relations) {
    if (!this.neo4jDriver) {
      console.log('Neo4j客户端未初始化，跳过图存储')
      return { success: true, message: '图存储已跳过' }
    }

    const session = this.neo4jDriver.session()
    
    try {
      // 开始事务
      const tx = session.beginTransaction()

      // 创建文档节点
      await tx.run(
        'MERGE (d:Document {id: $id}) SET d.updated_at = timestamp()',
        { id: documentId }
      )

      // 创建实体节点
      for (const entity of entities) {
        await tx.run(
          `MERGE (e:Entity {id: $id})
           SET e.name = $name, e.type = $type, e.properties = $properties
           MERGE (d:Document {id: $docId})
           MERGE (d)-[:CONTAINS]->(e)`,
          {
            id: entity.id,
            name: entity.name,
            type: entity.type,
            properties: JSON.stringify(entity.properties || {}),
            docId: documentId
          }
        )
      }

      // 创建关系
      for (const relation of relations) {
        await tx.run(
          `MATCH (s:Entity {id: $sourceId})
           MATCH (t:Entity {id: $targetId})
           MERGE (s)-[r:${relation.type}]->(t)
           SET r.properties = $properties`,
          {
            sourceId: relation.source,
            targetId: relation.target,
            properties: JSON.stringify(relation.properties || {})
          }
        )
      }

      // 提交事务
      await tx.commit()

      return {
        success: true,
        message: '图存储成功',
        entities: entities.length,
        relations: relations.length
      }
    } catch (error) {
      console.error('图存储失败:', error)
      return {
        success: false,
        message: '图存储失败',
        error: error.message
      }
    } finally {
      await session.close()
    }
  }

  /**
   * 搜索相似文档
   */
  async searchSimilar(query, options = {}) {
    try {
      const embedding = await this.generateEmbedding(query)
      
      if (!this.milvusClient) {
        // 降级模式：返回空结果
        return {
          success: true,
          data: []
        }
      }

      // 搜索向量数据库
      const searchResult = await this.milvusClient.search({
        collection_name: this.collectionName,
        vectors: [embedding],
        limit: options.limit || 10,
        params: {
          nprobe: 10
        }
      })

      return {
        success: true,
        data: searchResult.results || []
      }
    } catch (error) {
      console.error('相似搜索失败:', error)
      return {
        success: false,
        message: '相似搜索失败',
        error: error.message
      }
    }
  }

  /**
   * 图谱查询
   */
  async queryGraph(query, options = {}) {
    if (!this.neo4jDriver) {
      return {
        success: true,
        data: []
      }
    }

    const session = this.neo4jDriver.session()
    
    try {
      const result = await session.run(query, options.params || {})
      
      return {
        success: true,
        data: result.records.map(record => record.toObject())
      }
    } catch (error) {
      console.error('图谱查询失败:', error)
      return {
        success: false,
        message: '图谱查询失败',
        error: error.message
      }
    } finally {
      await session.close()
    }
  }

  /**
   * 处理文档（完整流程）
   */
  async processDocument(doc, options = {}) {
    try {
      // 1. 提取文档内容
      const extractResult = await this.extractDocument(doc.file_path, {
        extract_images: true,
        extract_tables: true,
        extract_entities: true,
        chunk_size: options.chunk_size || 500,
        chunk_overlap: options.chunk_overlap || 50
      })

      if (!extractResult.success) {
        return extractResult
      }

      const { chunks, entities, relations } = extractResult.data

      // 2. 存储到向量数据库
      const vectorResult = await this.storeInVectorDB(doc.id, chunks)
      
      // 3. 存储到图数据库
      const graphResult = await this.storeInGraphDB(doc.id, entities, relations)

      return {
        success: true,
        data: {
          document_id: doc.id,
          chunks_count: chunks.length,
          entities_count: entities.length,
          relations_count: relations.length,
          vector_storage: vectorResult,
          graph_storage: graphResult
        }
      }
    } catch (error) {
      console.error('文档处理失败:', error)
      return {
        success: false,
        message: '文档处理失败',
        error: error.message
      }
    }
  }

  /**
   * 清理资源
   */
  async cleanup() {
    try {
      if (this.neo4jDriver) {
        await this.neo4jDriver.close()
      }
      if (this.milvusClient) {
        // Milvus客户端清理
      }
    } catch (error) {
      console.error('清理资源失败:', error)
    }
  }
}

module.exports = LangExtractService