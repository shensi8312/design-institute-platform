const { extractDocxWithColors } = require('./scripts/extract_docx_with_colors');

async function test() {
  try {
    const file = '/Users/shenguoli/Documents/projects/design-institute-platform/docs/specs_zh 2/01 - GENERAL REQUIREMENTS/011000 FL - 摘要.docx';
    console.log('Testing: 011000 FL - 摘要.docx\n');

    const content = await extractDocxWithColors(file);

    if (!content) {
      console.error('❌ Null content');
      process.exit(1);
    }

    console.log('Length:', content.length, 'chars\n');
    console.log('=== First 3000 chars ===');
    console.log(content.substring(0, 3000));

    const hasNum = />[1-3]\.\s/.test(content);
    const hasLetter = />[A-C]\.\s/.test(content);
    const hasNested = /1\.1\s|1\.2\s/.test(content);

    console.log('\n=== Numbering Check ===');
    console.log('Has 1. 2. 3.:', hasNum);
    console.log('Has A. B. C.:', hasLetter);
    console.log('Has 1.1 1.2:', hasNested);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();
