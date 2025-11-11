/**
 * Word文档大纲提取器
 * 提取Word文档的标题层级结构（目录大纲）
 */

const mammoth = require('mammoth');
const fs = require('fs').promises;

class WordOutlineExtractor {
  /**
   * 从Word文件提取目录大纲
   * @param {string} filePath - Word文件路径
   * @returns {Promise<Object>} { outline: 树形结构, flatOutline: 扁平结构 }
   */
  async extractOutline(filePath) {
    try {
      console.log('[Word解析] 开始提取大纲:', filePath);

      // 读取Word文件
      const buffer = await fs.readFile(filePath);

      // 使用mammoth提取HTML，映射标题样式
      const result = await mammoth.convertToHtml(
        { buffer },
        {
          styleMap: [
            // 英文标题样式
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "p[style-name='Heading 4'] => h4:fresh",
            "p[style-name='Heading 5'] => h5:fresh",
            "p[style-name='Heading 6'] => h6:fresh",
            // 中文标题样式
            "p[style-name='标题 1'] => h1:fresh",
            "p[style-name='标题 2'] => h2:fresh",
            "p[style-name='标题 3'] => h3:fresh",
            "p[style-name='标题 4'] => h4:fresh",
            "p[style-name='标题 5'] => h5:fresh",
            "p[style-name='标题 6'] => h6:fresh",
            // 备用标题样式
            "p[style-name='heading 1'] => h1:fresh",
            "p[style-name='heading 2'] => h2:fresh",
            "p[style-name='heading 3'] => h3:fresh",
          ]
        }
      );

      console.log('[Word解析] HTML转换完成，开始解析标题');

      // 从HTML中提取标题
      const outline = this._parseHtmlToOutline(result.value);

      // 生成扁平化列表
      const flatOutline = this.flattenOutline(outline);

      console.log(`[Word解析] 成功提取 ${flatOutline.length} 个标题`);

      return {
        outline,
        flatOutline
      };
    } catch (error) {
      console.error('[Word解析] 提取大纲失败:', error);
      throw new Error(`解析Word文件失败: ${error.message}`);
    }
  }

  /**
   * 从HTML提取标题结构
   * @private
   * @param {string} html - HTML字符串
   * @returns {Array} 树形目录结构
   */
  _parseHtmlToOutline(html) {
    const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi;
    const outline = [];
    const stack = [{ level: 0, children: outline }];

    let match;
    let order = 0;

    while ((match = headingRegex.exec(html)) !== null) {
      const level = parseInt(match[1]);
      let title = match[2];

      // 清理HTML标签
      title = title.replace(/<[^>]+>/g, '').trim();

      // 跳过空标题
      if (!title) continue;

      // 提取章节编号（如果有）
      const numberMatch = title.match(/^([\d.]+)\s+(.+)$/);
      const sectionNumber = numberMatch ? numberMatch[1] : null;
      const sectionTitle = numberMatch ? numberMatch[2] : title;

      const node = {
        id: `heading_${order}`,
        title: title,
        sectionNumber: sectionNumber,
        sectionTitle: sectionTitle,
        level,
        order: order++,
        children: []
      };

      // 找到合适的父节点
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      // 添加到父节点的children
      stack[stack.length - 1].children.push(node);

      // 当前节点入栈，作为潜在的父节点
      stack.push(node);
    }

    return outline;
  }

  /**
   * 生成扁平化的目录列表（用于API返回和显示）
   * @param {Array} outline - 树形目录结构
   * @returns {Array} 扁平化数组
   */
  flattenOutline(outline) {
    const flat = [];

    const traverse = (nodes, depth = 0, parentPath = []) => {
      nodes.forEach((node, index) => {
        const path = [...parentPath, index + 1];

        flat.push({
          id: node.id,
          title: node.title,
          sectionNumber: node.sectionNumber,
          sectionTitle: node.sectionTitle,
          level: node.level,
          depth,
          path: path.join('.'),
          order: node.order,
          hasChildren: node.children && node.children.length > 0,
          childrenCount: node.children ? node.children.length : 0
        });

        if (node.children && node.children.length > 0) {
          traverse(node.children, depth + 1, path);
        }
      });
    };

    traverse(outline);
    return flat;
  }

  /**
   * 统计目录信息
   * @param {Array} outline - 树形目录结构
   * @returns {Object} 统计信息
   */
  getOutlineStats(outline) {
    const flat = this.flattenOutline(outline);

    const levelCounts = {};
    flat.forEach(node => {
      levelCounts[node.level] = (levelCounts[node.level] || 0) + 1;
    });

    return {
      totalSections: flat.length,
      maxLevel: Math.max(...flat.map(n => n.level)),
      levelDistribution: levelCounts,
      topLevelCount: outline.length
    };
  }
}

module.exports = new WordOutlineExtractor();
