const knex = require('../src/config/database');
const axios = require('axios');

const API_URL = 'http://10.10.18.3:8000/v1/chat/completions';
const MODEL = 'qwen-next-80b';

// 更智能的英文检测 - 只检测真正需要翻译的内容
function needsTranslation(html) {
  if (!html) return false;

  // 移除HTML标签
  const textOnly = html.replace(/<[^>]*>/g, ' ');

  // 检测是否有连续3个以上的英文单词
  const englishWords = textOnly.match(/\b[A-Z][a-z]+(\s+[A-Z][a-z]+){2,}\b/g);

  return englishWords && englishWords.length > 0;
}

async function translateText(text) {
  try {
    const response = await axios.post(API_URL, {
      model: MODEL,
      messages: [
        { role: 'system', content: '翻译英文为中文,保留HTML标签,保留专业术语如HVAC' },
        { role: 'user', content: text }
      ],
      temperature: 0.3,
      max_tokens: 6000
    }, { timeout: 90000 });

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('  错误:', error.response?.data?.error?.message || error.message);
    return text;
  }
}

async function main() {
  const sections = await knex('template_sections')
    .where('template_id', 'ac3dfd08-6875-479b-90db-244b9f840798')
    .whereNotNull('template_content')
    .select('id', 'code', 'template_content');

  console.log(`总共 ${sections.length} 个章节\n`);

  let done = 0, skip = 0;

  for (const s of sections) {
    if (!needsTranslation(s.template_content)) {
      skip++;
      continue;
    }

    console.log(`[${done + 1}/${sections.length - skip}] 翻译: ${s.code}`);
    const result = await translateText(s.template_content);

    if (result !== s.template_content) {
      await knex('template_sections').where('id', s.id).update({ template_content: result });
      done++;
      console.log('✅\n');
    }
  }

  console.log(`\n完成:${done} 跳过:${skip}`);
  process.exit(0);
}

main();
