const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const GraphRAGService = require('../services/rag/GraphRAGService')
const db = require('../config/database')

const graphService = new GraphRAGService()

/**
 * GET /api/graph
 * 获取所有知识图谱数据（从PostgreSQL）
 */
router.get('/', authenticate, async (req, res) => {
  try {
    console.log('[Graph API] 获取所有图谱数据');

    // 从PostgreSQL获取所有节点
    const nodes = await db('knowledge_graph_nodes')
      .select('id', 'entity_name', 'entity_type', 'properties', 'document_id');

    // 从PostgreSQL获取所有关系
    const relationships = await db('knowledge_graph_relationships')
      .select('id', 'source_node_id', 'target_node_id', 'relationship_type', 'properties');

    console.log(`[GraphRAG] 获取图谱数据: ${nodes.length} 个节点, ${relationships.length} 个关系`);
    console.log(`[GraphRAG] 关系样例:`, relationships.slice(0, 2));

    // 格式化为前端需要的格式
    const result = {
      nodes: nodes.map(node => ({
        id: node.id,
        label: node.entity_name,
        type: node.entity_type,
        properties: node.properties || {},
        documentId: node.document_id
      })),
      links: relationships.map(rel => ({
        id: rel.id,
        source: rel.source_node_id,
        target: rel.target_node_id,
        type: rel.relationship_type,
        properties: rel.properties || {}
      }))
    };

    console.log(`[GraphRAG] 返回数据: nodes=${result.nodes.length}, links=${result.links.length}`);
    console.log(`[GraphRAG] links样例:`, result.links.slice(0, 2));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[Graph API] 获取图谱数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取图谱数据失败',
      error: error.message
    });
  }
});

/**
 * GET /api/graph/documents/:docId
 * 获取文档的知识图谱
 */
router.get('/documents/:docId', authenticate, async (req, res) => {
  try {
    const { docId } = req.params

    console.log('[Graph API] 获取文档图谱:', docId)

    const result = await graphService.getDocumentGraph(docId)

    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('[Graph API] 错误:', error)
    res.status(500).json({
      success: false,
      message: '获取图谱失败',
      error: error.message
    })
  }
})

/**
 * PUT /api/graph/nodes/:nodeId
 * 更新图谱节点
 */
router.put('/nodes/:nodeId', authenticate, async (req, res) => {
  try {
    const { nodeId } = req.params
    const updateData = req.body

    console.log('[Graph API] 更新节点:', nodeId, updateData)

    const result = await graphService.updateNode(nodeId, updateData)

    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('[Graph API] 错误:', error)
    res.status(500).json({
      success: false,
      message: '更新节点失败',
      error: error.message
    })
  }
})

/**
 * PUT /api/graph/relationships/:relId
 * 更新图谱关系
 */
router.put('/relationships/:relId', authenticate, async (req, res) => {
  try {
    const { relId } = req.params
    const updateData = req.body

    console.log('[Graph API] 更新关系:', relId, updateData)

    const result = await graphService.updateRelationship(relId, updateData)

    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('[Graph API] 错误:', error)
    res.status(500).json({
      success: false,
      message: '更新关系失败',
      error: error.message
    })
  }
})

/**
 * DELETE /api/graph/nodes/:nodeId
 * 删除图谱节点
 */
router.delete('/nodes/:nodeId', authenticate, async (req, res) => {
  try {
    const { nodeId } = req.params

    console.log('[Graph API] 删除节点:', nodeId)

    const result = await graphService.deleteNode(nodeId)

    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('[Graph API] 错误:', error)
    res.status(500).json({
      success: false,
      message: '删除节点失败',
      error: error.message
    })
  }
})

/**
 * DELETE /api/graph/relationships/:relId
 * 删除图谱关系
 */
router.delete('/relationships/:relId', authenticate, async (req, res) => {
  try {
    const { relId } = req.params

    console.log('[Graph API] 删除关系:', relId)

    const result = await graphService.deleteRelationship(relId)

    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('[Graph API] 错误:', error)
    res.status(500).json({
      success: false,
      message: '删除关系失败',
      error: error.message
    })
  }
})

/**
 * DELETE /api/graph/documents/:docId
 * 删除文档的整个图谱
 */
router.delete('/documents/:docId', authenticate, async (req, res) => {
  try {
    const { docId } = req.params

    console.log('[Graph API] 删除文档图谱:', docId)

    const result = await graphService.deleteDocumentGraph(docId)

    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    console.error('[Graph API] 错误:', error)
    res.status(500).json({
      success: false,
      message: '删除图谱失败',
      error: error.message
    })
  }
})

// ==================== 配置管理API ====================

/**
 * GET /api/graph/config/entity-types
 * 获取实体类型配置列表
 */
router.get('/config/entity-types', authenticate, async (req, res) => {
  try {
    const db = require('../config/database')
    const types = await db('graph_entity_types')
      .where('is_active', true)
      .orderBy('sort_order', 'asc')

    res.json({ success: true, data: types })
  } catch (error) {
    console.error('[Graph Config] 获取实体类型失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/graph/config/entity-types
 * 创建实体类型
 */
router.post('/config/entity-types', authenticate, async (req, res) => {
  try {
    const db = require('../config/database')
    const { v4: uuidv4 } = require('uuid')

    const newType = {
      id: req.body.id || uuidv4(),
      ...req.body,
      created_at: new Date(),
      updated_at: new Date()
    }

    const type = await db('graph_entity_types').insert(newType).returning('*')

    res.json({ success: true, data: type[0] })
  } catch (error) {
    console.error('[Graph Config] 创建实体类型失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PUT /api/graph/config/entity-types/:id
 * 更新实体类型
 */
router.put('/config/entity-types/:id', authenticate, async (req, res) => {
  try {
    const db = require('../config/database')
    const type = await db('graph_entity_types')
      .where('id', req.params.id)
      .update({ ...req.body, updated_at: new Date() })
      .returning('*')

    res.json({ success: true, data: type[0] })
  } catch (error) {
    console.error('[Graph Config] 更新实体类型失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /api/graph/config/entity-types/:id
 * 删除实体类型（软删除）
 */
router.delete('/config/entity-types/:id', authenticate, async (req, res) => {
  try {
    const db = require('../config/database')
    await db('graph_entity_types')
      .where('id', req.params.id)
      .update({ is_active: false, updated_at: new Date() })

    res.json({ success: true })
  } catch (error) {
    console.error('[Graph Config] 删除实体类型失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/graph/config/relationship-types
 * 获取关系类型配置列表
 */
router.get('/config/relationship-types', authenticate, async (req, res) => {
  try {
    const db = require('../config/database')
    const types = await db('graph_relationship_types')
      .where('is_active', true)
      .orderBy('sort_order', 'asc')

    res.json({ success: true, data: types })
  } catch (error) {
    console.error('[Graph Config] 获取关系类型失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/graph/config/relationship-types
 * 创建关系类型
 */
router.post('/config/relationship-types', authenticate, async (req, res) => {
  try {
    const db = require('../config/database')
    const { v4: uuidv4 } = require('uuid')

    const newType = {
      id: req.body.id || uuidv4(),
      ...req.body,
      created_at: new Date(),
      updated_at: new Date()
    }

    const type = await db('graph_relationship_types').insert(newType).returning('*')

    res.json({ success: true, data: type[0] })
  } catch (error) {
    console.error('[Graph Config] 创建关系类型失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PUT /api/graph/config/relationship-types/:id
 * 更新关系类型
 */
router.put('/config/relationship-types/:id', authenticate, async (req, res) => {
  try {
    const db = require('../config/database')
    const type = await db('graph_relationship_types')
      .where('id', req.params.id)
      .update({ ...req.body, updated_at: new Date() })
      .returning('*')

    res.json({ success: true, data: type[0] })
  } catch (error) {
    console.error('[Graph Config] 更新关系类型失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /api/graph/config/relationship-types/:id
 * 删除关系类型（软删除）
 */
router.delete('/config/relationship-types/:id', authenticate, async (req, res) => {
  try {
    const db = require('../config/database')
    await db('graph_relationship_types')
      .where('id', req.params.id)
      .update({ is_active: false, updated_at: new Date() })

    res.json({ success: true })
  } catch (error) {
    console.error('[Graph Config] 删除关系类型失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

module.exports = router
