const DocumentParserService = require('./DocumentParserService')
const UnifiedLLMService = require('../llm/UnifiedLLMService')

/**
 * 文档智能分析 Agent
 *
 * 功能:
 * 1. 文档结构化解析 (Docling)
 * 2. 章节内容理解 (LLM)
 * 3. 智能问答
 * 4. 自动摘要生成
 * 5. 关键信息提取
 */
class DocumentAnalysisAgent {
  constructor() {
    this.parser = new DocumentParserService()
    this.llm = UnifiedLLMService  // UnifiedLLMService 导出的是单例实例
  }

  /**
   * 🚀 核心方法: 分析文档
   *
   * @param {Buffer} fileBuffer - 文件内容
   * @param {string} fileName - 文件名
   * @param {Object} options - 分析选项
   * @returns {Object} 分析结果
   */
  async analyzeDocument(fileBuffer, fileName, options = {}) {
    try {
      console.log(`[DocumentAgent] 开始分析文档: ${fileName}`)

      // Step 1: 结构化解析 (Docling优先)
      const parseResult = await this.parser.parseDocument(
        fileBuffer,
        this.getFileType(fileName),
        fileName
      )

      // 处理不同返回类型（字符串或对象）
      let documentData = {}
      if (typeof parseResult === 'string') {
        // PDF等返回纯文本
        documentData = {
          text: parseResult,
          parser: 'pdf-parse',
          structure: null,
          metadata: {}
        }
      } else if (parseResult && typeof parseResult === 'object') {
        // Word等返回结构化对象
        documentData = {
          text: parseResult.text || '',
          parser: parseResult.metadata?.parser || 'unknown',
          structure: parseResult.structure || null,
          metadata: parseResult.metadata || {}
        }
      }

      console.log(`[DocumentAgent] 解析完成, 使用解析器: ${documentData.parser}`)

      // Step 2: 提取结构化数据
      const documentStructure = {
        fileName,
        parser: documentData.parser,
        rawText: documentData.text,
        structure: documentData.structure,
        metadata: documentData.metadata
      }

      // Step 3: LLM 增强分析
      const analysis = await this.performLLMAnalysis(documentStructure, options)

      return {
        success: true,
        document: documentStructure,
        analysis: analysis
      }

    } catch (error) {
      console.error('[DocumentAgent] 分析失败:', error)
      throw error
    }
  }

  /**
   * 🧠 LLM 智能分析
   */
  async performLLMAnalysis(documentStructure, options) {
    const analysis = {}

    // 1. 生成文档摘要
    if (options.generateSummary !== false) {
      console.log('[DocumentAgent] 生成文档摘要...')
      analysis.summary = await this.generateSummary(documentStructure)
    }

    // 2. 提取关键信息
    if (options.extractKeyInfo) {
      console.log('[DocumentAgent] 提取关键信息...')
      analysis.keyInfo = await this.extractKeyInformation(documentStructure)
    }

    // 3. 章节分析 (如果有结构化数据)
    if (documentStructure.structure?.sections) {
      console.log('[DocumentAgent] 分析章节结构...')
      analysis.sections = await this.analyzeSections(documentStructure.structure.sections)
    }

    return analysis
  }

  /**
   * 📝 生成文档摘要 (分块递归摘要策略)
   */
  async generateSummary(documentStructure) {
    try {
      const fullText = documentStructure.rawText
      const textLength = fullText.length
      const CHUNK_SIZE = 2000  // 每块2000字符

      console.log(`[DocumentAgent] 文档总长度: ${textLength} 字符`)

      // 短文档: 直接摘要
      if (textLength <= CHUNK_SIZE) {
        console.log('[DocumentAgent] 短文档,直接生成摘要')
        return await this.generateSingleSummary(fullText, documentStructure.fileName, textLength)
      }

      // 长文档: 分块递归摘要
      console.log('[DocumentAgent] 长文档,使用分块递归摘要')

      // Step 1: 切分文档
      const chunks = this.splitTextIntoChunks(fullText, CHUNK_SIZE)
      console.log(`[DocumentAgent] 切分为 ${chunks.length} 个块`)

      // Step 2: 为每个块生成摘要
      const chunkSummaries = []
      for (let i = 0; i < chunks.length; i++) {
        console.log(`[DocumentAgent] 处理第 ${i + 1}/${chunks.length} 块...`)

        const prompt = `
请为以下文本片段生成简洁摘要 (100-150字):

片段 ${i + 1}/${chunks.length}:
${chunks[i]}

要求:
1. 提取核心内容
2. 简洁准确
3. 中文输出
`
        try {
          const response = await this.llm.chat([
            { role: 'user', content: prompt }
          ])
          chunkSummaries.push(`[第${i + 1}部分] ${response.content}`)
        } catch (error) {
          console.error(`[DocumentAgent] 第${i + 1}块摘要失败:`, error.message)
          chunkSummaries.push(`[第${i + 1}部分] 摘要生成失败`)
        }
      }

      // Step 3: 综合所有小摘要成总摘要
      console.log('[DocumentAgent] 综合生成总摘要...')
      const combinedSummaries = chunkSummaries.join('\n\n')

      const finalPrompt = `
基于以下各部分的摘要,生成一个完整的文档总摘要 (200-300字):

文档名称: ${documentStructure.fileName}
文档总长度: ${textLength} 字符

各部分摘要:
${combinedSummaries}

要求:
1. 综合所有部分的内容
2. 概括文档的整体主题和目的
3. 提炼最核心的要点
4. 200-300字,简洁准确
5. 中文输出
`

      const finalResponse = await this.llm.chat([
        { role: 'user', content: finalPrompt }
      ])

      return {
        content: finalResponse.content,
        generatedAt: new Date().toISOString(),
        method: 'chunk-recursive',
        chunks: chunks.length
      }

    } catch (error) {
      console.error('[DocumentAgent] 生成摘要失败:', error)
      return { content: '摘要生成失败', error: error.message }
    }
  }

  /**
   * 生成单个文本的摘要 (短文档用)
   */
  async generateSingleSummary(text, fileName, textLength) {
    const prompt = `
请为以下文档生成简洁的摘要 (200-300字):

文档名称: ${fileName}
文档长度: ${textLength} 字符
文档内容:
${text}

摘要要求:
1. 概括文档主题和目的
2. 提炼核心内容
3. 简洁准确
4. 中文输出
`

    const response = await this.llm.chat([
      { role: 'user', content: prompt }
    ])

    return {
      content: response.content,
      generatedAt: new Date().toISOString(),
      method: 'direct'
    }
  }

  /**
   * 切分文本为固定大小的块
   */
  splitTextIntoChunks(text, chunkSize) {
    const chunks = []
    let currentIndex = 0

    while (currentIndex < text.length) {
      // 尝试在句子边界切分,避免切断句子
      let endIndex = currentIndex + chunkSize

      if (endIndex < text.length) {
        // 向后查找句号、问号、叹号、换行符
        const searchText = text.substring(endIndex - 100, endIndex + 100)
        const punctuationMatch = searchText.match(/[。!?!\n]/)

        if (punctuationMatch) {
          endIndex = endIndex - 100 + punctuationMatch.index + 1
        }
      }

      chunks.push(text.substring(currentIndex, endIndex).trim())
      currentIndex = endIndex
    }

    return chunks
  }

  /**
   * 🔍 提取关键信息
   */
  async extractKeyInformation(documentStructure) {
    try {
      const text = documentStructure.rawText.substring(0, 4000)

      const prompt = `
分析以下文档,提取关键信息:

${text}

请提取:
1. 项目名称/文档主题
2. 时间信息 (日期、工期等)
3. 涉及的单位/人员
4. 重要数据 (金额、数量等)
5. 关键要求或条款

以 JSON 格式输出:
{
  "projectName": "...",
  "dates": [...],
  "organizations": [...],
  "keyData": [...],
  "requirements": [...]
}
`

      const response = await this.llm.chat([
        { role: 'user', content: prompt }
      ])

      // 尝试解析 JSON
      try {
        return JSON.parse(response.content)
      } catch {
        return { raw: response.content }
      }

    } catch (error) {
      console.error('[DocumentAgent] 提取关键信息失败:', error)
      return { error: error.message }
    }
  }

  /**
   * 📊 分析章节结构
   */
  async analyzeSections(sections) {
    try {
      console.log(`[DocumentAgent] 分析 ${sections.length} 个章节`)

      const sectionAnalysis = sections.slice(0, 10).map(section => ({
        code: section.code,
        title: section.title,
        level: section.level,
        page: section.page,
        contentLength: section.content?.length || 0
      }))

      return {
        totalSections: sections.length,
        hierarchy: this.buildHierarchy(sections),
        topLevelSections: sectionAnalysis
      }

    } catch (error) {
      console.error('[DocumentAgent] 章节分析失败:', error)
      return { error: error.message }
    }
  }

  /**
   * 🌲 构建章节层级树
   */
  buildHierarchy(sections) {
    const hierarchy = []
    const levelMap = {}

    sections.forEach(section => {
      const level = section.level || 1
      if (!levelMap[level]) {
        levelMap[level] = []
      }
      levelMap[level].push({
        code: section.code,
        title: section.title
      })
    })

    return levelMap
  }

  /**
   * 💬 智能问答
   */
  async answerQuestion(question, documentStructure) {
    try {
      console.log(`[DocumentAgent] 回答问题: ${question}`)

      // 如果有结构化章节,先定位相关章节
      let context = documentStructure.rawText.substring(0, 4000)

      if (documentStructure.structure?.sections) {
        const relevantSections = this.findRelevantSections(
          question,
          documentStructure.structure.sections
        )

        if (relevantSections.length > 0) {
          context = relevantSections
            .map(s => `[${s.code}] ${s.title}\n${s.content}`)
            .join('\n\n')
            .substring(0, 4000)
        }
      }

      const prompt = `
基于以下文档内容回答问题:

文档内容:
${context}

问题: ${question}

要求:
1. 基于文档内容回答,不要编造
2. 如果文档中没有相关信息,明确说明
3. 引用具体章节或段落
4. 中文回答
`

      const response = await this.llm.chat([
        { role: 'user', content: prompt }
      ])

      return {
        question,
        answer: response.content,
        context: context.substring(0, 500) + '...',
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      console.error('[DocumentAgent] 问答失败:', error)
      throw error
    }
  }

  /**
   * 🔍 查找相关章节 (简单关键词匹配)
   */
  findRelevantSections(question, sections) {
    const keywords = question
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 1)

    return sections
      .filter(section => {
        const text = `${section.title} ${section.content}`.toLowerCase()
        return keywords.some(kw => text.includes(kw))
      })
      .slice(0, 3) // 最多返回3个相关章节
  }

  /**
   * 📋 批量分析章节内容
   */
  async analyzeAllSections(sections) {
    try {
      const results = []

      // 限制分析数量,避免超时
      const sectionsToAnalyze = sections.slice(0, 5)

      for (const section of sectionsToAnalyze) {
        console.log(`[DocumentAgent] 分析章节: ${section.code} ${section.title}`)

        const prompt = `
分析以下章节内容,提取关键点:

章节: ${section.code} ${section.title}
内容: ${section.content?.substring(0, 2000)}

请提取:
1. 主要内容概述
2. 关键要求或标准
3. 重要数据或参数

简洁输出,每项不超过50字。
`

        try {
          const response = await this.llm.chat([
            { role: 'user', content: prompt }
          ])

          results.push({
            section: `${section.code} ${section.title}`,
            analysis: response.content
          })
        } catch (error) {
          console.error(`[DocumentAgent] 章节分析失败: ${section.code}`, error)
          results.push({
            section: `${section.code} ${section.title}`,
            error: error.message
          })
        }
      }

      return results

    } catch (error) {
      console.error('[DocumentAgent] 批量分析失败:', error)
      throw error
    }
  }

  /**
   * 获取文件类型
   */
  getFileType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase()
    const mimeTypes = {
      'pdf': 'application/pdf',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'doc': 'application/msword',
      'txt': 'text/plain'
    }
    return mimeTypes[ext] || 'application/octet-stream'
  }
}

module.exports = DocumentAnalysisAgent
