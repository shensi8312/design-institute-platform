const knex = require('../src/config/database');

async function main() {
  const section = await knex('template_sections')
    .where('template_id', 'ac3dfd08-6875-479b-90db-244b9f840798')
    .where('code', '23 05 53')
    .first();

  if (section) {
    console.log('章节:', section.code);
    console.log('内容长度:', section.template_content?.length);
    console.log('前200字符:', section.template_content?.substring(0, 200));
    console.log('\n是否包含大写英文:', /[A-Z]{2,}/.test(section.template_content || ''));
  } else {
    console.log('章节不存在');
  }

  process.exit(0);
}

main();
