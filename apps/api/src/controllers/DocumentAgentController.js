const DocumentAnalysisAgent = require('../services/document/DocumentAnalysisAgent')
const fs = require('fs').promises

/**
 * 文档智能分析 Agent 控制器
 */
class DocumentAgentController {
  constructor() {
    this.agent = new DocumentAnalysisAgent()
  }

  /**
   * 📄 分析上传的文档
   * POST /api/document-agent/analyze
   */
  async analyzeDocument(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '未上传文件'
        })
      }

      console.log(`[DocumentAgentController] 分析文档: ${req.file.originalname}`)

      // 读取文件内容
      const fileBuffer = await fs.readFile(req.file.path)

      // 获取分析选项
      const options = {
        generateSummary: req.body.generateSummary !== 'false',
        extractKeyInfo: req.body.extractKeyInfo === 'true'
      }

      // 调用 Agent 分析
      const result = await this.agent.analyzeDocument(
        fileBuffer,
        req.file.originalname,
        options
      )

      // 清理临时文件
      await fs.unlink(req.file.path).catch(() => {})

      res.json(result)

    } catch (error) {
      console.error('[DocumentAgentController] 分析失败:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * 💬 文档问答
   * POST /api/document-agent/ask
   */
  async askQuestion(req, res) {
    try {
      const { question, documentId } = req.body

      if (!question) {
        return res.status(400).json({
          success: false,
          error: '缺少问题参数'
        })
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '未上传文档'
        })
      }

      console.log(`[DocumentAgentController] 问答: ${question}`)

      // 读取文件
      const fileBuffer = await fs.readFile(req.file.path)

      // 先解析文档
      const parseResult = await this.agent.parser.parseDocument(
        fileBuffer,
        this.agent.getFileType(req.file.originalname),
        req.file.originalname
      )

      const documentStructure = {
        fileName: req.file.originalname,
        rawText: parseResult.text || '',
        structure: parseResult.structure || null
      }

      // 问答
      const answer = await this.agent.answerQuestion(question, documentStructure)

      // 清理临时文件
      await fs.unlink(req.file.path).catch(() => {})

      res.json({
        success: true,
        ...answer
      })

    } catch (error) {
      console.error('[DocumentAgentController] 问答失败:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * 📊 章节深度分析
   * POST /api/document-agent/analyze-sections
   */
  async analyzeSections(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '未上传文件'
        })
      }

      console.log(`[DocumentAgentController] 深度分析章节`)

      // 读取文件
      const fileBuffer = await fs.readFile(req.file.path)

      // 解析文档
      const parseResult = await this.agent.parser.parseDocument(
        fileBuffer,
        this.agent.getFileType(req.file.originalname),
        req.file.originalname
      )

      if (!parseResult.structure?.sections) {
        return res.json({
          success: false,
          error: '文档未包含结构化章节数据,请使用 Docling 解析器'
        })
      }

      // 批量分析章节
      const sectionAnalysis = await this.agent.analyzeAllSections(
        parseResult.structure.sections
      )

      // 清理临时文件
      await fs.unlink(req.file.path).catch(() => {})

      res.json({
        success: true,
        totalSections: parseResult.structure.sections.length,
        analyzed: sectionAnalysis.length,
        sections: sectionAnalysis
      })

    } catch (error) {
      console.error('[DocumentAgentController] 章节分析失败:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  /**
   * 🧪 测试接口
   * GET /api/document-agent/test
   */
  async test(req, res) {
    res.json({
      success: true,
      message: 'DocumentAnalysisAgent is ready',
      features: [
        '文档结构化解析 (Docling + pdf-parse)',
        'LLM 智能摘要生成',
        '关键信息提取',
        '章节内容分析',
        '智能问答',
        '批量章节分析'
      ]
    })
  }
}

module.exports = new DocumentAgentController()
