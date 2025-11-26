/**
 * CSI SPEC 标准化系统
 *
 * 表结构：
 * 1. spec_csi_framework - CSI 标准框架（骨架）
 * 2. spec_contents - 多来源内容
 * 3. spec_custom_sections - 公司自定义章节
 */

exports.up = async function(knex) {
  // 1. CSI 标准框架表 - 存储 CSI MasterFormat 标准章节结构
  await knex.schema.createTable('spec_csi_framework', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // CSI 编号体系
    table.string('division', 2).notNullable();           // Division: 09
    table.string('section_code', 20).notNullable();      // Section: 092900
    table.string('full_code', 50).notNullable().unique(); // 完整编号: 092900.1.1.A.1

    // 层级信息
    table.integer('level').notNullable();                // 层级: 0=DIV, 1=SEC, 2=PRT, 3=ART, 4=PR1, 5=PR2, 6=PR3, 7=PR4, 8=PR5
    table.string('level_type', 10).notNullable();        // 层级类型: DIV/SEC/PRT/ART/PR1/PR2/PR3/PR4/PR5
    table.string('level_label', 20);                     // 层级标签: A./1./a./1)/a)

    // 标题
    table.string('title_en', 500);                       // 英文标题
    table.string('title_zh', 500);                       // 中文标题

    // 父子关系
    table.string('parent_code', 50);                     // 父节点 full_code
    table.integer('sort_order').defaultTo(0);            // 排序

    // 元数据
    table.string('source', 50).defaultTo('CSI_2020');    // 来源版本
    table.jsonb('metadata').defaultTo('{}');             // 扩展元数据

    table.timestamps(true, true);

    // 索引
    table.index('division');
    table.index('section_code');
    table.index('level');
    table.index('parent_code');
    table.index(['division', 'level']);
  });

  // 2. SPEC 内容表 - 存储多来源的内容
  await knex.schema.createTable('spec_contents', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // 关联 CSI 框架
    table.uuid('framework_id').references('id').inTable('spec_csi_framework').onDelete('CASCADE');
    table.string('framework_code', 50).notNullable();    // 冗余存储 full_code 便于查询

    // 内容来源
    table.string('source_type', 50).notNullable();       // CSI_EN/CSI_ZH/COMPANY/MASTER
    table.string('source_name', 200);                    // 来源名称（如项目名）
    table.uuid('source_template_id');                    // 关联的模板ID

    // 内容
    table.text('content_en');                            // 英文内容
    table.text('content_zh');                            // 中文内容
    table.text('content_html');                          // HTML格式内容

    // 状态
    table.boolean('is_master').defaultTo(false);         // 是否为融合后的主版本
    table.float('ai_confidence');                        // AI匹配置信度
    table.string('match_status', 20).defaultTo('auto'); // auto/manual/pending

    // 元数据
    table.jsonb('metadata').defaultTo('{}');
    table.uuid('created_by');
    table.timestamps(true, true);

    // 索引
    table.index('framework_id');
    table.index('framework_code');
    table.index('source_type');
    table.index('is_master');
    table.index(['framework_code', 'source_type']);
  });

  // 3. 公司自定义章节表 - CSI 标准没有但公司需要的章节
  await knex.schema.createTable('spec_custom_sections', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // 编号信息
    table.string('section_code', 20).notNullable();      // 所属 Section: 092900
    table.string('custom_code', 50).notNullable();       // 自定义编号: 092900.1.10
    table.string('parent_code', 50);                     // 父节点编号

    // 层级
    table.integer('level').notNullable();
    table.string('level_type', 10).notNullable();
    table.string('level_label', 20);

    // 标题
    table.string('title_en', 500);
    table.string('title_zh', 500).notNullable();

    // 来源
    table.string('source_name', 200);                    // 来源项目/公司
    table.uuid('source_template_id');

    // 状态
    table.boolean('is_approved').defaultTo(false);       // 是否已审批纳入标准
    table.integer('usage_count').defaultTo(1);           // 使用次数

    table.jsonb('metadata').defaultTo('{}');
    table.uuid('created_by');
    table.timestamps(true, true);

    // 唯一约束
    table.unique(['section_code', 'custom_code']);

    // 索引
    table.index('section_code');
    table.index('parent_code');
    table.index('is_approved');
  });

  // 4. 扩展 template_sections 表 - 添加 CSI 关联字段
  const hasFrameworkColumn = await knex.schema.hasColumn('template_sections', 'csi_framework_id');
  if (!hasFrameworkColumn) {
    await knex.schema.alterTable('template_sections', (table) => {
      table.uuid('csi_framework_id').references('id').inTable('spec_csi_framework');
      table.string('csi_full_code', 50);                 // CSI 完整编号
      table.string('csi_level_type', 10);                // CSI 层级类型
      table.boolean('is_csi_custom').defaultTo(false);   // 是否为自定义章节
    });
  }

  // 5. 扩展 document_templates 表 - 添加来源类型
  const hasSourceTypeColumn = await knex.schema.hasColumn('document_templates', 'source_type');
  if (!hasSourceTypeColumn) {
    await knex.schema.alterTable('document_templates', (table) => {
      table.string('source_type', 50);                   // CSI_EN/CSI_ZH/COMPANY
      table.string('source_project', 200);               // 来源项目名（公司SPEC时）
      table.boolean('csi_parsed').defaultTo(false);      // 是否已完成CSI解析
      table.jsonb('csi_parse_result').defaultTo('{}');   // CSI解析结果
    });
  }
};

exports.down = async function(knex) {
  // 移除扩展字段
  const hasSourceTypeColumn = await knex.schema.hasColumn('document_templates', 'source_type');
  if (hasSourceTypeColumn) {
    await knex.schema.alterTable('document_templates', (table) => {
      table.dropColumn('source_type');
      table.dropColumn('source_project');
      table.dropColumn('csi_parsed');
      table.dropColumn('csi_parse_result');
    });
  }

  const hasFrameworkColumn = await knex.schema.hasColumn('template_sections', 'csi_framework_id');
  if (hasFrameworkColumn) {
    await knex.schema.alterTable('template_sections', (table) => {
      table.dropColumn('csi_framework_id');
      table.dropColumn('csi_full_code');
      table.dropColumn('csi_level_type');
      table.dropColumn('is_csi_custom');
    });
  }

  await knex.schema.dropTableIfExists('spec_custom_sections');
  await knex.schema.dropTableIfExists('spec_contents');
  await knex.schema.dropTableIfExists('spec_csi_framework');
};
