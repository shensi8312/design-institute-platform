const fs = require('fs-extra')
const path = require('path')

/**
 * 模板管理器
 * 统一管理Word、Excel、PPT模板
 */
class TemplateManager {
  constructor() {
    this.templatesRoot = path.join(__dirname, '../../../templates')
    this.templates = {
      word: {},
      excel: {},
      ppt: {}
    }
  }

  /**
   * 初始化：加载所有模板配置
   */
  async init() {
    try {
      // 确保模板目录存在
      await fs.ensureDir(path.join(this.templatesRoot, 'word'))
      await fs.ensureDir(path.join(this.templatesRoot, 'excel'))
      await fs.ensureDir(path.join(this.templatesRoot, 'ppt'))

      // 加载配置文件
      const configPath = path.join(this.templatesRoot, 'templates.json')
      if (await fs.pathExists(configPath)) {
        const config = await fs.readJson(configPath)
        this.templates = config
      } else {
        // 创建默认配置
        await this.createDefaultConfig()
      }

      console.log('✅ 模板管理器初始化完成')
      console.log('📄 Word模板:', Object.keys(this.templates.word).length, '个')
      console.log('📊 Excel模板:', Object.keys(this.templates.excel).length, '个')
      console.log('📽️ PPT模板:', Object.keys(this.templates.ppt).length, '个')
    } catch (error) {
      console.error('❌ 模板管理器初始化失败:', error)
    }
  }

  /**
   * 创建默认配置
   */
  async createDefaultConfig() {
    const config = {
      word: {
        general: {
          name: '通用文档',
          file: 'general.docx',
          description: '适用于各类通用文档',
          variables: ['title', 'author', 'date', 'content']
        },
        design_plan: {
          name: '设计方案',
          file: 'design_plan.docx',
          description: '设计方案专用模板，包含项目信息、章节结构',
          variables: ['title', 'project_name', 'author', 'date', 'content', 'sections', 'doc_number']
        },
        technical_report: {
          name: '技术报告',
          file: 'technical_report.docx',
          description: '技术报告专用模板',
          variables: ['title', 'project_name', 'author', 'date', 'content', 'doc_number']
        },
        meeting_minutes: {
          name: '会议纪要',
          file: 'meeting_minutes.docx',
          description: '会议记录专用模板',
          variables: ['title', 'date', 'attendees', 'content', 'action_items']
        }
      },
      excel: {
        general: {
          name: '通用表格',
          file: 'general.xlsx',
          description: '通用数据表格',
          variables: ['title', 'data']
        },
        data_analysis: {
          name: '数据分析',
          file: 'data_analysis.xlsx',
          description: '数据分析报表，包含图表',
          variables: ['title', 'data', 'charts']
        },
        cost_estimate: {
          name: '造价预算',
          file: 'cost_estimate.xlsx',
          description: '工程造价预算表',
          variables: ['project_name', 'items', 'total']
        }
      },
      ppt: {
        general: {
          name: '通用PPT',
          file: 'general.pptx',
          description: '通用演示文稿',
          variables: ['title', 'author', 'slides']
        },
        project_report: {
          name: '项目汇报',
          file: 'project_report.pptx',
          description: '项目汇报专用，包含封面、目录、内容页',
          variables: ['project_name', 'date', 'slides']
        },
        design_presentation: {
          name: '设计展示',
          file: 'design_presentation.pptx',
          description: '设计方案展示专用',
          variables: ['project_name', 'designer', 'slides']
        }
      }
    }

    await fs.writeJson(
      path.join(this.templatesRoot, 'templates.json'),
      config,
      { spaces: 2 }
    )

    this.templates = config
  }

  /**
   * 获取模板文件路径
   */
  getTemplatePath(type, templateId) {
    const template = this.templates[type]?.[templateId]
    if (!template) {
      // 如果找不到指定模板，返回通用模板
      const generalTemplate = this.templates[type]?.general
      if (!generalTemplate) {
        throw new Error(`未找到${type}类型的模板`)
      }
      console.warn(`⚠️ 未找到模板 ${templateId}，使用通用模板`)
      return path.join(this.templatesRoot, type, generalTemplate.file)
    }
    return path.join(this.templatesRoot, type, template.file)
  }

  /**
   * 获取模板信息
   */
  getTemplateInfo(type, templateId) {
    return this.templates[type]?.[templateId] || this.templates[type]?.general
  }

  /**
   * 获取所有模板列表
   */
  getTemplatesList(type) {
    if (type) {
      return Object.entries(this.templates[type] || {}).map(([id, info]) => ({
        id,
        ...info
      }))
    }
    return {
      word: this.getTemplatesList('word'),
      excel: this.getTemplatesList('excel'),
      ppt: this.getTemplatesList('ppt')
    }
  }

  /**
   * 上传/更新模板
   */
  async uploadTemplate(type, templateId, fileBuffer, metadata) {
    const extensions = { word: 'docx', excel: 'xlsx', ppt: 'pptx' }
    const ext = extensions[type]

    const templateInfo = {
      name: metadata.name || templateId,
      file: `${templateId}.${ext}`,
      description: metadata.description || '',
      variables: metadata.variables || [],
      uploadDate: new Date().toISOString(),
      uploadBy: metadata.uploadBy || 'system'
    }

    // 保存文件
    const filePath = path.join(this.templatesRoot, type, templateInfo.file)
    await fs.writeFile(filePath, fileBuffer)

    // 更新配置
    this.templates[type][templateId] = templateInfo
    await fs.writeJson(
      path.join(this.templatesRoot, 'templates.json'),
      this.templates,
      { spaces: 2 }
    )

    console.log(`✅ 模板上传成功: ${type}/${templateId}`)
    return templateInfo
  }

  /**
   * 删除模板
   */
  async deleteTemplate(type, templateId) {
    if (templateId === 'general') {
      throw new Error('不能删除通用模板')
    }

    const template = this.templates[type]?.[templateId]
    if (!template) {
      throw new Error('模板不存在')
    }

    // 删除文件
    const filePath = path.join(this.templatesRoot, type, template.file)
    if (await fs.pathExists(filePath)) {
      await fs.unlink(filePath)
    }

    // 更新配置
    delete this.templates[type][templateId]
    await fs.writeJson(
      path.join(this.templatesRoot, 'templates.json'),
      this.templates,
      { spaces: 2 }
    )

    console.log(`✅ 模板删除成功: ${type}/${templateId}`)
  }

  /**
   * 检查模板文件是否存在
   */
  async templateFileExists(type, templateId) {
    try {
      const templatePath = this.getTemplatePath(type, templateId)
      return await fs.pathExists(templatePath)
    } catch {
      return false
    }
  }
}

// 创建单例
const templateManager = new TemplateManager()

module.exports = templateManager
