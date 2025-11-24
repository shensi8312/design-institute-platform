const DocumentAnalysisAgent = require('./DocumentAnalysisAgent')

/**
 * 合同审核 Agent
 *
 * 功能:
 * 1. 合同条款自动提取
 * 2. 风险条款识别
 * 3. 合规性检查
 * 4. 条款对比分析
 */
class ContractReviewAgent extends DocumentAnalysisAgent {
  constructor() {
    super()

    // 预定义的风险关键词
    this.riskKeywords = [
      '违约金', '赔偿', '终止', '解除', '仲裁',
      '不可抗力', '保密', '排他', '独家', '禁止'
    ]
  }

  /**
   * 📄 审核合同
   */
  async reviewContract(fileBuffer, fileName) {
    try {
      console.log(`[ContractReviewAgent] 开始审核合同: ${fileName}`)

      // Step 1: 基础解析
      const parseResult = await this.parser.parseDocument(
        fileBuffer,
        this.getFileType(fileName),
        fileName
      )

      const documentStructure = {
        fileName,
        rawText: parseResult.text || '',
        structure: parseResult.structure || null
      }

      // Step 2: 提取合同关键信息
      const contractInfo = await this.extractContractInfo(documentStructure)

      // Step 3: 识别风险条款
      const risks = await this.identifyRisks(documentStructure)

      // Step 4: 合规性检查
      const compliance = await this.checkCompliance(documentStructure)

      return {
        success: true,
        contract: {
          fileName,
          info: contractInfo,
          risks: risks,
          compliance: compliance
        }
      }

    } catch (error) {
      console.error('[ContractReviewAgent] 审核失败:', error)
      throw error
    }
  }

  /**
   * 📋 提取合同关键信息
   */
  async extractContractInfo(documentStructure) {
    try {
      const text = documentStructure.rawText.substring(0, 8000)

      const prompt = `
分析以下合同,提取关键信息:

${text}

请提取:
1. 合同名称
2. 甲方（签约方）
3. 乙方（签约方）
4. 合同金额
5. 签订日期
6. 履行期限
7. 付款方式
8. 主要义务

以 JSON 格式输出:
{
  "contractName": "...",
  "partyA": "...",
  "partyB": "...",
  "amount": "...",
  "signDate": "...",
  "duration": "...",
  "paymentTerms": "...",
  "mainObligations": [...]
}
`

      const response = await this.llm.chat([
        { role: 'user', content: prompt }
      ])

      try {
        return JSON.parse(response.response)
      } catch {
        return { raw: response.response }
      }

    } catch (error) {
      console.error('[ContractReviewAgent] 信息提取失败:', error)
      return { error: error.message }
    }
  }

  /**
   * ⚠️ 识别风险条款
   */
  async identifyRisks(documentStructure) {
    try {
      const text = documentStructure.rawText.substring(0, 8000)

      const prompt = `
分析以下合同,识别潜在风险条款:

${text}

请识别:
1. 高风险条款 (可能造成重大损失)
2. 中等风险条款 (需要注意)
3. 不合理条款 (对我方不利)
4. 模糊条款 (定义不清)

对每个风险条款,说明:
- 条款内容
- 风险等级 (高/中/低)
- 风险原因
- 建议修改

以 JSON 格式输出:
{
  "highRisks": [
    {
      "clause": "...",
      "reason": "...",
      "suggestion": "..."
    }
  ],
  "mediumRisks": [...],
  "ambiguousClauses": [...]
}
`

      const response = await this.llm.chat([
        { role: 'user', content: prompt }
      ])

      try {
        return JSON.parse(response.response)
      } catch {
        return { raw: response.response }
      }

    } catch (error) {
      console.error('[ContractReviewAgent] 风险识别失败:', error)
      return { error: error.message }
    }
  }

  /**
   * ✅ 合规性检查
   */
  async checkCompliance(documentStructure) {
    try {
      const text = documentStructure.rawText.substring(0, 8000)

      const prompt = `
检查以下合同的合规性:

${text}

检查项:
1. 是否包含必要条款 (标的、价款、履行期限等)
2. 是否符合《合同法》基本要求
3. 违约责任是否对等
4. 争议解决方式是否明确
5. 保密条款是否合理

对每项检查,说明:
- 检查项
- 是否合规 (是/否/部分)
- 问题描述
- 改进建议

以 JSON 格式输出:
{
  "essentialClauses": {
    "compliant": true/false,
    "missing": [...]
  },
  "legalCompliance": {
    "compliant": true/false,
    "issues": [...]
  },
  "liabilityBalance": {
    "balanced": true/false,
    "unfairTerms": [...]
  },
  "overallScore": 85  // 0-100分
}
`

      const response = await this.llm.chat([
        { role: 'user', content: prompt }
      ])

      try {
        return JSON.parse(response.response)
      } catch {
        return { raw: response.response }
      }

    } catch (error) {
      console.error('[ContractReviewAgent] 合规检查失败:', error)
      return { error: error.message }
    }
  }

  /**
   * 🔄 合同条款对比
   */
  async compareContracts(contract1, contract2) {
    try {
      console.log('[ContractReviewAgent] 对比两份合同')

      const text1 = contract1.rawText.substring(0, 4000)
      const text2 = contract2.rawText.substring(0, 4000)

      const prompt = `
对比以下两份合同,找出差异:

合同A:
${text1}

合同B:
${text2}

请对比:
1. 合同金额差异
2. 履行期限差异
3. 付款方式差异
4. 违约责任差异
5. 其他重要条款差异

以 JSON 格式输出:
{
  "differences": [
    {
      "clause": "合同金额",
      "contractA": "...",
      "contractB": "...",
      "impact": "重大/一般/轻微"
    }
  ],
  "summary": "总体差异描述"
}
`

      const response = await this.llm.chat([
        { role: 'user', content: prompt }
      ])

      try {
        return JSON.parse(response.response)
      } catch {
        return { raw: response.response }
      }

    } catch (error) {
      console.error('[ContractReviewAgent] 对比失败:', error)
      throw error
    }
  }
}

module.exports = ContractReviewAgent
