const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

async function extractCSICatalog(pdfPath) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    console.log(`📄 读取文件: ${(dataBuffer.length / 1024 / 1024).toFixed(2)} MB\n`);

    const data = await pdf(dataBuffer);

    console.log(`📊 基本信息:`);
    console.log(`   总页数: ${data.numpages}`);
    console.log(`   文本长度: ${data.text.length} 字符\n`);

    // 保存完整文本
    const fullPath = pdfPath.replace('.pdf', '_full.txt');
    fs.writeFileSync(fullPath, data.text, 'utf-8');
    console.log(`✅ 完整文本 -> ${fullPath}\n`);

    // 按页分割
    const outputDir = pdfPath.replace('.pdf', '_pages');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const lines = data.text.split('\n');
    let currentPage = 1;
    let pageContent = [];
    let pageStart = 0;

    // 简单按行数分页（假设每页约100-150行）
    const linesPerPage = Math.ceil(lines.length / data.numpages);

    for (let i = 0; i < lines.length; i++) {
      pageContent.push(lines[i]);

      if (pageContent.length >= linesPerPage || i === lines.length - 1) {
        const pagePath = path.join(outputDir, `page_${String(currentPage).padStart(3, '0')}.txt`);
        fs.writeFileSync(pagePath, pageContent.join('\n'), 'utf-8');
        console.log(`   第 ${currentPage}/${data.numpages} 页: ${pageContent.join('').length} 字符`);

        pageContent = [];
        currentPage++;
      }
    }

    console.log(`\n✅ 分页文本 -> ${outputDir}/`);

    // 提取目录结构
    const catalog = extractCatalogStructure(data.text);
    const catalogPath = pdfPath.replace('.pdf', '_catalog.json');
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8');
    console.log(`✅ 目录结构 -> ${catalogPath}`);

    return { success: true, pages: data.numpages, chars: data.text.length };

  } catch (error) {
    console.error(`❌ 处理失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function extractCatalogStructure(text) {
  const lines = text.split('\n');
  const catalog = [];

  // 匹配 CSI 编号格式: 数字-数字 或 数字.数字
  const csiPattern = /^\s*(\d{2}[-\s]\d{2}|\d{2}\.\d{2})\s+(.+)/;

  for (const line of lines) {
    const match = line.match(csiPattern);
    if (match) {
      catalog.push({
        code: match[1].replace(/\s+/g, ''),
        title: match[2].trim()
      });
    }
  }

  return catalog;
}

// 执行
const pdfPath = process.argv[2] || 'CSI 目录清单.pdf';

if (!fs.existsSync(pdfPath)) {
  console.error(`❌ 文件不存在: ${pdfPath}`);
  process.exit(1);
}

console.log(`\n🔧 CSI目录提取工具\n${'='.repeat(50)}\n`);
extractCSICatalog(pdfPath).then(result => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(result.success ? '✅ 提取完成' : '❌ 提取失败');
  process.exit(result.success ? 0 : 1);
});
