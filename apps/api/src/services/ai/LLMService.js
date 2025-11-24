const axios = require('axios')
const { LLMConfig } = require('../../config/llm.config')

/**
 * LLM服务封装
 * 使用现有LLMConfig配置，支持ollama/vllm/qwenVL切换
 */
class LLMService {
  async callLLM(prompt, options = {}) {
    const config = LLMConfig.getCurrent()

    if (!config.baseUrl) {
      throw new Error(`LLM配置缺失: ${LLMConfig.provider} 的 baseUrl 未设置`)
    }

    try {
      const response = await axios.post(`${config.baseUrl}/v1/chat/completions`, {
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature || config.options.temperature,
        max_tokens: options.max_tokens || config.options.max_tokens
      }, {
        headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
        timeout: 60000
      })

      return response.data.choices[0].message.content
    } catch (error) {
      console.error('LLM调用失败:', error.message)
      if (error.response) {
        console.error('响应状态:', error.response.status)
        console.error('响应数据:', JSON.stringify(error.response.data))
      }
      throw error
    }
  }
}

module.exports = LLMService
