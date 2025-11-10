const fs = require('fs');

/**
 * 解析CSI目录编号层级
 * 00 00 00 - Division (2位)
 * 03 20 00 - Section (6位)
 * 03 21 21 - Subsection (8位)
 * 03 21 21.11 - Detail (8位+小数)
 */
function parseCSICode(code) {
  const cleaned = code.replace(/\s+/g, '');

  // 检测格式
  if (/^\d{2}$/.test(cleaned)) {
    return { level: 1, division: cleaned, type: 'division' };
  }

  if (/^\d{4}$/.test(cleaned)) {
    return {
      level: 2,
      division: cleaned.substring(0, 2),
      section: cleaned,
      type: 'section'
    };
  }

  if (/^\d{6}$/.test(cleaned)) {
    return {
      level: 3,
      division: cleaned.substring(0, 2),
      section: cleaned.substring(0, 4),
      subsection: cleaned,
      type: 'subsection'
    };
  }

  if (/^\d{8}$/.test(cleaned)) {
    return {
      level: 4,
      division: cleaned.substring(0, 2),
      section: cleaned.substring(0, 4),
      subsection: cleaned.substring(0, 6),
      detail: cleaned,
      type: 'detail'
    };
  }

  if (/^\d{6,8}\.\d{2}$/.test(cleaned)) {
    const [base, decimal] = cleaned.split('.');
    return {
      level: 5,
      division: base.substring(0, 2),
      section: base.substring(0, 4),
      subsection: base.substring(0, 6),
      detail: base + decimal,
      type: 'detail_decimal'
    };
  }

  return null;
}

/**
 * 构建层级树
 */
function buildHierarchy(catalog) {
  const tree = [];
  const nodeMap = new Map();

  // 先创建所有节点
  catalog.forEach(item => {
    const parsed = parseCSICode(item.code);
    if (!parsed) return;

    const node = {
      code: item.code,
      title: item.title,
      level: parsed.level,
      fullCode: parsed.detail || parsed.subsection || parsed.section || parsed.division,
      children: []
    };

    nodeMap.set(node.fullCode, node);
  });

  // 建立父子关系
  nodeMap.forEach(node => {
    const parsed = parseCSICode(node.code);
    if (!parsed) return;

    let parentCode = null;

    if (parsed.level === 2) {
      parentCode = parsed.division;
    } else if (parsed.level === 3) {
      parentCode = parsed.section;
    } else if (parsed.level === 4) {
      parentCode = parsed.subsection;
    } else if (parsed.level === 5) {
      parentCode = parsed.detail.substring(0, parsed.detail.length - 2);
    }

    if (parentCode && nodeMap.has(parentCode)) {
      nodeMap.get(parentCode).children.push(node);
    } else if (parsed.level === 1) {
      tree.push(node);
    }
  });

  return tree;
}

/**
 * 扁平化层级树（添加parent_id）
 */
function flattenHierarchy(tree, parentId = null, result = []) {
  tree.forEach(node => {
    const flatNode = {
      code: node.code,
      title: node.title,
      level: node.level,
      parent_code: parentId,
      has_children: node.children.length > 0
    };

    result.push(flatNode);

    if (node.children.length > 0) {
      flattenHierarchy(node.children, node.code, result);
    }
  });

  return result;
}

/**
 * 主函数
 */
function main() {
  const catalogPath = process.argv[2] || '../../docs/specs/CSI 目录清单_catalog.json';

  console.log(`\n🔧 CSI目录层级解析\n${'='.repeat(60)}\n`);

  // 读取原始目录
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
  console.log(`读取 ${catalog.length} 条原始数据\n`);

  // 构建层级树
  const tree = buildHierarchy(catalog);
  console.log(`构建层级树: ${tree.length} 个顶级Division\n`);

  // 扁平化
  const flattened = flattenHierarchy(tree);
  console.log(`扁平化层级: ${flattened.length} 条记录\n`);

  // 统计各层级数量
  const levelStats = {};
  flattened.forEach(node => {
    levelStats[node.level] = (levelStats[node.level] || 0) + 1;
  });

  console.log('层级统计:');
  Object.keys(levelStats).sort().forEach(level => {
    const levelNames = ['', 'Division', 'Section', 'Subsection', 'Detail', 'Detail+'];
    console.log(`  Level ${level} (${levelNames[level]}): ${levelStats[level]} 条`);
  });

  // 保存层级数据
  const outputPath = catalogPath.replace('_catalog.json', '_hierarchy.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    tree,
    flattened,
    statistics: levelStats
  }, null, 2));

  console.log(`\n✅ 层级数据已保存到: ${outputPath}`);

  // 保存SQL导入脚本
  const sqlPath = catalogPath.replace('_catalog.json', '_import.sql');
  const sqlLines = [
    '-- CSI MasterFormat 目录导入',
    '-- 创建spec_sections表（如不存在）',
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
    '',
    '-- 清空现有数据',
    'TRUNCATE TABLE spec_sections CASCADE;',
    '',
    '-- 插入数据',
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

  // 显示示例层级
  console.log(`\n${'='.repeat(60)}`);
  console.log('层级结构示例:\n');

  const exampleDivision = tree[3]; // Division 03
  if (exampleDivision) {
    console.log(`📁 ${exampleDivision.code} - ${exampleDivision.title}`);
    exampleDivision.children.slice(0, 2).forEach(section => {
      console.log(`  📄 ${section.code} - ${section.title}`);
      section.children.slice(0, 2).forEach(subsection => {
        console.log(`    📋 ${subsection.code} - ${subsection.title}`);
      });
    });
  }
}

main();
