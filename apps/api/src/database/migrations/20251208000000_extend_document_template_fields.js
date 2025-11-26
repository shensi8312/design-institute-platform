/**
 * 扩展 document_templates 字段长度，避免批量导入长文件名报错
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('document_templates', (table) => {
    table.string('name', 255).alter();          // 原 100
    table.string('file_name', 512).alter();     // 原 255
    table.string('file_type', 255).alter();     // 原 100
    table.string('minio_object', 512).alter();  // 原 500
    table.string('project_type', 100).alter();  // 原 50
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('document_templates', (table) => {
    table.string('name', 100).alter();
    table.string('file_name', 255).alter();
    table.string('file_type', 100).alter();
    table.string('minio_object', 500).alter();
    table.string('project_type', 50).alter();
  });
};
