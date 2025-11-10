/**
 * 归档服务
 * 核心：归档申请和知识库集成
 */

const knex = require('../../config/database');
const DocumentDomainConfig = require('../../config/DocumentDomainConfig');

class ArchiveService {
  constructor() {
    this.domainConfig = DocumentDomainConfig;
  }

  /**
   * 提交归档申请
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async requestArchive({
    documentId,
    requesterId,
    reason,
    suggestedCategory,
    suggestedTags
  }) {
    const document = await knex('project_documents')
      .where({ id: documentId })
      .first();

    // 检查文档状态
    if (document.status !== 'completed') {
      throw new Error('只有已完成的文档才能申请归档');
    }

    // 获取归档配置
    const archiveConfig = this.domainConfig.getArchiveConfig(document.document_type);

    // 检查归档前条件（合同需要检查审批状态等）
    if (archiveConfig.preArchiveChecks) {
      await this._checkPreArchiveConditions(documentId, archiveConfig.preArchiveChecks);
    }

    // 创建归档申请
    const [request] = await knex('archive_requests').insert({
      document_id: documentId,
      requester_id: requesterId,
      request_reason: reason,
      suggested_category: suggestedCategory,
      suggested_tags: JSON.stringify(suggestedTags || []),
      status: 'pending',
    }).returning('*');

    // 更新文档状态
    await knex('project_documents')
      .where({ id: documentId })
      .update({ status: 'archive_pending' });

    // TODO: 通知知识管理员

    return request;
  }

  /**
   * 检查归档前条件
   * @private
   */
  async _checkPreArchiveConditions(documentId, checks) {
    for (const check of checks) {
      switch (check) {
        case 'all_sections_approved':
          await this._checkAllSectionsApproved(documentId);
          break;
        case 'no_pending_revisions':
          await this._checkNoPendingRevisions(documentId);
          break;
        case 'no_open_issues':
          await this._checkNoOpenIssues(documentId);
          break;
        // TODO: 其他检查
      }
    }
  }

  /**
   * 检查所有章节是否已审批
   * @private
   */
  async _checkAllSectionsApproved(documentId) {
    const unapprovedCount = await knex('document_sections')
      .where({ document_id: documentId })
      .whereNot({ approval_status: 'approved' })
      .count('id as count')
      .first();

    if (parseInt(unapprovedCount.count) > 0) {
      throw new Error('存在未审批的章节，无法归档');
    }
  }

  /**
   * 检查是否有待处理的修订
   * @private
   */
  async _checkNoPendingRevisions(documentId) {
    const pendingCount = await knex('section_revisions')
      .where({ document_id: documentId, status: 'pending' })
      .count('id as count')
      .first();

    if (parseInt(pendingCount.count) > 0) {
      throw new Error('存在待处理的修订，无法归档');
    }
  }

  /**
   * 检查是否有未解决的问题
   * @private
   */
  async _checkNoOpenIssues(documentId) {
    const openIssuesCount = await knex('section_review_issues')
      .join('section_approval_tasks', 'section_review_issues.approval_task_id', 'section_approval_tasks.id')
      .where({ 'section_approval_tasks.document_id': documentId })
      .where({ 'section_review_issues.status': 'open' })
      .count('section_review_issues.id as count')
      .first();

    if (parseInt(openIssuesCount.count) > 0) {
      throw new Error('存在未解决的审批问题，无法归档');
    }
  }

  /**
   * 审批归档申请
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async approveArchiveRequest({
    requestId,
    reviewerId,
    permissions, // 权限设置
    category,
    tags,
    securityLevel,
    comment
  }) {
    const request = await knex('archive_requests')
      .where({ id: requestId })
      .first();

    if (!request) {
      throw new Error('归档申请不存在');
    }

    // 更新归档申请状态
    await knex('archive_requests')
      .where({ id: requestId })
      .update({
        status: 'approved',
        reviewer_id: reviewerId,
        review_comment: comment,
        reviewed_at: knex.fn.now(),
      });

    // 更新文档状态和密级
    await knex('project_documents')
      .where({ id: request.document_id })
      .update({
        status: 'archived',
        security_level: securityLevel,
        archived_at: knex.fn.now(),
        archived_by: reviewerId,
      });

    // 设置文档权限
    if (permissions && permissions.length > 0) {
      await this._setDocumentPermissions(request.document_id, permissions, reviewerId);
    }

    // TODO: 提取文档到知识库
    // await this._extractToKnowledgeBase(request.document_id, category, tags);

    return this.getArchiveRequest(requestId);
  }

  /**
   * 设置文档权限
   * @private
   */
  async _setDocumentPermissions(documentId, permissions, grantedBy) {
    for (const perm of permissions) {
      await knex('document_permissions').insert({
        document_id: documentId,
        permission_level: perm.level,
        branch_id: perm.branchId || null,
        department_id: perm.departmentId || null,
        project_id: perm.projectId || null,
        discipline_code: perm.disciplineCode || null,
        user_id: perm.userId || null,
        permission_type: perm.type || 'view',
        granted_by: grantedBy,
      });
    }
  }

  /**
   * 拒绝归档申请
   * @param {string} requestId
   * @param {string} reviewerId
   * @param {string} comment
   * @returns {Promise<Object>}
   */
  async rejectArchiveRequest(requestId, reviewerId, comment) {
    const request = await knex('archive_requests')
      .where({ id: requestId })
      .first();

    await knex('archive_requests')
      .where({ id: requestId })
      .update({
        status: 'rejected',
        reviewer_id: reviewerId,
        review_comment: comment,
        reviewed_at: knex.fn.now(),
      });

    // 恢复文档状态
    await knex('project_documents')
      .where({ id: request.document_id })
      .update({ status: 'completed' });

    return this.getArchiveRequest(requestId);
  }

  /**
   * 获取归档申请详情
   * @param {string} requestId
   * @returns {Promise<Object>}
   */
  async getArchiveRequest(requestId) {
    const request = await knex('archive_requests')
      .where({ id: requestId })
      .first();

    if (!request) {
      throw new Error('归档申请不存在');
    }

    // 加载文档信息
    request.document = await knex('project_documents')
      .where({ id: request.document_id })
      .first();

    return request;
  }

  /**
   * 获取待审批的归档申请列表
   * @returns {Promise<Array>}
   */
  async getPendingArchiveRequests() {
    return knex('archive_requests')
      .where({ status: 'pending' })
      .orderBy('created_at', 'asc');
  }
}

module.exports = new ArchiveService();
