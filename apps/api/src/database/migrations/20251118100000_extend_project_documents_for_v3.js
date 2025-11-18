/**
 * V3.0 项目中心 - 扩展 project_documents 表
 * 创建日期: 2025-11-18
 *
 * 新增字段:
 * - document_subtype: 文档子类型 (tech/commercial/draft/final/amendment)
 * - responsible_department: 负责部门
 * - file_path: 文件存储路径
 * - file_name: 原始文件名
 * - file_size: 文件大小
 * - mime_type: 文件MIME类型
 */

exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('project_documents');

  if (!hasTable) {
    throw new Error('project_documents 表不存在，请先运行 20251105000000_create_unified_document_system.js');
  }

  await knex.schema.alterTable('project_documents', (table) => {
    // 添加文档子类型字段
    table.string('document_subtype', 50)
      .comment('文档子类型: tech-技术标 | commercial-商务标 | draft-草稿 | final-定稿 | amendment-修订版');

    // 添加负责部门字段
    table.string('responsible_department', 100)
      .comment('负责部门');

    // 添加文件信息字段
    table.string('file_path', 500)
      .comment('文件存储路径');

    table.string('file_name', 200)
      .comment('原始文件名');

    table.bigInteger('file_size')
      .comment('文件大小（字节）');

    table.string('mime_type', 100)
      .comment('文件MIME类型');

    // 添加索引
    table.index('document_subtype');
    table.index('responsible_department');
  });

  console.log('✅ project_documents 表扩展完成 (V3.0)');
};

exports.down = async function(knex) {
  await knex.schema.alterTable('project_documents', (table) => {
    table.dropColumn('document_subtype');
    table.dropColumn('responsible_department');
    table.dropColumn('file_path');
    table.dropColumn('file_name');
    table.dropColumn('file_size');
    table.dropColumn('mime_type');
  });

  console.log('✅ project_documents 表扩展回滚完成');
};
