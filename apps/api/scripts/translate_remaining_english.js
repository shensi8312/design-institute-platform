/**
 * 翻译template_content中剩余的英文内容
 */

const knex = require('../src/config/database');
const axios = require('axios');

// Qwen-Next翻译API
const TRANSLATE_API = 'http://10.10.18.3:8000/v1/chat/completions';

async function translateText(text) {
  if (!text || text.trim().length === 0) return text;

  // 如果已经是纯中文（没有大写英文单词），跳过
  if (!/[A-Z]{2,}/.test(text)) return text;

  try {
    const response = await axios.post(TRANSLATE_API, {
      model: 'qwen-next-80b',
      messages: [
        {
          role: 'system',
          content: '你是专业的建筑工程翻译。请将英文内容翻译为中文，保留HTML标签和样式属性，保留专业术语的准确性。'
        },
        {
          role: 'user',
          content: `请翻译以下HTML内容为中文，保留所有HTML标签和style属性：\n\n${text}`
        }
      ],
      temperature: 0.3,
      max_tokens: 4000
    }, {
      timeout: 60000
    });

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('翻译失败:', error.message);
    return text; // 翻译失败时返回原文
  }
}

async function main() {
  try {
    // 获取所有有英文内容的章节
    const sections = await knex('template_sections')
      .where('template_id', 'ac3dfd08-6875-479b-90db-244b9f840798')
      .whereNotNull('template_content')
      .select('id', 'code', 'title', 'template_content');

    console.log(`找到 ${sections.length} 个章节需要检查\n`);

    let translated = 0;
    let skipped = 0;

    for (const section of sections) {
      // 检查是否有英文大写单词
      if (!/[A-Z]{2,}/.test(section.template_content)) {
        skipped++;
        continue;
      }

      console.log(`翻译中: ${section.code} - ${section.title}`);

      // 翻译内容
      const translatedContent = await translateText(section.template_content);

      if (translatedContent !== section.template_content) {
        // 更新数据库
        await knex('template_sections')
          .where('id', section.id)
          .update({
            template_content: translatedContent,
            updated_at: knex.fn.now()
          });

        translated++;
        console.log(`✅ 已翻译\n`);
      } else {
        console.log(`⚠️  翻译失败，保持原样\n`);
      }

      // 避免API调用过快
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n======================');
    console.log(`✅ 翻译完成: ${translated}`);
    console.log(`⏭️  跳过（已中文）: ${skipped}`);
    console.log(`📊 总计: ${sections.length}`);
    console.log('======================');

    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

main();
