const fs = require('fs');

function extractCSIEntries(fullText) {
  const entries = [];
  const lines = fullText.split('\n');

  // 匹配模式：
  // 00 00 00 标题
  // 03 20 00 标题
  // 03 21 21 标题
  // 03 21 21.11 标题
  const patterns = [
    /^(\d{2}\s\d{2}\s\d{2}(\.\d{2})?)\s+(.+)/,  // 完整6位或带小数
    /^(\d{2}\s\d{2})\s+(.+)/,                   // 4位
    /^(\d{2})\s+(.+)/                            // 2位
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const code = match[1];
        const title = pattern === patterns[0] ? match[3] :
                     pattern === patterns[1] ? match[2] : match[2];

        // 过滤掉明显不是目录项的行
        if (title.length > 3 && title.length < 200 && !title.match(/^[•\-]/)) {
          entries.push({ code, title: title.trim() });
        }
        break;
      }
    }
  }

  return entries;
}

const fullPath = process.argv[2] || '../../docs/specs/CSI 目录清单_full.txt';
const fullText = fs.readFileSync(fullPath, 'utf-8');

console.log('重新提取CSI目录...\n');

const entries = extractCSIEntries(fullText);
console.log(`提取到 ${entries.length} 条目录项\n`);

// 显示前20条
console.log('前20条样本:');
entries.slice(0, 20).forEach((e, i) => {
  console.log(`${i+1}. [${e.code}] ${e.title}`);
});

// 保存
const outputPath = fullPath.replace('_full.txt', '_catalog_v2.json');
fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2));
console.log(`\n✅ 已保存到: ${outputPath}`);
