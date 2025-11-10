/**
 * 文档AI服务
 * 核心：集成所有AI能力
 */

const DocumentDomainConfig = require('../../config/DocumentDomainConfig');
const UnifiedLLMService = require('../llm/UnifiedLLMService');
const knex = require('../../config/database');

class DocumentAIService {
  constructor() {
    this.domainConfig = DocumentDomainConfig;
    this.llmService = UnifiedLLMService;
  }

  /**
   * 调用AI能力
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async invokeAICapability({
    documentType,
    capabilityId,
    inputData,
    userId
  }) {
    // 检查能力是否支持
    if (!this.domainConfig.hasAICapability(documentType, capabilityId)) {
      throw new Error(`文档类型 ${documentType} 不支持AI能力 ${capabilityId}`);
    }

    // 获取能力配置
    const capabilities = this.domainConfig.getAICapabilities(documentType);
    const capability = capabilities.find(c => c.id === capabilityId);

    // 调用对应的处理方法
    let result;
    switch (capabilityId) {
      case 'generate_content':
        result = await this._generateContent(capability, inputData);
        break;
      case 'improve_writing':
        result = await this._improveWriting(capability, inputData);
        break;
      case 'check_consistency':
        result = await this._checkConsistency(capability, inputData);
        break;
      case 'detect_risk':
        result = await this._detectRisk(capability, inputData);
        break;
      case 'extract_key_terms':
        result = await this._extractKeyTerms(capability, inputData);
        break;
      // TODO: 其他AI能力
      default:
        result = await this._genericAICall(capability, inputData);
    }

    // 记录AI使用历史
    await this._recordAIHistory({
      documentId: inputData.documentId,
      sectionId: inputData.sectionId,
      taskType: capabilityId,
      inputData,
      outputData: result,
      llmModel: capability.llmModel,
      createdBy: userId,
    });

    return result;
  }

  /**
   * 生成章节内容
   * @private
   */
  async _generateContent(capability, inputData) {
    const { sectionCode, title, projectInfo, historicalReferences } = inputData;

    // 构建prompt
    let prompt = capability.promptTemplate
      .replace('{{sectionCode}}', sectionCode || '')
      .replace('{{title}}', title || '')
      .replace('{{projectInfo}}', JSON.stringify(projectInfo || {}))
      .replace('{{historicalReferences}}', historicalReferences || '无');

    // 调用LLM - 使用环境变量配置的默认模型
    const messages = [{ role: 'user', content: prompt }];
    const response = await this.llmService.chat(messages);

    return {
      content: response.content,
      confidence: 0.85,
    };
  }

  /**
   * 改进写作
   * @private
   */
  async _improveWriting(capability, inputData) {
    const { content } = inputData;

    const prompt = `请优化以下文本的语言表达，提高专业性和规范性：\n\n${content}`;

    const messages = [{ role: 'user', content: prompt }];
    const response = await this.llmService.chat(messages);

    return {
      improved_content: response.content,
      suggestions: [],
    };
  }

  /**
   * 一致性检查
   * @private
   */
  async _checkConsistency(capability, inputData) {
    const { documentId, sectionId } = inputData;

    // 获取所有章节内容
    const sections = await knex('document_sections')
      .where({ document_id: documentId })
      .select('id', 'title', 'content');

    const fullText = sections.map(s => `${s.title}: ${s.content || ''}`).join('\n\n');

    const prompt = `请检查以下文本中术语、单位、标准引用的一致性，列出所有不一致的地方：\n\n${fullText}`;

    const messages = [{ role: 'user', content: prompt }];
    const response = await this.llmService.chat(messages);

    return {
      report: response.content,
      inconsistencies: [],
      recommendations: [],
    };
  }

  /**
   * 法律风险识别（合同专用）
   * @private
   */
  async _detectRisk(capability, inputData) {
    const { content } = inputData;

    const prompt = `作为法律专家，请识别以下合同条款中的法律风险点：\n\n${content}\n\n请列出风险点、风险等级和建议。`;

    const messages = [{ role: 'user', content: prompt }];
    const response = await this.llmService.chat(messages);

    return {
      risks: [],
      report: response.content,
    };
  }

  /**
   * 提取关键条款（合同专用）
   * @private
   */
  async _extractKeyTerms(capability, inputData) {
    const { content } = inputData;

    const prompt = `从以下合同中提取关键条款，包括：合同主体、金额、付款条件、工期、违约责任等：\n\n${content}`;

    const messages = [{ role: 'user', content: prompt }];
    const response = await this.llmService.chat(messages);

    return {
      keyTerms: {},
      report: response.content,
    };
  }

  /**
   * 通用AI调用
   * @private
   */
  async _genericAICall(capability, inputData) {
    const prompt = JSON.stringify(inputData);

    const messages = [{ role: 'user', content: prompt }];
    const response = await this.llmService.chat(messages);

    return {
      result: response.content,
    };
  }

  /**
   * 记录AI使用历史
   * @private
   */
  async _recordAIHistory(data) {
    try {
      await knex('ai_generation_history').insert({
        document_id: data.documentId,
        section_id: data.sectionId,
        task_type: data.taskType,
        input_data: JSON.stringify(data.inputData),
        output_data: JSON.stringify(data.outputData),
        llm_model: data.llmModel,
        created_by: data.createdBy,
      });
    } catch (error) {
      console.error('[DocumentAIService] 记录AI历史失败:', error.message);
    }
  }

  /**
   * 清理LLM响应内容，移除思考过程标签
   * @private
   */
  _cleanLLMResponse(content) {
    if (!content) return '';

    // 移除 <think>...</think> 标签及其内容
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '');

    // 移除其他可能的元标签
    cleaned = cleaned.replace(/<\/think>/gi, '');
    cleaned = cleaned.replace(/<think>/gi, '');

    // 清理多余的空行
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    return cleaned.trim();
  }

  /**
   * AI对话助手 - 流式响应
   */
  async chatAssist({ documentId, sectionId, userMessage, context, userId, onChunk, onComplete, onError }) {
    try {
      // 构建系统提示
      const systemPrompt = `你是一个专业的文档写作助手。当前正在编辑的文档章节：

章节标题：${context.sectionTitle}
文档类型：${context.documentType}
当前内容：${context.currentContent || '（空白）'}

用户可能会要求你：
1. 生成新内容
2. 改进现有内容
3. 扩展内容细节
4. 调整语言风格
5. 检查内容质量

请根据用户的需求，提供专业、规范的内容。
**重要**：直接给出内容，不要包含解释性文字。`;

      // 构建对话历史
      const messages = [
        { role: 'system', content: systemPrompt },
      ];

      // 添加历史对话（最多4轮）
      if (context.conversationHistory && context.conversationHistory.length > 0) {
        context.conversationHistory.forEach((msg) => {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
        });
      }

      // 添加当前用户消息
      messages.push({
        role: 'user',
        content: userMessage,
      });

      // 流式调用LLM
      let isInThinkBlock = false;
      let thinkBuffer = '';
      let hasStartedThinking = false;

      await this.llmService.chatStream(messages, {
        onChunk: (text) => {
          // 检测思考开始
          if (text.includes('<think>')) {
            isInThinkBlock = true;
            if (!hasStartedThinking) {
              hasStartedThinking = true;
              onChunk('__THINKING__'); // 发送思考标记
            }
            thinkBuffer = '';
          }

          if (isInThinkBlock) {
            thinkBuffer += text;
            if (thinkBuffer.includes('</think>')) {
              isInThinkBlock = false;
              hasStartedThinking = false;
              onChunk('__THINKING_DONE__'); // 发送思考完成标记
              const afterThink = thinkBuffer.split('</think>')[1];
              if (afterThink) {
                onChunk(afterThink);
              }
              thinkBuffer = '';
            }
          } else {
            onChunk(text);
          }
        },
        onComplete: () => {
          onComplete();
        },
        onError: (error) => {
          onError(error);
        },
      });
    } catch (error) {
      onError(error);
    }
  }
}

module.exports = new DocumentAIService();
