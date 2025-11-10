const fs = require('fs-extra');
const path = require('path');

/**
 * MasterFormat 模板匹配服务
 * 根据 CSI MasterFormat 2018 规范匹配上传文件到对应模板
 */
class MasterFormatMatcher {
  constructor() {
    this.translationMap = null;
    this.initialized = false;
  }

  /**
   * 初始化：加载翻译映射表
   */
  async init() {
    if (this.initialized) return;

    try {
      const mapPath = path.join(__dirname, '../../../../../docs/specs/文件名翻译对照表_完整版.json');
      if (await fs.pathExists(mapPath)) {
        this.translationMap = await fs.readJson(mapPath);
        this.initialized = true;
        console.log('✅ MasterFormat 翻译映射加载成功');
      } else {
        console.warn('⚠️ 未找到翻译映射文件，MasterFormat匹配功能受限');
        this.translationMap = { folders: {}, files: {} };
        this.initialized = true;
      }
    } catch (error) {
      console.error('❌ 加载 MasterFormat 翻译映射失败:', error);
      this.translationMap = { folders: {}, files: {} };
      this.initialized = true;
    }
  }

  /**
   * 从文件名提取 MasterFormat 编号
   * 格式: XXXXXX FL - Description.docx
   * @param {string} filename
   * @returns {string|null} 6位数字编号
   */
  extractMasterFormatCode(filename) {
    // 匹配 6 位数字 + FL
    const match = filename.match(/^(\d{6})\s*FL\s*-/i);
    if (match) {
      return match[1];
    }

    // 匹配纯 6 位数字开头
    const simpleMatch = filename.match(/^(\d{6})/);
    if (simpleMatch) {
      return simpleMatch[1];
    }

    return null;
  }

  /**
   * 根据 Division 代码查找对应的文件夹
   * @param {string} divisionCode - 2位数字 (如 "03")
   * @returns {Object|null}
   */
  findDivisionFolder(divisionCode) {
    if (!this.translationMap || !this.translationMap.folders) {
      return null;
    }

    // 查找匹配的 Division 文件夹
    for (const [englishFolder, chineseFolder] of Object.entries(this.translationMap.folders)) {
      if (englishFolder.startsWith(`${divisionCode} -`)) {
        return {
          english: englishFolder,
          chinese: chineseFolder,
          divisionCode
        };
      }
    }

    return null;
  }

  /**
   * 匹配上传文件到 MasterFormat 模板
   * @param {string} uploadedFilename - 上传的文件名
   * @returns {Promise<Object>} 匹配结果
   */
  async matchTemplate(uploadedFilename) {
    await this.init();

    const code = this.extractMasterFormatCode(uploadedFilename);

    if (!code) {
      return {
        success: false,
        message: '未能从文件名中提取MasterFormat编号',
        filename: uploadedFilename
      };
    }

    // 提取 Division 代码 (前两位)
    const divisionCode = code.substring(0, 2);
    const division = this.findDivisionFolder(divisionCode);

    // 查找对应的模板文件
    let templateMatch = null;
    if (this.translationMap && this.translationMap.files) {
      for (const [englishFile, chineseFile] of Object.entries(this.translationMap.files)) {
        const templateCode = this.extractMasterFormatCode(englishFile);
        if (templateCode === code) {
          templateMatch = {
            english: englishFile,
            chinese: chineseFile,
            code: templateCode
          };
          break;
        }
      }
    }

    return {
      success: true,
      uploadedFile: uploadedFilename,
      masterFormatCode: code,
      division: division || { divisionCode, english: null, chinese: null },
      template: templateMatch,
      message: templateMatch
        ? `找到匹配模板: ${templateMatch.chinese || templateMatch.english}`
        : `Division ${divisionCode} 下未找到完全匹配的模板`
    };
  }

  /**
   * 批量匹配
   * @param {string[]} filenames
   * @returns {Promise<Object[]>}
   */
  async batchMatchTemplates(filenames) {
    await this.init();

    const results = [];
    for (const filename of filenames) {
      const result = await this.matchTemplate(filename);
      results.push(result);
    }

    return results;
  }

  /**
   * 根据 MasterFormat 编号查找模板
   * @param {string} code - 6位编号
   * @returns {Promise<Object|null>}
   */
  async findByCode(code) {
    await this.init();

    if (!this.translationMap || !this.translationMap.files) {
      return null;
    }

    for (const [englishFile, chineseFile] of Object.entries(this.translationMap.files)) {
      const templateCode = this.extractMasterFormatCode(englishFile);
      if (templateCode === code) {
        const divisionCode = code.substring(0, 2);
        return {
          code,
          divisionCode,
          english: englishFile,
          chinese: chineseFile,
          division: this.findDivisionFolder(divisionCode)
        };
      }
    }

    return null;
  }

  /**
   * 获取所有 Division 统计信息
   * @returns {Promise<Object>}
   */
  async getStatistics() {
    await this.init();

    const stats = {
      totalDivisions: 0,
      totalTemplates: 0,
      divisions: {}
    };

    if (!this.translationMap) {
      return stats;
    }

    // 统计 Divisions
    if (this.translationMap.folders) {
      stats.totalDivisions = Object.keys(this.translationMap.folders).length;

      // 初始化每个 Division 的计数
      for (const folder of Object.keys(this.translationMap.folders)) {
        const match = folder.match(/^(\d{2})\s*-/);
        if (match) {
          const divCode = match[1];
          stats.divisions[divCode] = {
            folder: folder,
            folderChinese: this.translationMap.folders[folder],
            templateCount: 0
          };
        }
      }
    }

    // 统计模板
    if (this.translationMap.files) {
      stats.totalTemplates = Object.keys(this.translationMap.files).length;

      for (const file of Object.keys(this.translationMap.files)) {
        const code = this.extractMasterFormatCode(file);
        if (code) {
          const divCode = code.substring(0, 2);
          if (stats.divisions[divCode]) {
            stats.divisions[divCode].templateCount++;
          }
        }
      }
    }

    return stats;
  }
}

// 创建单例
const masterFormatMatcher = new MasterFormatMatcher();

module.exports = masterFormatMatcher;
