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
      max_tokens: 2048
    }
  },

  // QwenVL多模态配置（从环境变量读取）
  qwenVL: {
    baseUrl: process.env.QWENVL_URL,
    model: process.env.QWENVL_MODEL,
    apiKey: process.env.QWENVL_API_KEY || '',
    options: {
      temperature: 0.0,      // ✅ 降到0消除随机性
      max_tokens: 6000,      // ✅ 修复：模型限制8192-693输入=7499，设为6000安全
      maxImageWidth: 2048,   // ✅ 2K分辨率（配合viewportScale=1.5控制tokens）
      maxImageHeight: 2048   // ✅ 2K分辨率
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