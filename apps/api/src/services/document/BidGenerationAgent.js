const DocumentAnalysisAgent = require('./DocumentAnalysisAgent')

/**
 * 标书自动生成 Agent
 *
 * 功能:
 * 1. 分析招标文件
 * 2. 自动生成投标文件
 * 3. 匹配公司资质和经验
 * 4. 生成技术方案
 */
class BidGenerationAgent extends DocumentAnalysisAgent {
  constructor() {
    super()
  }

  /**
   * 📝 自动生成标书
   *
   * @param {Buffer} tenderBuffer - 招标文件
   * @param {string} tenderFileName - 招标文件名
   * @param {Object} companyInfo - 公司信息
   * @returns {Object} 生成的标书内容
   */
  async generateBid(tenderBuffer, tenderFileName, companyInfo) {
    try {
      console.log(`[BidGenerationAgent] 开始生成标书: ${tenderFileName}`)

      // Step 1: 解析招标文件
      const parseResult = await this.parser.parseDocument(
        tenderBuffer,
        this.getFileType(tenderFileName),
        tenderFileName
      )

      const tenderDoc = {
        fileName: tenderFileName,
        rawText: parseResult.text || '',
        structure: parseResult.structure || null
      }

      // Step 2: 提取招标要求
      console.log('[BidGenerationAgent] 提取招标要求...')
      const requirements = await this.extractTenderRequirements(tenderDoc)

      // Step 3: 生成投标书各章节
      console.log('[BidGenerationAgent] 生成投标书章节...')
      const bidSections = await this.generateBidSections(requirements, companyInfo)

      return {
        success: true,
        tender: {
          fileName: tenderFileName,
          requirements: requirements
        },
        bid: {
          sections: bidSections,
          generatedAt: new Date().toISOString()
        }
      }

    } catch (error) {
      console.error('[BidGenerationAgent] 生成失败:', error)
      throw error
    }
  }

  /**
   * 📋 提取招标要求
   */
  async extractTenderRequirements(tenderDoc) {
    try {
      const text = tenderDoc.rawText.substring(0, 8000)

      const prompt = `
分析以下招标文件,提取关键要求:

${text}

请提取:
1. 项目名称
2. 项目概况
3. 投标截止时间
4. 资质要求
5. 技术要求
6. 商务要求 (预算、付款方式等)
7. 评分标准

以 JSON 格式输出:
{
  "projectName": "...",
  "projectOverview": "...",
  "deadline": "...",
  "qualificationRequirements": [...],
  "technicalRequirements": [...],
  "commercialRequirements": {
    "budget": "...",
    "paymentTerms": "..."
  },
  "scoringCriteria": [...]
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
      console.error('[BidGenerationAgent] 要求提取失败:', error)
      throw error
    }
  }

  /**
   * 📝 生成投标书章节
   */
  async generateBidSections(requirements, companyInfo) {
    const sections = []

    // 1. 公司资质介绍
    sections.push(await this.generateQualificationSection(companyInfo, requirements))

    // 2. 技术方案
    sections.push(await this.generateTechnicalProposal(requirements, companyInfo))

    // 3. 项目团队
    sections.push(await this.generateTeamSection(companyInfo))

    // 4. 项目经验
    sections.push(await this.generateExperienceSection(companyInfo))

    // 5. 商务报价
    sections.push(await this.generateCommercialProposal(requirements, companyInfo))

    return sections
  }

  /**
   * 🏢 生成公司资质章节
   */
  async generateQualificationSection(companyInfo, requirements) {
    try {
      const prompt = `
请为投标书撰写"公司资质介绍"章节:

公司信息:
- 公司名称: ${companyInfo.name}
- 成立时间: ${companyInfo.foundedYear}
- 资质等级: ${companyInfo.qualification}
- 注册资金: ${companyInfo.registeredCapital}
- 员工人数: ${companyInfo.employeeCount}

招标要求:
${JSON.stringify(requirements.qualificationRequirements || [])}

要求:
1. 突出公司优势
2. 证明满足资质要求
3. 简洁专业的表述
4. 500-800字

请输出章节内容:
`

      const response = await this.llm.chat([
        { role: 'user', content: prompt }
      ])

      return {
        title: '一、公司资质介绍',
        content: response.response
      }

    } catch (error) {
      console.error('[BidGenerationAgent] 资质章节生成失败:', error)
      return {
        title: '一、公司资质介绍',
        content: '资质章节生成失败',
        error: error.message
      }
    }
  }

  /**
   * 🔧 生成技术方案章节
   */
  async generateTechnicalProposal(requirements, companyInfo) {
    try {
      const prompt = `
请为投标书撰写"技术方案"章节:

项目概况:
${requirements.projectOverview || ''}

技术要求:
${JSON.stringify(requirements.technicalRequirements || [])}

公司技术能力:
- 技术团队: ${companyInfo.technicalTeam || '经验丰富的技术团队'}
- 核心技术: ${companyInfo.coreTechnology || '行业领先技术'}
- 技术设备: ${companyInfo.equipment || '先进设备'}

要求:
1. 针对性解决技术要求
2. 突出技术创新点
3. 提供具体实施方案
4. 1000-1500字

请输出章节内容:
`

      const response = await this.llm.chat([
        { role: 'user', content: prompt }
      ])

      return {
        title: '二、技术方案',
        content: response.response
      }

    } catch (error) {
      console.error('[BidGenerationAgent] 技术方案生成失败:', error)
      return {
        title: '二、技术方案',
        content: '技术方案生成失败',
        error: error.message
      }
    }
  }

  /**
   * 👥 生成项目团队章节
   */
  async generateTeamSection(companyInfo) {
    try {
      const prompt = `
请为投标书撰写"项目团队"章节:

团队信息:
- 项目经理: ${companyInfo.projectManager || '经验丰富的项目经理'}
- 技术负责人: ${companyInfo.technicalLead || '资深技术专家'}
- 团队规模: ${companyInfo.teamSize || '10-20人'}
- 专业配置: ${companyInfo.teamComposition || '完整的专业配置'}

要求:
1. 介绍核心成员资质
2. 说明团队分工
3. 突出项目管理能力
4. 500-800字

请输出章节内容:
`

      const response = await this.llm.chat([
        { role: 'user', content: prompt }
      ])

      return {
        title: '三、项目团队',
        content: response.response
      }

    } catch (error) {
      console.error('[BidGenerationAgent] 团队章节生成失败:', error)
      return {
        title: '三、项目团队',
        content: '团队章节生成失败',
        error: error.message
      }
    }
  }

  /**
   * 📂 生成项目经验章节
   */
  async generateExperienceSection(companyInfo) {
    try {
      const prompt = `
请为投标书撰写"类似项目经验"章节:

项目经验:
${JSON.stringify(companyInfo.pastProjects || [
  { name: '类似项目A', year: '2024', achievement: '成功完成' },
  { name: '类似项目B', year: '2023', achievement: '优质完工' }
])}

要求:
1. 列举3-5个类似项目
2. 说明项目规模和成果
3. 突出成功案例
4. 600-1000字

请输出章节内容:
`

      const response = await this.llm.chat([
        { role: 'user', content: prompt }
      ])

      return {
        title: '四、类似项目经验',
        content: response.response
      }

    } catch (error) {
      console.error('[BidGenerationAgent] 经验章节生成失败:', error)
      return {
        title: '四、类似项目经验',
        content: '经验章节生成失败',
        error: error.message
      }
    }
  }

  /**
   * 💰 生成商务报价章节
   */
  async generateCommercialProposal(requirements, companyInfo) {
    try {
      const prompt = `
请为投标书撰写"商务报价"章节:

招标预算:
${requirements.commercialRequirements?.budget || '根据要求'}

付款方式要求:
${requirements.commercialRequirements?.paymentTerms || '按合同约定'}

公司报价策略:
- 具有竞争力的价格
- 合理的利润空间
- 灵活的付款方式

要求:
1. 说明报价依据
2. 提供详细报价单
3. 说明付款方式
4. 承诺质保服务
5. 400-600字

请输出章节内容:
`

      const response = await this.llm.chat([
        { role: 'user', content: prompt }
      ])

      return {
        title: '五、商务报价',
        content: response.response
      }

    } catch (error) {
      console.error('[BidGenerationAgent] 商务章节生成失败:', error)
      return {
        title: '五、商务报价',
        content: '商务章节生成失败',
        error: error.message
      }
    }
  }
}

module.exports = BidGenerationAgent
