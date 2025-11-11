/**
 * LLM配置 - 从环境变量读取，不设默认值
 * 如果环境变量未配置，启动时会检查并报错
 */

const LLMConfig = {
  // 当前使用的LLM类型: 'ollama' | 'vllm' | 'qwenVL'
  provider: process.env.LLM_PROVIDER || 'vllm',

  // Ollama本地配置
  ollama: {
    baseUrl: process.env.OLLAMA_URL,
    model: process.env.OLLAMA_MODEL,
    options: {
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 4096
    }
  },

  // VLLM远程配置（从环境变量读取）
  vllm: {
    baseUrl: process.env.VLLM_URL,
    model: process.env.VLLM_MODEL,
    apiKey: process.env.VLLM_API_KEY || '',
    options: {
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 4000
    }
  },

  // QwenVL多模态配置（从环境变量读取）
  qwenVL: {
    baseUrl: process.env.QWENVL_URL,
    model: process.env.QWENVL_MODEL,
    apiKey: process.env.QWENVL_API_KEY || '',
    options: {
      temperature: 0.1,
      max_tokens: 8000,  // 增加到8000支持40+组件的JSON输出
      maxImageWidth: 4096,  // 提高图片分辨率保留细节
      maxImageHeight: 4096
    }
  },

  // 获取当前配置
  getCurrent() {
    return this[this.provider];
  },

  // 切换提供者
  switchProvider(provider) {
    if (['ollama', 'vllm', 'qwenVL'].includes(provider)) {
      this.provider = provider;
      console.log(`✅ 切换到 ${provider} LLM服务`);
      return true;
    }
    return false;
  }
};

module.exports = { LLMConfig };