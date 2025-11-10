/**
 * DOCX解析服务
 * 解析docx文件，提取章节结构和内容
 */

const mammoth = require('mammoth');
const fs = require('fs').promises;

class DocxParserService {
  /**
   * 解析docx文件，提取章节结构
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object>} 解析结果
   */
  async parseDocx(filePath) {
    try {
      const buffer = await fs.readFile(filePath);

      // 使用mammoth解析docx
      const result = await mammoth.convertToHtml({ buffer });
      const html = result.value;

      // 提取章节结构
      const sections = this._extractSections(html);

      return {
        success: true,
        sections,
        rawHtml: html,
        messages: result.messages,
      };
    } catch (error) {
      console.error('[DocxParser] 解析失败:', error.message);
      return {
        success: false,
        error: error.message,
        sections: [],
      };
    }
  }

  /**
   * 从HTML中提取章节结构
   * @private
   */
  _extractSections(html) {
    const sections = [];

    // 使用正则匹配标题（h1-h6）
    const headingRegex = /<h([1-6])>(.*?)<\/h\1>/gi;
    let match;
    let lastIndex = 0;
    let currentSection = null;

    while ((match = headingRegex.exec(html)) !== null) {
      const level = parseInt(match[1]);
      const title = this._stripHtml(match[2]);

      // 提取当前标题之前的内容作为上一节的内容
      if (currentSection) {
        const content = html.substring(lastIndex, match.index);
        currentSection.content = this._cleanContent(content);
      }

      // 创建新章节
      currentSection = {
        title,
        level,
        content: '',
        children: [],
      };

      // 根据层级关系建立父子关系
      if (level === 1) {
        sections.push(currentSection);
      } else {
        // 找到合适的父章节
        const parent = this._findParentSection(sections, level);
        if (parent) {
          parent.children.push(currentSection);
        } else {
          sections.push(currentSection);
        }
      }

      lastIndex = headingRegex.lastIndex;
    }

    // 处理最后一个章节的内容
    if (currentSection) {
      const content = html.substring(lastIndex);
      currentSection.content = this._cleanContent(content);
    }

    // 如果没有提取到章节，返回整个文档作为一个章节
    if (sections.length === 0) {
      sections.push({
        title: '正文',
        level: 1,
        content: this._cleanContent(html),
        children: [],
      });
    }

    return sections;
  }

  /**
   * 找到合适的父章节
   * @private
   */
  _findParentSection(sections, level) {
    for (let i = sections.length - 1; i >= 0; i--) {
      const section = sections[i];
      if (section.level < level) {
        return section;
      }
      if (section.children && section.children.length > 0) {
        const parent = this._findParentSection(section.children, level);
        if (parent) return parent;
      }
    }
    return null;
  }

  /**
   * 清理HTML内容
   * @private
   */
  _cleanContent(html) {
    if (!html) return '';

    // 移除空标签
    let cleaned = html.replace(/<[^>]+><\/[^>]+>/g, '');

    // 移除多余空白
    cleaned = cleaned.replace(/\n\s*\n/g, '\n');
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * 移除HTML标签
   * @private
   */
  _stripHtml(html) {
    return html.replace(/<[^>]+>/g, '').trim();
  }

  /**
   * 从文件名推断文档类型
   */
  inferDocumentType(filename) {
    const lower = filename.toLowerCase();

    if (lower.includes('可研') || lower.includes('可行性研究')) {
      return 'feasibility_study';
    }
    if (lower.includes('技术规范') || lower.includes('规范')) {
      return 'technical_specification';
    }
    if (lower.includes('设计方案') || lower.includes('方案')) {
      return 'design_proposal';
    }
    if (lower.includes('合同')) {
      return 'contract';
    }
    if (lower.includes('报告')) {
      return 'report';
    }

    return 'general_document';
  }
}

module.exports = new DocxParserService();
