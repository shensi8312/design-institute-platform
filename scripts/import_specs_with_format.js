#!/usr/bin/env node

/**
 * 手动解析Word XML，保留格式（粗体、斜体等）
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const knex = require('../apps/api/src/config/database');

// 将6位编号转换为章节编号
function convertCodeToSectionNumber(code) {
  if (code.length !== 6) return null;
  return `${code.slice(0, 2)} ${code.slice(2, 4)} ${code.slice(4, 6)}`;
}

// 解析Word XML，提取格式（包括空行和段间距）
function parseWordXML(xml) {
  const lines = [];

  // 匹配所有段落 <w:p>
  const paragraphs = xml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) || [];

  for (const para of paragraphs) {
    // 提取段落属性中的间距信息
    const spacingMatch = para.match(/<w:spacing\s+w:before="(\d+)"\s+w:after="(\d+)"/);
    let spacingBefore = 0;
    let spacingAfter = 0;
    if (spacingMatch) {
      spacingBefore = parseInt(spacingMatch[1]) / 20; // 转换为磅（pt）
      spacingAfter = parseInt(spacingMatch[2]) / 20;
    }

    // 提取文本runs <w:r>
    const runs = para.match(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g) || [];
    let paraHTML = '<p';

    // 添加样式
    const styles = [];
    if (spacingBefore > 0) styles.push(`margin-top: ${spacingBefore}pt`);
    if (spacingAfter > 0) styles.push(`margin-bottom: ${spacingAfter}pt`);

    if (styles.length > 0) {
      paraHTML += ` style="${styles.join('; ')}"`;
    }
    paraHTML += '>';

    let hasContent = false;
    for (const run of runs) {
      // 检查格式
      const isBold = /<w:b\s*\/>|<w:b\s+w:val="1"|<w:b\s+w:val="true"/.test(run);
      const isItalic = /<w:i\s*\/>|<w:i\s+w:val="1"|<w:i\s+w:val="true"/.test(run);
      const isUnderline = /<w:u\s/.test(run);

      // 提取文本 <w:t>
      const textMatches = run.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
      let text = '';
      for (const tm of textMatches) {
        const content = tm.replace(/<w:t[^>]*>|<\/w:t>/g, '');
        text += content;
      }

      if (text) {
        hasContent = true;
        // 应用格式
        if (isBold) text = `<strong>${text}</strong>`;
        if (isItalic) text = `<em>${text}</em>`;
        if (isUnderline) text = `<u>${text}</u>`;

        paraHTML += text;
      }
    }

    // 如果段落没有内容，添加一个空格以保留空行
    if (!hasContent) {
      paraHTML += '<br/>';
    }

    paraHTML += '</p>';
    lines.push(paraHTML);
  }

  return lines.join('\n');
}

async function importDocxContent(filePath, code) {
  try {
    // 解压docx获取document.xml
    const tempDir = `/tmp/docx_${Date.now()}`;
    execSync(`unzip -q "${filePath}" -d "${tempDir}"`, { encoding: 'utf-8' });

    const xmlPath = path.join(tempDir, 'word/document.xml');
    if (!fs.existsSync(xmlPath)) {
      console.log(`⚠️  无法解析: ${code}`);
      execSync(`rm -rf "${tempDir}"`);
      return false;
    }

    // 读取XML
    const xml = fs.readFileSync(xmlPath, 'utf-8');

    // 解析格式
    const htmlContent = parseWordXML(xml);

    // 清理临时目录
    execSync(`rm -rf "${tempDir}"`);

    // 转换为章节编号
    const sectionCode = convertCodeToSectionNumber(code);
    if (!sectionCode) {
      console.log(`⚠️  无效编号: ${code}`);
      return false;
    }

    // 查找对应的章节
    const templateId = 'ac3dfd08-6875-479b-90db-244b9f840798';
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

    console.log('开始导入specs_zh（保留格式和空行）...');
    console.log(`扫描目录: ${specsDir}\n`);

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
