const pptxgen = require('pptxgenjs')
const fs = require('fs-extra')
const TemplateManager = require('./TemplateManager')

/**
 * PPT演示文稿生成服务
 * 基于pptxgenjs生成PPT（注意：pptxgenjs不支持模板，需要代码生成）
 */
class PPTGeneratorService {
  /**
   * 生成PPT演示文稿
   * @param {Object} options
   * @param {string} options.title - PPT标题
   * @param {Array} options.slides - 幻灯片内容数组
   * @param {string} options.template - 模板ID（用于确定样式风格）
   * @param {Object} options.metadata - 额外元数据
   */
  async generate({ title, slides, template, metadata = {} }) {
    try {
      const templateInfo = TemplateManager.getTemplateInfo('ppt', template || 'general')
      console.log(`📽️ 使用PPT模板风格: ${templateInfo.name}`)

      const pptx = new pptxgen()

      // 设置演示文稿属性
      pptx.author = metadata.author || '系统生成'
      pptx.company = '十一设计院'
      pptx.title = title
      pptx.subject = metadata.subject || title

      // 定义主题样式（根据模板类型）
      const theme = this._getTheme(template)

      // 1. 封面页
      this._createCoverSlide(pptx, {
        title,
        author: metadata.author,
        date: metadata.date || new Date().toLocaleDateString('zh-CN'),
        theme
      })

      // 2. 目录页（如果幻灯片超过3页）
      if (slides && slides.length > 3) {
        this._createTableOfContentsSlide(pptx, { slides, theme })
      }

      // 3. 内容页
      if (Array.isArray(slides)) {
        slides.forEach((slide, index) => {
          this._createContentSlide(pptx, { slide, index, theme })
        })
      }

      // 4. 结束页
      this._createEndSlide(pptx, { theme })

      // 5. 生成Buffer
      const buffer = await pptx.write({ outputType: 'nodebuffer' })

      console.log(`✅ PPT生成成功: ${title}.pptx (${(buffer.length / 1024).toFixed(2)} KB)`)

      return {
        buffer,
        filename: `${title}.pptx`,
        size: buffer.length,
        template: templateInfo.name
      }

    } catch (error) {
      console.error('❌ 生成PPT失败:', error)
      throw new Error(`生成PPT失败: ${error.message}`)
    }
  }

  /**
   * 获取主题样式
   */
  _getTheme(template) {
    const themes = {
      general: {
        primaryColor: '1890FF',
        secondaryColor: '52C41A',
        textColor: '262626',
        bgColor: 'FFFFFF'
      },
      project_report: {
        primaryColor: '1677FF',
        secondaryColor: '13C2C2',
        textColor: '000000',
        bgColor: 'F0F2F5'
      },
      design_presentation: {
        primaryColor: '722ED1',
        secondaryColor: 'FA8C16',
        textColor: '262626',
        bgColor: 'FFFFFF'
      }
    }

    return themes[template] || themes.general
  }

  /**
   * 创建封面页
   */
  _createCoverSlide(pptx, { title, author, date, theme }) {
    const slide = pptx.addSlide()

    // 背景色
    slide.background = { color: theme.primaryColor }

    // Logo（如果有）
    // slide.addImage({ path: 'logo.png', x: 0.5, y: 0.5, w: 1.5, h: 0.5 })

    // 标题
    slide.addText(title, {
      x: 1,
      y: 2.5,
      w: 8,
      h: 1.5,
      fontSize: 44,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
      valign: 'middle'
    })

    // 副标题
    slide.addText('十一设计院 | MST-AI智能平台', {
      x: 1,
      y: 4.2,
      w: 8,
      h: 0.5,
      fontSize: 20,
      color: 'FFFFFF',
      align: 'center'
    })

    // 作者和日期
    if (author || date) {
      const info = []
      if (author) info.push(`主讲人: ${author}`)
      if (date) info.push(date)

      slide.addText(info.join('  |  '), {
        x: 1,
        y: 5.0,
        w: 8,
        h: 0.4,
        fontSize: 14,
        color: 'FFFFFF',
        align: 'center'
      })
    }
  }

  /**
   * 创建目录页
   */
  _createTableOfContentsSlide(pptx, { slides, theme }) {
    const slide = pptx.addSlide()

    // 标题
    slide.addText('目录', {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 0.6,
      fontSize: 32,
      bold: true,
      color: theme.primaryColor
    })

    // 目录项
    const tocItems = slides.map((s, idx) => ({
      text: `${idx + 1}. ${s.title || s.subtitle || '内容'}`,
      options: { bullet: false, fontSize: 18, color: theme.textColor }
    }))

    slide.addText(tocItems, {
      x: 1.5,
      y: 1.5,
      w: 7,
      h: 4,
      valign: 'top'
    })
  }

  /**
   * 创建内容页
   */
  _createContentSlide(pptx, { slide, index, theme }) {
    const pptSlide = pptx.addSlide()

    // 页眉
    pptSlide.addText(slide.title || `第${index + 1}部分`, {
      x: 0.5,
      y: 0.3,
      w: 8,
      h: 0.5,
      fontSize: 28,
      bold: true,
      color: theme.primaryColor
    })

    // 分隔线
    pptSlide.addShape(pptx.ShapeType.rect, {
      x: 0.5,
      y: 0.9,
      w: 9,
      h: 0.03,
      fill: { color: theme.primaryColor }
    })

    // 内容
    if (slide.content) {
      // 如果是文本内容
      if (typeof slide.content === 'string') {
        const lines = slide.content.split('\n').filter(l => l.trim())
        const textItems = lines.map(line => ({
          text: line.trim(),
          options: {
            bullet: line.trim().startsWith('-') || line.trim().startsWith('•'),
            fontSize: 16,
            color: theme.textColor
          }
        }))

        pptSlide.addText(textItems, {
          x: 1,
          y: 1.2,
          w: 8,
          h: 4,
          valign: 'top'
        })
      }
      // 如果是数组（列表项）
      else if (Array.isArray(slide.content)) {
        const textItems = slide.content.map(item => ({
          text: item,
          options: { bullet: true, fontSize: 16, color: theme.textColor }
        }))

        pptSlide.addText(textItems, {
          x: 1,
          y: 1.2,
          w: 8,
          h: 4,
          valign: 'top'
        })
      }
    }

    // 页脚
    pptSlide.addText(`第 ${index + 1} 页`, {
      x: 8.5,
      y: 5.3,
      w: 1,
      h: 0.3,
      fontSize: 12,
      color: '999999',
      align: 'right'
    })
  }

  /**
   * 创建结束页
   */
  _createEndSlide(pptx, { theme }) {
    const slide = pptx.addSlide()

    slide.background = { color: theme.primaryColor }

    slide.addText('谢谢观看', {
      x: 1,
      y: 2,
      w: 8,
      h: 1,
      fontSize: 48,
      bold: true,
      color: 'FFFFFF',
      align: 'center',
      valign: 'middle'
    })

    slide.addText('Thank You', {
      x: 1,
      y: 3.2,
      w: 8,
      h: 0.6,
      fontSize: 28,
      color: 'FFFFFF',
      align: 'center'
    })

    slide.addText('十一设计院 MST-AI智能平台', {
      x: 1,
      y: 4.5,
      w: 8,
      h: 0.4,
      fontSize: 16,
      color: 'FFFFFF',
      align: 'center'
    })
  }
}

// 创建单例
const pptGeneratorService = new PPTGeneratorService()

module.exports = pptGeneratorService
