/**
 * 二次翻译检查 - 只翻译英文段落
 */

const knex = require('../src/config/database');
const axios = require('axios');

const VLLM_URL = 'http://10.10.18.3:8000';
const VLLM_MODEL = '/mnt/data/models/Qwen3-32B';

/**
 * 检测段落是否主要是英文
 */
function isEnglishParagraph(text) {
  const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleanText.length < 20) return false;

  const englishChars = (cleanText.match(/[A-Za-z]/g) || []).length;
  const percentage = (englishChars / cleanText.length) * 100;

  return percentage > 50; // 超过50%英文字符认为是英文段落
}

/**
 * 使用VLLM翻译文本
 */
async function translateText(text) {
  try {
    const response = await axios.post(`${VLLM_URL}/v1/chat/completions`, {
      model: VLLM_MODEL,
      messages: [
        {
          role: 'system',
          content: '你是专业的建筑规范翻译专家。请将英文翻译为中文，保持专业术语准确性。只返回翻译结果，不要添加任何解释。'
        },
        {
          role: 'user',
          content: `请翻译以下文本为中文：\n\n${text}`
        }
      ],
      max_tokens: 2000,
      temperature: 0.3
    }, {
      timeout: 30000
    });

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('翻译失败:', error.message);
    return text; // 翻译失败返回原文
  }
}

/**
 * 处理HTML内容，只翻译英文段落
 */
async function processHtmlContent(html) {
  // 简单的段落分割（基于<p>标签）
  const paragraphs = html.split(/(<p[^>]*>.*?<\/p>)/s);
  const results = [];

  let translatedCount = 0;
  let skippedCount = 0;

  for (let para of paragraphs) {
    if (!para.trim()) {
      results.push(para);
      continue;
    }

    // 如果不是<p>标签，直接保留
    if (!para.startsWith('<p')) {
      results.push(para);
      continue;
    }

    // 提取段落文本内容
    const textContent = para.replace(/<[^>]*>/g, '');

    // 检查是否是英文段落
    if (isEnglishParagraph(textContent)) {
      const preview = textContent.substr(0, 80);
      console.log(`   翻译段落: ${preview}...`);

      // 翻译文本内容
      const translated = await translateText(textContent);

      // 替换<p>标签内的文本，保留标签属性
      const tagMatch = para.match(/^(<p[^>]*>)(.*?)(<\/p>)$/s);
      if (tagMatch) {
        results.push(tagMatch[1] + translated + tagMatch[3]);
      } else {
        results.push(translated);
      }

      translatedCount++;

      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      results.push(para);
      skippedCount++;
    }
  }

  console.log(`   翻译段落数: ${translatedCount}, 跳过段落数: ${skippedCount}`);

  return results.join('');
}

/**
 * 主函数
 */
async function main() {
  console.log('🔍 开始检查需要重新翻译的章节...\n');

  // 获取CSI MasterFormat 2020模板
  const template = await knex('document_templates')
    .where({ code: 'csi_masterformat_2020' })
    .first();

  if (!template) {
    console.error('❌ 未找到模板');
    return;
  }

  // 获取所有有内容的章节
  const sections = await knex('template_sections')
    .where({ template_id: template.id })
    .whereNotNull('description')
    .where('description', '!=', '');

  console.log(`📊 找到 ${sections.length} 个有内容的章节\n`);

  let processedCount = 0;
  let needsTranslation = [];

  // 第一步：检测哪些章节需要翻译
  for (const section of sections) {
    const text = section.description.replace(/<[^>]*>/g, ' ');
    const englishChars = (text.match(/[A-Za-z]/g) || []).length;
    const totalChars = text.length;
    const percentage = ((englishChars / totalChars) * 100).toFixed(1);

    if (parseFloat(percentage) > 30) {
      needsTranslation.push({
        ...section,
        englishPercentage: percentage
      });
    }
  }

  console.log(`⚠️  需要处理的章节数: ${needsTranslation.length}\n`);

  if (needsTranslation.length === 0) {
    console.log('✅ 所有章节已完全翻译');
    return;
  }

  // 只处理前5个章节作为测试
  const toProcess = needsTranslation.slice(0, 5);
  console.log(`🎯 本次处理前 ${toProcess.length} 个章节\n`);

  // 第二步：处理需要翻译的章节
  for (const section of toProcess) {
    console.log(`\n处理 ${section.code} - ${section.title} (英文占比: ${section.englishPercentage}%)`);

    try {
      // 处理HTML内容
      const updatedHtml = await processHtmlContent(section.description);

      // 更新数据库
      await knex('template_sections')
        .where({ id: section.id })
        .update({
          description: updatedHtml,
          updated_at: knex.fn.now()
        });

      processedCount++;
      console.log(`✅ 已更新`);
    } catch (error) {
      console.error(`❌ 处理失败: ${error.message}`);
    }
  }

  console.log(`\n====================`);
  console.log(`✅ 成功处理: ${processedCount}/${toProcess.length}`);
  console.log(`⚠️  剩余待处理: ${needsTranslation.length - toProcess.length}`);
  console.log(`====================\n`);
}

main()
  .then(() => {
    console.log('✅ 检查完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 处理失败:', error);
    process.exit(1);
  });
