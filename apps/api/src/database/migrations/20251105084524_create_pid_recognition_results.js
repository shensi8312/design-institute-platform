exports.up = function(knex) {
  return knex.schema.createTable('pid_recognition_results', table => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    // 关联原始文档
    table.uuid('document_id').references('id').inTable('knowledge_documents').onDelete('CASCADE'); // [PE-fix-table-name: documents表不存在，应为knowledge_documents]
    table.string('file_name').notNullable();
    table.string('file_path'); // 原始PDF路径

    // 识别结果（JSON格式）
    table.json('components').notNullable().defaultTo('[]'); // 检测到的组件
    table.json('connections').notNullable().defaultTo('[]'); // 连接关系
    table.json('visualization_urls').defaultTo('[]'); // 标注图URL
    table.json('graph_analysis'); // 图拓扑分析结果

    // 识别元数据
    table.integer('page_count').defaultTo(1);
    table.integer('component_count').defaultTo(0); // 组件总数
    table.integer('connection_count').defaultTo(0); // 连接总数

    // 状态管理
    table.enum('status', ['draft', 'confirmed', 'rejected']).defaultTo('draft');
    table.text('user_notes'); // 用户备注

    // 审核跟踪
    table.string('created_by', 50).references('id').inTable('users');
    table.string('confirmed_by', 50).references('id').inTable('users');
    table.timestamp('confirmed_at');

    // 时间戳
    table.timestamps(true, true);

    // 索引
    table.index('document_id');
    table.index('status');
    table.index('created_by');
    table.index('created_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('pid_recognition_results');
};
