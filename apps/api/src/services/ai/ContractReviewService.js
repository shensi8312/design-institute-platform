const knex = require('../../config/database')
const { v4: uuidv4 } = require('uuid')
const LLMService = require('./LLMService')
const DocumentParserService = require('../document/DocumentParserService')
const fs = require('fs').promises

/**
 * V3.0 合同AI审查服务 (基础版)
 *
 * 功能:
 * - 风险检测: 识别高风险条款
 * - 条款分析: 解析关键条款内容
 * - 完整性检查: 验证合同必要元素
 * - 生成审查报告
 */
class ContractReviewService {
  constructor() {
    this.llmService = new LLMService()
    this.parser = new DocumentParserService()
  }

  /**
   * 启动合同审查任务
   */
  async startReview(documentId, options = {}) {
    try {
      // 获取文档信息
      const document = await knex('project_documents')
        .where({ id: documentId })
        .first()

      if (!document) {
        return {
          success: false,
          message: '文档不存在'
        }
      }

      // 验证文档类型 - 支持所有文档类型
      if (!document.document_type) {
        return {
          success: false,
          message: '文档类型未知'
        }
      }

      // 创建审查任务
      const jobId = uuidv4()
      const jobData = {
        id: jobId,
        document_id: documentId,
        project_id: document.project_id,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date()
      }

      await knex('ai_review_jobs').insert(jobData)

      // 异步执行审查
      this.executeReview(jobId, document).catch(err => {
        console.error('执行合同审查失败:', err)
      })

      return {
        success: true,
        message: '审查任务已启动',
        data: {
          jobId,
          status: 'pending'
        }
      }
    } catch (error) {
      console.error('启动合同审查失败:', error)
      return {
        success: false,
        message: '启动审查失败',
        error: error.message
      }
    }
  }

  /**
   * 执行审查 (异步)
   */
  async executeReview(jobId, document) {
    try {
      // 更新状态为处理中
      await knex('ai_review_jobs')
        .where({ id: jobId })
        .update({
          status: 'processing',
          updated_at: new Date()
        })

      // 1. 提取文档内容
      const content = await this.extractContent(document)

      // 2. 分析合同
      const analysis = await this.analyzeContract(content)

      // 3. 保存结果
      await knex('ai_review_jobs')
        .where({ id: jobId })
        .update({
          status: 'completed',
          result: JSON.stringify(analysis),
          completed_at: new Date(),
          updated_at: new Date()
        })
    } catch (error) {
      console.error('执行审查失败:', error)
      await knex('ai_review_jobs')
        .where({ id: jobId })
        .update({
          status: 'failed',
          error_message: error.message,
          updated_at: new Date()
        })
    }
  }

  /**
   * 提取文档内容 (使用DocumentParserService - 支持Docling解析)
   */
  async extractContent(document) {
    try {
      if (!document.file_path) {
        throw new Error('文档文件路径不存在')
      }

      const dataBuffer = await fs.readFile(document.file_path)

      // 使用DocumentParserService解析文档（支持PDF/Word/PPT等，优先使用Docling）
      const parsed = await this.parser.parseDocument(
        dataBuffer,
        document.mime_type,
        document.file_name || 'contract.pdf'
      )

      // DocumentParserService可能返回字符串或对象
      let text = ''
      if (typeof parsed === 'string') {
        text = parsed
      } else if (parsed && parsed.text) {
        text = parsed.text
      }

      if (!text || text.trim().length === 0) {
        throw new Error('文档内容为空或解析失败')
      }

      return text
    } catch (error) {
      console.error('提取文档内容失败:', error)
      throw error
    }
  }

  /**
   * 分析合同 (基础版)
   */
  async analyzeContract(content) {
    try {
      // 1. 风险检测
      const risks = await this.detectRisks(content)

      // 2. 条款分析
      const clauses = await this.analyzeClauses(content)

      // 3. 完整性检查
      const completeness = await this.checkCompleteness(content)

      // 4. 生成总结
      const summary = await this.generateSummary(content, risks, clauses)

      return {
        summary,
        risks,
        clauses,
        completeness,
        analyzedAt: new Date().toISOString()
      }
    } catch (error) {
      console.error('分析合同失败:', error)
      throw error
    }
  }

  /**
   * 风险检测
   */
  async detectRisks(content) {
    const prompt = `请分析以下合同内容,识别潜在风险条款。

合同内容:
${content.substring(0, 8000)}

请从以下维度分析风险:
1. 违约责任条款
2. 付款条件
3. 知识产权归属
4. 保密义务
5. 争议解决方式

以JSON格式返回,包含:
{
  "high_risks": [{
    "clause": "条款内容摘要",
    "risk": "风险描述",
    "suggestion": "建议"
  }],
  "medium_risks": [...],
  "low_risks": [...]
}`

    const response = await this.llmService.callLLM(prompt)

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (err) {
      console.error('解析风险JSON失败:', err)
    }

    return {
      high_risks: [],
      medium_risks: [],
      low_risks: [],
      raw_response: response
    }
  }

  /**
   * 条款分析
   */
  async analyzeClauses(content) {
    const prompt = `请分析以下合同的关键条款:

合同内容:
${content.substring(0, 8000)}

请提取并分析以下关键条款:
1. 合同双方
2. 合同标的
3. 合同金额
4. 付款方式
5. 履行期限
6. 违约责任

以JSON格式返回:
{
  "parties": { "party_a": "", "party_b": "" },
  "subject": "",
  "amount": "",
  "payment_terms": "",
  "duration": "",
  "liability": ""
}`

    const response = await this.llmService.callLLM(prompt)

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (err) {
      console.error('解析条款JSON失败:', err)
    }

    return {
      raw_response: response
    }
  }

  /**
   * 完整性检查
   */
  async checkCompleteness(content) {
    const requiredElements = [
      '合同双方信息',
      '合同标的',
      '合同金额',
      '付款方式',
      '履行期限',
      '违约责任',
      '争议解决',
      '生效条件'
    ]

    const prompt = `请检查以下合同是否包含必要元素:

合同内容:
${content.substring(0, 8000)}

必要元素清单:
${requiredElements.map((e, i) => `${i + 1}. ${e}`).join('\n')}

以JSON格式返回:
{
  "missing_elements": ["缺失的元素"],
  "present_elements": ["存在的元素"],
  "completeness_score": 85
}`

    const response = await this.llmService.callLLM(prompt)

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (err) {
      console.error('解析完整性JSON失败:', err)
    }

    return {
      missing_elements: [],
      present_elements: requiredElements,
      completeness_score: 100,
      raw_response: response
    }
  }

  /**
   * 生成审查总结
   */
  async generateSummary(content, risks, clauses) {
    const highRiskCount = risks.high_risks?.length || 0
    const mediumRiskCount = risks.medium_risks?.length || 0

    let riskLevel = 'low'
    if (highRiskCount > 0) riskLevel = 'high'
    else if (mediumRiskCount > 2) riskLevel = 'medium'

    return {
      risk_level: riskLevel,
      risk_count: {
        high: highRiskCount,
        medium: mediumRiskCount,
        low: risks.low_risks?.length || 0
      },
      key_findings: [
        highRiskCount > 0 ? `发现${highRiskCount}个高风险条款` : '未发现高风险条款',
        mediumRiskCount > 0 ? `发现${mediumRiskCount}个中等风险条款` : '未发现中等风险条款',
        clauses.amount ? `合同金额: ${clauses.amount}` : '合同金额未明确'
      ].filter(Boolean)
    }
  }

  /**
   * 获取文档最新审查任务
   */
  async getLatestJob(documentId) {
    try {
      const job = await knex('ai_review_jobs')
        .where({ document_id: documentId })
        .orderBy('created_at', 'desc')
        .first()

      if (!job) {
        return {
          success: false,
          message: '未找到审查任务'
        }
      }

      return {
        success: true,
        data: {
          jobId: job.id,
          status: job.status,
          result: job.result ? JSON.parse(job.result) : null,
          error: job.error_message,
          createdAt: job.created_at,
          completedAt: job.completed_at
        }
      }
    } catch (error) {
      console.error('获取最新任务失败:', error)
      return {
        success: false,
        message: '获取最新任务失败',
        error: error.message
      }
    }
  }

  /**
   * 获取审查任务状态
   */
  async getJobStatus(jobId) {
    try {
      const job = await knex('ai_review_jobs')
        .where({ id: jobId })
        .first()

      if (!job) {
        return {
          success: false,
          message: '任务不存在'
        }
      }

      return {
        success: true,
        data: {
          jobId: job.id,
          status: job.status,
          result: job.result ? JSON.parse(job.result) : null,
          error: job.error_message,
          createdAt: job.created_at,
          completedAt: job.completed_at
        }
      }
    } catch (error) {
      console.error('获取任务状态失败:', error)
      return {
        success: false,
        message: '获取任务状态失败',
        error: error.message
      }
    }
  }
}

module.exports = ContractReviewService
