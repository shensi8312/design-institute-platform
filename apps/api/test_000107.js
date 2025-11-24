const { extractDocxWithColors } = require('./scripts/extract_docx_with_colors');

async function test() {
  try {
    const file = '/Users/shenguoli/Documents/projects/design-institute-platform/docs/specs_zh 2/00 - PROCUREMENT AND CONTRACTING REQUIREMENTS/000107 FL - 密封页面.docx';
    console.log('Testing: 000107 FL - 密封页面.docx\n');

    const content = await extractDocxWithColors(file);

    if (!content) {
      console.error('❌ Null content');
      process.exit(1);
    }

    console.log('Length:', content.length, 'chars\n');
    console.log('=== Full content ===');
    console.log(content);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();
