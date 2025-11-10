const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const fs = require('fs');
const path = require('path');
const knex = require('./src/config/database');

async function createCSITemplateFile() {
  const templateId = 'ac3dfd08-6875-479b-90db-244b9f840798';

  // Create document
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: "CSI MasterFormat 2020",
          heading: HeadingLevel.TITLE,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "技术规范文档模板",
              bold: true,
              size: 32,
            }),
          ],
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          text: "本文档包含 6667 个章节，涵盖完整的 CSI MasterFormat 2020 规范体系。",
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          text: "请从左侧目录树中选择具体章节查看详细内容。",
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          text: "使用说明：",
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          text: "1. 左侧导航树显示完整的章节结构",
        }),
        new Paragraph({
          text: "2. 点击章节可查看或编辑该章节内容",
        }),
        new Paragraph({
          text: "3. 支持在线编辑，修改自动保存",
        }),
        new Paragraph({
          text: "4. 支持多人协作编辑",
        }),
      ],
    }],
  });

  // Generate file
  const buffer = await Packer.toBuffer(doc);

  // Save to uploads/templates/
  const uploadsDir = path.join(__dirname, 'uploads', 'templates');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const fileName = 'CSI_MasterFormat_2020.docx';
  const filePath = path.join(uploadsDir, fileName);
  fs.writeFileSync(filePath, buffer);

  console.log(`✅ Created file: ${filePath}`);
  console.log(`   File size: ${buffer.length} bytes`);

  // Update database
  const relativePath = `uploads/templates/${fileName}`;
  await knex('document_templates')
    .where({ id: templateId })
    .update({
      file_path: relativePath,
      file_name: fileName,
      file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      file_size: buffer.length,
      updated_at: knex.fn.now()
    });

  console.log(`✅ Updated database with file_path: ${relativePath}`);

  await knex.destroy();
}

createCSITemplateFile().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
