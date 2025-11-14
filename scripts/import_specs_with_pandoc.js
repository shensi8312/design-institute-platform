#!/usr/bin/env node

/**
 * 使用pandoc解析Word，完整保留所有格式（包括自动编号列表）
 * 并将美元符号$转换为人民币符号¥
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const knex = require('../apps/api/src/config/database');

// 英文术语到中文的翻译映射
const TRANSLATION_MAP = {
  // 项目信息相关
  'PROJECT INFORMATION': '项目信息',
  'Project Information': '项目信息',
  'Notice to Bidders:': '投标须知：',
  'Notice to Bidders': '投标须知',
  'Regulatory Requirements:': '监管要求：',
  'Regulatory Requirements': '监管要求',
  'Project Identification:': '项目标识：',
  'Project Identification': '项目标识',
  'Project Location:': '项目位置：',
  'Project Location': '项目位置',
  'Bidding Requirements:': '投标要求：',
  'Bidding Requirements': '投标要求',
  'Contract Forms:': '合同表格：',
  'Contract Forms': '合同表格',
  'Conditions of the Contract:': '合同条件：',
  'Conditions of the Contract': '合同条件',

  // 规范说明相关
  'Retain': '保留',
  'Delete': '删除',
  'Paragraph': '段落',
  'Subparagraph': '子段落',
  'Article': '条款',
  'Section': '章节',

  // 产品和性能相关
  'PRODUCTS': '产品',
  'PERFORMANCE REQUIREMENTS': '性能要求',
  'EXECUTION': '施工',
  'GENERAL': '总则',
  'Products': '产品',
  'Performance Requirements': '性能要求',
  'Execution': '施工',
  'General': '总则',

  // 质量和提交相关
  'Quality Assurance': '质量保证',
  'Quality Control': '质量控制',
  'Submittals': '提交资料',
  'Action Submittals': '行动提交资料',
  'Informational Submittals': '信息性提交文件',

  // 其他常见术语
  'Mockup': '样板',
  'Field Quality Control': '现场质量控制',
  'Warranty': '保修',
  'Maintenance': '维护',
  'Cleaning': '清洁'
};

// 将6位编号转换为章节编号
function convertCodeToSectionNumber(code) {
  if (code.length !== 6) return null;
  return `${code.slice(0, 2)} ${code.slice(2, 4)} ${code.slice(4, 6)}`;
}

// 翻译HTML中的英文术语
function translateEnglishTerms(html) {
  let translated = html;

  // 对每个翻译映射进行替换
  for (const [english, chinese] of Object.entries(TRANSLATION_MAP)) {
    // 使用全局正则替换，匹配完整单词边界
    const regex = new RegExp(`\\b${english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    translated = translated.replace(regex, chinese);
  }

  return translated;
}

// 使用pandoc转换Word文档为HTML
function convertWithPandoc(filePath) {
  try {
    // pandoc参数:
    // --wrap=none: 不换行
    // --extract-media=.: 提取媒体文件
    const html = execSync(
      `pandoc "${filePath}" -f docx -t html --wrap=none`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );

    // 1. 将美元符号$替换为人民币符号¥
    let convertedHtml = html.replace(/\$/g, '¥');

    // 2. 翻译英文术语
    convertedHtml = translateEnglishTerms(convertedHtml);

    return convertedHtml;
  } catch (error) {
    console.error(`pandoc转换失败: ${error.message}`);
    return null;
  }
}

async function importDocxContent(filePath, code) {
  try {
    // 使用pandoc转换
    const htmlContent = convertWithPandoc(filePath);

    if (!htmlContent) {
      console.log(`⚠️  无法解析: ${code}`);
      return false;
    }

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

    console.log('开始导入specs_zh（使用pandoc，完整保留格式和自动编号）...');
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
