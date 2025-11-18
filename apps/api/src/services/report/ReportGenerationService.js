const knex = require('../../config/database')
const { v4: uuidv4 } = require('uuid')
const fs = require('fs').promises
const path = require('path')
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } = require('docx')

/**
 * V3.0 报告生成服务
 *
 * 功能:
 * - 基于AI审查结果生成Word报告
 * - 支持合同审查报告、投标审查报告等
 */
class ReportGenerationService {
  /**
   * 生成报告
   */
  async generateReport(options) {
    try {
      const {
        projectId,
        documentId,
        reportType = 'contract_review',
        format = 'docx'
      } = options

      // 验证文档存在
      const document = await knex('project_documents')
        .where({ id: documentId })
        .first()

      if (!document) {
        return {
          success: false,
          message: '文档不存在'
        }
      }

      // 获取AI审查结果
      const reviewJob = await knex('ai_review_jobs')
        .where({ document_id: documentId })
        .orderBy('created_at', 'desc')
        .first()

      if (!reviewJob || reviewJob.status !== 'completed') {
        return {
          success: false,
          message: 'AI审查尚未完成，无法生成报告'
        }
      }

      const reviewResult = JSON.parse(reviewJob.result)

      // 根据报告类型生成
      let reportBuffer
      if (reportType === 'contract_review') {
        reportBuffer = await this.generateContractReviewReport(document, reviewResult)
      } else {
        return {
          success: false,
          message: `不支持的报告类型: ${reportType}`
        }
      }

      // 保存报告文件
      const reportId = uuidv4()
      const fileName = `${reportType}_${document.title}_${Date.now()}.${format}`
      const reportDir = 'uploads/reports'

      // 确保目录存在
      await fs.mkdir(reportDir, { recursive: true })

      const filePath = path.join(reportDir, fileName)
      await fs.writeFile(filePath, reportBuffer)

      return {
        success: true,
        message: '报告生成成功',
        data: {
          reportId,
          fileName,
          filePath,
          downloadUrl: `/api/reports/download/${reportId}`
        }
      }
    } catch (error) {
      console.error('生成报告失败:', error)
      return {
        success: false,
        message: '生成报告失败',
        error: error.message
      }
    }
  }

  /**
   * 生成合同审查报告 (Word格式)
   */
  async generateContractReviewReport(document, reviewResult) {
    const { summary, risks, clauses, completeness } = reviewResult

    // 创建Word文档
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // 标题
          new Paragraph({
            text: '合同审查报告',
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 }
          }),

          // 基本信息
          new Paragraph({
            text: '一、基本信息',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
          }),

          new Paragraph({
            children: [
              new TextRun({ text: '合同名称: ', bold: true }),
              new TextRun(document.title || '未命名合同')
            ],
            spacing: { after: 100 }
          }),

          new Paragraph({
            children: [
              new TextRun({ text: '审查时间: ', bold: true }),
              new TextRun(new Date(reviewResult.analyzedAt).toLocaleString('zh-CN'))
            ],
            spacing: { after: 100 }
          }),

          new Paragraph({
            children: [
              new TextRun({ text: '风险等级: ', bold: true }),
              new TextRun({
                text: summary.risk_level === 'high' ? '高风险 ⚠️' :
                      summary.risk_level === 'medium' ? '中等风险 ⚡' : '低风险 ✓',
                color: summary.risk_level === 'high' ? 'FF0000' :
                       summary.risk_level === 'medium' ? 'FF8C00' : '008000'
              })
            ],
            spacing: { after: 200 }
          }),

          // 审查摘要
          new Paragraph({
            text: '二、审查摘要',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
          }),

          new Paragraph({
            children: [
              new TextRun({ text: `• 高风险条款: ${summary.risk_count.high}个\n`, color: 'FF0000' }),
              new TextRun({ text: `• 中等风险条款: ${summary.risk_count.medium}个\n`, color: 'FF8C00' }),
              new TextRun({ text: `• 低风险条款: ${summary.risk_count.low}个`, color: '008000' })
            ],
            spacing: { after: 200 }
          }),

          // 关键发现
          ...(summary.key_findings || []).map(finding =>
            new Paragraph({
              text: `• ${finding}`,
              spacing: { after: 100 }
            })
          ),

          // 风险详情
          new Paragraph({
            text: '三、风险详情',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
          }),

          // 高风险
          ...(risks.high_risks && risks.high_risks.length > 0 ? [
            new Paragraph({
              text: '3.1 高风险条款',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 }
            }),
            ...risks.high_risks.flatMap((risk, index) => [
              new Paragraph({
                children: [
                  new TextRun({ text: `${index + 1}. `, bold: true }),
                  new TextRun({ text: risk.clause || '条款内容', bold: true })
                ],
                spacing: { after: 50 }
              }),
              new Paragraph({
                text: `   风险: ${risk.risk}`,
                spacing: { after: 50 }
              }),
              new Paragraph({
                text: `   建议: ${risk.suggestion}`,
                spacing: { after: 200 }
              })
            ])
          ] : [
            new Paragraph({
              text: '3.1 高风险条款',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
              text: '未发现高风险条款 ✓',
              spacing: { after: 200 }
            })
          ]),

          // 中等风险
          ...(risks.medium_risks && risks.medium_risks.length > 0 ? [
            new Paragraph({
              text: '3.2 中等风险条款',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 }
            }),
            ...risks.medium_risks.slice(0, 3).flatMap((risk, index) => [
              new Paragraph({
                text: `${index + 1}. ${risk.clause || '条款内容'}`,
                spacing: { after: 50 }
              }),
              new Paragraph({
                text: `   风险: ${risk.risk}`,
                spacing: { after: 50 }
              }),
              new Paragraph({
                text: `   建议: ${risk.suggestion}`,
                spacing: { after: 200 }
              })
            ])
          ] : []),

          // 关键条款
          new Paragraph({
            text: '四、关键条款',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
          }),

          new Paragraph({
            children: [
              new TextRun({ text: '合同双方: ', bold: true }),
              new TextRun(clauses.parties ?
                `甲方: ${clauses.parties.party_a || '未识别'}, 乙方: ${clauses.parties.party_b || '未识别'}` :
                '未识别')
            ],
            spacing: { after: 100 }
          }),

          new Paragraph({
            children: [
              new TextRun({ text: '合同标的: ', bold: true }),
              new TextRun(clauses.subject || '未识别')
            ],
            spacing: { after: 100 }
          }),

          new Paragraph({
            children: [
              new TextRun({ text: '合同金额: ', bold: true }),
              new TextRun(clauses.amount || '未识别')
            ],
            spacing: { after: 100 }
          }),

          new Paragraph({
            children: [
              new TextRun({ text: '付款方式: ', bold: true }),
              new TextRun(clauses.payment_terms || '未识别')
            ],
            spacing: { after: 100 }
          }),

          new Paragraph({
            children: [
              new TextRun({ text: '履行期限: ', bold: true }),
              new TextRun(clauses.duration || '未识别')
            ],
            spacing: { after: 200 }
          }),

          // 完整性检查
          new Paragraph({
            text: '五、完整性检查',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
          }),

          new Paragraph({
            children: [
              new TextRun({ text: '完整性评分: ', bold: true }),
              new TextRun({
                text: `${completeness.completeness_score || 0}分`,
                color: completeness.completeness_score >= 80 ? '008000' : 'FF8C00'
              })
            ],
            spacing: { after: 200 }
          }),

          ...(completeness.missing_elements && completeness.missing_elements.length > 0 ? [
            new Paragraph({
              text: '缺失元素:',
              bold: true,
              spacing: { after: 100 }
            }),
            ...completeness.missing_elements.map(element =>
              new Paragraph({
                text: `• ${element}`,
                spacing: { after: 50 }
              })
            )
          ] : [
            new Paragraph({
              text: '所有必要元素完整 ✓',
              spacing: { after: 200 }
            })
          ]),

          // 审查结论
          new Paragraph({
            text: '六、审查结论',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
          }),

          new Paragraph({
            text: summary.risk_level === 'high' ?
              '本合同存在较高风险，建议法务部门详细审核后再签署。' :
              summary.risk_level === 'medium' ?
              '本合同存在一定风险，建议针对性修改条款后签署。' :
              '本合同风险较低，可考虑签署。',
            spacing: { after: 400 }
          }),

          new Paragraph({
            text: '---',
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 }
          }),

          new Paragraph({
            text: '本报告由AI系统自动生成，仅供参考。',
            alignment: AlignmentType.CENTER,
            italics: true,
            spacing: { after: 100 }
          }),

          new Paragraph({
            text: `生成时间: ${new Date().toLocaleString('zh-CN')}`,
            alignment: AlignmentType.CENTER,
            italics: true
          })
        ]
      }]
    })

    // 转换为Buffer
    return await Packer.toBuffer(doc)
  }
}

module.exports = ReportGenerationService
