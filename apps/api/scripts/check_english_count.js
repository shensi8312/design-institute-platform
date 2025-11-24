const knex = require('../src/config/database');

async function main() {
  const sections = await knex('template_sections')
    .where('template_id', 'ac3dfd08-6875-479b-90db-244b9f840798')
    .whereNotNull('template_content')
    .select('id', 'code', 'template_content');

  let hasEnglish = 0;
  let noEnglish = 0;

  for (const s of sections) {
    if (/[A-Z]{2,}/.test(s.template_content)) {
      hasEnglish++;
    } else {
      noEnglish++;
    }
  }

  console.log(`总章节: ${sections.length}`);
  console.log(`还有英文: ${hasEnglish}`);
  console.log(`已翻译: ${noEnglish}`);

  process.exit(0);
}

main();
