/**
 * CSI 内容匹配服务
 * 使用 AI 将公司 SPEC 内容自动匹配到 CSI 框架
 */

const knex = require('../../config/database');
const UnifiedLLMService = require('../llm/UnifiedLLMService');

class CSIContentMatcher {
  constructor() {
    this.llmService = UnifiedLLMService;
  }

  /**
   * 匹配公司 SPEC 内容到 CSI 框架
   * @param {Object} params
   * @param {string} params.content - 内容文本
   * @param {string} params.sectionCode - 目标 Section 编号 (如 092900)
   * @param {string} params.sourceName - 来源名称
   * @param {string} params.sourceTemplateId - 来源模板ID
   * @returns {Promise<Object>} 匹配结果
   */
  async matchContent({ content, sectionCode, sourceName, sourceTemplateId }) {
    // 1. 获取该 Section 的 CSI 框架
    const framework = await knex('spec_csi_framework')
      .where({ section_code: sectionCode })
      .orderBy('sort_order');

    if (framework.length === 0) {
      throw new Error(`CSI 框架不存在: ${sectionCode}`);
    }

    // 2. 构建框架目录供 AI 参考
    const frameworkOutline = this._buildFrameworkOutline(framework);

    // 3. 调用 AI 匹配
    const matchResult = await this._aiMatch(content, frameworkOutline, sectionCode);

    // 4. 处理匹配结果
    return this._processMatchResult(matchResult, {
      sectionCode,
      sourceName,
      sourceTemplateId,
      framework
    });
  }

  /**
   * 批量匹配内容块
   * @param {Array} contentBlocks - 内容块数组
   * @param {string} sectionCode - Section 编号
   * @param {Object} sourceInfo - 来源信息
   * @returns {Promise<Object>} 匹配统计
   */
  async batchMatch(contentBlocks, sectionCode, sourceInfo) {
    const results = {
      matched: [],
      unmatched: [],
      newSections: []
    };

    for (const block of contentBlocks) {
      try {
        const result = await this.matchContent({
          content: block.content,
          sectionCode,
          sourceName: sourceInfo.name,
          sourceTemplateId: sourceInfo.templateId
        });

        if (result.matched) {
          results.matched.push({
            ...result,
            content: block.content
          });
        } else if (result.suggestedNew) {
          results.newSections.push({
            ...result,
            content: block.content
          });
        } else {
          results.unmatched.push({ block, reason: result.reason });
        }
      } catch (error) {
        results.unmatched.push({ block, reason: error.message });
      }
    }

    return results;
  }

  /**
   * AI 匹配内容到框架
   * @private
   */
  async _aiMatch(content, frameworkOutline, sectionCode) {
    const prompt = `你是 CSI MasterFormat 规范专家。请分析以下内容，将其匹配到 CSI 框架的正确位置。

## CSI Section: ${sectionCode}

## 框架目录：
${frameworkOutline}

## 待匹配内容：
${content}

## 任务：
1. 分析内容属于哪个层级（PART/Article/Paragraph）
2. 找到最匹配的框架位置（返回 full_code）
3. 如果没有合适位置，建议新增章节

## 返回格式（JSON）：
{
  "matched": true/false,
  "fullCode": "匹配到的 full_code，如 092900.1.1.A",
  "confidence": 0.0-1.0,
  "reason": "匹配理由",
  "suggestedNew": {
    "parentCode": "父节点 full_code",
    "levelType": "建议层级类型 ART/PR1/PR2 等",
    "titleZh": "建议的中文标题",
    "titleEn": "建议的英文标题"
  }
}

只返回 JSON，不要其他内容。`;

    try {
      const response = await this.llmService.generateText(prompt, {
        temperature: 0.1,
        maxTokens: 1000
      });

      // 解析 JSON 响应
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return { matched: false, reason: '无法解析 AI 响应' };
    } catch (error) {
      console.error('[CSI匹配] AI调用失败:', error);
      return { matched: false, reason: error.message };
    }
  }

  /**
   * 处理匹配结果
   * @private
   */
  async _processMatchResult(matchResult, context) {
    const { sectionCode, sourceName, sourceTemplateId, framework } = context;

    if (matchResult.matched && matchResult.fullCode) {
      // 找到匹配的框架节点
      const frameworkNode = framework.find(n => n.full_code === matchResult.fullCode);

      if (frameworkNode) {
        return {
          matched: true,
          frameworkId: frameworkNode.id,
          frameworkCode: frameworkNode.full_code,
          confidence: matchResult.confidence || 0.8,
          reason: matchResult.reason
        };
      }
    }

    // 建议新增章节
    if (matchResult.suggestedNew) {
      return {
        matched: false,
        suggestedNew: true,
        suggestion: {
          sectionCode,
          parentCode: matchResult.suggestedNew.parentCode,
          levelType: matchResult.suggestedNew.levelType,
          titleZh: matchResult.suggestedNew.titleZh,
          titleEn: matchResult.suggestedNew.titleEn,
          sourceName,
          sourceTemplateId
        }
      };
    }

    return {
      matched: false,
      reason: matchResult.reason || '无法匹配'
    };
  }

  /**
   * 自动创建新章节
   * @param {Object} suggestion - 新章节建议
   * @returns {Promise<Object>} 创建的章节
   */
  async createCustomSection(suggestion) {
    const {
      sectionCode,
      parentCode,
      levelType,
      titleZh,
      titleEn,
      sourceName,
      sourceTemplateId,
      originalContent
    } = suggestion;

    if (!sectionCode) {
      throw new Error('缺少 sectionCode，无法创建自定义章节');
    }

    const normalizedParentCode = parentCode || sectionCode;

    // 计算新编号
    const customCode = await this._generateCustomCode(sectionCode, normalizedParentCode, levelType);

    // 计算层级
    const levelMap = {
      'ART': 3,
      'PR1': 4,
      'PR2': 5,
      'PR3': 6,
      'PR4': 7,
      'PR5': 8
    };

    const [created] = await knex('spec_custom_sections').insert({
      section_code: sectionCode,
      custom_code: customCode,
      parent_code: normalizedParentCode,
      level: levelMap[levelType] || 3,
      level_type: levelType,
      level_label: this._generateLevelLabel(levelType, customCode),
      title_zh: titleZh,
      title_en: titleEn,
      source_name: sourceName,
      source_template_id: sourceTemplateId,
      is_approved: false,
      usage_count: 1
    }).returning('*');

    // 将自定义章节内容也写入 spec_contents，便于后续融合和展示
    if (originalContent) {
      await knex('spec_contents').insert({
        framework_id: null,
        framework_code: customCode,
        source_type: 'COMPANY',
        source_name: sourceName,
        source_template_id: sourceTemplateId,
        content_zh: originalContent,
        ai_confidence: 1,
        match_status: 'auto',
        is_master: false
      });
    }

    return created;
  }

  /**
   * 保存匹配的内容
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async saveContent({
    frameworkId,
    frameworkCode,
    sourceType,
    sourceName,
    sourceTemplateId,
    contentEn,
    contentZh,
    contentHtml,
    confidence
  }) {
    const [content] = await knex('spec_contents').insert({
      framework_id: frameworkId,
      framework_code: frameworkCode,
      source_type: sourceType,
      source_name: sourceName,
      source_template_id: sourceTemplateId,
      content_en: contentEn,
      content_zh: contentZh,
      content_html: contentHtml,
      ai_confidence: confidence,
      match_status: confidence > 0.9 ? 'auto' : 'pending',
      is_master: false
    }).returning('*');

    return content;
  }

  /**
   * 生成融合版本
   * @param {string} frameworkCode - 框架编号
   * @returns {Promise<Object>}
   */
  async generateMasterContent(frameworkCode) {
    // 获取所有来源的内容
    const contents = await knex('spec_contents')
      .where({ framework_code: frameworkCode, is_master: false })
      .orderBy('created_at');

    if (contents.length === 0) {
      throw new Error('没有可融合的内容');
    }

    // 调用 AI 融合
    const merged = await this._aiMerge(contents);

    // 保存融合结果
    const [master] = await knex('spec_contents').insert({
      framework_code: frameworkCode,
      framework_id: contents[0].framework_id,
      source_type: 'MASTER',
      source_name: '融合版本',
      content_en: merged.contentEn,
      content_zh: merged.contentZh,
      content_html: merged.contentHtml,
      is_master: true,
      match_status: 'auto',
      metadata: JSON.stringify({
        sources: contents.map(c => c.id),
        mergedAt: new Date().toISOString()
      })
    }).returning('*');

    return master;
  }

  /**
   * AI 融合多个来源的内容
   * @private
   */
  async _aiMerge(contents) {
    const sourcesText = contents.map((c, i) => {
      const text = c.content_zh || c.content_en || '';
      return `来源 ${i + 1} (${c.source_name || c.source_type}):\n${text}`;
    }).join('\n\n---\n\n');

    const prompt = `你是技术规范专家。请融合以下多个来源的内容，生成一个标准化的版本。

## 多个来源内容：
${sourcesText}

## 要求：
1. 保留所有来源的有价值信息
2. 去除重复内容
3. 统一术语和格式
4. 使用专业的中文表述
5. 保持 CSI 格式规范

## 返回格式（JSON）：
{
  "contentZh": "融合后的中文内容",
  "contentEn": "融合后的英文内容（如有）",
  "contentHtml": "HTML格式内容"
}

只返回 JSON。`;

    try {
      const response = await this.llmService.generateText(prompt, {
        temperature: 0.3,
        maxTokens: 4000
      });

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('无法解析融合结果');
    } catch (error) {
      console.error('[CSI融合] AI调用失败:', error);
      // 降级：简单拼接
      return {
        contentZh: contents.map(c => c.content_zh || '').filter(Boolean).join('\n\n'),
        contentEn: contents.map(c => c.content_en || '').filter(Boolean).join('\n\n'),
        contentHtml: ''
      };
    }
  }

  /**
   * 生成自定义编号
   * @private
   */
  async _generateCustomCode(sectionCode, parentCode, levelType) {
    // 获取同级最大编号
    const existing = await knex('spec_custom_sections')
      .where({ section_code: sectionCode, parent_code: parentCode })
      .orderBy('custom_code', 'desc')
      .first();

    if (existing) {
      // 递增编号
      const lastNum = parseInt(existing.custom_code.split('.').pop()) || 0;
      return `${parentCode}.${lastNum + 1}`;
    }

    // 第一个自定义章节，从 10 开始（避免与标准章节冲突）
    return `${parentCode}.10`;
  }

  /**
   * 生成层级标签
   * @private
   */
  _generateLevelLabel(levelType, customCode) {
    const num = customCode.split('.').pop();
    const numInt = parseInt(num, 10);
    const safeLetter = (baseCharCode, n) => {
      // 超过26时直接返回数字，避免溢出到非字母字符
      if (Number.isNaN(n) || n < 1 || n > 26) return `${num}.`;
      return String.fromCharCode(baseCharCode + n - 1);
    };

    switch (levelType) {
      case 'ART':
        return num;
      case 'PR1':
        return `${safeLetter(65, numInt)}.`;
      case 'PR2':
        return num + '.';
      case 'PR3':
        return `${safeLetter(97, numInt).toLowerCase()}.`;
      case 'PR4':
        return num + ')';
      case 'PR5':
        return `${safeLetter(97, numInt).toLowerCase()})`;
      default:
        return num;
    }
  }

  /**
   * 构建框架目录文本
   * @private
   */
  _buildFrameworkOutline(framework) {
    const lines = [];

    for (const node of framework) {
      const indent = '  '.repeat(node.level - 1);
      const label = node.level_label || '';
      const title = node.title_en || node.title_zh || '';

      lines.push(`${indent}${label} ${title} [${node.full_code}]`);
    }

    return lines.join('\n');
  }
}

module.exports = new CSIContentMatcher();
