const llmService = require('../llm/UnifiedLLMService')
const Ajv = require('ajv')

/**
 * 动态提取引擎
 * 基于LLM和JSON Schema实现可配置的结构化提取
 */
class DynamicExtractionEngine {
  constructor() {
    this.llmService = llmService
    this.ajv = new Ajv()
  }

  /**
   * 执行提取
   * @param {string} text - 待提取文本
   * @param {object} template - 提取模板
   * @returns {object} 提取结果
   */
  async extract(text, template) {
    try {
      console.log(`[DynamicExtraction] 开始提取: ${template.name}`)

      const prompt = this.buildPrompt(text, template)

      const messages = [{
        role: 'system',
        content: '你是一个专业的文档结构化提取助手。请严格按照JSON Schema格式输出，只返回JSON，不要其他文字。'
      }, {
        role: 'user',
        content: prompt
      }]

      const result = await this.llmService.chat(messages, {
        temperature: 0.1,
        max_tokens: 2000
      })

      console.log(`[DynamicExtraction] LLM返回: ${result.substring(0, 200)}...`)

      const parsed = this.validateAndParse(result, template.output_schema)

      console.log(`[DynamicExtraction] 提取成功: ${JSON.stringify(parsed).substring(0, 200)}...`)

      return parsed
    } catch (error) {
      console.error(`[DynamicExtraction] 提取失败:`, error)
      throw error
    }
  }

  /**
   * 构建提示词
   */
  buildPrompt(text, template) {
    let prompt = template.prompt_template.replace(/\{\{TEXT\}\}/g, text)

    if (template.output_schema) {
      prompt += `\n\n请按以下JSON Schema格式输出：\n${JSON.stringify(template.output_schema, null, 2)}`
    }

    if (template.examples) {
      prompt += `\n\n输出示例：\n${template.examples}`
    }

    return prompt
  }

  /**
   * 验证和解析JSON结果
   */
  validateAndParse(result, schema) {
    const cleaned = result
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    if (schema) {
      const validate = this.ajv.compile(schema)
      const valid = validate(parsed)

      if (!valid) {
        console.warn('[DynamicExtraction] Schema验证失败:', validate.errors)
      }
    }

    return parsed
  }

  /**
   * 批量提取
   */
  async extractBatch(text, templates) {
    const results = []

    for (const template of templates) {
      try {
        const result = await this.extract(text, template)
        results.push({
          template_id: template.id,
          template_name: template.name,
          extraction_type: template.category,
          extracted_data: result,
          confidence: 0.85
        })
      } catch (error) {
        console.error(`[DynamicExtraction] 批量提取失败 (${template.name}):`, error.message)
      }
    }

    return results
  }
}

module.exports = DynamicExtractionEngine
