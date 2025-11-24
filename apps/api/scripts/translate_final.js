const knex = require('../src/config/database');
const axios = require('axios');

const API_URL = 'http://10.10.18.3:8000/v1/chat/completions';
const MODEL = 'qwen-next-80b';

// 分块翻译函数
async function translateChunk(text) {
  try {
    const response = await axios.post(API_URL, {
      model: MODEL,
      messages: [
        { role: 'system', content: '你是专业翻译，将英文翻译为中文，保留HTML标签和格式。' },
        { role: 'user', content: `翻译为中文：\n${text}` }
      ],
      temperature: 0.3,
      max_tokens: 1500
    }, { timeout: 60000 });

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('    翻译块错误:', error.response?.data?.error?.message || error.message);
    return text;
  }
}

// 按段落分块并翻译
async function translateText(text) {
  if (!text || !/[A-Z]{2,}/.test(text)) return text;

  // 如果文本较短,直接翻译
  if (text.length < 1000) {
    return await translateChunk(text);
  }

  // 按</p>分割段落
  const paragraphs = text.split('</p>').filter(p => p.trim());
  let translated = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i] + '</p>';
    if (!/[A-Z]{2,}/.test(para)) {
      translated.push(para);
      continue;
    }

    console.log(`    翻译段落 ${i + 1}/${paragraphs.length}`);
    const result = await translateChunk(para);
    translated.push(result);
    await new Promise(r => setTimeout(r, 500));
  }

  return translated.join('');
}

async function main() {
  const sections = await knex('template_sections')
    .where('template_id', 'ac3dfd08-6875-479b-90db-244b9f840798')
    .whereNotNull('template_content')
    .select('id', 'code', 'title', 'template_content');

  console.log(`共 ${sections.length} 个章节\n`);

  let done = 0, skip = 0, fail = 0;

  for (const s of sections) {
    if (!/[A-Z]{2,}/.test(s.template_content)) { skip++; continue; }

    console.log(`翻译: ${s.code} (${s.template_content.length}字符)`);
    const result = await translateText(s.template_content);

    if (result !== s.template_content) {
      await knex('template_sections').where('id', s.id).update({ template_content: result });
      done++;
      console.log('✅\n');
    } else {
      fail++;
      console.log('❌\n');
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n完成:${done} 失败:${fail} 跳过:${skip}`);
  process.exit(0);
}

main();
