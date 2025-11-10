const fs = require('fs').promises
const path = require('path')
const PDFDocument = require('pdfkit')
const pdf = require('pdf-parse')

/**
 * PDF翻译服务
 */
class PDFTranslationService {
  constructor() {
    this.uploadDir = process.env.UPLOAD_PATH || './uploads'
  }

  /**
   * 提取PDF文本内容
   */
  async extractText(pdfPath) {
    try {
      const dataBuffer = await fs.readFile(pdfPath)
      const data = await pdf(dataBuffer)

      return {
        text: data.text,
        pageCount: data.numpages,
        info: data.info
      }
    } catch (error) {
      console.error('[PDF翻译] 提取文本失败:', error)
      throw new Error('PDF文本提取失败: ' + error.message)
    }
  }

  /**
   * 分段翻译文本（避免超过token限制）
   */
  async translateText(text, targetLanguage, unifiedLLMService) {
    // 按段落分割文本
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim())

    // 每次翻译5个段落
    const batchSize = 5
    const translatedParagraphs = []

    for (let i = 0; i < paragraphs.length; i += batchSize) {
      const batch = paragraphs.slice(i, i + batchSize)
      const batchText = batch.join('\n\n')

      console.log(`[PDF翻译] 翻译批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(paragraphs.length / batchSize)}`)

      const languageMap = {
        en: '英语',
        zh: '中文',
        ja: '日语',
        ko: '韩语',
        fr: '法语',
        de: '德语',
        es: '西班牙语'
      }

      const prompt = `翻译任务：将以下文本翻译成${languageMap[targetLanguage] || targetLanguage}。
要求：
1. 保持原文格式和段落结构
2. 只输出翻译结果，不要解释或思考过程
3. 不要添加任何前缀或后缀说明

原文：
${batchText}

翻译结果：`

      try {
        const response = await unifiedLLMService.generate(prompt, {
          temperature: 0.3,
          max_tokens: 2000
        })

        // 清理翻译结果中的多余内容
        let translated = response.content
        // 移除常见的思考过程标记
        translated = translated.replace(/<think>[\s\S]*?<\/think>/g, '')
        translated = translated.replace(/^[\s\S]*?翻译[：:]/m, '')
        translated = translated.trim()

        translatedParagraphs.push(translated)
      } catch (error) {
        console.error(`[PDF翻译] 批次 ${i} 翻译失败:`, error)
        translatedParagraphs.push(`[翻译失败: ${batch.join('\n\n')}]`)
      }

      // 避免请求过快
      if (i + batchSize < paragraphs.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    return translatedParagraphs.join('\n\n')
  }

  /**
   * 生成翻译后的PDF
   */
  async generateTranslatedPDF(translatedText, originalInfo, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 }
        })

        const writeStream = require('fs').createWriteStream(outputPath)
        doc.pipe(writeStream)

        // 添加标题
        doc.fontSize(20)
          .text('翻译文档', { align: 'center' })
          .moveDown()

        // 添加原文档信息
        if (originalInfo && originalInfo.Title) {
          doc.fontSize(12)
            .text(`原标题: ${originalInfo.Title}`, { align: 'center' })
            .moveDown()
        }

        // 添加翻译内容
        doc.fontSize(11)

        // 按段落处理文本
        const paragraphs = translatedText.split(/\n\n+/)
        paragraphs.forEach((paragraph, index) => {
          if (paragraph.trim()) {
            doc.text(paragraph.trim(), {
              align: 'left',
              lineGap: 5
            })

            if (index < paragraphs.length - 1) {
              doc.moveDown(0.5)
            }
          }
        })

        // 添加页脚（在结束前添加到当前页）
        doc.fontSize(9)
          .text(
            `第 1 页`,
            50,
            doc.page.height - 30,
            { align: 'center' }
          )

        doc.end()

        writeStream.on('finish', () => {
          resolve(outputPath)
        })

        writeStream.on('error', reject)
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 完整的PDF翻译流程
   */
  async translatePDF(pdfPath, targetLanguage = 'zh') {
    try {
      console.log('[PDF翻译] 开始处理:', pdfPath)

      // 1. 提取文本
      console.log('[PDF翻译] 步骤1: 提取PDF文本')
      const { text, pageCount, info } = await this.extractText(pdfPath)
      console.log(`[PDF翻译] 提取完成: ${pageCount} 页, ${text.length} 字符`)

      if (!text || text.trim().length === 0) {
        throw new Error('PDF中没有可提取的文本内容')
      }

      // 2. 翻译文本
      console.log('[PDF翻译] 步骤2: 翻译文本')
      const unifiedLLMService = require('../llm/UnifiedLLMService')
      const translatedText = await this.translateText(text, targetLanguage, unifiedLLMService)
      console.log(`[PDF翻译] 翻译完成: ${translatedText.length} 字符`)

      // 3. 生成新PDF
      console.log('[PDF翻译] 步骤3: 生成翻译后的PDF')
      const timestamp = Date.now()
      const outputFileName = `translated_${timestamp}.pdf`
      const outputPath = path.join(this.uploadDir, outputFileName)

      await this.generateTranslatedPDF(translatedText, info, outputPath)
      console.log('[PDF翻译] PDF生成完成:', outputPath)

      return {
        success: true,
        originalPages: pageCount,
        originalLength: text.length,
        translatedLength: translatedText.length,
        outputPath,
        outputFileName,
        downloadUrl: `/uploads/${outputFileName}`
      }
    } catch (error) {
      console.error('[PDF翻译] 处理失败:', error)
      throw error
    }
  }
}

module.exports = PDFTranslationService
