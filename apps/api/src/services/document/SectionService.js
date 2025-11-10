/**
 * 章节服务
 * 核心：章节内容管理和编辑
 */

const knex = require('../../config/database');
const DocumentDomainConfig = require('../../config/DocumentDomainConfig');

class SectionService {
  constructor() {
    this.domainConfig = DocumentDomainConfig;
  }

  /**
   * 创建章节
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async createSection({
    documentId,
    title,
    parentId = null,
    sortOrder,
    content = '',
    sectionCode,
    level,
    createdBy
  }) {
    const [section] = await knex('document_sections').insert({
      document_id: documentId,
      title,
      parent_id: parentId,
      sort_order: sortOrder,
      content,
      section_code: sectionCode,
      level,
      from_template: false,
      created_by: createdBy,
    }).returning('*');

    return section;
  }

  /**
   * 获取章节详情
   * @param {string} sectionId
   * @returns {Promise<Object>}
   */
  async getSection(sectionId) {
    const section = await knex('document_sections')
      .where({ id: sectionId })
      .first();

    if (!section) {
      throw new Error('章节不存在');
    }

    return section;
  }

  /**
   * 更新章节内容
   * @param {string} sectionId
   * @param {string} content
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async updateSectionContent(sectionId, content, userId) {
    const section = await this.getSection(sectionId);

    // 检查编辑权限
    if (!section.editable) {
      throw new Error('该章节不可编辑');
    }

    await knex('document_sections')
      .where({ id: sectionId })
      .update({
        content,
        updated_by: userId,
        updated_at: knex.fn.now(),
      });

    // 记录变更历史
    await this._recordChangeHistory(sectionId, section.content, content, userId);

    return this.getSection(sectionId);
  }

  /**
   * 记录变更历史
   * @private
   */
  async _recordChangeHistory(sectionId, beforeValue, afterValue, userId) {
    const section = await this.getSection(sectionId);

    await knex('section_change_history').insert({
      section_id: sectionId,
      document_id: section.document_id,
      change_type: 'content_update',
      before_value: beforeValue,
      after_value: afterValue,
      changed_by: userId,
    });
  }

  /**
   * 更新章节标题
   * @param {string} sectionId
   * @param {string} title
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async updateSectionTitle(sectionId, title, userId) {
    await knex('document_sections')
      .where({ id: sectionId })
      .update({
        title,
        updated_by: userId,
        updated_at: knex.fn.now(),
      });

    return this.getSection(sectionId);
  }

  /**
   * 删除章节
   * @param {string} sectionId
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async deleteSection(sectionId, userId) {
    const section = await this.getSection(sectionId);

    // 检查删除权限
    if (!section.deletable) {
      throw new Error('该章节不可删除');
    }

    // 检查是否有子章节
    const childrenCount = await knex('document_sections')
      .where({ parent_id: sectionId })
      .count('id as count')
      .first();

    if (parseInt(childrenCount.count) > 0) {
      throw new Error('请先删除子章节');
    }

    await knex('document_sections').where({ id: sectionId }).del();
  }

  /**
   * 调整章节顺序
   * @param {string} documentId
   * @param {Array} sectionOrders - [{ id, sortOrder }]
   * @returns {Promise<void>}
   */
  async reorderSections(documentId, sectionOrders) {
    for (const { id, sortOrder } of sectionOrders) {
      await knex('document_sections')
        .where({ id, document_id: documentId })
        .update({ sort_order: sortOrder });
    }
  }

  /**
   * 锁定章节（协作编辑）
   * @param {string} sectionId
   * @param {string} userId
   * @param {number} expiresIn - 锁定时长（秒）
   * @returns {Promise<Object>}
   */
  async lockSection(sectionId, userId, expiresIn = 1800) {
    const section = await this.getSection(sectionId);

    // 检查是否已被锁定
    const existingLock = await knex('document_section_locks')
      .where({ section_id: sectionId })
      .where('expires_at', '>', knex.fn.now())
      .first();

    if (existingLock && existingLock.locked_by !== userId) {
      throw new Error('该章节正在被其他用户编辑');
    }

    // 创建或更新锁
    await knex('document_section_locks')
      .insert({
        section_id: sectionId,
        document_id: section.document_id,
        locked_by: userId,
        expires_at: knex.raw(`NOW() + INTERVAL '${expiresIn} seconds'`),
        lock_type: 'edit',
      })
      .onConflict('section_id')
      .merge();

    return this.getSection(sectionId);
  }

  /**
   * 解锁章节
   * @param {string} sectionId
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async unlockSection(sectionId, userId) {
    await knex('document_section_locks')
      .where({ section_id: sectionId, locked_by: userId })
      .del();
  }
}

module.exports = new SectionService();
