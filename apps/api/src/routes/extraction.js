const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const ExtractionTemplateService = require('../services/extraction/ExtractionTemplateService')
const DynamicExtractionEngine = require('../services/extraction/DynamicExtractionEngine')

const templateService = new ExtractionTemplateService()
const engine = new DynamicExtractionEngine()

/**
 * 获取所有模板
 */
router.get('/templates', authenticate, async (req, res) => {
  try {
    const { enabled, category } = req.query

    const templates = await templateService.getTemplates({
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : null,
      category
    })

    res.json({
      success: true,
      data: templates
    })
  } catch (error) {
    console.error('[API] 获取模板失败:', error)
    res.status(500).json({
      success: false,
      message: '获取模板失败',
      error: error.message
    })
  }
})

/**
 * 获取单个模板
 */
router.get('/templates/:id', authenticate, async (req, res) => {
  try {
    const template = await templateService.getTemplate(req.params.id)

    res.json({
      success: true,
      data: template
    })
  } catch (error) {
    console.error('[API] 获取模板失败:', error)
    res.status(error.message === '模板不存在' ? 404 : 500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 创建模板
 */
router.post('/templates', authenticate, async (req, res) => {
  try {
    const template = await templateService.createTemplate(req.body)

    res.json({
      success: true,
      data: template,
      message: '模板创建成功'
    })
  } catch (error) {
    console.error('[API] 创建模板失败:', error)
    res.status(500).json({
      success: false,
      message: '创建模板失败',
      error: error.message
    })
  }
})

/**
 * 更新模板
 */
router.put('/templates/:id', authenticate, async (req, res) => {
  try {
    const template = await templateService.updateTemplate(req.params.id, req.body)

    res.json({
      success: true,
      data: template,
      message: '模板更新成功'
    })
  } catch (error) {
    console.error('[API] 更新模板失败:', error)
    res.status(500).json({
      success: false,
      message: '更新模板失败',
      error: error.message
    })
  }
})

/**
 * 删除模板
 */
router.delete('/templates/:id', authenticate, async (req, res) => {
  try {
    await templateService.deleteTemplate(req.params.id)

    res.json({
      success: true,
      message: '模板删除成功'
    })
  } catch (error) {
    console.error('[API] 删除模板失败:', error)
    res.status(500).json({
      success: false,
      message: '删除模板失败',
      error: error.message
    })
  }
})

/**
 * 测试模板提取
 */
router.post('/templates/:id/test', authenticate, async (req, res) => {
  try {
    const { text } = req.body

    if (!text) {
      return res.status(400).json({
        success: false,
        message: '请提供待提取的文本'
      })
    }

    const template = await templateService.getTemplate(req.params.id)
    const result = await engine.extract(text, template)

    res.json({
      success: true,
      data: result,
      message: '提取成功'
    })
  } catch (error) {
    console.error('[API] 测试提取失败:', error)
    res.status(500).json({
      success: false,
      message: '提取失败',
      error: error.message
    })
  }
})

/**
 * 获取文档的提取结果
 */
router.get('/documents/:docId/extractions', authenticate, async (req, res) => {
  try {
    const { type } = req.query

    const extractions = await templateService.getExtractions(req.params.docId, { type })

    res.json({
      success: true,
      data: extractions
    })
  } catch (error) {
    console.error('[API] 获取提取结果失败:', error)
    res.status(500).json({
      success: false,
      message: '获取提取结果失败',
      error: error.message
    })
  }
})

/**
 * 对文档执行提取
 */
router.post('/documents/:docId/extract', authenticate, async (req, res) => {
  try {
    const { templateIds } = req.body

    if (!templateIds || !Array.isArray(templateIds)) {
      return res.status(400).json({
        success: false,
        message: '请提供模板ID列表'
      })
    }

    // 获取文档内容
    const db = require('../config/database')
    const doc = await db('knowledge_documents').where('id', req.params.docId).first()

    if (!doc) {
      return res.status(404).json({
        success: false,
        message: '文档不存在'
      })
    }

    // 获取文档向量文本
    const vectors = await db('knowledge_vectors')
      .where('document_id', req.params.docId)
      .orderBy('chunk_index')
      .limit(10)

    const text = vectors.map(v => v.chunk_text).join('\n\n')

    if (!text) {
      return res.status(400).json({
        success: false,
        message: '文档无可提取内容'
      })
    }

    // 获取模板
    const templates = await Promise.all(
      templateIds.map(id => templateService.getTemplate(id))
    )

    // 执行批量提取
    const results = await engine.extractBatch(text, templates)

    // 保存结果
    await templateService.saveExtractionBatch(req.params.docId, results)

    res.json({
      success: true,
      data: results,
      message: `成功提取 ${results.length} 项数据`
    })
  } catch (error) {
    console.error('[API] 文档提取失败:', error)
    res.status(500).json({
      success: false,
      message: '文档提取失败',
      error: error.message
    })
  }
})

module.exports = router
