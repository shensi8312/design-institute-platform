const knex = require('../src/config/database');

function hasRealEnglish(html) {
  if (!html) return false;

  // 移除HTML标签
  const text = html.replace(/<[^>]*>/g, ' ');

  // 移除已经是中文的部分,只看剩余文本
  // 检测是否有连续的英文句子(5个以上英文单词)
  const englishPattern = /\b[A-Za-z]+(\s+[A-Za-z]+){4,}\b/g;
  const matches = text.match(englishPattern);

  return matches && matches.length > 0;
}

async function main() {
  const sections = await knex('template_sections')
    .where('template_id', 'ac3dfd08-6875-479b-90db-244b9f840798')
    .whereNotNull('template_content')
    .select('id', 'code', 'template_content');

  let reallyNeedsTranslation = 0;
  let alreadyChinese = 0;

  for (const s of sections) {
    if (hasRealEnglish(s.template_content)) {
      reallyNeedsTranslation++;
      if (reallyNeedsTranslation <= 5) {
        console.log(`需要翻译: ${s.code}`);
      }
    } else {
      alreadyChinese++;
    }
  }

  console.log(`\n总章节: ${sections.length}`);
  console.log(`真正需要翻译: ${reallyNeedsTranslation}`);
  console.log(`已经是中文: ${alreadyChinese}`);

  process.exit(0);
}

main();
