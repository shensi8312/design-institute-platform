#!/usr/bin/env node

/**
 * 完整解析Word XML，保留所有格式：
 * - 列表自动编号 (1.1, A, B等)
 * - 文字颜色
 * - 粗体、斜体、下划线
 * - 空行和段间距
 * - $ 转 ¥
 * - 英文术语翻译
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const knex = require('../apps/api/src/config/database');

// 英文术语翻译映射
const TRANSLATION_MAP = {
  'PROJECT INFORMATION': '项目信息',
  'Notice to Bidders:': '投标须知：',
  'Regulatory Requirements:': '监管要求：',
  'Project Identification:': '项目标识：',
  'Project Location:': '项目位置：',
  'PRODUCTS': '产品',
  'PERFORMANCE REQUIREMENTS': '性能要求',
  'EXECUTION': '施工',
  'GENERAL': '总则',
  'Quality Assurance': '质量保证',
  'Submittals': '提交资料',
  'Mockup': '样板'
};

// 将6位编号转换为章节编号
function convertCodeToSectionNumber(code) {
  if (code.length !== 6) return null;
  return `${code.slice(0, 2)} ${code.slice(2, 4)} ${code.slice(4, 6)}`;
}

// 读取 numbering.xml 获取编号定义
function parseNumbering(numberingXml) {
  const numbering = {};

  // 提取抽象编号定义
  const abstractNumMatches = numberingXml.match(/<w:abstractNum[^>]*w:abstractNumId="(\d+)"[^>]*>[\s\S]*?<\/w:abstractNum>/g) || [];

  for (const abstractNum of abstractNumMatches) {
    const numIdMatch = abstractNum.match(/w:abstractNumId="(\d+)"/);
    if (!numIdMatch) continue;

    const numId = numIdMatch[1];
    const levels = {};

    // 提取每一级的格式
    const lvlMatches = abstractNum.match(/<w:lvl[^>]*w:ilvl="(\d+)"[^>]*>[\s\S]*?<\/w:lvl>/g) || [];

    for (const lvl of lvlMatches) {
      const ilvlMatch = lvl.match(/w:ilvl="(\d+)"/);
      const numFmtMatch = lvl.match(/<w:numFmt[^>]*w:val="([^"]*)"/);

      if (ilvlMatch && numFmtMatch) {
        const level = parseInt(ilvlMatch[1]);
        const format = numFmtMatch[1];

        // 转换为 HTML list type
        let listType = '1'; // 默认数字
        if (format === 'upperLetter') listType = 'A';
        else if (format === 'lowerLetter') listType = 'a';
        else if (format === 'upperRoman') listType = 'I';
        else if (format === 'lowerRoman') listType = 'i';
        else if (format === 'decimal') listType = '1';

        levels[level] = listType;
      }
    }

    numbering[numId] = levels;
  }

  // 提取编号实例映射
  const numMatches = numberingXml.match(/<w:num[^>]*w:numId="(\d+)"[^>]*>[\s\S]*?<\/w:num>/g) || [];

  for (const num of numMatches) {
    const numIdMatch = num.match(/w:numId="(\d+)"/);
    const abstractNumIdMatch = num.match(/<w:abstractNumId[^>]*w:val="(\d+)"/);

    if (numIdMatch && abstractNumIdMatch) {
      const instanceId = numIdMatch[1];
      const abstractId = abstractNumIdMatch[1];

      if (numbering[abstractId]) {
        numbering[instanceId] = numbering[abstractId];
      }
    }
  }

  return numbering;
}

// 解析Word XML，完整保留所有格式
function parseWordXML(xml, numberingXml) {
  const lines = [];
  const numbering = parseNumbering(numberingXml);

  // 跟踪当前列表状态
  let listStack = []; // [{numId, ilvl, type}]

  // 匹配所有段落
  const paragraphs = xml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) || [];

  for (const para of paragraphs) {
    // 检查是否有编号
    const numPrMatch = para.match(/<w:numPr>[\s\S]*?<w:ilvl[^>]*w:val="(\d+)"[\s\S]*?<w:numId[^>]*w:val="(\d+)"[\s\S]*?<\/w:numPr>/);

    let currentNumId = null;
    let currentIlvl = null;

    if (numPrMatch) {
      currentIlvl = parseInt(numPrMatch[1]);
      currentNumId = numPrMatch[2];
    }

    // 处理列表嵌套
    if (currentNumId !== null) {
      // 关闭更深的列表
      while (listStack.length > 0 && listStack[listStack.length - 1].ilvl >= currentIlvl) {
        lines.push('</li>');
        lines.push('</ol>');
        listStack.pop();
      }

      // 打开新列表
      const listType = (numbering[currentNumId] && numbering[currentNumId][currentIlvl]) || '1';

      if (listStack.length === 0 || listStack[listStack.length - 1].ilvl < currentIlvl) {
        lines.push(`<ol type="${listType}">`);
        listStack.push({ numId: currentNumId, ilvl: currentIlvl, type: listType });
      }

      lines.push('<li>');
    } else {
      // 非列表项，关闭所有列表
      while (listStack.length > 0) {
        lines.push('</li>');
        lines.push('</ol>');
        listStack.pop();
      }
    }

    // 提取段落间距
    const spacingMatch = para.match(/<w:spacing\s+w:before="(\d+)"\s+w:after="(\d+)"/);
    let spacingBefore = 0;
    let spacingAfter = 0;
    if (spacingMatch) {
      spacingBefore = parseInt(spacingMatch[1]) / 20;
      spacingAfter = parseInt(spacingMatch[2]) / 20;
    }

    // 构建段落HTML
    const runs = para.match(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g) || [];
    let paraHTML = '<p';

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

      // 提取颜色
      const colorMatch = run.match(/<w:color[^>]*w:val="([^"]*)"/);
      let color = null;
      if (colorMatch && colorMatch[1] !== '000000') {
        color = `#${colorMatch[1]}`;
      }

      // 提取文本
      const textMatches = run.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
      let text = '';
      for (const tm of textMatches) {
        const content = tm.replace(/<w:t[^>]*>|<\/w:t>/g, '');
        text += content;
      }

      if (text) {
        hasContent = true;

        // 替换 $ 为 ¥
        text = text.replace(/\$/g, '¥');

        // 翻译英文术语
        for (const [english, chinese] of Object.entries(TRANSLATION_MAP)) {
          const regex = new RegExp(`\\b${english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
          text = text.replace(regex, chinese);
        }

        // 应用格式
        if (color) text = `<span style="color: ${color}">${text}</span>`;
        if (isBold) text = `<strong>${text}</strong>`;
        if (isItalic) text = `<em>${text}</em>`;
        if (isUnderline) text = `<u>${text}</u>`;

        paraHTML += text;
      }
    }

    // 如果段落没有内容，添加空行
    if (!hasContent && currentNumId === null) {
      paraHTML += '<br/>';
    }

    paraHTML += '</p>';

    if (currentNumId === null) {
      lines.push(paraHTML);
    } else {
      // 列表项内容不需要 <p> 标签
      const content = paraHTML.replace(/<\/?p[^>]*>/g, '');
      if (content.trim()) {
        lines.push(content);
      }
    }
  }

  // 关闭所有剩余的列表
  while (listStack.length > 0) {
    lines.push('</li>');
    lines.push('</ol>');
    listStack.pop();
  }

  return lines.join('\n');
}

async function importDocxContent(filePath, code) {
  try {
    // 解压docx
    const tempDir = `/tmp/docx_${Date.now()}`;
    execSync(`unzip -q "${filePath}" -d "${tempDir}"`, { encoding: 'utf-8' });

    const xmlPath = path.join(tempDir, 'word/document.xml');
    const numberingPath = path.join(tempDir, 'word/numbering.xml');

    if (!fs.existsSync(xmlPath)) {
      console.log(`⚠️  无法解析: ${code}`);
      execSync(`rm -rf "${tempDir}"`);
      return false;
    }

    // 读取XML
    const xml = fs.readFileSync(xmlPath, 'utf-8');
    const numberingXml = fs.existsSync(numberingPath) ? fs.readFileSync(numberingPath, 'utf-8') : '';

    // 解析格式
    const htmlContent = parseWordXML(xml, numberingXml);

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

    console.log('开始导入specs_zh（完整保留所有格式）...');
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
