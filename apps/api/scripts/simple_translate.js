/**
 * 简单翻译脚本 - 把数据库里的英文翻译成中文
 */

const knex = require('../src/config/database');
const axios = require('axios');

// 翻译API配置
const API_URL = 'http://10.10.18.3:8000/v1/chat/completions';
const MODEL_NAME = 'qwen-next-80b';

async function translateText(text) {
  if (!text || text.trim().length === 0) return text;

  // 如果没有英文大写单词，跳过
  if (!/[A-Z]{2,}/.test(text)) return text;

  try {
    const response = await axios.post(API_URL, {
      model: MODEL_NAME,
      messages: [
        {
          role: 'system',
          content: '你是专业翻译。将英文翻译为中文，保留所有HTML标签和style属性不变。'
        },
        {
          role: 'user',
          content: `请翻译以下内容为中文，保留HTML标签：\n\n${text}`
        }
      ],
      temperature: 0.3,
      max_tokens: 4000
    }, {
      timeout: 60000
    });

    const translated = response.data.choices[0].message.content.trim();
    return translated;
  } catch (error) {
    console.error('  翻译API错误:', error.response?.status, error.message);
    return text;
  }
}

async function main() {
  try {
    console.log('开始翻译...\n');

    const sections = await knex('template_sections')
      .where('template_id', 'ac3dfd08-6875-479b-90db-244b9f840798')
      .whereNotNull('template_content')
      .select('id', 'code', 'title', 'template_content');

    console.log(`找到 ${sections.length} 个章节需要检查\n`);

    let translated = 0;
    let skipped = 0;
    let failed = 0;

    for (const section of sections) {
      // 跳过已经是纯中文的
      if (!/[A-Z]{2,}/.test(section.template_content)) {
        skipped++;
        continue;
      }

      console.log(`翻译: ${section.code} - ${section.title}`);

      const result = await translateText(section.template_content);

      if (result !== section.template_content && !/[A-Z]{2,}/.test(result)) {
        // 翻译成功且结果是中文
        await knex('template_sections')
          .where('id', section.id)
          .update({
            template_content: result,
            updated_at: knex.fn.now()
          });

        translated++;
        console.log('  ✅ 已翻译\n');
      } else if (result === section.template_content) {
        // 翻译失败
        failed++;
        console.log('  ❌ 翻译失败\n');
      } else {
        // 翻译了但还有英文
        await knex('template_sections')
          .where('id', section.id)
          .update({
            template_content: result,
            updated_at: knex.fn.now()
          });
        translated++;
        console.log('  ⚠️  部分翻译\n');
      }

      // 避免API调用过快
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n======================');
    console.log(`✅ 翻译成功: ${translated}`);
    console.log(`❌ 翻译失败: ${failed}`);
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
