const Docxtemplater = require('docxtemplater')
const PizZip = require('pizzip')
const fs = require('fs-extra')
const TemplateManager = require('./TemplateManager')
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx')

/**
 * Word文档生成服务
 * 基于docxtemplater，使用单位标准模板生成Word文档
 */
class WordGeneratorService {
  constructor() {
    // 实体识别关键词配置
    this.entityPatterns = {
      product: {
        keywords: [
          '产品', '设备', '仪器', '仪表', '系统', '装置', '机组', '机械', '泵', '阀', '管',
          '电机', '变压器', '开关', '控制器', '传感器', '执行器', '探测器', '报警器',
          '风机', '压缩机', '换热器', '冷却器', '过滤器', '分离器', '储罐', '容器'
        ],
        color: 'yellow' // 黄色高亮
      },
      material: {
        keywords: [
          '材料', '材质', '钢材', '不锈钢', '碳钢', '合金', '铝', '铜', '塑料', 'PVC', 'PE', 'PP',
          '橡胶', '陶瓷', '玻璃', '混凝土', '水泥', '砖', '石材', '木材', '保温材料',
          '防腐材料', '密封材料', '填料', '涂料', '油漆', '焊条', '螺栓', '螺母', '垫片'
        ],
        color: 'cyan' // 青色高亮
      },
      process: {
        keywords: [
          '工艺', '方法', '安装', '施工', '焊接', '切割', '打磨', '抛光', '喷涂', '镀锌',
          '热处理', '冷却', '加热', '干燥', '过滤', '分离', '混合', '搅拌', '压缩', '膨胀',
          '检测', '测试', '校验', '调试', '维护', '保养', '清洗', '消毒', '灭菌',
          '组装', '拆卸', '吊装', '运输', '存储', '包装'
        ],
        color: 'green' // 绿色高亮
      }
    }
  }

  /**
   * 识别文本中的实体并标记
   * @param {string} text - 要处理的文本
   * @returns {Array} - 带有实体标记的文本片段数组
   */
  _identifyEntities(text) {
    if (!text) return [{ text: '', type: null }]

    const segments = []
    let currentPos = 0
    const matches = []

    // 收集所有匹配
    for (const [entityType, config] of Object.entries(this.entityPatterns)) {
      for (const keyword of config.keywords) {
        let searchPos = 0
        while (true) {
          const index = text.indexOf(keyword, searchPos)
          if (index === -1) break
          matches.push({
            start: index,
            end: index + keyword.length,
            type: entityType,
            text: keyword,
            color: config.color
          })
          searchPos = index + 1
        }
      }
    }

    // 按位置排序
    matches.sort((a, b) => a.start - b.start)

    // 移除重叠的匹配（保留最长的）
    const filteredMatches = []
    for (const match of matches) {
      const overlapping = filteredMatches.find(m =>
        (match.start >= m.start && match.start < m.end) ||
        (match.end > m.start && match.end <= m.end)
      )
      if (!overlapping) {
        filteredMatches.push(match)
      } else if (match.text.length > overlapping.text.length) {
        // 替换为更长的匹配
        const index = filteredMatches.indexOf(overlapping)
        filteredMatches[index] = match
      }
    }

    // 重新排序
    filteredMatches.sort((a, b) => a.start - b.start)

    // 构建片段
    for (const match of filteredMatches) {
      if (match.start > currentPos) {
        segments.push({
          text: text.substring(currentPos, match.start),
          type: null
        })
      }
      segments.push({
        text: match.text,
        type: match.type,
        color: match.color
      })
      currentPos = match.end
    }

    // 添加剩余文本
    if (currentPos < text.length) {
      segments.push({
        text: text.substring(currentPos),
        type: null
      })
    }

    return segments.length > 0 ? segments : [{ text: text, type: null }]
  }

  /**
   * 将颜色名称转换为docx高亮颜色
   */
  _getHighlightColor(colorName) {
    const colorMap = {
      'yellow': 'yellow',
      'cyan': 'cyan',
      'green': 'green',
      'magenta': 'magenta',
      'red': 'red',
      'blue': 'blue'
    }
    return colorMap[colorName] || 'yellow'
  }

  /**
   * 生成Word文档（自动使用对应模板）
   * @param {Object} options
   * @param {string} options.title - 文档标题
   * @param {string} options.content - 文档内容（支持Markdown）
   * @param {string} options.template - 模板ID（如: design_plan, technical_report）
   * @param {string} options.author - 作者
   * @param {Object} options.metadata - 额外元数据
   * @param {boolean} options.enableHighlight - 是否启用实体高亮
   */
  async generate({ title, content, template, author, metadata = {}, enableHighlight = false }) {
    try {
      // 1. 从模板管理器获取模板路径
      const templatePath = TemplateManager.getTemplatePath('word', template || 'general')
      const templateInfo = TemplateManager.getTemplateInfo('word', template || 'general')

      console.log(`📄 使用Word模板: ${templateInfo.name} (${templateInfo.file})`)

      // 检查模板文件是否存在，不存在则使用直接生成方式
      if (!await fs.pathExists(templatePath)) {
        console.warn(`⚠️ 模板文件不存在，使用docx库直接生成: ${templatePath}`)
        return this._generateWithoutTemplate({ title, content, template, author, metadata, enableHighlight })
      }

      // 2. 读取模板
      const templateContent = await fs.readFile(templatePath, 'binary')
      const zip = new PizZip(templateContent)
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => ''  // 未提供的变量返回空字符串
      })

      // 3. 准备数据（自动填充所有变量）
      const data = this._prepareData({
        title,
        content,
        author,
        metadata,
        templateVariables: templateInfo.variables
      })

      console.log('📝 填充数据:', Object.keys(data).join(', '))

      // 4. 渲染模板
      doc.render(data)

      // 5. 生成Buffer
      const buffer = doc.getZip().generate({
        type: 'nodebuffer',
        compression: 'DEFLATE'
      })

      console.log(`✅ Word文档生成成功: ${title}.docx (${(buffer.length / 1024).toFixed(2)} KB)`)

      return {
        buffer,
        filename: `${title}.docx`,
        size: buffer.length,
        template: templateInfo.name
      }

    } catch (error) {
      console.error('❌ 生成Word失败:', error)
      throw new Error(`生成Word失败: ${error.message}`)
    }
  }

  /**
   * 准备模板数据
   */
  _prepareData({ title, content, author, metadata, templateVariables }) {
    const now = new Date()

    const data = {
      // 基础字段
      title: title || '无标题',
      author: author || '系统生成',
      date: now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }),
      datetime: now.toLocaleString('zh-CN'),
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),

      // 内容
      content: this._formatContent(content),

      // 文档编号
      doc_number: metadata.doc_number || this._generateDocNumber(),

      // 项目信息
      project_name: metadata.project_name || '',
      department: metadata.department || '技术部',

      // 其他元数据
      ...metadata
    }

    // 如果模板需要章节数据
    if (templateVariables && templateVariables.includes('sections')) {
      data.sections = this._parseSections(content)
    }

    // 如果模板需要参会人员（会议纪要）
    if (templateVariables && templateVariables.includes('attendees')) {
      data.attendees = metadata.attendees || []
    }

    // 如果模板需要行动项（会议纪要）
    if (templateVariables && templateVariables.includes('action_items')) {
      data.action_items = metadata.action_items || []
    }

    return data
  }

  /**
   * 格式化内容（Markdown转纯文本，保留换行）
   */
  _formatContent(content) {
    if (!content) return ''

    return content
      // 移除Markdown标题标记，但保留文本
      .replace(/^#{1,6}\s+/gm, '')
      // 移除加粗和斜体标记
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      // 移除代码块
      .replace(/```[\s\S]*?```/g, '')
      // 移除行内代码
      .replace(/`(.+?)`/g, '$1')
      // 移除链接，保留文本
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      // 保留换行符
      .trim()
  }

  /**
   * 解析章节（用于循环渲染）
   */
  _parseSections(content) {
    if (!content) return []

    const sections = []
    const lines = content.split('\n')
    let currentSection = null

    for (const line of lines) {
      if (line.trim().startsWith('## ')) {
        // 保存上一个章节
        if (currentSection) {
          currentSection.content = currentSection.content.trim()
          sections.push(currentSection)
        }
        // 开始新章节
        currentSection = {
          title: line.replace(/^##\s+/, '').trim(),
          content: ''
        }
      } else if (currentSection && line.trim()) {
        currentSection.content += line + '\n'
      }
    }

    // 保存最后一个章节
    if (currentSection) {
      currentSection.content = currentSection.content.trim()
      sections.push(currentSection)
    }

    return sections
  }

  /**
   * 生成文档编号
   */
  _generateDocNumber() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `MST-${year}${month}${day}-${random}`
  }

  /**
   * 清理文件名（移除特殊字符）
   */
  _sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_')
  }

  /**
   * 创建带高亮的TextRun数组
   */
  _createHighlightedTextRuns(text, size = 24) {
    const segments = this._identifyEntities(text)

    return segments.map(segment => {
      const options = {
        text: segment.text,
        size: size
      }

      if (segment.type && segment.color) {
        options.highlight = this._getHighlightColor(segment.color)
      }

      return new TextRun(options)
    })
  }

  /**
   * 不使用模板直接生成Word文档（回退方案）
   */
  async _generateWithoutTemplate({ title, content, template, author, metadata = {}, enableHighlight = false }) {
    try {
      const now = new Date()
      const children = []

      // 1. 标题
      children.push(
        new Paragraph({
          text: title || '无标题',
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        })
      )

      // 2. 元数据（作者、日期）
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `作者：${author || '系统生成'}`,
              size: 22
            })
          ],
          spacing: { after: 200 }
        })
      )

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `日期：${now.toLocaleDateString('zh-CN')}`,
              size: 22
            })
          ],
          spacing: { after: 400 }
        })
      )

      // 如果启用高亮，添加图例说明
      if (enableHighlight) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: '【图例说明】', bold: true, size: 22 }),
              new TextRun({ text: ' 产品/设备', highlight: 'yellow', size: 22 }),
              new TextRun({ text: ' | ', size: 22 }),
              new TextRun({ text: '材料/材质', highlight: 'cyan', size: 22 }),
              new TextRun({ text: ' | ', size: 22 }),
              new TextRun({ text: '工艺/方法', highlight: 'green', size: 22 })
            ],
            spacing: { after: 400 }
          })
        )
      }

      // 3. 处理内容（支持简单Markdown和实体高亮）
      if (content) {
        const lines = content.split('\n')

        for (const line of lines) {
          const trimmedLine = line.trim()

          if (!trimmedLine) {
            // 空行
            children.push(new Paragraph({ text: '' }))
          } else if (trimmedLine.startsWith('# ')) {
            // 一级标题
            children.push(
              new Paragraph({
                text: trimmedLine.replace(/^#\s+/, ''),
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
              })
            )
          } else if (trimmedLine.startsWith('## ')) {
            // 二级标题
            children.push(
              new Paragraph({
                text: trimmedLine.replace(/^##\s+/, ''),
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 200 }
              })
            )
          } else if (trimmedLine.startsWith('### ')) {
            // 三级标题
            children.push(
              new Paragraph({
                text: trimmedLine.replace(/^###\s+/, ''),
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 200, after: 100 }
              })
            )
          } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
            // 列表项
            const listText = trimmedLine.replace(/^[-*]\s+/, '')
            if (enableHighlight) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: '• ', size: 24 }),
                    ...this._createHighlightedTextRuns(listText, 24)
                  ],
                  spacing: { after: 100 }
                })
              )
            } else {
              children.push(
                new Paragraph({
                  text: '• ' + listText,
                  spacing: { after: 100 }
                })
              )
            }
          } else if (trimmedLine.startsWith('| ')) {
            // 表格行（简单处理）
            children.push(
              new Paragraph({
                text: trimmedLine.replace(/\|/g, '  '),
                spacing: { after: 100 }
              })
            )
          } else {
            // 普通段落 - 支持实体高亮
            if (enableHighlight) {
              children.push(
                new Paragraph({
                  children: this._createHighlightedTextRuns(trimmedLine, 24),
                  spacing: { after: 200 }
                })
              )
            } else {
              children.push(
                new Paragraph({
                  text: trimmedLine,
                  spacing: { after: 200 }
                })
              )
            }
          }
        }
      }

      // 4. 创建文档
      const doc = new Document({
        sections: [{
          properties: {},
          children: children
        }]
      })

      // 5. 生成Buffer
      const buffer = await Packer.toBuffer(doc)

      console.log(`✅ Word文档生成成功（无模板${enableHighlight ? '，带高亮' : ''}）: ${title}.docx (${(buffer.length / 1024).toFixed(2)} KB)`)

      return {
        buffer,
        filename: `${title}.docx`,
        size: buffer.length,
        template: 'generated-without-template'
      }

    } catch (error) {
      console.error('❌ 直接生成Word失败:', error)
      throw new Error(`直接生成Word失败: ${error.message}`)
    }
  }
}

// 创建单例
const wordGeneratorService = new WordGeneratorService()

module.exports = wordGeneratorService
