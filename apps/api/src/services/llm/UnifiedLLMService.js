const axios = require('axios')
const { LLMConfig } = require('../../config/llm.config')

/**
 * 统一LLM服务
 * 支持Ollama和vLLM自动切换
 */
class UnifiedLLMService {
  constructor() {
    this.config = LLMConfig
  }

  /**
   * 提取思考内容和正文内容
   * @returns {thinking: string, content: string}
   */
  extractThinkingAndContent(fullText) {
    if (!fullText) return { thinking: '', content: '' }

    let thinking = ''
    let content = ''

    // 查找<think>标签的位置
    const thinkStartIndex = fullText.indexOf('<think>')
    const thinkEndIndex = fullText.indexOf('</think>')

    if (thinkStartIndex !== -1) {
      if (thinkEndIndex !== -1) {
        // 有完整的<think>...</think>
        thinking = fullText.substring(thinkStartIndex + 7, thinkEndIndex).trim()
        // 删除<think>...</think>,保留其余内容
        content = (fullText.substring(0, thinkStartIndex) + fullText.substring(thinkEndIndex + 8)).trim()
      } else {
        // 有<think>但未闭合,正在思考中
        thinking = fullText.substring(thinkStartIndex + 7).trim()
        content = fullText.substring(0, thinkStartIndex).trim()
      }
    } else {
      // 没有<think>标签
      content = fullText.trim()
    }

    return { thinking, content }
  }

  /**
   * 过滤<think>标签(仅用于非流式)
   */
  filterThinkTags(content) {
    return this.extractThinkingAndContent(content).content
  }

  /**
   * 生成回复 - 流式输出
   * @param {string} prompt - 提示词
   * @param {object} options - 可选参数
   * @param {function} onChunk - 流式输出回调
   */
  async generateStream(prompt, options = {}, onChunk) {
    const currentConfig = this.config.getCurrent()
    const provider = this.config.provider

    console.log(`[UnifiedLLM] 使用${provider.toUpperCase()}流式生成`)

    try {
      if (provider === 'ollama') {
        return await this.generateStreamOllama(prompt, currentConfig, options, onChunk)
      } else if (provider === 'vllm') {
        return await this.generateStreamVLLM(prompt, currentConfig, options, onChunk)
      } else {
        throw new Error(`不支持的LLM提供商: ${provider}`)
      }
    } catch (error) {
      console.error(`[UnifiedLLM] ${provider}流式生成失败:`, error.message)
      throw error
    }
  }

  /**
   * 使用vLLM流式生成
   */
  async generateStreamVLLM(prompt, config, options, onChunk) {
    const startTime = Date.now()

    const headers = {
      'Content-Type': 'application/json'
    }

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`
    }

    const messages = [{ role: 'user', content: prompt }]

    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: options.model || config.model,
        messages,
        temperature: options.temperature || config.options.temperature,
        top_p: options.top_p || config.options.top_p,
        max_tokens: options.max_tokens || config.options.max_tokens,
        stream: true
      })
    })

    if (!response.ok) {
      throw new Error(`vLLM请求失败: ${response.status} ${response.statusText}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    let fullContent = ''
    let previousContent = ''
    let previousThinking = ''
    let isInsideThink = false // 是否在<think>标签内

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(line => line.trim() && line.startsWith('data:'))

      for (const line of lines) {
        const data = line.replace('data: ', '').trim()
        if (data === '[DONE]') break

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            // 累积完整内容
            fullContent += content

            // 检查是否进入或离开<think>标签
            if (fullContent.includes('<think>')) {
              isInsideThink = true
            }
            if (fullContent.includes('</think>')) {
              isInsideThink = false
            }

            // 提取思考和正文
            const { thinking, content: mainContent } = this.extractThinkingAndContent(fullContent)

            // 计算新增内容
            const newThinking = thinking.substring(previousThinking.length)
            const newContent = mainContent.substring(previousContent.length)

            // 如果在思考中,只发送thinking,不发送content
            if (isInsideThink && newThinking) {
              console.log('[思考中] 新增thinking:', newThinking.length, '字')
              onChunk({ content: '', thinking: newThinking })
              previousThinking = thinking
            }
            // 思考结束后,发送content
            else if (!isInsideThink && newContent) {
              console.log('[回答中] 新增content:', newContent.length, '字')
              onChunk({ content: newContent, thinking: '' })
              previousContent = mainContent
            } else {
              console.log('[跳过] isInsideThink:', isInsideThink, 'newThinking:', newThinking.length, 'newContent:', newContent.length)
            }
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }

    const latency = Date.now() - startTime

    return {
      content: previousContent,
      thinking: previousThinking,
      model: config.model,
      latency,
      provider: 'vllm'
    }
  }

  /**
   * 使用Ollama流式生成
   */
  async generateStreamOllama(prompt, config, options, onChunk) {
    const startTime = Date.now()

    const response = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model || config.model,
        prompt,
        stream: true,
        options: {
          temperature: options.temperature || config.options.temperature,
          top_p: options.top_p || config.options.top_p,
          ...config.options
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama请求失败: ${response.status} ${response.statusText}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    let fullContent = ''
    let previousContent = ''
    let previousThinking = ''
    let isInsideThink = false // 是否在<think>标签内

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(line => line.trim())

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line)
          const content = parsed.response
          if (content) {
            // 累积完整内容
            fullContent += content

            // 检查是否进入或离开<think>标签
            if (fullContent.includes('<think>')) {
              isInsideThink = true
            }
            if (fullContent.includes('</think>')) {
              isInsideThink = false
            }

            // 提取思考和正文
            const { thinking, content: mainContent } = this.extractThinkingAndContent(fullContent)

            // 计算新增内容
            const newThinking = thinking.substring(previousThinking.length)
            const newContent = mainContent.substring(previousContent.length)

            // 如果在思考中,只发送thinking,不发送content
            if (isInsideThink && newThinking) {
              console.log('[思考中] 新增thinking:', newThinking.length, '字')
              onChunk({ content: '', thinking: newThinking })
              previousThinking = thinking
            }
            // 思考结束后,发送content
            else if (!isInsideThink && newContent) {
              console.log('[回答中] 新增content:', newContent.length, '字')
              onChunk({ content: newContent, thinking: '' })
              previousContent = mainContent
            } else {
              console.log('[跳过] isInsideThink:', isInsideThink, 'newThinking:', newThinking.length, 'newContent:', newContent.length)
            }
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }

    const latency = Date.now() - startTime

    return {
      content: previousContent,
      thinking: previousThinking,
      model: config.model,
      latency,
      provider: 'ollama'
    }
  }

  /**
   * 生成回复 - 非流式(保留兼容性)
   * @param {string} prompt - 提示词
   * @param {object} options - 可选参数
   * @returns {Promise<object>} 生成结果
   */
  async generate(prompt, options = {}) {
    const currentConfig = this.config.getCurrent()
    const provider = this.config.provider

    console.log(`[UnifiedLLM] 使用${provider.toUpperCase()}生成回复`)

    try {
      let result
      if (provider === 'ollama') {
        result = await this.generateWithOllama(prompt, currentConfig, options)
      } else if (provider === 'vllm') {
        result = await this.generateWithVLLM(prompt, currentConfig, options)
      } else {
        throw new Error(`不支持的LLM提供商: ${provider}`)
      }

      result.content = this.filterThinkTags(result.content)
      return result
    } catch (error) {
      console.error(`[UnifiedLLM] ${provider}生成失败:`, error.message)
      if (error.response) {
        console.error(`[UnifiedLLM] 响应状态:`, error.response.status)
        console.error(`[UnifiedLLM] 响应数据:`, JSON.stringify(error.response.data))
      }

      // 如果vLLM失败,尝试切换到Ollama
      if (provider === 'vllm') {
        console.log('[UnifiedLLM] vLLM失败,尝试切换到Ollama')
        this.config.provider = 'ollama'
        return await this.generate(prompt, options)
      }

      throw error
    }
  }

  /**
   * 使用Ollama生成
   */
  async generateWithOllama(prompt, config, options) {
    const startTime = Date.now()

    const response = await axios.post(
      `${config.baseUrl}/api/generate`,
      {
        model: options.model || config.model,
        prompt,
        stream: false,
        options: {
          temperature: options.temperature || config.options.temperature,
          top_p: options.top_p || config.options.top_p,
          ...config.options
        }
      },
      { timeout: 60000 }
    )

    const latency = Date.now() - startTime

    return {
      content: response.data.response,
      model: response.data.model || config.model,
      usage: {
        prompt_tokens: response.data.prompt_eval_count || 0,
        completion_tokens: response.data.eval_count || 0,
        total_tokens:
          (response.data.prompt_eval_count || 0) +
          (response.data.eval_count || 0)
      },
      latency,
      provider: 'ollama'
    }
  }

  /**
   * 使用vLLM生成
   * vLLM更适合chat接口，将prompt转为消息格式
   */
  async generateWithVLLM(prompt, config, options) {
    const startTime = Date.now()

    const headers = {
      'Content-Type': 'application/json'
    }

    // 如果有API Key，添加到headers
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`
    }

    // 将prompt转换为chat messages格式
    const messages = [
      { role: 'user', content: prompt }
    ]

    const response = await axios.post(
      `${config.baseUrl}/v1/chat/completions`,
      {
        model: options.model || config.model,
        messages,
        temperature: options.temperature || config.options.temperature,
        top_p: options.top_p || config.options.top_p,
        max_tokens: options.max_tokens || config.options.max_tokens,
        stream: false
      },
      {
        headers,
        timeout: 60000  // DeepSeek-V3是大模型，需要更长时间
      }
    )

    const latency = Date.now() - startTime

    return {
      content: response.data.choices[0].message.content,
      model: response.data.model || config.model,
      usage: response.data.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      },
      latency,
      provider: 'vllm'
    }
  }

  /**
   * Chat接口（支持对话历史）
   * @param {Array} messages - 消息历史
   * @param {object} options - 可选参数
   */
  async chat(messages, options = {}) {
    const currentConfig = this.config.getCurrent()
    const provider = this.config.provider

    try {
      if (provider === 'ollama') {
        return await this.chatWithOllama(messages, currentConfig, options)
      } else if (provider === 'vllm') {
        return await this.chatWithVLLM(messages, currentConfig, options)
      } else {
        throw new Error(`不支持的LLM提供商: ${provider}`)
      }
    } catch (error) {
      console.error(`[UnifiedLLM] Chat失败:`, error.message)
      throw error
    }
  }

  /**
   * Ollama Chat API
   */
  async chatWithOllama(messages, config, options) {
    const startTime = Date.now()

    const response = await axios.post(
      `${config.baseUrl}/api/chat`,
      {
        model: options.model || config.model,
        messages,
        stream: false,
        options: {
          temperature: options.temperature || config.options.temperature,
          top_p: options.top_p || config.options.top_p,
          ...config.options
        }
      },
      { timeout: 60000 }
    )

    const latency = Date.now() - startTime

    return {
      content: response.data.message.content,
      model: response.data.model || config.model,
      usage: {
        prompt_tokens: response.data.prompt_eval_count || 0,
        completion_tokens: response.data.eval_count || 0,
        total_tokens:
          (response.data.prompt_eval_count || 0) +
          (response.data.eval_count || 0)
      },
      latency,
      provider: 'ollama'
    }
  }

  /**
   * vLLM Chat API
   */
  async chatWithVLLM(messages, config, options) {
    const startTime = Date.now()

    const headers = {
      'Content-Type': 'application/json'
    }

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`
    }

    const response = await axios.post(
      `${config.baseUrl}/v1/chat/completions`,
      {
        model: options.model || config.model,
        messages,
        temperature: options.temperature || config.options.temperature,
        top_p: options.top_p || config.options.top_p,
        max_tokens: options.max_tokens || config.options.max_tokens,
        stream: false
      },
      {
        headers,
        timeout: 60000  // DeepSeek-V3是大模型，需要更长时间
      }
    )

    const latency = Date.now() - startTime

    return {
      content: response.data.choices[0].message.content,
      model: response.data.model || config.model,
      usage: response.data.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      },
      latency,
      provider: 'vllm'
    }
  }

  /**
   * 流式生成（支持消息数组，用于对话历史）
   * @param {Array} messages - 消息数组
   * @param {object} options - 可选参数
   * @param {function} onChunk - 流式输出回调
   */
  async generateStreamWithMessages(messages, options = {}, onChunk) {
    const currentConfig = this.config.getCurrent()
    const provider = this.config.provider

    console.log(`[UnifiedLLM] 使用${provider.toUpperCase()}流式生成（多轮对话）`)

    try {
      if (provider === 'ollama') {
        return await this.generateStreamOllamaWithMessages(messages, currentConfig, options, onChunk)
      } else if (provider === 'vllm') {
        return await this.generateStreamVLLMWithMessages(messages, currentConfig, options, onChunk)
      } else {
        throw new Error(`不支持的LLM提供商: ${provider}`)
      }
    } catch (error) {
      console.error(`[UnifiedLLM] ${provider}流式生成失败:`, error.message)
      throw error
    }
  }

  /**
   * vLLM流式生成（消息数组）
   */
  async generateStreamVLLMWithMessages(messages, config, options, onChunk) {
    const startTime = Date.now()

    const headers = {
      'Content-Type': 'application/json'
    }

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`
    }

    const requestBody = {
      model: options.model || config.model,
      messages,
      temperature: options.temperature || config.options.temperature,
      top_p: options.top_p || config.options.top_p,
      max_tokens: options.max_tokens || config.options.max_tokens,
      stream: true
    };

    // 支持function calling
    if (options.tools && options.tools.length > 0) {
      requestBody.tools = options.tools;
      console.log(`[vLLM] 传递${options.tools.length}个工具定义`);
    }

    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      throw new Error(`vLLM请求失败: ${response.status} ${response.statusText}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    let fullContent = ''
    let previousContent = ''
    let previousThinking = ''
    let isInsideThink = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(line => line.trim() && line.startsWith('data:'))

      for (const line of lines) {
        const data = line.replace('data: ', '').trim()
        if (data === '[DONE]') break

        try {
          const parsed = JSON.parse(data)

          // 处理tool_calls
          const toolCalls = parsed.choices?.[0]?.delta?.tool_calls || parsed.choices?.[0]?.message?.tool_calls
          if (toolCalls && toolCalls.length > 0) {
            console.log('[vLLM] 检测到工具调用:', JSON.stringify(toolCalls, null, 2))
            onChunk({ tool_calls: toolCalls })
          }

          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            fullContent += content

            if (fullContent.includes('<think>')) {
              isInsideThink = true
            }
            if (fullContent.includes('</think>')) {
              isInsideThink = false
            }

            const { thinking, content: mainContent } = this.extractThinkingAndContent(fullContent)

            const newThinking = thinking.substring(previousThinking.length)
            const newContent = mainContent.substring(previousContent.length)

            if (isInsideThink && newThinking) {
              onChunk({ content: '', thinking: newThinking })
              previousThinking = thinking
            } else if (!isInsideThink && newContent) {
              onChunk({ content: newContent, thinking: '' })
              previousContent = mainContent
            }
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }

    const latency = Date.now() - startTime

    return {
      content: previousContent,
      thinking: previousThinking,
      model: config.model,
      latency,
      provider: 'vllm'
    }
  }

  /**
   * Ollama流式生成（消息数组）
   */
  async generateStreamOllamaWithMessages(messages, config, options, onChunk) {
    const startTime = Date.now()

    // 将消息数组转换为prompt
    const prompt = messages.map(msg => {
      if (msg.role === 'system') return msg.content
      if (msg.role === 'user') return `用户: ${msg.content}`
      if (msg.role === 'assistant') return `助手: ${msg.content}`
      return ''
    }).join('\n\n')

    const response = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model || config.model,
        prompt,
        stream: true,
        options: {
          temperature: options.temperature || config.options.temperature,
          top_p: options.top_p || config.options.top_p,
          ...config.options
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Ollama请求失败: ${response.status} ${response.statusText}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    let fullContent = ''
    let previousContent = ''
    let previousThinking = ''
    let isInsideThink = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(line => line.trim())

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line)
          const content = parsed.response
          if (content) {
            fullContent += content

            if (fullContent.includes('<think>')) {
              isInsideThink = true
            }
            if (fullContent.includes('</think>')) {
              isInsideThink = false
            }

            const { thinking, content: mainContent } = this.extractThinkingAndContent(fullContent)

            const newThinking = thinking.substring(previousThinking.length)
            const newContent = mainContent.substring(previousContent.length)

            if (isInsideThink && newThinking) {
              onChunk({ content: '', thinking: newThinking })
              previousThinking = thinking
            } else if (!isInsideThink && newContent) {
              onChunk({ content: newContent, thinking: '' })
              previousContent = mainContent
            }
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }

    const latency = Date.now() - startTime

    return {
      content: previousContent,
      thinking: previousThinking,
      model: config.model,
      latency,
      provider: 'ollama'
    }
  }

  /**
   * 获取当前使用的LLM信息
   */
  getCurrentProvider() {
    return {
      provider: this.config.provider,
      config: this.config.getCurrent()
    }
  }

  /**
   * 切换LLM提供商
   */
  switchProvider(provider) {
    return this.config.switchProvider(provider)
  }

  /**
   * 流式聊天（用于AI助手）
   * @param {Array} messages - 消息数组
   * @param {Object} options - 配置选项
   * @param {Function} options.onChunk - 接收文本片段的回调
   * @param {Function} options.onComplete - 完成时的回调
   * @param {Function} options.onError - 错误时的回调
   */
  async chatStream(messages, options = {}) {
    const { onChunk, onComplete, onError } = options;

    try {
      await this.generateStreamWithMessages(messages, {}, (chunk) => {
        // generateStreamWithMessages返回 { content, thinking }
        // 我们只需要content部分
        if (chunk.content) {
          onChunk(chunk.content);
        }
      });

      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('[UnifiedLLM] chatStream失败:', error.message);
      if (onError) {
        onError(error);
      } else {
        throw error;
      }
    }
  }
}

module.exports = new UnifiedLLMService()
