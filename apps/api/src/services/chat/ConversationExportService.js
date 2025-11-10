const PDFDocument = require('pdfkit')
const { Document, Packer, Paragraph, TextRun } = require('docx')
const pptxgen = require('pptxgenjs')

class ConversationExportService {
  /**
   * 导出会话为PDF
   */
  async exportToPDF(conversation, messages) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument()
        const chunks = []

        doc.on('data', chunk => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))

        // 标题
        doc.fontSize(20).text(conversation.title || '对话记录', {
          align: 'center'
        })
        doc.moveDown()

        doc.fontSize(12).text(`创建时间: ${new Date(conversation.created_at).toLocaleString()}`, {
          align: 'center'
        })
        doc.moveDown(2)

        // 消息内容
        messages.forEach((msg, idx) => {
          const role = msg.role === 'user' ? '用户' : 'AI助手'
          const time = new Date(msg.timestamp).toLocaleTimeString()

          doc.fontSize(14).fillColor('#1890ff').text(`${role} (${time})`)
          doc.fontSize(12).fillColor('#000000').text(msg.content, {
            indent: 20
          })

          // 来源引用
          if (msg.sources && msg.sources.length > 0) {
            doc.fontSize(10).fillColor('#666666').text('  来源:', { indent: 20 })
            msg.sources.forEach(source => {
              doc.fontSize(9).text(`    - ${source.document_name}${source.page ? ` (第${source.page}页)` : ''}`, {
                indent: 30
              })
            })
          }

          doc.moveDown()
        })

        doc.end()
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 导出会话为Word
   */
  async exportToWord(conversation, messages) {
    const paragraphs = []

    // 标题
    paragraphs.push(
      new Paragraph({
        text: conversation.title || '对话记录',
        heading: 'Heading1',
        spacing: { after: 200 }
      })
    )

    paragraphs.push(
      new Paragraph({
        text: `创建时间: ${new Date(conversation.created_at).toLocaleString()}`,
        spacing: { after: 400 }
      })
    )

    // 消息内容
    messages.forEach((msg, idx) => {
      const role = msg.role === 'user' ? '用户' : 'AI助手'
      const time = new Date(msg.timestamp).toLocaleTimeString()

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${role} (${time})`,
              bold: true,
              color: '1890FF'
            })
          ],
          spacing: { before: 200 }
        })
      )

      paragraphs.push(
        new Paragraph({
          text: msg.content,
          spacing: { after: 100 }
        })
      )

      // 来源引用
      if (msg.sources && msg.sources.length > 0) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '来源:',
                italics: true,
                color: '666666'
              })
            ]
          })
        )

        msg.sources.forEach(source => {
          paragraphs.push(
            new Paragraph({
              text: `  - ${source.document_name}${source.page ? ` (第${source.page}页)` : ''}`,
              spacing: { after: 50 }
            })
          )
        })
      }
    })

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs
        }
      ]
    })

    return await Packer.toBuffer(doc)
  }

  /**
   * 导出会话为PPT
   */
  async exportToPPT(conversation, messages) {
    const pptx = new pptxgen()

    // 第一页：标题页
    const titleSlide = pptx.addSlide()
    titleSlide.addText(conversation.title || '对话记录', {
      x: 1,
      y: 2,
      w: 8,
      h: 1,
      fontSize: 32,
      bold: true,
      align: 'center'
    })
    titleSlide.addText(`创建时间: ${new Date(conversation.created_at).toLocaleString()}`, {
      x: 1,
      y: 3.5,
      w: 8,
      h: 0.5,
      fontSize: 16,
      align: 'center',
      color: '666666'
    })

    // 每条消息一页
    messages.forEach((msg, idx) => {
      const slide = pptx.addSlide()
      const role = msg.role === 'user' ? '用户' : 'AI助手'
      const time = new Date(msg.timestamp).toLocaleTimeString()

      // 标题
      slide.addText(`${role} (${time})`, {
        x: 0.5,
        y: 0.5,
        w: 9,
        h: 0.5,
        fontSize: 18,
        bold: true,
        color: msg.role === 'user' ? '87D068' : '1890FF'
      })

      // 消息内容
      slide.addText(msg.content, {
        x: 0.5,
        y: 1.2,
        w: 9,
        h: 4,
        fontSize: 14,
        valign: 'top'
      })

      // 来源引用
      if (msg.sources && msg.sources.length > 0) {
        const sourcesText = '来源:\n' + msg.sources.map(s =>
          `  • ${s.document_name}${s.page ? ` (第${s.page}页)` : ''}`
        ).join('\n')

        slide.addText(sourcesText, {
          x: 0.5,
          y: 5.5,
          w: 9,
          h: 1.5,
          fontSize: 12,
          color: '666666',
          italic: true
        })
      }
    })

    return await pptx.write('nodebuffer')
  }
}

module.exports = ConversationExportService
