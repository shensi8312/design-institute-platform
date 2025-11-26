/**
 * CSI 框架服务
 * 管理 CSI MasterFormat 标准框架
 */

const knex = require('../../config/database');
const { spawn } = require('child_process');
const path = require('path');

class CSIFrameworkService {
  constructor() {
    // 项目根目录下的 services/csi-parser
    this.pythonParserPath = path.join(
      __dirname,
      '../../../../../services/csi-parser/csi_docx_parser.py'
    );
    // 使用虚拟环境中的 Python
    this.pythonPath = path.join(
      __dirname,
      '../../../../../services/csi-parser/venv/bin/python3'
    );
  }

  /**
   * 解析 CSI MasterSpec DOCX 文件
   * @param {string} filePath - DOCX 文件路径
   * @returns {Promise<Object>} 解析结果
   */
  async parseCSIDocx(filePath) {
    return new Promise((resolve, reject) => {
      const python = spawn(this.pythonPath, [this.pythonParserPath, filePath]);

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          console.error('[CSI解析] Python错误:', stderr);
          reject(new Error(`CSI解析失败: ${stderr || '未知错误'}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result);
          }
        } catch (e) {
          reject(new Error(`解析输出失败: ${e.message}`));
        }
      });
    });
  }

  /**
   * 导入 CSI 框架到数据库
   * @param {Object} parseResult - 解析结果
   * @param {string} source - 来源版本 (如 CSI_2020)
   * @returns {Promise<Object>} 导入统计
   */
  async importFramework(parseResult, source = 'CSI_2020') {
    const { flat_list, section_code, division } = parseResult;

    if (!flat_list || flat_list.length === 0) {
      throw new Error('解析结果为空');
    }

    const inserted = [];
    const updated = [];

    for (const node of flat_list) {
      const record = {
        division: node.division || division,
        section_code: node.section_code || section_code,
        full_code: node.full_code,
        level: node.level,
        level_type: node.level_type,
        level_label: node.level_label || '',
        title_en: node.title_en || '',
        title_zh: node.title_zh || '',
        parent_code: node.parent_code || null,
        sort_order: node.sort_order,
        source,
        metadata: JSON.stringify({
          content: node.content || ''
        })
      };

      // Upsert
      const existing = await knex('spec_csi_framework')
        .where({ full_code: record.full_code })
        .first();

      if (existing) {
        await knex('spec_csi_framework')
          .where({ id: existing.id })
          .update({
            ...record,
            updated_at: knex.fn.now()
          });
        updated.push(record.full_code);
      } else {
        await knex('spec_csi_framework').insert(record);
        inserted.push(record.full_code);
      }
    }

    return {
      section_code,
      division,
      total: flat_list.length,
      inserted: inserted.length,
      updated: updated.length
    };
  }

  /**
   * 获取 Section 的框架结构
   * @param {string} sectionCode - Section 编号 (如 092900)
   * @returns {Promise<Array>} 树形结构
   */
  async getSectionFramework(sectionCode) {
    const nodes = await knex('spec_csi_framework')
      .where({ section_code: sectionCode })
      .orderBy('sort_order');

    return this._buildTree(nodes);
  }

  /**
   * 获取 Division 下所有 Section
   * @param {string} division - Division 编号 (如 09)
   * @returns {Promise<Array>}
   */
  async getDivisionSections(division) {
    return knex('spec_csi_framework')
      .where({ division, level: 1, level_type: 'SEC' })
      .orderBy('section_code');
  }

  /**
   * 搜索框架节点
   * @param {string} keyword - 关键词
   * @param {Object} options - 选项
   * @returns {Promise<Array>}
   */
  async searchFramework(keyword, options = {}) {
    let query = knex('spec_csi_framework');

    if (keyword) {
      query = query.where(function() {
        this.where('title_en', 'ilike', `%${keyword}%`)
          .orWhere('title_zh', 'ilike', `%${keyword}%`)
          .orWhere('full_code', 'ilike', `%${keyword}%`);
      });
    }

    if (options.division) {
      query = query.where({ division: options.division });
    }

    if (options.sectionCode) {
      query = query.where({ section_code: options.sectionCode });
    }

    if (options.levelType) {
      query = query.where({ level_type: options.levelType });
    }

    return query.orderBy('sort_order').limit(options.limit || 100);
  }

  /**
   * 获取框架节点详情
   * @param {string} fullCode - 完整编号
   * @returns {Promise<Object>}
   */
  async getNode(fullCode) {
    return knex('spec_csi_framework')
      .where({ full_code: fullCode })
      .first();
  }

  /**
   * 获取节点的子节点
   * @param {string} fullCode - 父节点完整编号
   * @returns {Promise<Array>}
   */
  async getChildren(fullCode) {
    return knex('spec_csi_framework')
      .where({ parent_code: fullCode })
      .orderBy('sort_order');
  }

  /**
   * 获取统计信息
   * @returns {Promise<Object>}
   */
  async getStatistics() {
    const total = await knex('spec_csi_framework').count('* as count').first();

    const byDivision = await knex('spec_csi_framework')
      .select('division')
      .count('* as count')
      .groupBy('division')
      .orderBy('division');

    const byLevelType = await knex('spec_csi_framework')
      .select('level_type')
      .count('* as count')
      .groupBy('level_type');

    return {
      total: parseInt(total.count),
      byDivision: byDivision.reduce((acc, row) => {
        acc[row.division] = parseInt(row.count);
        return acc;
      }, {}),
      byLevelType: byLevelType.reduce((acc, row) => {
        acc[row.level_type] = parseInt(row.count);
        return acc;
      }, {})
    };
  }

  /**
   * 构建树形结构
   * @private
   */
  _buildTree(nodes) {
    const nodeMap = new Map();
    const roots = [];

    // 创建节点映射
    nodes.forEach(node => {
      nodeMap.set(node.full_code, {
        ...node,
        children: []
      });
    });

    // 建立父子关系
    nodes.forEach(node => {
      const treeNode = nodeMap.get(node.full_code);
      if (node.parent_code && nodeMap.has(node.parent_code)) {
        nodeMap.get(node.parent_code).children.push(treeNode);
      } else {
        roots.push(treeNode);
      }
    });

    return roots;
  }
}

module.exports = new CSIFrameworkService();
