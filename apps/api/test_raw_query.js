const knex = require('./src/config/database');

async function test() {
  try {
    const result = await knex('template_sections')
      .select('code', 'template_content')
      .where('code', '00 01 01')
      .first();

    console.log('Code:', result.code);
    console.log('\n=== Template Content (前200字符) ===');
    console.log(result.template_content.substring(0, 500));
    console.log('\n=== 检查是否包含margin-left ===');
    console.log('Has margin-left:', result.template_content.includes('margin-left'));

    // 提取1.1那行
    const match = result.template_content.match(/<p[^>]*>1\.1[^<]*/);
    console.log('\n=== 1.1这行的HTML ===');
    console.log(match ? match[0] : 'Not found');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

test();
