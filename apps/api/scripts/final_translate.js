const knex = require('../src/config/database');
const axios = require('axios');

const API_URL = 'http://10.10.18.3:8000/v1/chat/completions';
const MODEL = 'qwen-next-80b';

function hasRealEnglish(html) {
  if (!html) return false;
  const text = html.replace(/<[^>]*>/g, ' ');
  const englishPattern = /\b[A-Za-z]+(\s+[A-Za-z]+){4,}\b/g;
  const matches = text.match(englishPattern);
  return matches && matches.length > 0;
}

async function translateChunk(text) {
  try {
    const response = await axios.post(API_URL, {
      model: MODEL,
      messages: [
        { role: 'system', content: '翻译英文为中文,保留HTML和专业术语' },
        { role: 'user', content: text }
      ],
      temperature: 0.3,
      max_tokens: 2000
    }, { timeout: 60000 });
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('    错误:', error.response?.data?.error?.message || error.message);
    return text;
  }
}

async function translateSection(content) {
  // 短内容直接翻译
  if (content.length < 2000) {
    return await translateChunk(content);
  }

  // 长内容按</p>分块,每块最多2000字符
  const paragraphs = content.split('</p>').filter(p => p.trim());
  const chunks = [];
  let currentChunk = '';

  for (const p of paragraphs) {
    const para = p + '</p>';
    if (currentChunk.length + para.length > 2000 && currentChunk) {
      chunks.push(currentChunk);
      currentChunk = para;
    } else {
      currentChunk += para;
    }
  }
  if (currentChunk) chunks.push(currentChunk);

  console.log(`    分${chunks.length}块并行翻译`);

  // 并行翻译所有块(每次10个)
  const results = [];
  for (let i = 0; i < chunks.length; i += 10) {
    const batch = chunks.slice(i, i + 10);
    const translated = await Promise.all(batch.map(c => translateChunk(c)));
    results.push(...translated);
    console.log(`    完成 ${Math.min(i + 10, chunks.length)}/${chunks.length}`);
  }

  return results.join('');
}

async function main() {
  const sections = await knex('template_sections')
    .where('template_id', 'ac3dfd08-6875-479b-90db-244b9f840798')
    .whereNotNull('template_content')
    .select('id', 'code', 'template_content');

  console.log(`总共 ${sections.length} 个章节\n`);

  let done = 0, skip = 0;

  for (const s of sections) {
    if (!hasRealEnglish(s.template_content)) {
      skip++;
      continue;
    }

    console.log(`[${done + 1}/${sections.length - skip}] ${s.code} (${s.template_content.length}字符)`);

    const result = await translateSection(s.template_content);

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
