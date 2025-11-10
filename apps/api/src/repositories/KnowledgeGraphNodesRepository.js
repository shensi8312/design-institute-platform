const BaseRepository = require('./BaseRepository')

/**
 * 知识图谱节点和关系Repository
 */
class KnowledgeGraphNodesRepository extends BaseRepository {
  constructor() {
    super('knowledge_graph_nodes')
    this.relationshipsTable = 'knowledge_graph_relationships'
  }

  /**
   * 批量插入节点
   */
  async batchInsertNodes(nodes) {
    try {
      return await this.db(this.tableName)
        .insert(nodes)
        .returning('*')
    } catch (error) {
      console.error('[GraphNodesRepository] 批量插入节点失败:', error)
      throw error
    }
  }

  /**
   * 批量插入关系
   */
  async batchInsertRelationships(relationships) {
    try {
      return await this.db(this.relationshipsTable)
        .insert(relationships)
        .returning('*')
    } catch (error) {
      console.error('[GraphNodesRepository] 批量插入关系失败:', error)
      throw error
    }
  }

  /**
   * 获取文档的所有节点
   */
  async getNodesByDocId(docId) {
    try {
      return await this.db(this.tableName)
        .where('document_id', docId)
        .orderBy('created_at', 'asc')
    } catch (error) {
      console.error('[GraphNodesRepository] 获取节点失败:', error)
      throw error
    }
  }

  /**
   * 获取文档的所有关系
   */
  async getRelationshipsByDocId(docId) {
    try {
      return await this.db(this.relationshipsTable)
        .where('document_id', docId)
        .orderBy('created_at', 'asc')
    } catch (error) {
      console.error('[GraphNodesRepository] 获取关系失败:', error)
      throw error
    }
  }

  /**
   * 获取完整图谱（节点+关系）
   */
  async getGraphByDocId(docId) {
    try {
      const nodes = await this.getNodesByDocId(docId)
      const relationships = await this.getRelationshipsByDocId(docId)

      return {
        nodes,
        relationships
      }
    } catch (error) {
      console.error('[GraphNodesRepository] 获取图谱失败:', error)
      throw error
    }
  }

  /**
   * 根据实体名称查找节点
   */
  async findNodeByEntity(docId, entityName) {
    try {
      return await this.db(this.tableName)
        .where('document_id', docId)
        .where('entity_name', entityName)
        .first()
    } catch (error) {
      console.error('[GraphNodesRepository] 查找节点失败:', error)
      throw error
    }
  }

  /**
   * 更新节点
   */
  async updateNode(nodeId, updateData) {
    try {
      return await this.db(this.tableName)
        .where('id', nodeId)
        .update({
          ...updateData,
          updated_at: this.db.fn.now()
        })
        .returning('*')
    } catch (error) {
      console.error('[GraphNodesRepository] 更新节点失败:', error)
      throw error
    }
  }

  /**
   * 更新关系
   */
  async updateRelationship(relId, updateData) {
    try {
      return await this.db(this.relationshipsTable)
        .where('id', relId)
        .update({
          ...updateData,
          updated_at: this.db.fn.now()
        })
        .returning('*')
    } catch (error) {
      console.error('[GraphNodesRepository] 更新关系失败:', error)
      throw error
    }
  }

  /**
   * 删除文档的所有节点和关系
   */
  async deleteNodesByDocId(docId) {
    try {
      // 先删除关系
      await this.db(this.relationshipsTable)
        .where('document_id', docId)
        .delete()

      // 再删除节点
      return await this.db(this.tableName)
        .where('document_id', docId)
        .delete()
    } catch (error) {
      console.error('[GraphNodesRepository] 删除节点失败:', error)
      throw error
    }
  }

  /**
   * 删除单个节点
   */
  async deleteNode(nodeId) {
    try {
      // 先删除相关的关系
      await this.db(this.relationshipsTable)
        .where('source_node_id', nodeId)
        .orWhere('target_node_id', nodeId)
        .delete()

      // 再删除节点
      return await this.db(this.tableName)
        .where('id', nodeId)
        .delete()
    } catch (error) {
      console.error('[GraphNodesRepository] 删除节点失败:', error)
      throw error
    }
  }

  /**
   * 删除单个关系
   */
  async deleteRelationship(relId) {
    try {
      return await this.db(this.relationshipsTable)
        .where('id', relId)
        .delete()
    } catch (error) {
      console.error('[GraphNodesRepository] 删除关系失败:', error)
      throw error
    }
  }

  /**
   * 根据版本获取图谱
   */
  async getGraphByVersionId(versionId) {
    try {
      const nodes = await this.db(this.tableName)
        .where('version_id', versionId)
        .orderBy('created_at', 'asc')

      const relationships = await this.db(this.relationshipsTable)
        .where('version_id', versionId)
        .orderBy('created_at', 'asc')

      return {
        nodes,
        relationships
      }
    } catch (error) {
      console.error('[GraphNodesRepository] 根据版本获取图谱失败:', error)
      throw error
    }
  }

  /**
   * 删除版本的所有图谱数据
   */
  async deleteGraphByVersionId(versionId) {
    try {
      await this.db(this.relationshipsTable)
        .where('version_id', versionId)
        .delete()

      await this.db(this.tableName)
        .where('version_id', versionId)
        .delete()
    } catch (error) {
      console.error('[GraphNodesRepository] 删除版本图谱失败:', error)
      throw error
    }
  }
}

module.exports = KnowledgeGraphNodesRepository
