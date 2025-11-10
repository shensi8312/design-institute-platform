const pdfParse = require('pdf-parse')
const mammoth = require('mammoth')
const JSZip = require('jszip')
const axios = require('axios')
const FormData = require('form-data')
const { pdfToPng } = require('pdf-to-png-converter')
const fs = require('fs').promises

/**
 * 文档解析服务
 * 支持PDF、Word、PPT、TXT、图片等格式
 * 集成DeepSeek-OCR高精度识别
 */
class DocumentParserService {
  constructor() {
    // 从环境变量读取OCR服务地址
    this.ocrServiceUrl = process.env.DOCUMENT_RECOGNITION_SERVICE || 'http://10.10.18.3:7000/ocr'
    this.ocrEnabled = process.env.USE_OCR_FOR_PDF !== 'false' // 默认启用
  }

  /**
   * 根据文件类型解析文档内容
   */
  async parseDocument(buffer, fileType, fileName) {
    try {
      console.log(`[DocumentParser] 解析文件: ${fileName}, 类型: ${fileType}`)

      if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        return await this.parsePDF(buffer, fileName)
      } else if (
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileName.endsWith('.docx')
      ) {
        return await this.parseWord(buffer)
      } else if (
        fileType.includes('powerpoint') ||
        fileType.includes('ms-powerpoint') ||
        fileType.includes('.presentation') ||
        fileType === 'application/vnd.ms-powerpoint' ||
        fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        fileName.endsWith('.ppt') ||
        fileName.endsWith('.pptx')
      ) {
        return await this.parsePowerPoint(buffer)
      } else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
        return this.parseText(buffer)
      } else if (
        fileType.startsWith('image/') ||
        fileName.match(/\.(jpg|jpeg|png|bmp|tiff|gif)$/i)
      ) {
        return await this.parseImage(buffer, fileName)
      } else {
        console.warn(`[DocumentParser] 未知文件类型: ${fileType}`)
        return `文件: ${fileName}`
      }
    } catch (error) {
      console.error(`[DocumentParser] 解析失败: ${error.message}`)
      throw error
    }
  }

  /**
   * 解析PDF文件
   */
  async parsePDF(buffer, fileName) {
    try {
      console.log(`[DocumentParser] 开始解析PDF: ${fileName}`)

      let textContent = ''
      let pdfData = null
      let usedPdfParse = false

      try {
        pdfData = await pdfParse(buffer)
        textContent = pdfData.text.trim()
        usedPdfParse = true

        console.log(`[DocumentParser] pdf-parse提取: ${pdfData.numpages}页, ${textContent.length}字符`)
      } catch (pdfParseError) {
        console.warn(`[DocumentParser] pdf-parse失败:`, pdfParseError.message)
      }

      if (!pdfData) {
        console.warn(`[DocumentParser] PDF解析失败，返回文件名`)
        return `文件: ${fileName}`
      }

      const avgCharsPerPage = textContent.length / pdfData.numpages
      const validLines = textContent.split('\n').filter(line => line.trim().length > 10).length
      const hasLowQualityText = validLines < pdfData.numpages * 2

      const needOCR = textContent.length < 100 || avgCharsPerPage < 200 || hasLowQualityText

      if (this.ocrEnabled && needOCR) {
        console.log(`[DocumentParser] 检测到可能是扫描件:`)
        console.log(`  - 平均 ${avgCharsPerPage.toFixed(0)} 字符/页`)
        console.log(`  - 有效行数: ${validLines} (共${pdfData.numpages}页)`)
        console.log(`  - 调用 DeepSeek-OCR 识别...`)

        try {
          const ocrText = await this.ocrPDFToText(buffer, fileName, pdfData.numpages)

          if (ocrText && ocrText.trim().length > textContent.length) {
            console.log(`[DocumentParser] ✅ DeepSeek-OCR识别成功: ${ocrText.length}字符 (原${textContent.length}字符)`)
            textContent = ocrText
          } else if (ocrText) {
            console.log(`[DocumentParser] DeepSeek-OCR识别: ${ocrText.length}字符，但不如pdf-parse`)
          }
        } catch (ocrError) {
          console.error(`[DocumentParser] DeepSeek-OCR识别失败:`, ocrError.message)
        }
      }

      console.log(`[DocumentParser] PDF解析完成: ${textContent.length}字符`)
      return textContent || `文件: ${fileName}`

    } catch (error) {
      console.error('[DocumentParser] PDF解析失败:', error)
      throw new Error('PDF解析失败: ' + error.message)
    }
  }

  /**
   * 将PDF转成图片并OCR识别
   */
  async ocrPDFToText(pdfBuffer, fileName, totalPages) {
    try {
      const maxPages = Math.min(totalPages, 10)
      console.log(`[DocumentParser] 将对前${maxPages}页进行OCR (总共${totalPages}页)`)

      let allText = ''

      for (let pageNum = 0; pageNum < maxPages; pageNum++) {
        try {
          const pngPages = await pdfToPng(pdfBuffer, {
            disableFontFace: false,
            useSystemFonts: false,
            viewportScale: 1.5,
            outputFolder: '/tmp',
            outputFileMask: `ocr_temp_${Date.now()}_${pageNum}`,
            pagesToProcess: [pageNum + 1],
            strictPagesToProcess: false,
            verbosityLevel: 0
          })

          if (pngPages && pngPages.length > 0) {
            const pageBuffer = pngPages[0].content
            const pageText = await this.callOCRService(pageBuffer, `${fileName}_p${pageNum + 1}.png`)

            if (pageText && pageText.trim().length > 0) {
              allText += pageText + '\n\n'
              console.log(`[DocumentParser] 第${pageNum + 1}页OCR: ${pageText.length}字符`)
            }
          }

          // 清理临时文件
          const tempDir = await fs.readdir('/tmp')
          for (const file of tempDir) {
            if (file.includes('ocr_temp_')) {
              await fs.unlink(`/tmp/${file}`).catch(() => {})
            }
          }
        } catch (pageError) {
          console.warn(`[DocumentParser] 第${pageNum + 1}页处理失败:`, pageError.message)
        }
      }

      return allText.trim()
    } catch (error) {
      console.error(`[DocumentParser] PDF OCR失败:`, error.message)
      throw error
    }
  }

  /**
   * 解析图片文件（调用DeepSeek-OCR）
   */
  async parseImage(buffer, fileName) {
    try {
      console.log(`[DocumentParser] 开始DeepSeek-OCR识别图片: ${fileName}`)

      if (!this.ocrEnabled) {
        console.warn(`[DocumentParser] OCR服务未启用，跳过图片识别`)
        return `图片文件: ${fileName}`
      }

      const ocrText = await this.callOCRService(buffer, fileName)

      if (ocrText && ocrText.trim().length > 0) {
        console.log(`[DocumentParser] ✅ 图片OCR成功: ${ocrText.length}字符`)
        return ocrText
      } else {
        console.warn(`[DocumentParser] OCR未识别到文字`)
        return `图片文件: ${fileName}`
      }
    } catch (error) {
      console.error('[DocumentParser] 图片OCR失败:', error)
      return `图片文件: ${fileName}`
    }
  }

  /**
   * 调用DeepSeek-OCR服务
   */
  async callOCRService(imageBuffer, fileName) {
    try {
      const form = new FormData()
      form.append('file', imageBuffer, {
        filename: fileName,
        contentType: 'image/png'
      })

      console.log(`[DocumentParser] 🚀 调用DeepSeek-OCR: ${this.ocrServiceUrl}`)

      const response = await axios.post(this.ocrServiceUrl, form, {
        headers: {
          ...form.getHeaders()
        },
        timeout: 60000, // 60秒超时
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      })

      if (response.data && response.data.success) {
        const text = response.data.text || ''
        console.log(`[DocumentParser] ✅ DeepSeek-OCR返回: ${text.length}字符`)
        return text
      } else {
        const errorMsg = response.data?.message || response.data?.error || 'OCR服务返回失败'
        console.warn(`[DocumentParser] ❌ DeepSeek-OCR失败: ${errorMsg}`)
        return null
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.error(`[DocumentParser] ❌ DeepSeek-OCR服务连接失败: ${this.ocrServiceUrl} 不可达`)
      } else if (error.code === 'ETIMEDOUT') {
        console.error(`[DocumentParser] ❌ DeepSeek-OCR服务超时`)
      } else {
        console.error(`[DocumentParser] ❌ DeepSeek-OCR调用异常:`, error.message)
      }
      throw error
    }
  }

  /**
   * 解析Word文档
   */
  async parseWord(buffer) {
    try {
      const result = await mammoth.extractRawText({ buffer })
      return result.value || ''
    } catch (error) {
      console.error('Word解析失败:', error)
      return ''
    }
  }

  /**
   * 解析PowerPoint文档
   */
  async parsePowerPoint(buffer) {
    try {
      console.log('[DocumentParser] 开始解析PowerPoint')

      const zip = new JSZip()
      const zipContents = await zip.loadAsync(buffer)

      let textContent = ''
      const slideFiles = Object.keys(zipContents.files).filter(filename =>
        filename.startsWith('ppt/slides/slide') && filename.endsWith('.xml')
      )

      for (const slideFile of slideFiles) {
        const slideXml = await zipContents.files[slideFile].async('text')
        const textMatches = slideXml.match(/<a:t>(.*?)<\/a:t>/g)
        if (textMatches) {
          const slideText = textMatches
            .map(match => match.replace(/<\/?a:t>/g, ''))
            .join(' ')
          textContent += slideText + '\n'
        }
      }

      return textContent.trim()
    } catch (error) {
      console.error('PowerPoint解析失败:', error)
      return ''
    }
  }

  /**
   * 解析纯文本
   */
  parseText(buffer) {
    return buffer.toString('utf-8')
  }

  /**
   * 根据文件名获取Content-Type
   */
  getContentType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase()
    const mimeTypes = {
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'tiff': 'image/tiff'
    }
    return mimeTypes[ext] || 'application/octet-stream'
  }
}

module.exports = DocumentParserService
