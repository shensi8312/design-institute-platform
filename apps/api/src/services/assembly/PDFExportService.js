const PDFDocument = require('pdfkit')
const fs = require('fs')
const path = require('path')

class PDFExportService {
  constructor() {
    this.outputDir = path.join(__dirname, '../../../exports/pdf')
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true })
    }
  }

  /**
   * 生成装配指导PDF
   */
  async generateAssemblyGuidePDF(design, steps, constraints) {
    return new Promise((resolve, reject) => {
      try {
        const filename = `装配指导_${design.design_name}_${Date.now()}.pdf`
        const filepath = path.join(this.outputDir, filename)

        const doc = new PDFDocument({ size: 'A4', margin: 50 })
        const stream = fs.createWriteStream(filepath)

        doc.pipe(stream)

        // 标题
        doc.fontSize(20).text('装配指导书', { align: 'center' })
        doc.moveDown()

        // 基本信息
        doc.fontSize(14).text('基本信息', { underline: true })
        doc.fontSize(10)
        doc.text(`设计名称: ${design.design_name}`)
        doc.text(`项目名称: ${design.project_name}`)
        doc.text(`创建时间: ${new Date(design.created_at).toLocaleString('zh-CN')}`)
        doc.text(`总步骤数: ${design.steps_count} 步`)
        doc.moveDown()

        // 装配步骤
        doc.fontSize(14).text('装配步骤', { underline: true })
        doc.fontSize(10)

        steps.forEach((step, index) => {
          doc.moveDown(0.5)
          doc.text(`步骤 ${step.step_number}: ${step.operation_type}`, { bold: true })
          doc.text(`  描述: ${step.description}`)
          doc.text(`  零件A: ${step.part_a}`)
          doc.text(`  零件B: ${step.part_b}`)
          if (step.notes) {
            doc.text(`  备注: ${step.notes}`)
          }
        })

        // 约束关系（如果有）
        if (constraints && constraints.length > 0) {
          doc.addPage()
          doc.fontSize(14).text('约束关系明细', { underline: true })
          doc.fontSize(10)

          constraints.forEach((c, i) => {
            doc.moveDown(0.5)
            doc.text(`${i + 1}. ${c.type} - ${c.part_a} 与 ${c.part_b}`)
            doc.text(`   置信度: ${(c.confidence * 100).toFixed(0)}%`)
            if (c.reasoning) {
              doc.text(`   推理依据: ${c.reasoning}`)
            }
          })
        }

        // 页脚
        doc.fontSize(8).text(
          '本文档由MST设计平台AI自动生成',
          50,
          doc.page.height - 50,
          { align: 'center' }
        )

        doc.end()

        stream.on('finish', () => {
          resolve({
            success: true,
            filename,
            filepath,
            url: `/exports/pdf/${filename}`
          })
        })

        stream.on('error', (error) => {
          reject(error)
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 导出SolidWorks约束JSON
   */
  async exportSolidWorksJSON(design, steps, constraints) {
    try {
      const filename = `SolidWorks_${design.design_name}_${Date.now()}.json`
      const filepath = path.join(this.outputDir.replace('/pdf', '/json'), filename)

      const jsonDir = path.dirname(filepath)
      if (!fs.existsSync(jsonDir)) {
        fs.mkdirSync(jsonDir, { recursive: true })
      }

      const solidworksData = {
        metadata: {
          designName: design.design_name,
          projectName: design.project_name,
          exportDate: new Date().toISOString(),
          version: '1.0',
          format: 'SolidWorks Assembly Constraints'
        },
        assembly: {
          name: design.design_name,
          description: design.description || '',
          stepsCount: design.steps_count
        },
        steps: steps.map(s => ({
          stepNumber: s.step_number,
          operation: s.operation_type,
          description: s.description,
          partA: s.part_a,
          partB: s.part_b,
          parameters: typeof s.parameters === 'string' ? JSON.parse(s.parameters) : s.parameters,
          notes: s.notes
        })),
        constraints: (constraints || []).map(c => ({
          type: c.type,
          entities: [c.part_a, c.part_b],
          parameters: typeof c.parameters === 'string' ? JSON.parse(c.parameters) : c.parameters,
          confidence: c.confidence,
          ruleId: c.rule_id
        }))
      }

      fs.writeFileSync(filepath, JSON.stringify(solidworksData, null, 2), 'utf-8')

      return {
        success: true,
        filename,
        filepath,
        url: `/exports/json/${filename}`
      }
    } catch (error) {
      throw error
    }
  }

  /**
   * 清理过期文件（超过24小时）
   */
  async cleanOldFiles() {
    try {
      const dirs = [
        this.outputDir,
        this.outputDir.replace('/pdf', '/json')
      ]

      dirs.forEach(dir => {
        if (!fs.existsSync(dir)) return

        const files = fs.readdirSync(dir)
        const now = Date.now()

        files.forEach(file => {
          const filepath = path.join(dir, file)
          const stats = fs.statSync(filepath)
          const age = now - stats.mtimeMs

          if (age > 24 * 60 * 60 * 1000) {
            fs.unlinkSync(filepath)
            console.log('[PDFExportService] 清理过期文件:', file)
          }
        })
      })
    } catch (error) {
      console.error('[PDFExportService] 清理文件失败:', error)
    }
  }
}

module.exports = new PDFExportService()
