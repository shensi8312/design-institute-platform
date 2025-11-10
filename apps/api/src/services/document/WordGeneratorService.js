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
  /**
   * 生成Word文档（自动使用对应模板）
   * @param {Object} options
   * @param {string} options.title - 文档标题
   * @param {string} options.content - 文档内容（支持Markdown）
   * @param {string} options.template - 模板ID（如: design_plan, technical_report）
   * @param {string} options.author - 作者
   * @param {Object} options.metadata - 额外元数据
   */
  async generate({ title, content, template, author, metadata = {} }) {
    try {
      // 1. 从模板管理器获取模板路径
      const templatePath = TemplateManager.getTemplatePath('word', template || 'general')
      const templateInfo = TemplateManager.getTemplateInfo('word', template || 'general')

      console.log(`📄 使用Word模板: ${templateInfo.name} (${templateInfo.file})`)

      // 检查模板文件是否存在，不存在则使用直接生成方式
      if (!await fs.pathExists(templatePath)) {
        console.warn(`⚠️ 模板文件不存在，使用docx库直接生成: ${templatePath}`)
        return this._generateWithoutTemplate({ title, content, template, author, metadata })
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
   * 不使用模板直接生成Word文档（回退方案）
   */
  async _generateWithoutTemplate({ title, content, template, author, metadata = {} }) {
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

      // 3. 处理内容（支持简单Markdown）
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
            children.push(
              new Paragraph({
                text: trimmedLine.replace(/^[-*]\s+/, '• '),
                spacing: { after: 100 }
              })
            )
          } else if (trimmedLine.startsWith('| ')) {
            // 表格行（简单处理）
            children.push(
              new Paragraph({
                text: trimmedLine.replace(/\|/g, '  '),
                spacing: { after: 100 }
              })
            )
          } else {
            // 普通段落
            children.push(
              new Paragraph({
                text: trimmedLine,
                spacing: { after: 200 }
              })
            )
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

      console.log(`✅ Word文档生成成功（无模板）: ${title}.docx (${(buffer.length / 1024).toFixed(2)} KB)`)

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
