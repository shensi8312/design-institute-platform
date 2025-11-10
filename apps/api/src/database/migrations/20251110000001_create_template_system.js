exports.up = function(knex) {
  return knex.schema
    .createTable('document_templates', (table) => {
      table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
      table.string('code', 50).notNullable().unique().comment('模板编码');
      table.string('name', 100).notNullable().comment('模板名称');
      table.string('type', 50).notNullable().comment('文档类型');
      table.text('description').comment('模板描述');
      table.jsonb('config').comment('模板配置');
      table.string('section_code_format').comment('章节编号格式');
      table.integer('max_level').defaultTo(5).comment('最大层级');
      table.boolean('is_system').defaultTo(false).comment('是否系统模板');
      table.boolean('is_active').defaultTo(true).comment('是否启用');
      table.string('organization_id', 50).references('id').inTable('organizations');
      table.string('created_by', 50).references('id').inTable('users');
      table.timestamps(true, true);

      table.index(['type', 'is_active']);
      table.index(['organization_id']);
    })

    .createTable('template_sections', (table) => {
      table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
      table.string('template_id', 50).notNullable().references('id').inTable('document_templates').onDelete('CASCADE');
      table.string('code', 50).notNullable().comment('章节编号');
      table.text('title').notNullable().comment('章节标题');
      table.integer('level').notNullable().comment('层级');
      table.string('parent_code', 50).comment('父章节编号');
      table.text('description').comment('章节说明');
      table.text('template_content').comment('章节模板内容');
      table.jsonb('metadata').comment('元数据');
      table.integer('sort_order').defaultTo(0);
      table.boolean('is_required').defaultTo(true).comment('是否必填章节');
      table.boolean('is_editable').defaultTo(true).comment('是否可编辑');
      table.timestamps(true, true);

      table.unique(['template_id', 'code']);
      table.index(['template_id', 'level']);
      table.index(['template_id', 'parent_code']);
    })

    .createTable('document_instances', (table) => {
      table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
      table.string('template_id', 50).notNullable().references('id').inTable('document_templates');
      table.string('title', 200).notNullable().comment('文档标题');
      table.string('project_id', 50).references('id').inTable('projects');
      table.string('knowledge_base_id', 50).references('id').inTable('knowledge_bases');
      table.jsonb('variables').comment('模板变量值');
      table.enum('status', ['draft', 'in_review', 'approved', 'archived']).defaultTo('draft');
      table.string('created_by', 50).references('id').inTable('users');
      table.string('current_editor', 50).references('id').inTable('users');
      table.timestamp('last_edited_at');
      table.timestamps(true, true);

      table.index(['template_id']);
      table.index(['project_id']);
      table.index(['status']);
    })

    .createTable('instance_sections', (table) => {
      table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
      table.string('instance_id', 50).notNullable().references('id').inTable('document_instances').onDelete('CASCADE');
      table.string('section_code', 50).notNullable().comment('对应template_sections.code');
      table.text('content').comment('章节实际内容');
      table.jsonb('content_json').comment('结构化内容');
      table.integer('word_count').defaultTo(0);
      table.enum('status', ['empty', 'draft', 'completed', 'reviewed']).defaultTo('empty');
      table.string('last_edited_by', 50).references('id').inTable('users');
      table.timestamp('last_edited_at');
      table.timestamps(true, true);

      table.unique(['instance_id', 'section_code']);
      table.index(['instance_id']);
      table.index(['status']);
    })

    .createTable('document_locks', (table) => {
      table.string('id', 50).primary().defaultTo(knex.raw('gen_random_uuid()::text'));
      table.string('instance_id', 50).notNullable().references('id').inTable('document_instances').onDelete('CASCADE');
      table.string('section_code', 50);
      table.string('locked_by', 50).notNullable().references('id').inTable('users');
      table.timestamp('locked_at').defaultTo(knex.fn.now());
      table.timestamp('expires_at').notNullable();

      table.unique(['instance_id', 'section_code']);
      table.index(['expires_at']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTable('document_locks')
    .dropTable('instance_sections')
    .dropTable('document_instances')
    .dropTable('template_sections')
    .dropTable('document_templates');
};
