/**
 * 文档领域配置管理器
 * 统一加载和管理各文档类型的领域配置 (SPEC/Contract/Bidding)
 *
 * 注意：此配置用于统一文档管理系统，与 DomainConfig.js（知识图谱领域）不同
 */

const specDomain = require('./domains/spec.domain');
const contractDomain = require('./domains/contract.domain');
const biddingDomain = require('./domains/bidding.domain');

class DocumentDomainConfig {
  constructor() {
    this.domains = new Map();
    this._registerDomains();
  }

  /**
   * 注册所有领域配置
   * @private
   */
  _registerDomains() {
    this.domains.set('spec', specDomain);
    this.domains.set('contract', contractDomain);
    this.domains.set('bidding', biddingDomain);
  }

  /**
   * 获取指定文档类型的领域配置
   * @param {string} documentType - 文档类型 (spec | contract | bidding)
   * @returns {Object} 领域配置对象
   */
  getDomain(documentType) {
    const domain = this.domains.get(documentType);
    if (!domain) {
      throw new Error(`未知的文档类型: ${documentType}`);
    }
    return domain;
  }

  /**
   * 获取所有已注册的文档类型
   * @returns {Array<string>} 文档类型列表
   */
  getAllDocumentTypes() {
    return Array.from(this.domains.keys());
  }

  /**
   * 获取所有领域配置的摘要信息
   * @returns {Array<Object>} 包含基本信息的数组
   */
  getAllDomainsSummary() {
    return Array.from(this.domains.entries()).map(([type, config]) => ({
      documentType: type,
      displayName: config.displayName,
      icon: config.icon,
      sectionMode: config.sectionPolicy.mode,
      aiEnabled: config.aiCapabilities.length > 0,
      approvalEnabled: config.approvalWorkflow.enabled,
    }));
  }

  /**
   * 检查文档类型是否支持某项AI能力
   * @param {string} documentType - 文档类型
   * @param {string} capabilityId - AI能力ID
   * @returns {boolean}
   */
  hasAICapability(documentType, capabilityId) {
    const domain = this.getDomain(documentType);
    const capability = domain.aiCapabilities.find(cap => cap.id === capabilityId);
    return capability && capability.enabled;
  }

  /**
   * 获取文档类型的AI能力列表
   * @param {string} documentType - 文档类型
   * @returns {Array<Object>} AI能力列表
   */
  getAICapabilities(documentType) {
    const domain = this.getDomain(documentType);
    return domain.aiCapabilities.filter(cap => cap.enabled);
  }

  /**
   * 获取审批工作流配置
   * @param {string} documentType - 文档类型
   * @returns {Object} 审批工作流配置
   */
  getApprovalWorkflow(documentType) {
    const domain = this.getDomain(documentType);
    return domain.approvalWorkflow;
  }

  /**
   * 获取章节编辑策略
   * @param {string} documentType - 文档类型
   * @returns {Object} 章节策略配置
   */
  getSectionPolicy(documentType) {
    const domain = this.getDomain(documentType);
    return domain.sectionPolicy;
  }

  /**
   * 获取模板变量定义
   * @param {string} documentType - 文档类型
   * @returns {Array<Object>} 变量定义列表
   */
  getTemplateVariables(documentType) {
    const domain = this.getDomain(documentType);
    return domain.template.variables;
  }

  /**
   * 获取编辑器配置
   * @param {string} documentType - 文档类型
   * @returns {Object} 编辑器配置
   */
  getEditorConfig(documentType) {
    const domain = this.getDomain(documentType);
    return domain.editor;
  }

  /**
   * 获取内容验证规则
   * @param {string} documentType - 文档类型
   * @returns {Object} 验证规则配置
   */
  getValidationRules(documentType) {
    const domain = this.getDomain(documentType);
    return domain.validation;
  }

  /**
   * 获取导出配置
   * @param {string} documentType - 文档类型
   * @returns {Object} 导出配置
   */
  getExportConfig(documentType) {
    const domain = this.getDomain(documentType);
    return domain.export;
  }

  /**
   * 获取权限配置
   * @param {string} documentType - 文档类型
   * @returns {Object} 权限配置
   */
  getPermissions(documentType) {
    const domain = this.getDomain(documentType);
    return domain.permissions;
  }

  /**
   * 检查用户是否有权限执行某操作
   * @param {string} documentType - 文档类型
   * @param {string} action - 操作类型 (create | edit | review | delete | requestArchive)
   * @param {Array<string>} userRoles - 用户角色列表
   * @returns {boolean}
   */
  hasPermission(documentType, action, userRoles) {
    const permissions = this.getPermissions(documentType);
    const actionKey = `can${action.charAt(0).toUpperCase()}${action.slice(1)}`;
    const allowedRoles = permissions[actionKey] || [];

    return userRoles.some(role => allowedRoles.includes(role));
  }

  /**
   * 获取修订追踪配置
   * @param {string} documentType - 文档类型
   * @returns {Object} 修订追踪配置
   */
  getRevisionTrackingConfig(documentType) {
    const domain = this.getDomain(documentType);
    return domain.revisionTracking;
  }

  /**
   * 获取归档配置
   * @param {string} documentType - 文档类型
   * @returns {Object} 归档配置
   */
  getArchiveConfig(documentType) {
    const domain = this.getDomain(documentType);
    return domain.archive;
  }

  /**
   * 获取协作配置
   * @param {string} documentType - 文档类型
   * @returns {Object} 协作配置
   */
  getCollaborationConfig(documentType) {
    const domain = this.getDomain(documentType);
    return domain.collaboration;
  }

  /**
   * 根据金额获取所需审批阶段
   * @param {string} documentType - 文档类型
   * @param {number} amount - 金额
   * @returns {Array<string>} 审批阶段ID列表
   */
  getRequiredApprovalStages(documentType, amount) {
    const workflow = this.getApprovalWorkflow(documentType);

    if (!workflow.approvalThresholds) {
      // 如果没有阈值配置，返回所有必需阶段
      return workflow.stages
        .filter(stage => stage.required)
        .map(stage => stage.id);
    }

    // 找到匹配的阈值配置
    const threshold = workflow.approvalThresholds.find(
      t => amount <= t.maxAmount
    );

    return threshold ? threshold.stages : [];
  }

  /**
   * 验证章节结构是否符合领域规则
   * @param {string} documentType - 文档类型
   * @param {Array<Object>} sections - 章节列表
   * @returns {Object} 验证结果 { valid: boolean, errors: Array<string> }
   */
  validateSectionStructure(documentType, sections) {
    const policy = this.getSectionPolicy(documentType);
    const errors = [];

    // 检查核心章节（如果定义了）
    if (policy.coreSections && policy.coreSections.length > 0) {
      const sectionTitles = sections.map(s => s.title);
      const missingCoreSections = policy.coreSections.filter(
        coreTitle => !sectionTitles.includes(coreTitle)
      );

      if (missingCoreSections.length > 0) {
        errors.push(`缺少核心章节: ${missingCoreSections.join(', ')}`);
      }
    }

    // 检查嵌套层级
    if (policy.maxNestingLevel) {
      const maxLevel = Math.max(...sections.map(s => s.level || 1));
      if (maxLevel > policy.maxNestingLevel) {
        errors.push(`章节嵌套层级超过限制 (${maxLevel} > ${policy.maxNestingLevel})`);
      }
    }

    // 检查章节编码格式（如果需要）
    if (policy.requireSectionCode && policy.sectionCodeFormat) {
      const invalidCodes = sections.filter(
        s => s.section_code && !policy.sectionCodeFormat.test(s.section_code)
      );

      if (invalidCodes.length > 0) {
        errors.push(`章节编号格式不符合要求: ${invalidCodes.map(s => s.section_code).join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取文档类型的显示名称
   * @param {string} documentType - 文档类型
   * @returns {string} 显示名称
   */
  getDisplayName(documentType) {
    const domain = this.getDomain(documentType);
    return domain.displayName;
  }

  /**
   * 获取文档类型的图标
   * @param {string} documentType - 文档类型
   * @returns {string} 图标名称
   */
  getIcon(documentType) {
    const domain = this.getDomain(documentType);
    return domain.icon;
  }
}

// 导出单例
module.exports = new DocumentDomainConfig();
