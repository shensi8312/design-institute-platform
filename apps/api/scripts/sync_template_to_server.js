const localKnex = require('../src/config/database');
const remoteKnex = require('knex')({
  client: 'pg',
  connection: {
    host: '10.10.19.4',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'design_platform'
  }
});

async function syncTemplate() {
  try {
    console.log('📖 从本地数据库读取模板数据...');

    // 从本地读取所有章节
    const sections = await localKnex('template_sections')
      .where('template_id', 'ac3dfd08-6875-479b-90db-244b9f840798')
      .select('*');

    console.log(`✅ 读取到 ${sections.length} 个章节`);

    // 构建树形结构
    const sectionStructure = buildTree(sections);
    console.log(`🌲 构建树形结构完成，根节点数：${sectionStructure.length}`);

    // 检查服务器上是否已存在该模板
    const existing = await remoteKnex('document_templates')
      .where('id', 'ac3dfd08-6875-479b-90db-244b9f840798')
      .first();

    if (existing) {
      console.log('📝 服务器上已存在该模板，执行更新...');
      await remoteKnex('document_templates')
        .where('id', 'ac3dfd08-6875-479b-90db-244b9f840798')
        .update({
          section_structure: JSON.stringify(sectionStructure),
          updated_at: new Date()
        });
      console.log('✅ 模板更新成功！');
    } else {
      console.log('📝 服务器上不存在该模板，执行插入...');
      await remoteKnex('document_templates').insert({
        id: 'ac3dfd08-6875-479b-90db-244b9f840798',
        name: 'CSI MasterFormat 规范模板',
        template_type: 'csi_spec',
        version: 'v1.0',
        section_structure: JSON.stringify(sectionStructure),
        status: 'published',
        created_at: new Date(),
        updated_at: new Date()
      });
      console.log('✅ 模板插入成功！');
    }

    await localKnex.destroy();
    await remoteKnex.destroy();
    console.log('\n🎉 数据同步完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
    await localKnex.destroy();
    await remoteKnex.destroy();
    process.exit(1);
  }
}

function buildTree(flatSections) {
  const map = {};
  const roots = [];

  // 第一遍：建立映射
  flatSections.forEach(s => {
    map[s.code] = {
      code: s.code,
      title: s.title,
      template_content: s.template_content || '',
      level: s.level,
      children: []
    };
  });

  // 第二遍：建立父子关系
  flatSections.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  flatSections.forEach(s => {
    if (!s.parent_code || s.parent_code === null) {
      // 顶层节点
      roots.push(map[s.code]);
    } else {
      // 子节点
      if (map[s.parent_code]) {
        map[s.parent_code].children.push(map[s.code]);
      } else {
        // 如果找不到父节点，作为根节点
        roots.push(map[s.code]);
      }
    }
  });

  return roots;
}

syncTemplate();
