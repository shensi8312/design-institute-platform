/**
 * LLM服务 - 统一的大语言模型接口
 */

const { LLMConfig, autoDetectLLM } = require('../../config/llm.config');
const axios = require('axios');

class LLMService {
  constructor() {
    this.initialized = false;
  }
  
  /**
   * 初始化LLM服务
   */
  async initialize() {
    if (!this.initialized) {
      await autoDetectLLM();
      this.initialized = true;
    }
  }
  
  /**
   * 发送消息到LLM
   * @param {string} message - 用户消息
   * @param {Array} context - 上下文（可选）
   * @returns {Promise<string>} - AI回复
   */
  async sendMessage(message, context = []) {
    await this.initialize();
    
    const config = LLMConfig.getCurrent();
    const provider = LLMConfig.provider;
    
    if (provider === 'ollama') {
      return await this.sendToOllama(message, context, config);
    } else if (provider === 'vllm') {
      return await this.sendToVLLM(message, context, config);
    } else {
      throw new Error('没有可用的LLM服务，请先启动Ollama或配置VLLM');
    }
  }
  
  /**
   * 发送到Ollama
   */
  async sendToOllama(message, context, config) {
    // 如果context为空且message包含明确的指令格式，直接使用message作为prompt
    const isStructuredPrompt = message.includes('文档内容：') || message.includes('用户问题：');
    const prompt = isStructuredPrompt ? message : this.buildPrompt(message, context);
    
    const response = await axios.post(
      `${config.baseUrl}/api/generate`,
      {
        model: config.model,
        prompt: prompt,
        stream: false,
        options: config.options
      },
      {
        timeout: 60000  // 增加到60秒
      }
    );
    
    return response.data.response;
  }
  
  /**
   * 发送到VLLM
   */
  async sendToVLLM(message, context, config) {
    const messages = [
      { role: 'system', content: '你是一个专业的建筑设计AI助手。' },
      ...context.map(c => ({
        role: c.role || 'user',
        content: c.content
      })),
      { role: 'user', content: message }
    ];
    
    const response = await axios.post(
      `${config.baseUrl}/v1/chat/completions`,
      {
        model: config.model,
        messages: messages,
        temperature: config.options.temperature,
        top_p: config.options.top_p,
        max_tokens: config.options.max_tokens
      },
      {
        headers: config.apiKey ? {
          'Authorization': `Bearer ${config.apiKey}`
        } : {},
        timeout: 30000
      }
    );
    
    return response.data.choices[0].message.content;
  }
  
  /**
   * 构建提示词
   */
  buildPrompt(message, context) {
    let prompt = '你是一个专业的建筑设计AI助手。\n\n';
    
    if (context.length > 0) {
      prompt += '对话历史:\n';
      context.forEach(c => {
        prompt += `${c.role === 'assistant' ? 'AI' : '用户'}: ${c.content}\n`;
      });
      prompt += '\n';
    }
    
    prompt += `用户: ${message}\nAI:`;
    return prompt;
  }
  
  
  /**
   * 生成嵌入向量
   * @param {string} text - 要嵌入的文本
   * @returns {Promise<Array>} - 向量
   */
  async generateEmbedding(text) {
    await this.initialize();
    
    const provider = LLMConfig.provider;
    
    try {
      if (provider === 'ollama') {
        const config = LLMConfig.getCurrent();
        const response = await axios.post(
          `${config.baseUrl}/api/embeddings`,
          {
            model: 'nomic-embed-text',  // 使用专门的嵌入模型
            prompt: text
          }
        );
        return response.data.embedding;
      }
      // VLLM或其他情况，返回随机向量
      return Array(768).fill(0).map(() => Math.random());
    } catch (error) {
      console.error('生成嵌入向量失败:', error);
      // 返回随机向量作为备用
      return Array(768).fill(0).map(() => Math.random());
    }
  }
  
  /**
   * 获取当前LLM状态
   */
  getStatus() {
    return {
      provider: LLMConfig.provider,
      config: LLMConfig.getCurrent(),
      initialized: this.initialized
    };
  }
}

// 导出单例
module.exports = new LLMService();