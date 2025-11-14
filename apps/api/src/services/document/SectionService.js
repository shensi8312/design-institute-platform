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

  // ============================================
  // 模板章节管理
  // ============================================

  /**
   * 创建模板章节
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async createTemplateSection({
    templateId,
    code,
    title,
    level,
    parentCode = null,
    description = '',
    templateContent = '',
    sortOrder = 0,
    isRequired = true,
    isEditable = true,
    metadata = {},
    editableUserIds = []
  }) {
    // 如果没有提供 code，自动计算
    if (!code) {
      code = await this._generateTemplateCode(templateId, parentCode, sortOrder);
    }

    const [section] = await knex('template_sections').insert({
      template_id: templateId,
      code,
      title,
      level,
      parent_code: parentCode,
      description,
      template_content: templateContent,
      sort_order: sortOrder,
      is_required: isRequired,
      is_editable: isEditable,
      metadata: JSON.stringify(metadata),
      editable_user_ids: editableUserIds || [],
    }).returning('*');

    return section;
  }

  /**
   * 更新模板章节
   * @param {string} templateId
   * @param {string} sectionId
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updateTemplateSection(templateId, sectionId, updates) {
    const section = await knex('template_sections')
      .where({ id: sectionId, template_id: templateId })
      .first();

    if (!section) {
      throw new Error('章节不存在');
    }

    // 如果更新了 code，检查唯一性
    if (updates.code && updates.code !== section.code) {
      const existing = await knex('template_sections')
        .where({ template_id: templateId, code: updates.code })
        .first();

      if (existing) {
        throw new Error('章节编号已存在');
      }

      // 如果改变了 code，需要更新所有子章节的 parent_code 和 code
      await this._updateChildrenCodes(templateId, section.code, updates.code);
    }

    const updateData = {
      updated_at: knex.fn.now(),
    };

    if (updates.code !== undefined) updateData.code = updates.code;
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.template_content !== undefined) updateData.template_content = updates.template_content;
    if (updates.is_required !== undefined) updateData.is_required = updates.is_required;
    if (updates.is_editable !== undefined) updateData.is_editable = updates.is_editable;
    if (updates.metadata !== undefined) updateData.metadata = JSON.stringify(updates.metadata);
    if (updates.editable_user_ids !== undefined) {
      updateData.editable_user_ids = updates.editable_user_ids || [];
    }

    await knex('template_sections')
      .where({ id: sectionId })
      .update(updateData);

    return knex('template_sections').where({ id: sectionId }).first();
  }

  /**
   * 移动模板章节
   * @param {string} templateId
   * @param {string} sectionId
   * @param {Object} moveParams
   * @returns {Promise<Object>}
   */
  async moveTemplateSection(templateId, sectionId, { newParentCode, newSortOrder, newLevel }) {
    const section = await knex('template_sections')
      .where({ id: sectionId, template_id: templateId })
      .first();

    if (!section) {
      throw new Error('章节不存在');
    }

    const oldCode = section.code;
    const oldParentCode = section.parent_code;
    const oldLevel = section.level;

    // 计算新的 code
    const newCode = this._recalculateCode(newParentCode, newSortOrder);

    // 开始事务
    await knex.transaction(async (trx) => {
      // 1. 更新目标章节
      await trx('template_sections')
        .where({ id: sectionId })
        .update({
          parent_code: newParentCode,
          code: newCode,
          level: newLevel,
          sort_order: newSortOrder,
          updated_at: knex.fn.now(),
        });

      // 2. 递归更新所有子章节的 code 和 level
      if (oldCode !== newCode) {
        await this._updateChildrenCodesAndLevels(
          templateId,
          oldCode,
          newCode,
          oldLevel,
          newLevel,
          trx
        );
      }

      // 3. 调整原父级下其他兄弟节点的 sort_order
      if (oldParentCode) {
        await this._adjustSiblingsSortOrder(templateId, oldParentCode, section.sort_order, trx);
      }

      // 4. 调整新父级下其他兄弟节点的 sort_order
      if (newParentCode) {
        await this._adjustSiblingsSortOrder(templateId, newParentCode, newSortOrder, trx, true);
      }
    });

    return knex('template_sections').where({ id: sectionId }).first();
  }

  /**
   * 删除模板章节
   * @param {string} templateId
   * @param {string} sectionId
   * @returns {Promise<void>}
   */
  async deleteTemplateSection(templateId, sectionId) {
    const section = await knex('template_sections')
      .where({ id: sectionId, template_id: templateId })
      .first();

    if (!section) {
      throw new Error('章节不存在');
    }

    // 检查是否有子章节
    const children = await knex('template_sections')
      .where({ template_id: templateId, parent_code: section.code });

    if (children.length > 0) {
      throw new Error(`该章节包含 ${children.length} 个子章节，请先删除子章节`);
    }

    // 删除章节（CASCADE 会自动处理关联数据）
    await knex('template_sections').where({ id: sectionId }).del();
  }

  // ============================================
  // 私有辅助方法 - 模板章节
  // ============================================

  /**
   * 生成模板章节编号
   * @private
   */
  async _generateTemplateCode(templateId, parentCode, sortOrder) {
    if (!parentCode) {
      // 顶级章节：查找当前最大编号
      const maxCode = await knex('template_sections')
        .where({ template_id: templateId, parent_code: null })
        .max('code as max')
        .first();

      const nextNumber = maxCode.max ? parseInt(maxCode.max) + 1 : 1;
      return `${nextNumber}`;
    }

    // 子章节：parent.sortOrder
    return `${parentCode}.${sortOrder}`;
  }

  /**
   * 重新计算章节编号
   * @private
   */
  _recalculateCode(parentCode, sortOrder) {
    if (!parentCode) {
      return `${sortOrder}`;
    }
    return `${parentCode}.${sortOrder}`;
  }

  /**
   * 递归更新子章节的 code
   * @private
   */
  async _updateChildrenCodes(templateId, oldParentCode, newParentCode) {
    const children = await knex('template_sections')
      .where({ template_id: templateId, parent_code: oldParentCode });

    for (const child of children) {
      const newCode = child.code.replace(oldParentCode, newParentCode);

      await knex('template_sections')
        .where({ id: child.id })
        .update({
          code: newCode,
          parent_code: newParentCode
        });

      // 递归更新子章节的子章节
      await this._updateChildrenCodes(templateId, child.code, newCode);
    }
  }

  /**
   * 递归更新子章节的 code 和 level
   * @private
   */
  async _updateChildrenCodesAndLevels(templateId, oldParentCode, newParentCode, oldParentLevel, newParentLevel, trx) {
    const children = await trx('template_sections')
      .where({ template_id: templateId, parent_code: oldParentCode });

    const levelDiff = newParentLevel - oldParentLevel;

    for (const child of children) {
      const newCode = child.code.replace(oldParentCode, newParentCode);
      const newLevel = child.level + levelDiff;

      await trx('template_sections')
        .where({ id: child.id })
        .update({
          code: newCode,
          parent_code: newParentCode,
          level: newLevel,
        });

      // 递归更新子章节的子章节
      await this._updateChildrenCodesAndLevels(
        templateId,
        child.code,
        newCode,
        child.level,
        newLevel,
        trx
      );
    }
  }

  /**
   * 调整兄弟节点的 sort_order
   * @private
   */
  async _adjustSiblingsSortOrder(templateId, parentCode, fromSortOrder, trx, increment = false) {
    const query = trx('template_sections')
      .where({ template_id: templateId, parent_code: parentCode });

    if (increment) {
      // 插入时：后面的节点 +1
      await query
        .where('sort_order', '>=', fromSortOrder)
        .increment('sort_order', 1);
    } else {
      // 删除/移出时：后面的节点 -1
      await query
        .where('sort_order', '>', fromSortOrder)
        .decrement('sort_order', 1);
    }
  }
}

module.exports = new SectionService();
