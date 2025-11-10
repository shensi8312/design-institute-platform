/**
 * 修订追踪服务
 * 核心：Word风格的修订标记和管理
 */

const knex = require('../../config/database');
const DocumentDomainConfig = require('../../config/DocumentDomainConfig');

class RevisionTrackingService {
  constructor() {
    this.domainConfig = DocumentDomainConfig;
  }

  /**
   * 创建修订记录
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async createRevision({
    sectionId,
    documentId,
    revisionType, // 'insert' | 'delete' | 'replace'
    startOffset,
    endOffset,
    originalText,
    newText,
    authorId,
    authorName
  }) {
    // 获取或分配用户颜色
    const authorColor = await this._getAuthorColor(documentId, authorId);

    const [revision] = await knex('section_revisions').insert({
      section_id: sectionId,
      document_id: documentId,
      revision_type: revisionType,
      start_offset: startOffset,
      end_offset: endOffset,
      original_text: originalText,
      new_text: newText,
      status: 'pending',
      author_id: authorId,
      author_name: authorName,
      author_color: authorColor,
    }).returning('*');

    return revision;
  }

  /**
   * 获取或分配作者颜色
   * @private
   */
  async _getAuthorColor(documentId, userId) {
    // 检查是否已分配颜色
    let colorAssignment = await knex('document_collaborator_colors')
      .where({ document_id: documentId, user_id: userId })
      .first();

    if (colorAssignment) {
      return colorAssignment.color;
    }

    // 获取可用颜色池
    const document = await knex('project_documents').where({ id: documentId }).first();
    const revisionConfig = this.domainConfig.getRevisionTrackingConfig(document.document_type);
    const colorPool = revisionConfig.colorPool;

    // 查找已使用的颜色
    const usedColors = await knex('document_collaborator_colors')
      .where({ document_id: documentId })
      .pluck('color');

    // 找到第一个未使用的颜色
    const availableColor = colorPool.find(c => !usedColors.includes(c)) || colorPool[0];

    // 分配颜色
    await knex('document_collaborator_colors').insert({
      document_id: documentId,
      user_id: userId,
      color: availableColor,
    });

    return availableColor;
  }

  /**
   * 获取章节的所有修订
   * @param {string} sectionId
   * @param {string} status - 'pending' | 'accepted' | 'rejected' | 'all'
   * @returns {Promise<Array>}
   */
  async getSectionRevisions(sectionId, status = 'pending') {
    let query = knex('section_revisions').where({ section_id: sectionId });

    if (status !== 'all') {
      query = query.where({ status });
    }

    return query.orderBy('created_at', 'asc');
  }

  /**
   * 接受修订
   * @param {string} revisionId
   * @param {string} reviewerId
   * @returns {Promise<Object>}
   */
  async acceptRevision(revisionId, reviewerId) {
    const revision = await knex('section_revisions')
      .where({ id: revisionId })
      .first();

    if (!revision) {
      throw new Error('修订不存在');
    }

    // 应用修订到章节内容
    await this._applyRevision(revision);

    // 更新修订状态
    await knex('section_revisions')
      .where({ id: revisionId })
      .update({
        status: 'accepted',
        reviewed_by: reviewerId,
        reviewed_at: knex.fn.now(),
      });

    return this.getRevision(revisionId);
  }

  /**
   * 应用修订到章节内容
   * @private
   */
  async _applyRevision(revision) {
    const section = await knex('document_sections')
      .where({ id: revision.section_id })
      .first();

    let content = section.content || '';

    switch (revision.revision_type) {
      case 'insert':
        content = content.slice(0, revision.start_offset) +
                  revision.new_text +
                  content.slice(revision.start_offset);
        break;

      case 'delete':
        content = content.slice(0, revision.start_offset) +
                  content.slice(revision.end_offset);
        break;

      case 'replace':
        content = content.slice(0, revision.start_offset) +
                  revision.new_text +
                  content.slice(revision.end_offset);
        break;
    }

    await knex('document_sections')
      .where({ id: revision.section_id })
      .update({ content });
  }

  /**
   * 拒绝修订
   * @param {string} revisionId
   * @param {string} reviewerId
   * @param {string} comment
   * @returns {Promise<Object>}
   */
  async rejectRevision(revisionId, reviewerId, comment) {
    await knex('section_revisions')
      .where({ id: revisionId })
      .update({
        status: 'rejected',
        reviewed_by: reviewerId,
        reviewed_at: knex.fn.now(),
        review_comment: comment,
      });

    return this.getRevision(revisionId);
  }

  /**
   * 获取修订详情
   * @param {string} revisionId
   * @returns {Promise<Object>}
   */
  async getRevision(revisionId) {
    const revision = await knex('section_revisions')
      .where({ id: revisionId })
      .first();

    if (!revision) {
      throw new Error('修订不存在');
    }

    return revision;
  }

  /**
   * 批量接受修订
   * @param {Array<string>} revisionIds
   * @param {string} reviewerId
   * @returns {Promise<void>}
   */
  async acceptRevisionsInBatch(revisionIds, reviewerId) {
    for (const revisionId of revisionIds) {
      await this.acceptRevision(revisionId, reviewerId);
    }
  }

  /**
   * 批量拒绝修订
   * @param {Array<string>} revisionIds
   * @param {string} reviewerId
   * @param {string} comment
   * @returns {Promise<void>}
   */
  async rejectRevisionsInBatch(revisionIds, reviewerId, comment) {
    for (const revisionId of revisionIds) {
      await this.rejectRevision(revisionId, reviewerId, comment);
    }
  }

  /**
   * 开启/关闭修订追踪
   * @param {string} documentId
   * @param {boolean} enabled
   * @returns {Promise<void>}
   */
  async toggleRevisionTracking(documentId, enabled) {
    await knex('document_revision_settings')
      .where({ document_id: documentId })
      .update({ track_changes_enabled: enabled });
  }
}

module.exports = new RevisionTrackingService();
