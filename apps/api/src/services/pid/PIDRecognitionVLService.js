const axios = require('axios')
const fs = require('fs').promises
const path = require('path')
const sharp = require('sharp')
let FormData = globalThis.FormData
if (!FormData) {
  try {
    FormData = require('form-data')
    console.log('✅ 使用 form-data 包兼容旧版 Node 环境')
  } catch (error) {
    throw new Error('FormData API 不可用，请升级到 Node 18+ 或安装 form-data 包')
  }
}
const { LLMConfig } = require('../../config/llm.config')
const crypto = require('crypto')

// PDF 处理依赖
let pdfToPng = null
try {
  pdfToPng = require('pdf-to-png-converter')
  console.log('✅ PDF转PNG支持已启用')
} catch (e) {
  console.warn('⚠️  PDF转PNG支持未启用:', e.message)
}

// Canvas绘图依赖（用于生成标注图）
let Canvas = null
try {
  Canvas = require('canvas')
  console.log('✅ Canvas绘图支持已启用')
} catch (e) {
  console.warn('⚠️  Canvas绘图支持未启用:', e.message)
}

/**
 * PID图纸识别服务 - QWEN-VL多模态版本
 *
 * 优势:
 * - 直接理解图像语义，无需形状匹配
 * - 可识别复杂符号和文字
 * - 可提取连接关系和流程描述
 *
 * 使用场景:
 * - 初步识别和理解PID图纸
 * - 提取高层次的流程信息
 * - 生成组件清单和连接关系
 */
class PIDRecognitionVLService {
  constructor() {
    this.config = LLMConfig.qwenVL
    this.ocrServiceUrl = process.env.DOCUMENT_RECOGNITION_SERVICE || 'http://10.10.18.3:7000/ocr'

    // 文件保存目录
    this.uploadDir = process.env.UPLOAD_DIR || './uploads'
    this.originalsDir = path.join(this.uploadDir, 'pid_originals')
    this.annotationsDir = path.join(this.uploadDir, 'pid_annotations')
    this.convertedDir = path.join(this.uploadDir, 'pid_converted')

    console.log(`✅ PID识别服务初始化 (QWEN-VL): ${this.config.baseUrl}`)
    console.log(`✅ OCR服务地址: ${this.ocrServiceUrl}`)

    // 确保目录存在
    this._ensureDirectories()
  }

  /**
   * 确保上传目录存在
   */
  async _ensureDirectories() {
    try {
      await fs.mkdir(this.originalsDir, { recursive: true })
      await fs.mkdir(this.annotationsDir, { recursive: true })
      await fs.mkdir(this.convertedDir, { recursive: true })
      console.log('✅ PID上传目录已创建')
    } catch (error) {
      console.error('❌ 创建上传目录失败:', error.message)
    }
  }

  /**
   * 识别PID图纸（OCR+VL两阶段增强）
   */
  async recognizePIDWithOCR(fileBuffer, fileName = 'pid.png') {
    console.log(`🔍 [OCR+QWEN-VL] 开始两阶段识别: ${fileName}`)

    try {
      // 确保目录存在（修复异步问题）
      await this._ensureDirectories()

      // 检查是否是PDF文件
      const isPDF = fileName.toLowerCase().endsWith('.pdf')
      let imageBuffer = fileBuffer

      if (isPDF) {
        console.log('  检测到PDF文件，转换为图片...')
        imageBuffer = await this._pdfToImage(fileBuffer)
      }

      // 阶段1: OCR提取文本标签
      console.log('  📝 阶段1: OCR提取组件位号...')
      const ocrFileName = isPDF ? 'pid_page_1.png' : fileName
      const ocrText = await this._callOCRService(imageBuffer, ocrFileName)
      console.log(`  ✅ OCR提取: ${ocrText.length}字符`)

      // 调整图片大小
      const processedImage = await this._preprocessImage(imageBuffer)

      // 阶段2: 调用QWEN-VL，结合OCR结果识别
      console.log('  🤖 阶段2: QwenVL结合OCR结果识别组件和连接...')
      const result = await this._callQwenVLWithOCR(processedImage, ocrText)

      // 解析结果
      const parsed = this._parseResult(result)

      console.log(`✅ [OCR+QWEN-VL] 识别完成: ${parsed.components.length} 个组件, ${parsed.connections.length} 条连接`)

      return {
        success: true,
        method: 'ocr+qwen-vl',
        components: parsed.components,
        connections: parsed.connections,
        legend: parsed.legend,
        summary: parsed.summary,
        ocr_text: ocrText,
        page_count: 1,
        raw_response: result
      }
    } catch (error) {
      console.error(`❌ [OCR+QWEN-VL] 识别失败:`, error.message)
      throw error
    }
  }

  /**
   * 识别PID图纸（纯VL，不使用OCR）
   */
  async recognizePID(fileBuffer, fileName = 'pid.png') {
    console.log(`🔍 [QWEN-VL] 开始识别: ${fileName}`)

    try {
      // 确保目录存在（修复异步问题）
      await this._ensureDirectories()

      // 生成唯一文件ID
      const fileId = crypto.randomBytes(4).toString('hex')
      const timestamp = Date.now()

      // 检查是否是PDF文件
      const isPDF = fileName.toLowerCase().endsWith('.pdf')
      let imageBuffer = fileBuffer
      let savedPaths = { original: null, converted: null }

      // 1. 保存原始文件
      const originalExt = isPDF ? '.pdf' : path.extname(fileName)
      const originalPath = path.join(this.originalsDir, `${fileId}_${timestamp}${originalExt}`)
      await fs.writeFile(originalPath, fileBuffer)
      savedPaths.original = `/uploads/pid_originals/${path.basename(originalPath)}`
      console.log(`  ✅ 原始文件已保存: ${savedPaths.original}`)

      // 2. 如果是PDF，转换为图片并保存
      if (isPDF) {
        console.log('  检测到PDF文件，转换为图片...')
        imageBuffer = await this._pdfToImage(fileBuffer)
        const convertedPath = path.join(this.convertedDir, `${fileId}_${timestamp}.png`)
        await fs.writeFile(convertedPath, imageBuffer)
        savedPaths.converted = `/uploads/pid_converted/${path.basename(convertedPath)}`
        console.log(`  ✅ 转换图片已保存: ${savedPaths.converted}`)
      }

      // 3. 调整图片大小（用于API识别）
      const processedImage = await this._preprocessImage(imageBuffer)

      // 4. 调用QWEN-VL识别
      const result = await this._callQwenVL(processedImage)

      // 5. 解析结果
      const parsed = this._parseResult(result)

      // 5.1. 应用NMS去除重复检测（修复标注图多画一个框的bug）
      const deduplicatedComponents = this._applyNMS(parsed.components, 0.5)

      console.log(`✅ [QWEN-VL] 识别完成: ${parsed.components.length} 个组件 (去重后: ${deduplicatedComponents.length}), ${parsed.connections.length} 条连接`)

      // 6. 生成可视化标注图（使用去重后的组件）
      const annotationUrl = await this._generateAnnotationImage(
        imageBuffer,
        deduplicatedComponents,
        parsed.connections,
        fileId,
        timestamp
      )

      // 7. 返回完整结果（包含所有URL）
      const visualization_urls = [
        savedPaths.converted || savedPaths.original,  // 显示转换后的图片或原始图片
        annotationUrl                                   // 标注图
      ].filter(Boolean)

      return {
        success: true,
        method: 'qwen-vl',
        file_id: fileId,
        file_name: fileName,
        file_path: savedPaths.original,
        converted_path: savedPaths.converted,
        components: deduplicatedComponents,
        connections: parsed.connections,
        legend: parsed.legend,
        summary: parsed.summary,
        visualization_urls,  // ✅ 返回正确的字段名
        page_count: 1,
        raw_response: result
      }
    } catch (error) {
      console.error(`❌ [QWEN-VL] 识别失败:`, error.message)
      throw error
    }
  }

  /**
   * 将PDF第一页转换为图片（使用pdftoppm高质量转换）
   */
  async _pdfToImage(pdfBuffer) {
    try {
      const { execSync } = require('child_process')
      const os = require('os')

      // 保存PDF到临时文件
      const tempPdfPath = path.join(os.tmpdir(), `pid_${Date.now()}.pdf`)
      await fs.writeFile(tempPdfPath, pdfBuffer)

      console.log(`  临时PDF文件: ${tempPdfPath}`)

      // 使用pdftoppm转换（300 DPI高质量）
      const outputPrefix = path.join(os.tmpdir(), `pid_page_${Date.now()}`)

      try {
        // pdftoppm -png -r 300 -f 1 -l 1 input.pdf output_prefix
        execSync(`pdftoppm -png -r 300 -f 1 -l 1 "${tempPdfPath}" "${outputPrefix}"`, {
          timeout: 30000
        })

        // pdftoppm生成的文件名格式：output_prefix-1.png
        const outputPath = `${outputPrefix}-1.png`
        const imageBuffer = await fs.readFile(outputPath)

        console.log(`  ✅ PDF转图片完成(300 DPI): ${(imageBuffer.length / 1024).toFixed(2)} KB`)

        // 清理临时文件
        try {
          await fs.unlink(tempPdfPath)
          await fs.unlink(outputPath)
        } catch (e) {
          // 忽略清理错误
        }

        return imageBuffer
      } catch (cmdError) {
        console.warn(`  ⚠️  pdftoppm失败，回退到pdf-to-png-converter: ${cmdError.message}`)

        // 回退到旧方法
        if (!pdfToPng) {
          throw new Error('PDF转PNG支持未启用，请安装: npm install pdf-to-png-converter')
        }

        const pngPages = await pdfToPng.pdfToPng(tempPdfPath, {
          disableFontFace: false,
          useSystemFonts: false,
          viewportScale: 3.0,
          outputFolder: os.tmpdir(),
          strictPagesToProcess: true,
          pagesToProcess: [1]
        })

        // 清理临时PDF文件
        try {
          await fs.unlink(tempPdfPath)
        } catch (e) {
          // 忽略清理错误
        }

        if (!pngPages || pngPages.length === 0) {
          throw new Error('PDF转PNG失败：没有生成图片')
        }

        const imageBuffer = pngPages[0].content
        console.log(`  ✅ PDF转图片完成(fallback): ${(imageBuffer.length / 1024).toFixed(2)} KB`)

        return imageBuffer
      }
    } catch (error) {
      console.error('❌ PDF转图片失败:', error.message)
      throw new Error(`无法处理PDF文件: ${error.message}`)
    }
  }

  /**
   * 预处理图片：调整大小，减少token占用
   */
  async _preprocessImage(imageBuffer) {
    const { maxImageWidth, maxImageHeight } = this.config.options

    try {
      const metadata = await sharp(imageBuffer).metadata()
      console.log(`  原始尺寸: ${metadata.width}x${metadata.height}`)

      let processedBuffer = imageBuffer

      // 如果图片过大，调整尺寸
      if (metadata.width > maxImageWidth || metadata.height > maxImageHeight) {
        console.log(`  调整至: ${maxImageWidth}x${maxImageHeight} (保持比例)`)
        processedBuffer = await sharp(imageBuffer)
          .resize(maxImageWidth, maxImageHeight, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 80 })  // JPEG压缩减少体积
          .toBuffer()
      }

      // 转换为base64
      const base64 = processedBuffer.toString('base64')
      const sizeKB = (base64.length / 1024).toFixed(2)
      console.log(`  Base64大小: ${sizeKB} KB`)

      return base64
    } catch (error) {
      console.error('图片预处理失败:', error.message)
      // 回退到直接转换
      return imageBuffer.toString('base64')
    }
  }

  /**
   * 调用DeepSeek-OCR服务提取文本
   */
  async _callOCRService(imageBuffer, fileName) {
    try {
      const form = new FormData()
      form.append('file', imageBuffer, {
        filename: fileName,
        contentType: 'image/png'
      })

      console.log(`  🚀 调用DeepSeek-OCR: ${this.ocrServiceUrl}`)

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
        console.log(`  ✅ DeepSeek-OCR返回: ${text.length}字符`)
        return text
      } else {
        const errorMsg = response.data?.message || response.data?.error || 'OCR服务返回失败'
        console.warn(`  ❌ DeepSeek-OCR失败: ${errorMsg}`)
        return ''
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.error(`  ❌ DeepSeek-OCR服务连接失败: ${this.ocrServiceUrl}`)
      } else if (error.code === 'ETIMEDOUT') {
        console.error(`  ❌ DeepSeek-OCR服务超时`)
      } else {
        console.error(`  ❌ DeepSeek-OCR调用异常:`, error.message)
      }
      // OCR失败不阻断流程，返回空字符串
      return ''
    }
  }

  /**
   * 调用QWEN-VL API（结合OCR结果）
   */
  async _callQwenVLWithOCR(imageBase64, ocrText) {
    const prompt = `结合图像和OCR文本识别P&ID图纸。

OCR提取的文本：
\`\`\`
${ocrText}
\`\`\`

任务：
1. 根据OCR位号定位图中符号
2. 根据符号形状判断类型（阀门/仪表/设备等）
3. 追踪管道连接
4. 提取管径DN、压力等级PN

位号映射：
MV→manual_valve, V→pneumatic_valve, NV→needle_valve, CV→check_valve,
PT→pressure_transducer, PS→pressure_switch, MFC→mass_flow_controller,
RG→pressure_regulator, F→filter

JSON格式：components数组（id/type/tag/dn/pn），connections数组（from/to/dn/pn）。

列出OCR中的所有位号，不要遗漏。`

    console.log(`  调用API: ${this.config.baseUrl}/v1/chat/completions`)

    const startTime = Date.now()

    try {
      const response = await axios.post(
        `${this.config.baseUrl}/v1/chat/completions`,
        {
          model: this.config.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${imageBase64}`
                  }
                }
              ]
            }
          ],
          temperature: this.config.options.temperature,
          max_tokens: this.config.options.max_tokens
        },
        {
          timeout: 300000,  // 5分钟超时
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
          }
        }
      )

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`  API响应耗时: ${elapsed}s`)

      return response.data.choices[0].message.content
    } catch (error) {
      if (error.response) {
        console.error('API错误:', error.response.status, error.response.data)
        throw new Error(`QWEN-VL API错误: ${error.response.data.error?.message || error.message}`)
      }
      throw error
    }
  }

  /**
   * 调用QWEN-VL API
   */
  async _callQwenVL(imageBase64) {
    const prompt = `识别P&ID图纸上的所有工业设备。

从左到右、从上到下扫描：
- 圆圈内字母 = 仪表
- X形/蝴蝶形 = 阀门
- 方框 = 控制器
- 三角形 = 调节器

读取每个符号旁边的位号标签。识别管道连接。

JSON格式：components数组（id/type/tag），connections数组（from/to）。

不要遗漏任何设备！`

    console.log(`  调用API: ${this.config.baseUrl}/v1/chat/completions`)

    const startTime = Date.now()

    try {
      const response = await axios.post(
        `${this.config.baseUrl}/v1/chat/completions`,
        {
          model: this.config.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${imageBase64}`
                  }
                }
              ]
            }
          ],
          temperature: this.config.options.temperature,
          max_tokens: this.config.options.max_tokens
        },
        {
          timeout: 300000,  // 5分钟超时（PID图纸识别需要较长时间）
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
          },
          onUploadProgress: (progressEvent) => {
            console.log(`  上传进度: ${Math.round(progressEvent.loaded / 1024)}KB`)
          }
        }
      )

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`  API响应耗时: ${elapsed}s`)

      return response.data.choices[0].message.content
    } catch (error) {
      if (error.response) {
        console.error('API错误:', error.response.status, error.response.data)
        throw new Error(`QWEN-VL API错误: ${error.response.data.error?.message || error.message}`)
      }
      throw error
    }
  }

  /**
   * 解析QWEN-VL响应（强化版）
   */
  _parseResult(content, tileOffset = null) {
    console.log(`  🔍 开始解析响应 (长度: ${content.length} 字符)`)

    // 尝试提取JSON
    let jsonData = null
    let parseMethod = 'unknown'

    // 方法1: 直接解析整个响应
    try {
      jsonData = JSON.parse(content)
      parseMethod = '直接解析'
      console.log(`  ✅ 方法1成功: ${parseMethod}`)
    } catch (e) {
      // 方法2: 提取```json...```代码块（支持多行）
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        try {
          const jsonStr = this._cleanJsonString(jsonMatch[1])
          jsonData = JSON.parse(jsonStr)
          parseMethod = 'JSON代码块'
          console.log(`  ✅ 方法2成功: ${parseMethod}`)
        } catch (e2) {
          console.warn(`  ❌ 方法2失败: ${e2.message}`)
        }
      }

      // 方法3: 提取```...```代码块（不带json标记）
      if (!jsonData) {
        const codeMatch = content.match(/```\s*([\s\S]*?)\s*```/)
        if (codeMatch) {
          try {
            const jsonStr = this._cleanJsonString(codeMatch[1])
            jsonData = JSON.parse(jsonStr)
            parseMethod = '通用代码块'
            console.log(`  ✅ 方法3成功: ${parseMethod}`)
          } catch (e3) {
            console.warn(`  ❌ 方法3失败: ${e3.message}`)
          }
        }
      }

      // 方法4: 提取完整JSON对象（包含components字段）
      if (!jsonData) {
        const fullJsonMatch = content.match(/(\{[\s\S]*"components"[\s\S]*?\][\s\S]*?\})/)
        if (fullJsonMatch) {
          try {
            const jsonStr = this._cleanJsonString(fullJsonMatch[1])
            jsonData = JSON.parse(jsonStr)
            parseMethod = 'components对象提取'
            console.log(`  ✅ 方法4成功: ${parseMethod}`)
          } catch (e4) {
            console.warn(`  ❌ 方法4失败: ${e4.message}`)
          }
        }
      }

      // 方法5: 查找第一个{到最后一个}之间的内容
      if (!jsonData) {
        const firstBrace = content.indexOf('{')
        const lastBrace = content.lastIndexOf('}')
        if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
          try {
            const jsonStr = this._cleanJsonString(content.substring(firstBrace, lastBrace + 1))
            jsonData = JSON.parse(jsonStr)
            parseMethod = '括号范围提取'
            console.log(`  ✅ 方法5成功: ${parseMethod}`)
          } catch (e5) {
            console.warn(`  ❌ 方法5失败: ${e5.message}`)
          }
        }
      }
    }

    // 如果成功解析JSON
    if (jsonData) {
      const result = {
        components: (jsonData.components || []).map(c => {
          // ✅ 从bbox计算position（中心点），加上tile的offset
          let position = [0, 0]
          if (c.bbox && c.bbox.length >= 4) {
            const centerX = Math.round((c.bbox[0] + c.bbox[2]) / 2)
            const centerY = Math.round((c.bbox[1] + c.bbox[3]) / 2)

            // 如果有tile offset，加上偏移量转换为全局坐标
            if (tileOffset) {
              position = [
                centerX + tileOffset.offset_x,
                centerY + tileOffset.offset_y
              ]
            } else {
              position = [centerX, centerY]
            }
          }

          // ✅ 优先使用tag，tag为空时才用id
          const tag_number = c.tag || c.id || ''

          // 🔍 增加日志查看tag提取情况
          if (!c.tag && c.id) {
            console.log(`    ⚠️  组件 ${c.id} 缺少tag字段（type=${c.type}）`)
          }

          return {
            tag_number,
            symbol_type: c.type || '',
            position,
            confidence: 0.9,
            parameters: { dn: c.dn, pn: c.pn },
            source: 'qwen-vl',
            ...c
          }
        }),
        connections: jsonData.connections || [],
        legend: jsonData.legend || [],
        summary: jsonData.summary || '',
        statistics: jsonData.statistics || {},
        legend_found: jsonData.legend_found
      }

      // 输出统计信息
      console.log(`  📊 解析结果: ${result.components.length}个组件, ${result.connections.length}条连接`)
      if (result.statistics && Object.keys(result.statistics).length > 0) {
        console.log('  📊 识别统计:')
        for (const [key, value] of Object.entries(result.statistics)) {
          console.log(`     ${key}: ${value}`)
        }
      }

      return result
    }

    // 如果无法解析JSON，尝试从文本中提取信息
    console.warn('⚠️  所有JSON解析方法失败，使用文本提取')
    console.warn('⚠️  响应内容预览:', content.substring(0, 500))
    return this._extractFromText(content)
  }

  /**
   * 清理JSON字符串（移除注释和多余符号）
   */
  _cleanJsonString(str) {
    return str
      .replace(/\/\*[\s\S]*?\*\//g, '')  // 移除多行注释
      .replace(/\/\/.*/g, '')             // 移除单行注释
      .replace(/,\s*}/g, '}')             // 移除对象尾随逗号
      .replace(/,\s*]/g, ']')             // 移除数组尾随逗号
      .trim()
  }

  /**
   * 从纯文本响应中提取信息
   */
  _extractFromText(content) {
    console.log('  使用文本提取模式')

    const components = []
    const connections = []

    // 简单的文本分析逻辑
    const lines = content.split('\n')
    let currentId = 1

    for (const line of lines) {
      // 检测组件提及（简单示例）
      if (line.match(/valve|pump|tank|filter|instrument|gauge/i)) {
        const tagMatch = line.match(/([A-Z]{1,3}-\d{3})/i)
        components.push({
          id: `COMP-${currentId++}`,
          type: 'unknown',
          tag: tagMatch ? tagMatch[1] : `TAG-${currentId}`,
          description: line.trim().substring(0, 100)
        })
      }
    }

    return {
      components,
      connections,
      legend: [],
      summary: content.substring(0, 500)
    }
  }

  /**
   * 生成可视化标注图
   */
  async _generateAnnotationImage(imageBuffer, components, connections, fileId, timestamp) {
    try {
      console.log(`  🎨 生成可视化标注图...`)

      // 如果Canvas不可用，返回null
      if (!Canvas) {
        console.warn('  ⚠️  Canvas未安装，跳过标注图生成')
        return null
      }

      // 加载原始图片
      const image = await Canvas.loadImage(imageBuffer)
      const canvas = Canvas.createCanvas(image.width, image.height)
      const ctx = canvas.getContext('2d')

      // 绘制原始图片
      ctx.drawImage(image, 0, 0)

      // 设置绘图样式
      ctx.strokeStyle = '#00FF00'  // 绿色边框
      ctx.fillStyle = 'rgba(0, 255, 0, 0.2)'  // 半透明绿色填充
      ctx.lineWidth = 3

      // 设置文字样式（支持中文）
      ctx.font = 'bold 24px "PingFang SC", "Microsoft YaHei", "SimHei", sans-serif'
      ctx.fillStyle = '#FFFFFF'  // 白色文字
      ctx.strokeStyle = '#000000'  // 黑色描边
      ctx.lineWidth = 3

      // 绘制组件标注
      let annotatedCount = 0
      for (const component of components) {
        const tag = component.tag_number || component.tag || component.id
        const type = component.symbol_type || component.type || 'unknown'

        // 如果有位置信息，绘制在对应位置
        if (component.position && Array.isArray(component.position)) {
          const [x, y] = component.position
          if (x > 0 && y > 0 && x < image.width && y < image.height) {
            // 绘制标记点
            ctx.beginPath()
            ctx.arc(x, y, 10, 0, 2 * Math.PI)
            ctx.fillStyle = 'rgba(0, 255, 0, 0.8)'
            ctx.fill()
            ctx.strokeStyle = '#00FF00'
            ctx.lineWidth = 2
            ctx.stroke()

            // 绘制标签背景
            const text = `${tag} [${type}]`
            const textWidth = ctx.measureText(text).width
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
            ctx.fillRect(x + 15, y - 20, textWidth + 10, 30)

            // 绘制标签文字
            ctx.fillStyle = '#FFFFFF'
            ctx.fillText(text, x + 20, y)

            annotatedCount++
          }
        }
      }

      // 如果没有位置信息，在图片顶部绘制组件列表
      if (annotatedCount === 0 && components.length > 0) {
        console.log(`  ℹ️  组件无位置信息，绘制组件列表`)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
        ctx.fillRect(10, 10, 500, Math.min(components.length * 30 + 20, 400))

        ctx.font = 'bold 20px "PingFang SC", "Microsoft YaHei", "SimHei", sans-serif'
        ctx.fillStyle = '#00FF00'
        ctx.fillText(`识别到 ${components.length} 个组件:`, 20, 35)

        ctx.font = '16px "PingFang SC", "Microsoft YaHei", "SimHei", sans-serif'
        ctx.fillStyle = '#FFFFFF'
        const maxDisplay = Math.min(components.length, 10)
        for (let i = 0; i < maxDisplay; i++) {
          const comp = components[i]
          const tag = comp.tag_number || comp.tag || comp.id
          const type = comp.symbol_type || comp.type || 'unknown'
          ctx.fillText(`${i + 1}. ${tag} - ${type}`, 30, 65 + i * 25)
        }

        if (components.length > 10) {
          ctx.fillText(`... 还有 ${components.length - 10} 个组件`, 30, 65 + 10 * 25)
        }
      }

      // 保存标注图
      const annotationPath = path.join(this.annotationsDir, `${fileId}_${timestamp}_annotated.png`)
      const buffer = canvas.toBuffer('image/png')
      await fs.writeFile(annotationPath, buffer)

      const annotationUrl = `/uploads/pid_annotations/${path.basename(annotationPath)}`
      console.log(`  ✅ 标注图已生成: ${annotationUrl}`)

      return annotationUrl
    } catch (error) {
      console.error('  ❌ 生成标注图失败:', error.message)
      return null
    }
  }

  /**
   * 批量识别多页PID图纸
   */
  async recognizeBatch(imageBuffers, fileNames = []) {
    console.log(`🔍 [QWEN-VL] 批量识别: ${imageBuffers.length} 页`)

    const results = []

    for (let i = 0; i < imageBuffers.length; i++) {
      const fileName = fileNames[i] || `page_${i + 1}.png`
      try {
        const result = await this.recognizePID(imageBuffers[i], fileName)
        results.push({
          page: i + 1,
          fileName,
          ...result
        })
      } catch (error) {
        console.error(`  页 ${i + 1} 识别失败:`, error.message)
        results.push({
          page: i + 1,
          fileName,
          success: false,
          error: error.message
        })
      }
    }

    return results
  }

  /**
   * 切片图片为9个重叠区域（3x3网格）
   */
  async _sliceImageToTiles(imageBuffer) {
    const metadata = await sharp(imageBuffer).metadata()
    const { width, height } = metadata

    console.log(`  📐 切片策略: ${width}x${height} → 9个区域 (3x3网格, 15%重叠)`)

    // 每个tile占40%宽高，相邻tile偏移30%，产生10%重叠
    const tileWidth = Math.floor(width * 0.4)
    const tileHeight = Math.floor(height * 0.4)
    const offsetX = Math.floor(width * 0.3)
    const offsetY = Math.floor(height * 0.3)

    const tiles = []
    const zoneNames = [
      ['左上', '中上', '右上'],
      ['左中', '中心', '右中'],
      ['左下', '中下', '右下']
    ]

    let tileId = 0
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const left = col * offsetX
        const top = row * offsetY
        const actualWidth = Math.min(tileWidth, width - left)
        const actualHeight = Math.min(tileHeight, height - top)

        const tileBuffer = await sharp(imageBuffer)
          .extract({
            left,
            top,
            width: actualWidth,
            height: actualHeight
          })
          .toBuffer()

        tiles.push({
          id: tileId++,
          zone: zoneNames[row][col],
          buffer: tileBuffer,
          bbox: [left, top, left + actualWidth, top + actualHeight],  // 记录在原图中的坐标
          offset_x: left,
          offset_y: top
        })

        console.log(`    ✂️  ${zoneNames[row][col]}: bbox=[${left},${top},${left + actualWidth},${top + actualHeight}]`)
      }
    }

    return tiles
  }

  /**
   * 计算两个bbox的IoU（交并比）
   */
  _calculateIoU(box1, box2) {
    if (!box1 || !box2 || box1.length < 4 || box2.length < 4) return 0

    const [x1_1, y1_1, x2_1, y2_1] = box1
    const [x1_2, y1_2, x2_2, y2_2] = box2

    // 计算交集
    const xLeft = Math.max(x1_1, x1_2)
    const yTop = Math.max(y1_1, y1_2)
    const xRight = Math.min(x2_1, x2_2)
    const yBottom = Math.min(y2_1, y2_2)

    if (xRight < xLeft || yBottom < yTop) return 0

    const intersectionArea = (xRight - xLeft) * (yBottom - yTop)

    // 计算并集
    const box1Area = (x2_1 - x1_1) * (y2_1 - y1_1)
    const box2Area = (x2_2 - x1_2) * (y2_2 - y1_2)
    const unionArea = box1Area + box2Area - intersectionArea

    return unionArea > 0 ? intersectionArea / unionArea : 0
  }

  /**
   * NMS（非极大值抑制）去除重复检测
   */
  _applyNMS(components, iouThreshold = 0.5) {
    if (components.length === 0) return []

    // 按置信度排序（如果有partial标记，完整的优先）
    const sorted = components.sort((a, b) => {
      const scoreA = a.partial ? 0.5 : 1.0
      const scoreB = b.partial ? 0.5 : 1.0
      return scoreB - scoreA
    })

    const keep = []
    const suppressed = new Set()

    for (let i = 0; i < sorted.length; i++) {
      if (suppressed.has(i)) continue

      const compA = sorted[i]
      keep.push(compA)

      // 抑制与当前框IoU超过阈值的其他框
      for (let j = i + 1; j < sorted.length; j++) {
        if (suppressed.has(j)) continue

        const compB = sorted[j]

        // 1. 如果tag相同，认为是同一设备
        if (compA.tag && compB.tag && compA.tag === compB.tag) {
          suppressed.add(j)
          continue
        }

        // 2. 如果bbox重叠度高（IoU > threshold），认为是重复检测
        const iou = this._calculateIoU(compA.bbox, compB.bbox)
        if (iou > iouThreshold) {
          suppressed.add(j)
          const tagA = compA.tag || compA.id || 'unknown'
          const tagB = compB.tag || compB.id || 'unknown'
          console.log(`    🔄 NMS抑制: "${tagB}" (${compB.type}) 被 "${tagA}" (${compA.type}) 抑制 (IoU=${iou.toFixed(2)})`)
        }
      }
    }

    return keep
  }

  /**
   * 投票合并：对同一设备的多次检测进行投票
   */
  _voteAndMerge(components) {
    const tagGroups = {}

    // 按tag分组
    for (const comp of components) {
      const tag = comp.tag || comp.id
      if (!tag) continue

      if (!tagGroups[tag]) {
        tagGroups[tag] = []
      }
      tagGroups[tag].push(comp)
    }

    const merged = []

    for (const [tag, group] of Object.entries(tagGroups)) {
      if (group.length === 1) {
        merged.push(group[0])
      } else {
        // 多个检测，投票选出最优
        console.log(`    🗳️  投票: "${tag}" 有 ${group.length} 个候选`)

        // 投票规则：
        // 1. 优先选择partial=false的
        // 2. 如果都是partial或都不是，选bbox最大的（更完整）
        const sorted = group.sort((a, b) => {
          if (a.partial !== b.partial) {
            return a.partial ? 1 : -1  // false优先
          }

          // bbox面积
          const areaA = a.bbox ? (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]) : 0
          const areaB = b.bbox ? (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]) : 0
          return areaB - areaA
        })

        const winner = sorted[0]
        console.log(`       → 选中: partial=${winner.partial}, bbox=${winner.bbox}`)
        merged.push(winner)
      }
    }

    // 添加没有tag的组件（无法投票）
    for (const comp of components) {
      if (!comp.tag && !comp.id) {
        merged.push(comp)
      }
    }

    return merged
  }

  /**
   * 合并多个区域的识别结果（NMS + 投票）
   */
  _mergeRecognitionResults(tileResults) {
    console.log(`  🔗 合并 ${tileResults.length} 个区域的结果...`)

    const allComponents = []
    const allConnections = []

    for (const result of tileResults) {
      const { zone, components, connections } = result

      for (const comp of components) {
        allComponents.push({ ...comp, zone })
      }

      for (const conn of connections) {
        allConnections.push({ ...conn, source_zone: zone })
      }
    }

    console.log(`  📊 合并前: ${allComponents.length} 个组件`)

    // 步骤1: NMS去除重复检测
    console.log(`  🎯 步骤1: NMS去重 (IoU阈值=0.5)`)
    const afterNMS = this._applyNMS(allComponents, 0.5)
    console.log(`  ✅ NMS后: ${afterNMS.length} 个组件`)

    // 步骤2: 投票合并同tag设备
    console.log(`  🎯 步骤2: 投票合并`)
    const afterVote = this._voteAndMerge(afterNMS)
    console.log(`  ✅ 投票后: ${afterVote.length} 个组件`)

    // 连接去重
    const uniqueConnections = []
    const seenConnections = new Set()

    for (const conn of allConnections) {
      const key = `${conn.from}-${conn.to}`
      if (!seenConnections.has(key)) {
        uniqueConnections.push(conn)
        seenConnections.add(key)
      }
    }

    console.log(`  ℹ️  最终统计: 原始${allComponents.length}个 → NMS${afterNMS.length}个 → 投票${afterVote.length}个`)

    return {
      components: afterVote,
      connections: uniqueConnections
    }
  }

  /**
   * 在完整图像上识别图例表格（方案2：不hardcode位置）
   */
  async _extractLegend(imageBuffer) {
    try {
      console.log(`  📖 步骤1: 识别图例表格...`)

      const processedImage = await this._preprocessImage(imageBuffer)

      // 让模型在整图上找图例表格
      const legendPrompt = `任务：在这张PID图中找到并识别符号图例表（通常标题为"CHART OF SYMBOLS"）。

如果找到图例表格，请识别表格内容：
- ITEM列：序号
- SYMBOL列：符号图标
- DESCRIPTION列：英文描述

输出JSON格式：
{
  "legend_found": true,
  "legend": [
    {"item": 1, "description": "MANUAL VALVE"},
    {"item": 2, "description": "NEEDLE VALVE"}
  ]
}

如果找不到图例表格，输出：
{
  "legend_found": false,
  "legend": []
}

注意：
1. description必须是完整的英文大写描述（如MASS FLOW CONTROLLER）
2. 按从上到下顺序输出
3. 仅输出JSON，不包含其他文字`

      const result = await this._callQwenVLWithCustomPrompt(processedImage, legendPrompt)

      // 解析图例JSON
      const legendData = this._parseResult(result)

      if (legendData.legend_found && legendData.legend && legendData.legend.length > 0) {
        console.log(`    ✅ 图例识别成功: ${legendData.legend.length}个符号`)

        // 打印图例内容
        legendData.legend.forEach((l, idx) => {
          console.log(`       ${idx + 1}. ${l.description}`)
        })

        // 构建图例文本（用于注入prompt）
        const legendText = legendData.legend
          .map(l => `  - ${l.description}${l.item ? ' (序号' + l.item + ')' : ''}`)
          .join('\n')

        return {
          success: true,
          legendText,
          legendData: legendData.legend
        }
      } else {
        console.warn(`    ⚠️  未找到图例表格，将不提供图例参考`)
        return {
          success: false,
          legendText: '',
          legendData: []
        }
      }
    } catch (error) {
      console.error(`    ❌ 图例识别失败: ${error.message}`)
      return {
        success: false,
        legendText: '',
        legendData: []
      }
    }
  }

  /**
   * 识别PID图纸（切片模式）
   */
  async recognizePIDWithTiling(fileBuffer, fileName = 'pid.png') {
    console.log(`🔍 [QWEN-VL 切片模式] 开始识别: ${fileName}`)

    try {
      await this._ensureDirectories()

      const fileId = crypto.randomBytes(4).toString('hex')
      const timestamp = Date.now()

      const isPDF = fileName.toLowerCase().endsWith('.pdf')
      let imageBuffer = fileBuffer
      let savedPaths = { original: null, converted: null }

      const originalExt = isPDF ? '.pdf' : path.extname(fileName)
      const originalPath = path.join(this.originalsDir, `${fileId}_${timestamp}${originalExt}`)
      await fs.writeFile(originalPath, fileBuffer)
      savedPaths.original = `/uploads/pid_originals/${path.basename(originalPath)}`
      console.log(`  ✅ 原始文件已保存`)

      if (isPDF) {
        console.log('  检测到PDF文件，转换为图片...')
        imageBuffer = await this._pdfToImage(fileBuffer)
        const convertedPath = path.join(this.convertedDir, `${fileId}_${timestamp}.png`)
        await fs.writeFile(convertedPath, imageBuffer)
        savedPaths.converted = `/uploads/pid_converted/${path.basename(convertedPath)}`
        console.log(`  ✅ 转换图片已保存`)
      }

      const metadata = await sharp(imageBuffer).metadata()
      console.log(`  📏 原始尺寸: ${metadata.width}x${metadata.height}`)

      // 步骤1: 提取图例
      const legend = await this._extractLegend(imageBuffer)

      // 步骤2: 切片
      console.log(`\n  📐 步骤2: 切片识别...`)
      const tiles = await this._sliceImageToTiles(imageBuffer)

      // 逐个识别
      const tileResults = []
      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i]
        console.log(`\n  🔍 识别区域 ${i+1}/9: ${tile.zone}...`)

        // 对当前切片进行OCR
        let ocrTexts = ''
        try {
          const ocrResult = await this._callOCRService(tile.buffer, `tile_${tile.id}.png`)
          ocrTexts = ocrResult || '（无OCR结果）'
          console.log(`    📝 OCR提取: ${ocrResult.length}字符`)
        } catch (e) {
          console.warn(`    ⚠️  OCR失败: ${e.message}`)
          ocrTexts = '（OCR不可用）'
        }

        const processedTile = await this._preprocessImage(tile.buffer)

        const tilePrompt = `识别此P&ID图像切片中的所有设备、符号和文字标注，返回JSON。

切片信息：
- 原图坐标范围：[${tile.bbox.join(',')}]
- 切片ID：tile_${tile.id}
- 跨边界对象标记 "partial": true

符号图例：
${legend.legendText || '（无图例，根据形状判断）'}

OCR文字提示：
${ocrTexts}

识别三类对象：

1️⃣ **物理设备**（需要采购的组件）
   - type = 图例中的完整英文名称（如"MANUAL VALVE"、"PRESSURE TRANSDUCER"）
   - 无法匹配图例时：圆圈→"INSTRUMENT"、X形→"VALVE"、方框→"CONTROLLER"、三角→"REGULATOR"、其他→"UNKNOWN"
   - tag = 位号（如"V1"、"PT2"）
   - bbox = [x1,y1,x2,y2]

2️⃣ **文字标注**（重要！必须全部识别）
   📍 **流向/接口**：箭头+文字 → type="INTERFACE", tag="TO VAC2"
   📍 **气体介质**：气体名称 → type="MEDIUM", tag="N2"
   📍 **管道规格**：尺寸标注 → type="PIPE_SPEC", tag="1/4\""
   📍 **其他文字**：→ type="LABEL", tag=实际文字
   - 使用 position=[x,y] 表示文字中心

3️⃣ **连接关系**
   - 管线连接：{"from":"id1","to":"id2","direction":"A->B","line_type":"process"}
   - direction: 有箭头用"A->B"或"B->A"，无箭头用"BIDIR"

⚠️ 所有OCR提取的文字都必须作为标注对象输出！

输出格式：
{
  "components": [
    {"id":"tile_${tile.id}_C1","type":"MANUAL VALVE","tag":"V1","bbox":[100,200,150,250],"partial":false},
    {"id":"tile_${tile.id}_C2","type":"INTERFACE","tag":"TO VAC2","position":[300,400],"partial":false},
    {"id":"tile_${tile.id}_C3","type":"MEDIUM","tag":"N2","position":[500,600],"partial":false}
  ],
  "connections":[
    {"from":"tile_${tile.id}_C1","to":"tile_${tile.id}_C2","direction":"A->B","line_type":"process"}
  ]
}

只输出JSON，不要其他文字。`

        const result = await this._callQwenVLWithCustomPrompt(processedTile, tilePrompt)

        // ✅ 传入tile的offset，用于坐标转换
        const parsed = this._parseResult(result, {
          offset_x: tile.offset_x,
          offset_y: tile.offset_y
        })

        tileResults.push({
          zone: tile.zone,
          components: parsed.components,
          connections: parsed.connections
        })

        console.log(`    ✅ ${tile.zone}: ${parsed.components.length} 个组件, ${parsed.connections.length} 条连线`)
      }

      // 合并
      const merged = this._mergeRecognitionResults(tileResults)

      // 分类组件：设备、接口、介质、规格
      const classified = await this._classifyComponents(merged.components)

      console.log(`\n  🎯 切片识别完成: ${classified.devices.length}个设备, ${classified.interfaces.length}个接口, ${classified.mediums.length}个介质, ${classified.specs.length}个规格, ${merged.connections.length}条连线`)

      // 生成标注图（使用所有组件）
      const allComponents = [
        ...classified.devices,
        ...classified.interfaces,
        ...classified.mediums,
        ...classified.specs
      ]

      const annotationUrl = await this._generateAnnotationImage(
        imageBuffer,
        allComponents,
        merged.connections,
        fileId,
        timestamp
      )

      const visualization_urls = [
        savedPaths.converted || savedPaths.original,
        annotationUrl
      ].filter(Boolean)

      return {
        success: true,
        method: 'qwen-vl-tiling',
        file_id: fileId,
        file_name: fileName,
        file_path: savedPaths.original,
        converted_path: savedPaths.converted,
        components: classified.devices,
        interfaces: classified.interfaces,
        mediums: classified.mediums,
        specs: classified.specs,
        connections: merged.connections,
        legend: {},
        summary: `识别完成：${classified.devices.length}个设备，${classified.interfaces.length}个接口`,
        statistics: {
          devices: classified.devices.length,
          interfaces: classified.interfaces.length,
          mediums: classified.mediums.length,
          specs: classified.specs.length,
          connections: merged.connections.length
        },
        visualization_urls,
        page_count: 1,
        tile_count: tiles.length
      }
    } catch (error) {
      console.error(`❌ [QWEN-VL 切片模式] 识别失败:`, error.message)
      throw error
    }
  }

  /**
   * 分类组件：优先使用模型输出的type，只对明显错误进行最小修正
   */
  /**
   * 使用规则引擎分类组件
   */
  async _classifyComponents(components, legend = {}) {
    console.log(`🔍 [PID分类] 开始分类 ${components.length} 个组件...`);

    try {
      const PIDRuleProcessor = require('../rules/processors/PIDRuleProcessor');
      const processor = new PIDRuleProcessor();

      return await processor.classifyComponents(components, legend);
    } catch (error) {
      console.error('❌ [PID分类] 规则分类失败，使用fallback:', error);
      return this._fallbackClassify(components);
    }
  }

  /**
   * Fallback分类逻辑
   */
  _fallbackClassify(components) {
    const devices = [];
    const interfaces = [];
    const mediums = [];
    const specs = [];

    components.forEach(comp => {
      const tag = (comp.tag || comp.tag_number || '').toUpperCase();

      if (/^(TO|FROM|BTM)\s/.test(tag)) {
        interfaces.push({ ...comp, category: 'interface', type: 'INTERFACE' });
      } else if (/^(Ar|N2|H2|He|O2)$/.test(tag)) {
        mediums.push({ ...comp, category: 'medium', type: 'MEDIUM' });
      } else if (/\d+\s*(PSIG|SCCM|Torr|")/.test(tag)) {
        specs.push({ ...comp, category: 'spec', type: 'SPEC' });
      } else {
        devices.push({ ...comp, category: 'device' });
      }
    });

    console.log(`⚠️  [PID分类-Fallback] 设备:${devices.length} 接口:${interfaces.length} 介质:${mediums.length} 规格:${specs.length}`);

    return { devices, interfaces, mediums, specs };
  }

  /**
   * 调用QWEN-VL API（自定义prompt）
   */
  async _callQwenVLWithCustomPrompt(imageBase64, customPrompt) {
    const startTime = Date.now()

    try {
      const response = await axios.post(
        `${this.config.baseUrl}/v1/chat/completions`,
        {
          model: this.config.model,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: customPrompt },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` }}
            ]
          }],
          temperature: this.config.options.temperature,
          max_tokens: this.config.options.max_tokens
        },
        {
          timeout: 300000,
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
          }
        }
      )

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`    API响应: ${elapsed}s`)

      return response.data.choices[0].message.content
    } catch (error) {
      if (error.response) {
        console.error('API错误:', error.response.status, error.response.data)
        throw new Error(`QWEN-VL API错误: ${error.response.data.error?.message || error.message}`)
      }
      throw error
    }
  }
}

module.exports = PIDRecognitionVLService
