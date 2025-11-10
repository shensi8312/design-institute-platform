const fs = require('fs');

function parseCSICode(code) {
  const cleaned = code.replace(/\s+/g, '');

  // 2位: Division
  if (/^\d{2}$/.test(cleaned)) {
    return { level: 1, parentCode: null };
  }

  // 6位: Section
  if (/^\d{6}$/.test(cleaned)) {
    return { level: 2, parentCode: cleaned.substring(0, 2) };
  }

  // 8位: Subsection
  if (/^\d{8}$/.test(cleaned)) {
    return { level: 3, parentCode: cleaned.substring(0, 6) };
  }

  // 6-8位+小数: Detail
  if (/^\d{6,8}\.\d+$/.test(cleaned)) {
    const base = cleaned.split('.')[0];
    return { level: 4, parentCode: base };
  }

  return null;
}

function buildHierarchy(catalog) {
  const nodeMap = new Map();

  // 创建所有节点
  catalog.forEach(item => {
    const parsed = parseCSICode(item.code);
    if (!parsed) return;

    const cleanCode = item.code.replace(/\s+/g, '');
    nodeMap.set(cleanCode, {
      code: item.code,
      cleanCode,
      title: item.title,
      level: parsed.level,
      parentCode: parsed.parentCode,
      children: []
    });
  });

  // 建立父子关系
  const tree = [];
  nodeMap.forEach(node => {
    if (node.parentCode && nodeMap.has(node.parentCode)) {
      nodeMap.get(node.parentCode).children.push(node);
    } else if (node.level === 1) {
      tree.push(node);
    }
  });

  return { tree, nodeMap };
}

function flattenHierarchy(tree, result = []) {
  tree.forEach(node => {
    result.push({
      code: node.code,
      title: node.title,
      level: node.level,
      parent_code: node.parentCode,
      has_children: node.children.length > 0
    });

    if (node.children.length > 0) {
      flattenHierarchy(node.children, result);
    }
  });

  return result;
}

const catalogPath = process.argv[2] || '../../docs/specs/CSI 目录清单_catalog_v2.json';

console.log('\n🔧 CSI目录层级解析（修正版）\n' + '='.repeat(60) + '\n');

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
console.log(`读取 ${catalog.length} 条原始数据\n`);

const { tree, nodeMap } = buildHierarchy(catalog);
console.log(`构建层级树: ${tree.length} 个顶级Division\n`);

const flattened = flattenHierarchy(tree);
console.log(`扁平化层级: ${flattened.length} 条记录\n`);

const levelStats = {};
flattened.forEach(node => {
  levelStats[node.level] = (levelStats[node.level] || 0) + 1;
});

console.log('层级统计:');
const levelNames = ['', 'Division (2位)', 'Section (6位)', 'Subsection (8位)', 'Detail (小数)'];
Object.keys(levelStats).sort().forEach(level => {
  console.log(`  Level ${level} ${levelNames[level]}: ${levelStats[level]} 条`);
});

// 保存数据
const hierarchyPath = catalogPath.replace('.json', '_hierarchy.json');
fs.writeFileSync(hierarchyPath, JSON.stringify({ tree, flattened, statistics: levelStats }, null, 2));
console.log(`\n✅ 层级数据已保存到: ${hierarchyPath}`);

// 生成SQL
const sqlPath = catalogPath.replace('.json', '_import.sql');
const sqlLines = [
  '-- CSI MasterFormat 目录导入 (修正版)',
  'CREATE TABLE IF NOT EXISTS spec_sections (',
  '  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),',
  '  code VARCHAR(20) NOT NULL UNIQUE,',
  '  title TEXT NOT NULL,',
  '  level INT NOT NULL,',
  '  parent_code VARCHAR(20),',
  '  content TEXT,',
  '  sort_order INT DEFAULT 0,',
  '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,',
  '  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
  ');',
  'CREATE INDEX IF NOT EXISTS idx_spec_sections_level ON spec_sections(level);',
  'CREATE INDEX IF NOT EXISTS idx_spec_sections_parent ON spec_sections(parent_code);',
  '',
  'TRUNCATE TABLE spec_sections CASCADE;',
  ''
];

flattened.forEach((node, index) => {
  const code = node.code.replace(/'/g, "''");
  const title = node.title.replace(/'/g, "''");
  const parentCode = node.parent_code ? `'${node.parent_code.replace(/'/g, "''")}'` : 'NULL';

  sqlLines.push(
    `INSERT INTO spec_sections (code, title, level, parent_code, sort_order) VALUES ('${code}', '${title}', ${node.level}, ${parentCode}, ${index});`
  );
});

fs.writeFileSync(sqlPath, sqlLines.join('\n'));
console.log(`✅ SQL导入脚本已保存到: ${sqlPath}\n`);

// 示例展示
console.log('='.repeat(60));
console.log('层级结构示例:\n');

const exampleDiv = tree.find(t => t.code === '00');
if (exampleDiv) {
  console.log(`📁 Level 1: ${exampleDiv.code} - ${exampleDiv.title} (${exampleDiv.children.length}个子项)`);

  exampleDiv.children.slice(0, 3).forEach(section => {
    console.log(`  📄 Level 2: ${section.code} - ${section.title} (${section.children.length}个子项)`);

    section.children.slice(0, 2).forEach(subsection => {
      console.log(`    📋 Level 3: ${subsection.code} - ${subsection.title}`);
    });
  });
}
