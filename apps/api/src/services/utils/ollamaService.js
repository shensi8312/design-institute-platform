/**
 * Ollama LLM服务 - 真实实现
 * 使用本地Ollama进行规则提取
 */

const axios = require('axios');

class OllamaService {
  constructor() {
    this.baseURL = 'http://localhost:11434';
    this.model = 'qwen2:1.5b'; // 使用已安装的模型
  }

  /**
   * 调用Ollama生成响应
   * @param {string} prompt - 提示词
   * @param {Object} options - 可选参数，包括images等
   */
  async generate(prompt, options = {}) {
    try {
      // 构建请求体
      const requestBody = {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 2000
        }
      };

      // 如果有图像，添加到请求中
      if (options.images && Array.isArray(options.images)) {
        // 注意：需要使用支持视觉的模型，如llava或bakllava
        requestBody.model = 'llava:latest'; // 或使用其他视觉模型
        requestBody.images = options.images;
        console.log('使用视觉模型处理图像');
      }

      const response = await axios.post(`${this.baseURL}/api/generate`, requestBody);

      return response.data.response;
    } catch (error) {
      console.error('Ollama调用失败:', error.message);
      
      // 如果是图像处理失败，提供更详细的错误信息
      if (options.images && error.response?.status === 400) {
        console.error('图像处理失败，可能原因：');
        console.error('1. Ollama未安装视觉模型（如llava）');
        console.error('2. 图像格式不受支持');
        console.error('3. 图像数据损坏');
        console.error('运行以下命令安装视觉模型: ollama pull llava');
      }
      
      throw error;
    }
  }

  /**
   * 从文本中智能提取规则
   */
  async extractRulesFromText(text, engineType) {
    const prompt = `你是一个建筑规范专家。请从以下文本中提取${engineType}相关的规则。

文本内容：
${text}

请按以下JSON格式返回提取的规则（只返回JSON，不要其他文字）：
[
  {
    "name": "规则名称",
    "category": "规则类别",
    "description": "规则描述",
    "conditions": [
      {"field": "字段名", "operator": "操作符", "value": "值"}
    ],
    "actions": [
      {"type": "动作类型", "target": "目标", "value": "值", "unit": "单位"}
    ],
    "source": "来源",
    "confidence": 0.95
  }
]

提取要求：
1. 容积率相关规则：寻找"容积率≤X"这样的模式
2. 建筑密度规则：寻找"建筑密度≤X%"
3. 绿地率规则：寻找"绿地率≥X%"
4. 建筑间距规则：寻找"间距不小于X米"或"X倍建筑高度"
5. 退线距离规则：寻找"退线X米"

只返回JSON数组，不要解释。`;

    try {
      const response = await this.generate(prompt);
      
      // 尝试解析JSON
      let rules = [];
      try {
        // 提取JSON部分
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          rules = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.log('JSON解析失败，使用正则提取');
        // 如果JSON解析失败，使用备用的正则提取
        rules = this.extractWithRegex(text, engineType);
      }

      return rules;
    } catch (error) {
      console.error('LLM提取失败，使用正则备用方案');
      return this.extractWithRegex(text, engineType);
    }
  }

  /**
   * 理解引擎意图
   */
  async understandEngineIntent(engineName) {
    const prompt = `分析"${engineName}"的含义和用途。

请按以下格式回答：
1. 主要用途：
2. 相关概念：（列出5-8个相关概念）
3. 相关规范：（列出可能的规范名称）
4. 关键指标：（列出需要控制的指标）

简洁回答，每项不超过50字。`;

    try {
      const response = await this.generate(prompt);
      
      // 解析响应
      const intent = {
        primaryIntent: '',
        concepts: [],
        standards: [],
        metrics: []
      };

      const lines = response.split('\n');
      let currentSection = '';
      
      for (const line of lines) {
        if (line.includes('主要用途')) {
          currentSection = 'intent';
          intent.primaryIntent = line.replace(/.*：/, '').trim();
        } else if (line.includes('相关概念')) {
          currentSection = 'concepts';
        } else if (line.includes('相关规范')) {
          currentSection = 'standards';
        } else if (line.includes('关键指标')) {
          currentSection = 'metrics';
        } else if (line.trim()) {
          const content = line.replace(/^\d+\./, '').replace(/^-/, '').trim();
          if (content) {
            switch(currentSection) {
              case 'concepts':
                intent.concepts.push(content);
                break;
              case 'standards':
                intent.standards.push(content);
                break;
              case 'metrics':
                intent.metrics.push(content);
                break;
            }
          }
        }
      }

      return intent;
    } catch (error) {
      console.error('意图理解失败:', error);
      // 返回默认值
      if (engineName.includes('强排')) {
        return {
          primaryIntent: '建筑总图强制性排布优化',
          concepts: ['容积率', '建筑密度', '绿地率', '日照间距', '消防间距'],
          standards: ['控规', 'GB50180', 'GB50016'],
          metrics: ['FAR', 'density', 'green_ratio', 'spacing']
        };
      }
      return {
        primaryIntent: engineName,
        concepts: [],
        standards: [],
        metrics: []
      };
    }
  }

  /**
   * 扩展搜索关键词
   */
  async expandKeywords(concepts) {
    const prompt = `扩展以下建筑概念的相关关键词：
${concepts.join(', ')}

为每个概念提供2-3个同义词或相关词，用逗号分隔。`;

    try {
      const response = await this.generate(prompt);
      const expanded = response.split(/[,，\n]/).map(s => s.trim()).filter(s => s);
      return [...new Set([...concepts, ...expanded])];
    } catch (error) {
      console.error('关键词扩展失败:', error);
      return concepts;
    }
  }

  /**
   * 验证规则合理性
   */
  async validateRule(rule) {
    const prompt = `判断以下建筑规则是否合理：
规则：${rule.description}
条件：${JSON.stringify(rule.conditions)}
动作：${JSON.stringify(rule.actions)}

回答"合理"或"不合理"，并简述原因（不超过20字）。`;

    try {
      const response = await this.generate(prompt);
      const isValid = response.includes('合理') && !response.includes('不合理');
      return {
        valid: isValid,
        reason: response.substring(0, 50)
      };
    } catch (error) {
      console.error('规则验证失败:', error);
      return { valid: true, reason: '无法验证' };
    }
  }

  /**
   * 备用的正则提取方法
   */
  extractWithRegex(text, engineType) {
    const rules = [];
    
    // 容积率提取
    const farPattern = /容积率[≤<]\s*([\d.]+)/g;
    let match;
    while ((match = farPattern.exec(text)) !== null) {
      rules.push({
        name: '容积率限制',
        category: '用地指标',
        description: `容积率不超过${match[1]}`,
        conditions: [{ field: 'land.type', operator: '!=', value: 'null' }],
        actions: [{ type: 'setMaxValue', target: '容积率', value: parseFloat(match[1]) }],
        source: 'regex提取',
        confidence: 0.8
      });
    }

    // 建筑密度提取
    const densityPattern = /建筑密度[≤<]\s*([\d.]+)%/g;
    while ((match = densityPattern.exec(text)) !== null) {
      rules.push({
        name: '建筑密度限制',
        category: '用地指标',
        description: `建筑密度不超过${match[1]}%`,
        conditions: [{ field: 'land.type', operator: '!=', value: 'null' }],
        actions: [{ type: 'setMaxValue', target: '建筑密度', value: parseFloat(match[1]), unit: '%' }],
        source: 'regex提取',
        confidence: 0.8
      });
    }

    // 绿地率提取
    const greenPattern = /绿地率[≥>]\s*([\d.]+)%/g;
    while ((match = greenPattern.exec(text)) !== null) {
      rules.push({
        name: '绿地率要求',
        category: '用地指标',
        description: `绿地率不低于${match[1]}%`,
        conditions: [{ field: 'project.type', operator: '==', value: '新建' }],
        actions: [{ type: 'setMinValue', target: '绿地率', value: parseFloat(match[1]), unit: '%' }],
        source: 'regex提取',
        confidence: 0.8
      });
    }

    return rules;
  }

  /**
   * 测试Ollama连接
   */
  async testConnection() {
    try {
      const response = await axios.get(`${this.baseURL}/api/tags`);
      const models = response.data.models || [];
      console.log('Ollama连接成功，可用模型:', models.map(m => m.name));
      return true;
    } catch (error) {
      console.error('Ollama连接失败:', error.message);
      return false;
    }
  }
}

module.exports = new OllamaService();