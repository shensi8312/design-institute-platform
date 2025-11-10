/**
 * 导入specs_zh目录下的.docx文件内容到template_sections
 */

const knex = require('../src/config/database');
const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');

const SPECS_DIR = path.join(__dirname, '../../../docs/specs_zh');

/**
 * 从文件名提取章节编码
 * 例如："323300 FL - 场地设施.docx" → "32 33 00"
 */
function extractCodeFromFilename(filename) {
  const match = filename.match(/^(\d{6})\s/);
  if (match) {
    const code = match[1];
    // 转换为空格分隔格式：323300 → 32 33 00
    return code.match(/.{1,2}/g).join(' ');
  }
  return null;
}

/**
 * 读取.docx文件内容
 */
async function readDocx(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (error) {
    console.error(`读取文件失败: ${filePath}`, error.message);
    return null;
  }
}

/**
 * 扫描目录下所有.docx文件
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
 * 主函数
 */
async function main() {
  console.log('🚀 开始导入specs_zh文件内容...\n');

  // 获取CSI MasterFormat 2020模板ID
  const template = await knex('document_templates')
    .where({ code: 'csi_masterformat_2020' })
    .first();

  if (!template) {
    console.error('❌ 未找到CSI MasterFormat 2020模板');
    return;
  }

  console.log(`✅ 找到模板: ${template.name} (ID: ${template.id})\n`);

  // 扫描所有.docx文件
  const docxFiles = findAllDocxFiles(SPECS_DIR);
  console.log(`📁 找到 ${docxFiles.length} 个.docx文件\n`);

  let successCount = 0;
  let failCount = 0;
  let notFoundCount = 0;

  for (const filePath of docxFiles) {
    const filename = path.basename(filePath);
    const code = extractCodeFromFilename(filename);

    if (!code) {
      console.log(`⏭️  跳过: ${filename} (无法提取编码)`);
      failCount++;
      continue;
    }

    // 查找对应的章节
    const section = await knex('template_sections')
      .where({
        template_id: template.id,
        code: code
      })
      .first();

    if (!section) {
      console.log(`⚠️  未找到章节: ${code} (${filename})`);
      notFoundCount++;
      continue;
    }

    // 读取.docx内容
    const content = await readDocx(filePath);

    if (!content) {
      console.log(`❌ 读取失败: ${filename}`);
      failCount++;
      continue;
    }

    // 更新章节description字段
    await knex('template_sections')
      .where({ id: section.id })
      .update({
        description: content,
        updated_at: knex.fn.now()
      });

    console.log(`✅ ${code} - ${section.title} (${content.length}字符)`);
    successCount++;
  }

  console.log(`\n====================`);
  console.log(`✅ 成功: ${successCount}`);
  console.log(`⚠️  未找到: ${notFoundCount}`);
  console.log(`❌ 失败: ${failCount}`);
  console.log(`📊 总计: ${docxFiles.length}`);
  console.log(`====================\n`);
}

main()
  .then(() => {
    console.log('✅ 导入完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 导入失败:', error);
    process.exit(1);
  });
