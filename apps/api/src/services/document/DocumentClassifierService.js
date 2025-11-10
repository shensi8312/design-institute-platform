const UnifiedLLMService = require('../llm/UnifiedLLMService');

/**
 * 文档自动分类服务
 * 基于LLM分析文档内容，自动匹配合适的分类
 */
class DocumentClassifierService {
  constructor() {
    this.db = require('../../config/database');
  }

  /**
   * 自动分类文档
   * @param {string} documentId - 文档ID
   * @param {string} content - 文档内容
   * @param {string} fileName - 文件名
   * @param {string} organizationId - 组织ID
   * @returns {Promise<{success: boolean, categoryId?: string, categoryName?: string, confidence?: number}>}
   */
  async classifyDocument(documentId, content, fileName, organizationId) {
    try {
      console.log('[DocumentClassifier] 开始分类文档:', documentId);

      // 1. 获取组织的所有活跃分类
      const categories = await this.db('knowledge_categories')
        .where({
          organization_id: organizationId,
          status: 'active'
        })
        .whereNull('deleted_at')
        .select('id', 'name', 'code', 'description', 'parent_id')
        .orderBy('sort', 'asc');

      if (categories.length === 0) {
        console.log('[DocumentClassifier] 未找到可用分类');
        return {
          success: false,
          message: '组织没有可用的文档分类'
        };
      }

      // 2. 构建分类层级结构（便于LLM理解）
      const categoryTree = this._buildCategoryTree(categories);

      // 3. 准备文档内容摘要（避免内容过长）
      const contentSummary = this._extractContentSummary(content, fileName);

      // 4. 使用LLM进行分类
      const classificationResult = await this._classifyWithLLM(
        contentSummary,
        categoryTree,
        categories
      );

      if (!classificationResult.success) {
        return classificationResult;
      }

      // 5. 更新文档的分类ID
      await this.db('knowledge_documents')
        .where({ id: documentId })
        .update({
          category_id: classificationResult.categoryId,
          updated_at: this.db.fn.now()
        });

      console.log('[DocumentClassifier] 分类成功:', {
        documentId,
        categoryId: classificationResult.categoryId,
        categoryName: classificationResult.categoryName,
        confidence: classificationResult.confidence
      });

      return classificationResult;

    } catch (error) {
      console.error('[DocumentClassifier] 分类失败:', error);
      return {
        success: false,
        message: '文档分类失败',
        error: error.message
      };
    }
  }

  /**
   * 构建分类层级树
   */
  _buildCategoryTree(categories) {
    const categoryMap = {};
    const rootCategories = [];

    // 创建映射
    categories.forEach(cat => {
      categoryMap[cat.id] = {
        ...cat,
        children: []
      };
    });

    // 构建树形结构
    categories.forEach(cat => {
      if (cat.parent_id && categoryMap[cat.parent_id]) {
        categoryMap[cat.parent_id].children.push(categoryMap[cat.id]);
      } else {
        rootCategories.push(categoryMap[cat.id]);
      }
    });

    return rootCategories;
  }

  /**
   * 提取文档内容摘要
   */
  _extractContentSummary(content, fileName) {
    if (!content || content.trim().length === 0) {
      return `文件名: ${fileName}`;
    }

    // 取前2000字符作为摘要
    const summary = content.substring(0, 2000).trim();

    return `文件名: ${fileName}\n\n内容摘要:\n${summary}`;
  }

  /**
   * 使用LLM进行分类
   */
  async _classifyWithLLM(contentSummary, categoryTree, allCategories) {
    try {
      // 构建分类列表文本
      const categoryList = this._formatCategoriesForLLM(categoryTree);

      const prompt = `你是一个专业的文档分类助手。请根据文档内容，从给定的分类列表中选择最合适的分类。

**文档信息：**
${contentSummary}

**可用分类列表：**
${categoryList}

**任务：**
1. 仔细分析文档内容和文件名
2. 从上述分类列表中选择最合适的一个分类
3. 返回JSON格式结果

**返回格式（严格JSON）：**
{
  "category_code": "分类编码",
  "category_name": "分类名称",
  "confidence": 0.85,
  "reasoning": "选择该分类的理由"
}

**要求：**
- confidence 为0-1之间的浮点数，表示分类置信度
- 必须从提供的分类列表中选择
- 如果无法确定，选择最通用的分类，confidence设为较低值
- 只返回JSON，不要有其他文字`;

      console.log('[DocumentClassifier] 调用LLM进行分类...');

      const response = await UnifiedLLMService.generate({
        prompt,
        temperature: 0.2, // 低温度，提高稳定性
        format: 'json'
      });

      console.log('[DocumentClassifier] LLM原始响应:', response);

      // 解析LLM响应
      let result;
      try {
        result = typeof response === 'string' ? JSON.parse(response) : response;
      } catch (parseError) {
        console.error('[DocumentClassifier] JSON解析失败:', parseError);
        // 尝试从响应中提取JSON
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('无法解析LLM响应');
        }
      }

      // 验证和查找分类
      const category = allCategories.find(
        cat => cat.code === result.category_code
      );

      if (!category) {
        console.error('[DocumentClassifier] 找不到匹配的分类:', result.category_code);
        // 使用第一个分类作为默认值
        return {
          success: true,
          categoryId: allCategories[0].id,
          categoryName: allCategories[0].name,
          confidence: 0.3,
          reasoning: '无法确定最佳分类，使用默认分类'
        };
      }

      return {
        success: true,
        categoryId: category.id,
        categoryName: category.name,
        categoryCode: category.code,
        confidence: result.confidence || 0.5,
        reasoning: result.reasoning || ''
      };

    } catch (error) {
      console.error('[DocumentClassifier] LLM分类失败:', error);
      throw error;
    }
  }

  /**
   * 格式化分类列表为LLM可理解的文本
   */
  _formatCategoriesForLLM(categoryTree, level = 0) {
    let text = '';
    const indent = '  '.repeat(level);

    categoryTree.forEach(cat => {
      text += `${indent}- [${cat.code}] ${cat.name}`;
      if (cat.description) {
        text += ` - ${cat.description}`;
      }
      text += '\n';

      if (cat.children && cat.children.length > 0) {
        text += this._formatCategoriesForLLM(cat.children, level + 1);
      }
    });

    return text;
  }

  /**
   * 批量分类文档
   */
  async batchClassifyDocuments(documentIds, organizationId) {
    const results = [];

    for (const docId of documentIds) {
      try {
        const doc = await this.db('knowledge_documents')
          .where({ id: docId })
          .first('id', 'content', 'name');

        if (!doc) {
          results.push({
            documentId: docId,
            success: false,
            message: '文档不存在'
          });
          continue;
        }

        const result = await this.classifyDocument(
          doc.id,
          doc.content,
          doc.name,
          organizationId
        );

        results.push({
          documentId: docId,
          ...result
        });

      } catch (error) {
        results.push({
          documentId: docId,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * 重新分类文档（手动触发）
   */
  async reclassifyDocument(documentId) {
    try {
      const doc = await this.db('knowledge_documents')
        .where({ id: documentId })
        .first('id', 'content', 'name', 'kb_id');

      if (!doc) {
        return {
          success: false,
          message: '文档不存在'
        };
      }

      // 获取知识库的组织ID
      const kb = await this.db('knowledge_bases')
        .where({ id: doc.kb_id })
        .first('organization_id');

      if (!kb) {
        return {
          success: false,
          message: '知识库不存在'
        };
      }

      return await this.classifyDocument(
        doc.id,
        doc.content,
        doc.name,
        kb.organization_id
      );

    } catch (error) {
      console.error('[DocumentClassifier] 重新分类失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = DocumentClassifierService;
