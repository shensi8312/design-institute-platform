/**
 * 章节审批服务
 * 核心：章节级审批工作流
 */

const knex = require('../../config/database');
const DocumentDomainConfig = require('../../config/DocumentDomainConfig');

class SectionApprovalService {
  constructor() {
    this.domainConfig = DocumentDomainConfig;
  }

  /**
   * 提交章节审批
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async submitSectionForApproval({
    sectionId,
    documentId,
    reviewerId,
    reviewerName,
    reviewerRole,
    submittedBy,
    submittedByName,
    message
  }) {
    // 创建章节快照
    const section = await knex('document_sections')
      .where({ id: sectionId })
      .first();

    const snapshot = {
      title: section.title,
      content: section.content,
      updated_at: section.updated_at,
    };

    // 创建审批任务
    const [task] = await knex('section_approval_tasks').insert({
      section_id: sectionId,
      document_id: documentId,
      submitted_by: submittedBy,
      submitted_by_name: submittedByName,
      submission_message: message,
      reviewer_id: reviewerId,
      reviewer_name: reviewerName,
      reviewer_role: reviewerRole,
      status: 'pending',
      section_snapshot: JSON.stringify(snapshot),
    }).returning('*');

    // 更新章节审批状态
    await knex('document_sections')
      .where({ id: sectionId })
      .update({
        approval_status: 'submitted',
        current_reviewer_id: reviewerId,
        current_reviewer_name: reviewerName,
        last_submitted_at: knex.fn.now(),
      });

    // TODO: 发送通知给审批人

    return task;
  }

  /**
   * 审批章节
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async reviewSection({
    taskId,
    reviewerId,
    decision, // 'approved' | 'rejected' | 'returned'
    comment,
    issues
  }) {
    const task = await this.getApprovalTask(taskId);

    // 记录问题点
    if (issues && issues.length > 0) {
      for (const issue of issues) {
        await this.createReviewIssue({
          approvalTaskId: taskId,
          sectionId: task.section_id,
          ...issue,
        });
      }
    }

    // 更新任务状态
    await knex('section_approval_tasks')
      .where({ id: taskId })
      .update({
        status: decision,
        review_decision: decision,
        review_comment: comment,
        reviewed_at: knex.fn.now(),
      });

    // 更新章节审批状态
    let newApprovalStatus = 'draft';
    if (decision === 'approved') {
      newApprovalStatus = 'approved';
    } else if (decision === 'rejected') {
      newApprovalStatus = 'rejected';
    } else if (decision === 'returned') {
      newApprovalStatus = 'revision_needed';
    }

    await knex('document_sections')
      .where({ id: task.section_id })
      .update({
        approval_status: newApprovalStatus,
        current_reviewer_id: decision === 'approved' ? null : task.reviewer_id,
        last_approved_at: decision === 'approved' ? knex.fn.now() : null,
        last_approved_by: decision === 'approved' ? reviewerId : null,
        pending_issues_count: issues ? issues.length : 0,
      });

    // 记录审批历史
    await this._recordApprovalHistory(task, decision, comment, issues ? issues.length : 0);

    return this.getApprovalTask(taskId);
  }

  /**
   * 创建审批问题点
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async createReviewIssue({
    approvalTaskId,
    sectionId,
    issueType,
    severity,
    startOffset,
    endOffset,
    selectedText,
    issueTitle,
    issueDescription,
    suggestedFix,
    createdBy
  }) {
    const [issue] = await knex('section_review_issues').insert({
      approval_task_id: approvalTaskId,
      section_id: sectionId,
      issue_type: issueType,
      severity,
      start_offset: startOffset,
      end_offset: endOffset,
      selected_text: selectedText,
      issue_title: issueTitle,
      issue_description: issueDescription,
      suggested_fix: suggestedFix,
      status: 'open',
      created_by: createdBy,
    }).returning('*');

    return issue;
  }

  /**
   * 修复问题点
   * @param {string} issueId
   * @param {string} userId
   * @param {string} comment
   * @returns {Promise<Object>}
   */
  async fixIssue(issueId, userId, comment) {
    await knex('section_review_issues')
      .where({ id: issueId })
      .update({
        status: 'fixed',
        fixed_by: userId,
        fixed_at: knex.fn.now(),
        fix_comment: comment,
      });

    // 更新章节的待解决问题数
    const issue = await knex('section_review_issues')
      .where({ id: issueId })
      .first();

    const openIssuesCount = await knex('section_review_issues')
      .where({ section_id: issue.section_id, status: 'open' })
      .count('id as count')
      .first();

    await knex('document_sections')
      .where({ id: issue.section_id })
      .update({ pending_issues_count: parseInt(openIssuesCount.count) });

    return issue;
  }

  /**
   * 获取审批任务详情
   * @param {string} taskId
   * @returns {Promise<Object>}
   */
  async getApprovalTask(taskId) {
    const task = await knex('section_approval_tasks')
      .where({ id: taskId })
      .first();

    if (!task) {
      throw new Error('审批任务不存在');
    }

    // 加载问题点
    task.issues = await knex('section_review_issues')
      .where({ approval_task_id: taskId })
      .orderBy('created_at', 'asc');

    return task;
  }

  /**
   * 获取审批人的待审批任务
   * @param {string} reviewerId
   * @returns {Promise<Array>}
   */
  async getReviewerPendingTasks(reviewerId) {
    return knex('section_approval_tasks')
      .where({ reviewer_id: reviewerId, status: 'pending' })
      .orderBy('submitted_at', 'asc');
  }

  /**
   * 记录审批历史
   * @private
   */
  async _recordApprovalHistory(task, decision, comment, issuesCount) {
    // 获取审批轮次
    const historyCount = await knex('section_approval_history')
      .where({ section_id: task.section_id })
      .count('id as count')
      .first();

    const roundNumber = parseInt(historyCount.count) + 1;

    await knex('section_approval_history').insert({
      section_id: task.section_id,
      document_id: task.document_id,
      round_number: roundNumber,
      submitted_by: task.submitted_by,
      submitted_by_name: task.submitted_by_name,
      submitted_at: task.submitted_at,
      reviewer_id: task.reviewer_id,
      reviewer_name: task.reviewer_name,
      reviewed_at: knex.fn.now(),
      decision,
      review_comment: comment,
      issues_count: issuesCount,
      content_snapshot: task.section_snapshot,
    });
  }
}

module.exports = new SectionApprovalService();
