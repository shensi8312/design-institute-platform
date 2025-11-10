/**
 * 添加文件存储字段到document_templates表
 * 用于支持OnlyOffice在线编辑
 */

exports.up = function(knex) {
  return knex.schema.table('document_templates', (table) => {
    // 添加文件存储相关字段
    table.string('file_path').nullable().comment('文件路径（Minio或本地）');
    table.string('file_name').nullable().comment('原始文件名');
    table.string('file_type').nullable().comment('文件MIME类型');
    table.bigInteger('file_size').nullable().comment('文件大小（字节）');
    table.string('minio_bucket').nullable().comment('Minio存储桶');
    table.string('minio_object').nullable().comment('Minio对象名');

    // 添加版本和状态字段
    table.string('version', 50).nullable().defaultTo('1.0').comment('模板版本');
    table.string('status', 50).nullable().defaultTo('draft').comment('状态: draft/published/archived');
    table.timestamp('published_at').nullable().comment('发布时间');
    table.string('published_by', 50).nullable().comment('发布人');

    // 添加索引
    table.index('status');
    table.index('minio_bucket');
  });
};

exports.down = function(knex) {
  return knex.schema.table('document_templates', (table) => {
    table.dropColumn('file_path');
    table.dropColumn('file_name');
    table.dropColumn('file_type');
    table.dropColumn('file_size');
    table.dropColumn('minio_bucket');
    table.dropColumn('minio_object');
    table.dropColumn('version');
    table.dropColumn('status');
    table.dropColumn('published_at');
    table.dropColumn('published_by');
  });
};
