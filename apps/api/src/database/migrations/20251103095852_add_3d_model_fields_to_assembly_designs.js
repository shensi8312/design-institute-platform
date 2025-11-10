/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  const hasModelPath = await knex.schema.hasColumn('assembly_designs', 'model_3d_path');
  const hasModelFormat = await knex.schema.hasColumn('assembly_designs', 'model_format');
  const hasOriginalFormat = await knex.schema.hasColumn('assembly_designs', 'original_format');
  const hasFileSize = await knex.schema.hasColumn('assembly_designs', 'file_size');
  const hasConversionStatus = await knex.schema.hasColumn('assembly_designs', 'conversion_status');

  return knex.schema.table('assembly_designs', table => {
    if (!hasModelPath) {
      table.string('model_3d_path', 500).nullable().comment('3D模型文件路径');
    }
    if (!hasModelFormat) {
      table.string('model_format', 50).nullable().comment('3D模型格式 (STL/OBJ/STEP/SLDPRT等)');
    }
    if (!hasOriginalFormat) {
      table.string('original_format', 20).nullable().comment('原始文件格式（如果有转换）');
    }
    if (!hasFileSize) {
      table.bigInteger('file_size').nullable().comment('文件大小（字节）');
    }
    if (!hasConversionStatus) {
      table.string('conversion_status', 20).defaultTo('none').comment('转换状态: pending/completed/failed/none');
    }
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('assembly_designs', table => {
    table.dropColumn('model_3d_path');
    table.dropColumn('model_format');
    table.dropColumn('original_format');
    table.dropColumn('file_size');
    table.dropColumn('conversion_status');
  });
};
