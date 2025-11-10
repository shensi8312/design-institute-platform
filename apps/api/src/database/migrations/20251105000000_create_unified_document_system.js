/**
 * 统一文档管理系统 - 核心表迁移
 * 创建日期: 2025-11-05
 */

exports.up = async function(knex) {
  // ============================================
  // 1. 文档模板表
  // ============================================
  await knex.schema.createTable('document_templates', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));

    // 基本信息
    table.string('name', 200).notNullable();
    table.string('template_type', 50).notNullable().comment('spec | contract | bidding');
    table.string('version', 20).defaultTo('v1.0');
    table.text('description');

    // 文件信息
    table.string('file_path', 500);
    table.string('file_name', 200);
    table.string('file_type', 50);
    table.bigInteger('file_size');

    // 章节结构（JSON存储）
    table.jsonb('section_structure').notNullable();

    // 变量定义
    table.jsonb('variables').defaultTo('[]');

    // 配置
    table.jsonb('config').defaultTo('{}');

    // 状态
    table.string('status', 20).defaultTo('draft').comment('draft | published | archived');

    // 元数据
    table.string('created_by', 50);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.string('updated_by', 50);
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('published_at');
    table.string('published_by', 50);

    // 索引
    table.index('template_type');
    table.index('status');
  });

  // ============================================
  // 2. 项目文档表
  // ============================================
  await knex.schema.createTable('project_documents', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));

    table.string('title', 200).notNullable();
    table.string('document_type', 50).notNullable().comment('spec | contract | bidding');

    // 关联关系
    table.string('project_id', 50).notNullable();
    table.string('template_id', 50);
    table.string('template_version', 20);

    // 状态
    table.string('status', 20).defaultTo('draft')
      .comment('draft | in_review | completed | archive_pending | archived');

    // 密级（归档后才设置）
    table.string('security_level', 20);

    table.string('created_by', 50).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.string('updated_by', 50);
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // 完成信息
    table.timestamp('completed_at');
    table.string('completed_by', 50);

    // 归档信息
    table.timestamp('archived_at');
    table.string('archived_by', 50);

    // 外键
    table.foreign('project_id').references('projects.id').onDelete('CASCADE');
    table.foreign('template_id').references('document_templates.id');

    // 索引
    table.index('project_id');
    table.index('document_type');
    table.index('status');
    table.index('template_id');
  });

  // ============================================
  // 3. 文档章节表
  // ============================================
  await knex.schema.createTable('document_sections', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
    table.string('document_id', 50).notNullable();

    // 章节信息
    table.string('section_code', 50);
    table.string('title', 200).notNullable();
    table.integer('level').notNullable();
    table.string('parent_id', 50);
    table.integer('sort_order').defaultTo(0);

    // 内容
    table.text('content');
    table.string('content_format', 20).defaultTo('html');

    // 元数据
    table.boolean('from_template').defaultTo(false);
    table.string('template_section_id', 50);
    table.boolean('editable').defaultTo(true);
    table.boolean('deletable').defaultTo(true);

    // AI标记
    table.boolean('ai_generated').defaultTo(false);
    table.decimal('ai_confidence', 3, 2);

    // 审批状态
    table.string('approval_status', 20).defaultTo('draft')
      .comment('draft | submitted | in_review | approved | rejected | revision_needed');
    table.string('current_reviewer_id', 50);
    table.string('current_reviewer_name', 100);
    table.timestamp('last_submitted_at');
    table.timestamp('last_approved_at');
    table.string('last_approved_by', 50);
    table.integer('pending_issues_count').defaultTo(0);

    table.string('created_by', 50);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.string('updated_by', 50);
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // 外键
    table.foreign('document_id').references('project_documents.id').onDelete('CASCADE');
    table.foreign('parent_id').references('document_sections.id').onDelete('CASCADE');

    // 索引
    table.index('document_id');
    table.index('parent_id');
    table.index(['document_id', 'sort_order']);
    table.index('approval_status');
    table.index('current_reviewer_id');
  });

  // ============================================
  // 4. 修订追踪表
  // ============================================
  await knex.schema.createTable('section_revisions', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
    table.string('section_id', 50).notNullable();
    table.string('document_id', 50).notNullable();

    // 修订类型
    table.string('revision_type', 20).notNullable().comment('insert | delete | replace');

    // 修改位置
    table.integer('start_offset').notNullable();
    table.integer('end_offset').notNullable();

    // 修改内容
    table.text('original_text');
    table.text('new_text');

    // 格式变更
    table.jsonb('format_changes');

    // 修订状态
    table.string('status', 20).defaultTo('pending').comment('pending | accepted | rejected');

    // 修改人信息
    table.string('author_id', 50).notNullable();
    table.string('author_name', 100).notNullable();
    table.string('author_color', 20);

    // 接受/拒绝信息
    table.string('reviewed_by', 50);
    table.timestamp('reviewed_at');
    table.text('review_comment');

    table.timestamp('created_at').defaultTo(knex.fn.now());

    // 外键
    table.foreign('section_id').references('document_sections.id').onDelete('CASCADE');
    table.foreign('document_id').references('project_documents.id').onDelete('CASCADE');

    // 索引
    table.index('section_id');
    table.index('status');
    table.index('author_id');
    table.index('created_at');
  });

  // ============================================
  // 5. 修订颜色分配表
  // ============================================
  await knex.schema.createTable('document_collaborator_colors', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
    table.string('document_id', 50).notNullable();
    table.string('user_id', 50).notNullable();
    table.string('color', 20).notNullable();
    table.string('color_name', 50);
    table.timestamp('assigned_at').defaultTo(knex.fn.now());

    table.foreign('document_id').references('project_documents.id').onDelete('CASCADE');
    table.unique(['document_id', 'user_id']);
  });

  // ============================================
  // 6. 章节审批任务表
  // ============================================
  await knex.schema.createTable('section_approval_tasks', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
    table.string('section_id', 50).notNullable();
    table.string('document_id', 50).notNullable();

    // 提交信息
    table.string('submitted_by', 50).notNullable();
    table.string('submitted_by_name', 100);
    table.timestamp('submitted_at').defaultTo(knex.fn.now());
    table.text('submission_message');

    // 审批人
    table.string('reviewer_id', 50).notNullable();
    table.string('reviewer_name', 100);
    table.string('reviewer_role', 100);

    // 审批状态
    table.string('status', 20).defaultTo('pending')
      .comment('pending | reviewing | approved | rejected | returned');

    // 审批结果
    table.string('review_decision', 20);
    table.text('review_comment');
    table.timestamp('reviewed_at');

    // 修改要求
    table.boolean('revision_required').defaultTo(false);
    table.integer('revision_count').defaultTo(0);

    // 审批时限
    table.timestamp('due_date');
    table.boolean('is_overdue').defaultTo(false);

    // 章节快照
    table.jsonb('section_snapshot');

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // 外键
    table.foreign('section_id').references('document_sections.id').onDelete('CASCADE');
    table.foreign('document_id').references('project_documents.id').onDelete('CASCADE');

    // 索引
    table.index('section_id');
    table.index('document_id');
    table.index('reviewer_id');
    table.index('status');
    table.index('submitted_by');
  });

  // ============================================
  // 7. 审批问题点表
  // ============================================
  await knex.schema.createTable('section_review_issues', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
    table.string('approval_task_id', 50).notNullable();
    table.string('section_id', 50).notNullable();

    // 问题类型
    table.string('issue_type', 50).notNullable().comment('error | warning | suggestion | question');
    table.string('severity', 20).defaultTo('medium').comment('low | medium | high | critical');

    // 文本位置
    table.integer('start_offset');
    table.integer('end_offset');
    table.text('selected_text');

    // 问题描述
    table.string('issue_title', 200).notNullable();
    table.text('issue_description').notNullable();
    table.text('suggested_fix');

    // 状态
    table.string('status', 20).defaultTo('open').comment('open | fixed | wont_fix | disputed');

    // 修复信息
    table.string('fixed_by', 50);
    table.timestamp('fixed_at');
    table.text('fix_comment');

    // 审批人确认
    table.boolean('verified_by_reviewer').defaultTo(false);
    table.timestamp('verified_at');

    table.string('created_by', 50).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // 外键
    table.foreign('approval_task_id').references('section_approval_tasks.id').onDelete('CASCADE');
    table.foreign('section_id').references('document_sections.id').onDelete('CASCADE');

    // 索引
    table.index('approval_task_id');
    table.index('section_id');
    table.index('status');
    table.index('created_by');
  });

  // ============================================
  // 8. 归档申请表
  // ============================================
  await knex.schema.createTable('archive_requests', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
    table.string('document_id', 50).notNullable();

    // 申请信息
    table.string('requester_id', 50).notNullable();
    table.text('request_reason');
    table.string('suggested_category', 100);
    table.jsonb('suggested_tags').defaultTo('[]');

    // 审核状态
    table.string('status', 20).defaultTo('pending').comment('pending | approved | rejected');
    table.string('reviewer_id', 50);
    table.text('review_comment');
    table.timestamp('reviewed_at');

    table.timestamp('created_at').defaultTo(knex.fn.now());

    // 外键
    table.foreign('document_id').references('project_documents.id').onDelete('CASCADE');

    // 索引
    table.index('status');
  });

  // ============================================
  // 9. 文档权限表
  // ============================================
  await knex.schema.createTable('document_permissions', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
    table.string('document_id', 50).notNullable();

    // 权限级别
    table.string('permission_level', 20).notNullable()
      .comment('enterprise | branch | department | project | discipline | personal');

    // 权限范围
    table.string('branch_id', 50);
    table.string('department_id', 50);
    table.string('project_id', 50);
    table.string('discipline_code', 50);
    table.string('user_id', 50);

    // 权限类型
    table.string('permission_type', 20).defaultTo('view').comment('view | download | reference');

    // 设置信息
    table.string('granted_by', 50).notNullable();
    table.timestamp('granted_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at');

    table.timestamp('created_at').defaultTo(knex.fn.now());

    // 外键
    table.foreign('document_id').references('project_documents.id').onDelete('CASCADE');

    // 索引
    table.index('document_id');
    table.index('permission_level');
    table.index('branch_id');
    table.index('department_id');
    table.index('project_id');
  });

  // ============================================
  // 10. 文档修订设置表
  // ============================================
  await knex.schema.createTable('document_revision_settings', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
    table.string('document_id', 50).notNullable().unique();

    // 修订模式
    table.boolean('track_changes_enabled').defaultTo(false);

    // 权限配置
    table.string('who_can_edit', 20).defaultTo('all').comment('all | owner_only | reviewers_only');
    table.string('who_can_accept_reject', 20).defaultTo('owner').comment('owner | reviewers | anyone');

    // 自动接受配置
    table.integer('auto_accept_after_days');

    // 显示配置
    table.boolean('show_revisions').defaultTo(true);
    table.boolean('show_comments').defaultTo(true);

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // 外键
    table.foreign('document_id').references('project_documents.id').onDelete('CASCADE');
  });

  console.log('✅ 统一文档系统核心表创建完成');
};

exports.down = async function(knex) {
  // 按照依赖关系逆序删除表
  await knex.schema.dropTableIfExists('document_revision_settings');
  await knex.schema.dropTableIfExists('document_permissions');
  await knex.schema.dropTableIfExists('archive_requests');
  await knex.schema.dropTableIfExists('section_review_issues');
  await knex.schema.dropTableIfExists('section_approval_tasks');
  await knex.schema.dropTableIfExists('document_collaborator_colors');
  await knex.schema.dropTableIfExists('section_revisions');
  await knex.schema.dropTableIfExists('document_sections');
  await knex.schema.dropTableIfExists('project_documents');
  await knex.schema.dropTableIfExists('document_templates');

  console.log('✅ 统一文档系统核心表删除完成');
};
