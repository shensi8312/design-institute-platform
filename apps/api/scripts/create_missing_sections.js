/**
 * 为缺失的章节创建数据库记录
 */

const knex = require('../src/config/database');
const path = require('path');
const fs = require('fs');

const SPECS_DIR = path.join(__dirname, '../../../docs/specs_zh 2');

/**
 * 从文件名提取章节编码和标题
 */
function extractFromFilename(filename) {
  // 匹配格式：323300 FL - Site Furnishings.docx
  const match = filename.match(/^(\d{2})(\d{2})(\d{2})(\.\d+)?\s+[A-Z]+\s+-\s+(.+)\.docx$/);
  if (match) {
    const [_, p1, p2, p3, decimal, title] = match;
    const code = `${p1} ${p2} ${p3}${decimal || ''}`;
    return { code, title };
  }
  return null;
}

/**
 * 扫描所有.docx文件
 */
function findAllDocxFiles(dir) {
  const files = [];

  function walk(currentDir) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (item.endsWith('.docx') && !item.startsWith('~$')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * 推断parent_code
 */
function inferParentCode(code) {
  const parts = code.split(' ');

  // 如果是 "01 81 13.14" 这样的格式，父节点是 "01 81 13"
  if (parts.length === 3 && parts[2].includes('.')) {
    const baseCode = parts[2].split('.')[0];
    return `${parts[0]} ${parts[1]} ${baseCode}`;
  }

  // 如果是 "01 81 13"，父节点是 "01 81 00"
  if (parts.length === 3 && parts[2] !== '00') {
    return `${parts[0]} ${parts[1]} 00`;
  }

  // 如果是 "01 81 00"，父节点是 "01 00 00"
  if (parts.length === 3 && parts[1] !== '00') {
    return `${parts[0]} 00 00`;
  }

  // 如果是 "01 00 00"，没有父节点
  return null;
}

/**
 * 推断层级
 */
function inferLevel(code) {
  const parts = code.split(' ');

  // 带小数点的是最深层级
  if (parts.length === 3 && parts[2].includes('.')) {
    return 4;
  }

  // "01 81 13" 是第3层
  if (parts.length === 3 && parts[2] !== '00') {
    return 3;
  }

  // "01 81 00" 是第2层
  if (parts.length === 3 && parts[1] !== '00') {
    return 2;
  }

  // "01 00 00" 是第1层
  return 1;
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始创建缺失的章节...\\n');

  // 获取CSI MasterFormat 2020模板ID
  const template = await knex('document_templates')
    .where({ code: 'csi_masterformat_2020' })
    .first();

  if (!template) {
    console.error('❌ 未找到CSI MasterFormat 2020模板');
    return;
  }

  console.log(`✅ 找到模板: ${template.name} (ID: ${template.id})\\n`);

  // 扫描所有.docx文件
  const docxFiles = findAllDocxFiles(SPECS_DIR);
  console.log(`📁 找到 ${docxFiles.length} 个.docx文件\\n`);

  let createdCount = 0;
  let existCount = 0;
  let failCount = 0;

  for (const filePath of docxFiles) {
    const filename = path.basename(filePath);
    const info = extractFromFilename(filename);

    if (!info) {
      continue;
    }

    const { code, title } = info;

    // 检查章节是否已存在
    const existing = await knex('template_sections')
      .where({
        template_id: template.id,
        code: code
      })
      .first();

    if (existing) {
      existCount++;
      continue;
    }

    // 创建新章节
    try {
      const parentCode = inferParentCode(code);
      const level = inferLevel(code);

      await knex('template_sections').insert({
        id: knex.raw('gen_random_uuid()'),
        template_id: template.id,
        code: code,
        title: title,
        level: level,
        parent_code: parentCode,
        sort_order: 0,
        is_required: false,
        is_editable: true,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });

      console.log(`✅ 创建: ${code} - ${title}`);
      createdCount++;
    } catch (error) {
      console.error(`❌ 创建失败 ${code}:`, error.message);
      failCount++;
    }
  }

  console.log(`\\n====================`);
  console.log(`✅ 创建: ${createdCount}`);
  console.log(`⏭️  已存在: ${existCount}`);
  console.log(`❌ 失败: ${failCount}`);
  console.log(`📊 总计: ${docxFiles.length}`);
  console.log(`====================\\n`);
}

main()
  .then(() => {
    console.log('✅ 完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 失败:', error);
    process.exit(1);
  });
