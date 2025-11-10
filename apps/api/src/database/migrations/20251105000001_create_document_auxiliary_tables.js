/**
 * 统一文档管理系统 - 辅助表迁移
 * 包括：批注、版本、历史、附件、分类等
 * 创建日期: 2025-11-05
 */

exports.up = async function(knex) {
  // ============================================
  // 1. 文档批注表
  // ============================================
  await knex.schema.createTable('document_comments', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
    table.string('document_id', 50).notNullable();
    table.string('section_id', 50);

    // 批注锚点
    table.string('anchor_type', 20).notNullable().comment('section | text_range | annotation');
    table.jsonb('anchor_data');

    // 批注内容
    table.text('content').notNullable();
    table.string('comment_type', 20).defaultTo('general').comment('general | question | suggestion | risk');

    // 状态
    table.string('status', 20).defaultTo('open').comment('open | resolved | rejected');
    table.string('priority', 20).defaultTo('normal').comment('low | normal | high');

    // AI分析
    table.boolean('ai_risk_detected').defaultTo(false);
    table.string('ai_risk_type', 50);

    // 关联
    table.string('parent_comment_id', 50);

    table.string('created_by', 50).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.string('updated_by', 50);
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.string('resolved_by', 50);
    table.timestamp('resolved_at');

    // 外键
    table.foreign('document_id').references('project_documents.id').onDelete('CASCADE');
    table.foreign('section_id').references('document_sections.id').onDelete('CASCADE');
    table.foreign('parent_comment_id').references('document_comments.id').onDelete('CASCADE');

    // 索引
    table.index('document_id');
    table.index('section_id');
    table.index('status');
  });

  // ============================================
  // 2. 文档版本表
  // ============================================
  await knex.schema.createTable('document_versions', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
    table.string('document_id', 50).notNullable();
    table.integer('version_number').notNullable();

    // 快照
    table.jsonb('content_snapshot').notNullable();

    // 变更信息
    table.string('change_type', 20).comment('auto_save | manual_save | checkpoint');
    table.text('change_summary');

    table.string('created_by', 50);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // 外键
    table.foreign('document_id').references('project_documents.id').onDelete('CASCADE');

    // 索引
    table.index('document_id');
    table.index(['document_id', 'version_number']);
  });

  // ============================================
  // 3. 章节修改历史表
  // ============================================
  await knex.schema.createTable('section_change_history', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
    table.string('section_id', 50).notNullable();
    table.string('document_id', 50).notNullable();

    // 修改类型
    table.string('change_type', 50).notNullable()
      .comment('content_update | title_change | structure_change | created | deleted');

    // 修改前后对比
    table.text('before_value');
    table.text('after_value');
    table.jsonb('diff_data');

    // 修改统计
    table.integer('chars_added').defaultTo(0);
    table.integer('chars_deleted').defaultTo(0);
    table.integer('chars_modified').defaultTo(0);

    // AI分析的修改摘要
    table.text('ai_summary');

    // 修改人信息
    table.string('changed_by', 50).notNullable();
    table.string('changed_by_name', 100);
    table.string('changed_by_role', 100);

    // 修改原因
    table.text('change_reason');

    table.timestamp('created_at').defaultTo(knex.fn.now());

    // 外键
    table.foreign('section_id').references('document_sections.id').onDelete('CASCADE');
    table.foreign('document_id').references('project_documents.id').onDelete('CASCADE');

    // 索引
    table.index('section_id');
    table.index('document_id');
    table.index('created_at');
    table.index('changed_by');
  });

  // ============================================
  // 4. 章节审批历史表
  // ============================================
  await knex.schema.createTable('section_approval_history', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
    table.string('section_id', 50).notNullable();
    table.string('document_id', 50).notNullable();

    // 第几轮审批
    table.integer('round_number').notNullable();

    // 提交信息
    table.string('submitted_by', 50).notNullable();
    table.string('submitted_by_name', 100);
    table.timestamp('submitted_at').notNullable();

    // 审批信息
    table.string('reviewer_id', 50).notNullable();
    table.string('reviewer_name', 100);
    table.timestamp('reviewed_at');

    // 审批结果
    table.string('decision', 20).comment('approved | rejected | returned');
    table.text('review_comment');
    table.integer('issues_count').defaultTo(0);

    // 内容快照
    table.text('content_snapshot');

    table.timestamp('created_at').defaultTo(knex.fn.now());

    // 外键
    table.foreign('section_id').references('document_sections.id').onDelete('CASCADE');
    table.foreign('document_id').references('project_documents.id').onDelete('CASCADE');

    // 索引
    table.index('section_id');
    table.index('document_id');
    table.index(['section_id', 'round_number']);
  });

  // ============================================
  // 5. 文档附件表
  // ============================================
  await knex.schema.createTable('document_attachments', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
    table.string('document_id', 50).notNullable();

    // 文件信息
    table.string('file_name', 200).notNullable();
    table.string('file_type', 50).notNullable();
    table.bigInteger('file_size').notNullable();
    table.string('file_path', 500).notNullable();

    // 附件分类
    table.string('attachment_type', 50);
    table.string('attachment_category', 100);
    table.text('description');

    // 状态
    table.string('status', 20).defaultTo('active').comment('active | deleted');

    // 预览信息
    table.string('thumbnail_path', 500);
    table.boolean('preview_available').defaultTo(false);

    table.string('uploaded_by', 50).notNullable();
    table.timestamp('uploaded_at').defaultTo(knex.fn.now());
    table.string('updated_by', 50);
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // 外键
    table.foreign('document_id').references('project_documents.id').onDelete('CASCADE');

    // 索引
    table.index('document_id');
    table.index('attachment_type');
  });

  // ============================================
  // 6. 文档协作锁定表
  // ============================================
  await knex.schema.createTable('document_section_locks', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
    table.string('section_id', 50).notNullable().unique();
    table.string('document_id', 50).notNullable();

    // 锁定信息
    table.string('locked_by', 50).notNullable();
    table.timestamp('locked_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at').notNullable();

    // 锁定类型
    table.string('lock_type', 20).defaultTo('edit').comment('edit | review');

    // 外键
    table.foreign('section_id').references('document_sections.id').onDelete('CASCADE');
    table.foreign('document_id').references('project_documents.id').onDelete('CASCADE');

    // 索引
    table.index('document_id');
    table.index('expires_at');
  });

  // ============================================
  // 7. 操作日志表
  // ============================================
  await knex.schema.createTable('document_operation_logs', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
    table.string('document_id', 50).notNullable();
    table.string('section_id', 50);

    // 操作信息
    table.string('operation_type', 50).notNullable()
      .comment('create | update | delete | lock | unlock | approve | reject');
    table.string('operation_target', 50).comment('document | section | comment | attachment');

    // 操作详情
    table.jsonb('operation_data');

    // 操作人
    table.string('operator_id', 50).notNullable();
    table.string('operator_ip', 50);

    table.timestamp('created_at').defaultTo(knex.fn.now());

    // 外键
    table.foreign('document_id').references('project_documents.id').onDelete('CASCADE');
    table.foreign('section_id').references('document_sections.id').onDelete('CASCADE');

    // 索引
    table.index('document_id');
    table.index('operator_id');
    table.index('created_at');
    table.index('operation_type');
  });

  // ============================================
  // 8. AI生成历史表
  // ============================================
  await knex.schema.createTable('ai_generation_history', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
    table.string('document_id', 50);
    table.string('section_id', 50);

    // 生成任务
    table.string('task_type', 50).notNullable();
    table.jsonb('input_data');

    // 生成结果
    table.jsonb('output_data');
    table.decimal('confidence', 3, 2);

    // 用户反馈
    table.boolean('user_accepted');
    table.text('user_feedback');

    // LLM信息
    table.string('llm_model', 100);
    table.integer('llm_tokens');
    table.decimal('llm_cost', 10, 4);

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.string('created_by', 50);

    // 外键
    table.foreign('document_id').references('project_documents.id').onDelete('CASCADE');
    table.foreign('section_id').references('document_sections.id').onDelete('CASCADE');

    // 索引
    table.index('document_id');
    table.index('task_type');
  });

  // ============================================
  // 9. 模板版本历史表
  // ============================================
  await knex.schema.createTable('template_versions', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
    table.string('template_id', 50).notNullable();
    table.string('version', 20).notNullable();
    table.jsonb('section_structure').notNullable();
    table.text('changes_summary');
    table.string('created_by', 50);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // 外键
    table.foreign('template_id').references('document_templates.id').onDelete('CASCADE');

    // 索引
    table.index('template_id');
  });

  // ============================================
  // 10. 合同字段标注表
  // ============================================
  await knex.schema.createTable('section_field_annotations', (table) => {
    table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
    table.string('section_id', 50).notNullable();

    // 标注位置
    table.integer('start_offset').notNullable();
    table.integer('end_offset').notNullable();
    table.text('selected_text').notNullable();

    // 标注类型
    table.string('field_type', 50).notNullable();
    table.string('field_label', 100);
    table.text('field_value');

    // AI信息
    table.boolean('ai_detected').defaultTo(false);
    table.decimal('ai_confidence', 3, 2);

    // 风险标记
    table.boolean('has_risk').defaultTo(false);
    table.string('risk_level', 20).comment('low | medium | high');
    table.text('risk_description');

    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.string('created_by', 50);
    table.string('updated_by', 50);
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // 外键
    table.foreign('section_id').references('document_sections.id').onDelete('CASCADE');

    // 索引
    table.index('section_id');
  });

  console.log('✅ 统一文档系统辅助表创建完成');
};

exports.down = async function(knex) {
  // 按照依赖关系逆序删除表
  await knex.schema.dropTableIfExists('section_field_annotations');
  await knex.schema.dropTableIfExists('template_versions');
  await knex.schema.dropTableIfExists('ai_generation_history');
  await knex.schema.dropTableIfExists('document_operation_logs');
  await knex.schema.dropTableIfExists('document_section_locks');
  await knex.schema.dropTableIfExists('document_attachments');
  await knex.schema.dropTableIfExists('section_approval_history');
  await knex.schema.dropTableIfExists('section_change_history');
  await knex.schema.dropTableIfExists('document_versions');
  await knex.schema.dropTableIfExists('document_comments');

  console.log('✅ 统一文档系统辅助表删除完成');
};
