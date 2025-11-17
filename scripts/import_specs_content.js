#!/usr/bin/env node

/**
 * 导入specs_docx文档内容到template_sections表
 */

const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const knex = require('../apps/api/src/config/database');

// 将6位编号转换为章节编号（如 000101 -> 00 01 01）
function convertCodeToSectionNumber(code) {
  if (code.length !== 6) return null;
  return `${code.slice(0, 2)} ${code.slice(2, 4)} ${code.slice(4, 6)}`;
}

async function importDocxContent(filePath, code) {
  try {
    // 读取docx内容，保留样式
    const result = await mammoth.convertToHtml({
      path: filePath,
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Title'] => h1.title:fresh",
        "r[style-name='Strong'] => strong",
        "r[style-name='Emphasis'] => em",
        "p[style-name='List Paragraph'] => li:fresh"
      ]
    });
    const htmlContent = result.value;

    // 转换为章节编号
    const sectionCode = convertCodeToSectionNumber(code);
    if (!sectionCode) {
      console.log(`⚠️  无效编号: ${code}`);
      return false;
    }

    // 查找对应的章节
    const templateId = 'ac3dfd08-6875-479b-90db-244b9f840798'; // CSI MasterFormat 2020
    const section = await knex('template_sections')
      .where({
        template_id: templateId,
        code: sectionCode
      })
      .first();

    if (!section) {
      console.log(`⚠️  未找到章节: ${sectionCode} (${code})`);
      return false;
    }

    // 更新内容
    await knex('template_sections')
      .where({ id: section.id })
      .update({
        template_content: htmlContent,
        updated_at: knex.fn.now()
      });

    console.log(`✅ ${sectionCode} - ${section.title}`);
    return true;
  } catch (error) {
    console.error(`❌ 处理失败 ${code}:`, error.message);
    return false;
  }
}

async function scanAndImport(dir) {
  let successCount = 0;
  let failCount = 0;

  async function scanDir(currentDir) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        await scanDir(fullPath);
      } else if (item.endsWith('.docx') && !item.startsWith('~$')) {
        // 提取文件名中的6位编号
        const match = item.match(/^(\d{6})/);
        if (match) {
          const code = match[1];
          const success = await importDocxContent(fullPath, code);
          if (success) {
            successCount++;
          } else {
            failCount++;
          }
        }
      }
    }
  }

  await scanDir(dir);

  console.log('\n========== 导入完成 ==========');
  console.log(`✅ 成功: ${successCount} 个`);
  console.log(`❌ 失败: ${failCount} 个`);
}

async function main() {
  try {
    const specsDir = path.join(__dirname, '../docs/specs_zh');

    console.log('开始导入specs_zh中文内容到数据库...');
    console.log(`扫描目录: ${specsDir}\n`);

    // 连接测试
    await knex.raw('SELECT 1');
    console.log('✅ 数据库连接成功\n');

    await scanAndImport(specsDir);
  } catch (error) {
    console.error('导入失败:', error);
  } finally {
    await knex.destroy();
  }
}

main();
