const axios = require('axios')
const fs = require('fs').promises
const path = require('path')
const sharp = require('sharp')
const { LLMConfig } = require('../../config/llm.config')

// PDF 处理依赖
let pdfToPng = null
try {
  pdfToPng = require('pdf-to-png-converter')
  console.log('✅ PDF转PNG支持已启用')
} catch (e) {
  console.warn('⚠️  PDF转PNG支持未启用:', e.message)
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
    console.log(`✅ PID识别服务初始化 (QWEN-VL): ${this.config.baseUrl}`)
  }

  /**
   * 识别PID图纸
   */
  async recognizePID(fileBuffer, fileName = 'pid.png') {
    console.log(`🔍 [QWEN-VL] 开始识别: ${fileName}`)

    try {
      // 检查是否是PDF文件
      const isPDF = fileName.toLowerCase().endsWith('.pdf')
      let imageBuffer = fileBuffer

      if (isPDF) {
        console.log('  检测到PDF文件，转换为图片...')
        imageBuffer = await this._pdfToImage(fileBuffer)
      }

      // 调整图片大小
      const processedImage = await this._preprocessImage(imageBuffer)

      // 调用QWEN-VL识别
      const result = await this._callQwenVL(processedImage)

      // 解析结果
      const parsed = this._parseResult(result)

      console.log(`✅ [QWEN-VL] 识别完成: ${parsed.components.length} 个组件, ${parsed.connections.length} 条连接`)

      return {
        success: true,
        method: 'qwen-vl',
        components: parsed.components,
        connections: parsed.connections,
        legend: parsed.legend,
        summary: parsed.summary,
        page_count: 1,
        raw_response: result
      }
    } catch (error) {
      console.error(`❌ [QWEN-VL] 识别失败:`, error.message)
      throw error
    }
  }

  /**
   * 将PDF第一页转换为图片
   */
  async _pdfToImage(pdfBuffer) {
    if (!pdfToPng) {
      throw new Error('PDF转PNG支持未启用，请安装: npm install pdf-to-png-converter')
    }

    try {
      // 保存PDF到临时文件
      const os = require('os')
      const tempPdfPath = path.join(os.tmpdir(), `pid_${Date.now()}.pdf`)
      await fs.writeFile(tempPdfPath, pdfBuffer)

      console.log(`  临时PDF文件: ${tempPdfPath}`)

      // 转换PDF第一页为PNG
      const pngPages = await pdfToPng.pdfToPng(tempPdfPath, {
        disableFontFace: false,
        useSystemFonts: false,
        viewportScale: 2.0,
        outputFolder: os.tmpdir(),
        strictPagesToProcess: true,
        pagesToProcess: [1]  // 只处理第一页
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
      console.log(`  PDF转图片完成: ${imageBuffer.length} bytes`)

      return imageBuffer
    } catch (error) {
      console.error('PDF转图片失败:', error.message)
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
   * 调用QWEN-VL API
   */
  async _callQwenVL(imageBase64) {
    const prompt = `你是P&ID图纸识别专家。请仔细分析图纸，识别:

1. **所有带位号标签的组件** (MV1, V1, RG1等)
2. **管道连接关系** (追踪管线，识别哪个组件连接到哪个组件)
3. **连接规格** (管径DN、压力等级PN)

位号规则：
MV→manual_valve, V→pneumatic_valve, NV→needle_valve, CV→check_valve, PT→pressure_transducer, PS→pressure_switch, MFC→mass_flow_controller, RG→pressure_regulator, F→filter

**必须**返回JSON格式：
\`\`\`json
{
  "components": [
    {"id": "MV1", "type": "manual_valve", "tag": "MV1", "dn": 40, "pn": 16},
    {"id": "RG1", "type": "pressure_regulator", "tag": "RG1", "dn": 40, "pn": 16}
  ],
  "connections": [
    {"from": "MV1", "to": "RG1", "dn": 40, "pn": 16, "pipe_type": "process"},
    {"from": "RG1", "to": "MFC1", "dn": 25, "pn": 16, "pipe_type": "process"}
  ]
}
\`\`\`

要求：
- 完整列出所有30-40个组件
- **追踪所有管道连接线，识别连接关系**
- 提取管径和压力等级标注
- 不要遗漏任何组件和连接`

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
   * 解析QWEN-VL响应
   */
  _parseResult(content) {
    // 尝试提取JSON
    let jsonData = null

    try {
      // 方法1: 直接解析整个响应
      jsonData = JSON.parse(content)
    } catch (e) {
      // 方法2: 提取```json...```代码块（支持多行）
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        try {
          const jsonStr = jsonMatch[1]
            .replace(/\/\/.*/g, '')  // 移除单行注释
            .replace(/,\s*}/g, '}')  // 移除尾随逗号
            .replace(/,\s*]/g, ']')
          jsonData = JSON.parse(jsonStr)
          console.log('  ✅ 成功解析JSON代码块')
        } catch (e2) {
          console.warn('⚠️  JSON代码块解析失败:', e2.message)
        }
      }

      // 方法3: 尝试提取完整JSON对象（包含connections字段）
      if (!jsonData) {
        const fullJsonMatch = content.match(/(\{[\s\S]*"connections"[\s\S]*?\][\s\S]*?\})/)
        if (fullJsonMatch) {
          try {
            const cleanJson = fullJsonMatch[1]
              .replace(/\/\/.*/g, '')
              .replace(/,\s*}/g, '}')
              .replace(/,\s*]/g, ']')
            jsonData = JSON.parse(cleanJson)
            console.log('  ✅ 成功解析完整JSON对象')
          } catch (e3) {
            console.warn('⚠️  完整JSON对象解析失败:', e3.message)
          }
        }
      }
    }

    // 如果成功解析JSON
    if (jsonData) {
      const result = {
        components: jsonData.components || [],
        connections: jsonData.connections || [],
        legend: jsonData.legend || [],
        summary: jsonData.summary || '',
        statistics: jsonData.statistics || {}
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
    return this._extractFromText(content)
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
}

module.exports = PIDRecognitionVLService
