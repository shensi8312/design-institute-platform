const knex = require('../src/config/database');
const axios = require('axios');

const API_URL = 'http://10.10.18.3:8000/v1/chat/completions';
const MODEL = 'qwen-next-80b';
const PARALLEL_LIMIT = 5; // 同时翻译5个段落

// 翻译单个段落
async function translateChunk(text) {
  try {
    const response = await axios.post(API_URL, {
      model: MODEL,
      messages: [
        { role: 'system', content: '你是专业翻译，将英文翻译为中文，保留HTML标签。' },
        { role: 'user', content: `翻译:\n${text}` }
      ],
      temperature: 0.3,
      max_tokens: 1200
    }, { timeout: 45000 });

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('    翻译错误:', error.response?.data?.error?.message || error.message);
    return text;
  }
}

// 并行翻译段落
async function translateParagraphsBatch(paragraphs) {
  const results = [];

  for (let i = 0; i < paragraphs.length; i += PARALLEL_LIMIT) {
    const batch = paragraphs.slice(i, i + PARALLEL_LIMIT);
    const promises = batch.map(p =>
      /[A-Z]{2,}/.test(p.text) ? translateChunk(p.text) : Promise.resolve(p.text)
    );

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);

    console.log(`    已翻译 ${Math.min(i + PARALLEL_LIMIT, paragraphs.length)}/${paragraphs.length}`);
  }

  return results;
}

// 翻译整个章节
async function translateText(text) {
  if (!text || !/[A-Z]{2,}/.test(text)) return text;

  if (text.length < 800) {
    return await translateChunk(text);
  }

  // 按</p>分割
  const parts = text.split('</p>').filter(p => p.trim());
  const paragraphs = parts.map(p => ({ text: p + '</p>' }));

  const translated = await translateParagraphsBatch(paragraphs);
  return translated.join('');
}

async function main() {
  const sections = await knex('template_sections')
    .where('template_id', 'ac3dfd08-6875-479b-90db-244b9f840798')
    .whereNotNull('template_content')
    .select('id', 'code', 'template_content');

  console.log(`共 ${sections.length} 个章节\n`);

  let done = 0, skip = 0, fail = 0;

  for (const s of sections) {
    if (!/[A-Z]{2,}/.test(s.template_content)) { skip++; continue; }

    console.log(`[${done + fail + 1}/${sections.length - skip}] 翻译: ${s.code} (${s.template_content.length}字符)`);
    const result = await translateText(s.template_content);

    if (result !== s.template_content) {
      await knex('template_sections').where('id', s.id).update({ template_content: result });
      done++;
      console.log('✅\n');
    } else {
      fail++;
      console.log('❌\n');
    }
  }

  console.log(`\n完成:${done} 失败:${fail} 跳过:${skip}`);
  process.exit(0);
}

main();
