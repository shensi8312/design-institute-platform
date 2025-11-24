const knex = require('knex')({
  client: 'pg',
  connection: {
    host: '10.10.19.4',
    port: 5433,
    user: 'postgres',
    password: 'postgres',
    database: 'design_platform'
  }
});

const axios = require('axios');

async function exportTemplate() {
  try {
    // 从本地API获取已翻译的章节数据
    const response = await axios.get('http://localhost:3000/api/unified-document/templates/ac3dfd08-6875-479b-90db-244b9f840798/sections', {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2FkbWluIiwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWUsInJvbGVJZCI6InJvbGVfYWRtaW4iLCJpYXQiOjE3NjMxMTg4NzYsImV4cCI6MTc2MzcyMzY3Nn0.Mwxeyvnngm855b4OTnEYDUL0cSSFAn4CQRDOcxCprxY'
      }
    });

    const sections = response.data;
    console.log(`读取到 ${sections.length} 个章节`);

    // 构建 section_structure JSONB
    const sectionStructure = buildTree(sections);

    // 检查模板是否存在
    const existing = await knex('document_templates')
      .where('id', 'ac3dfd08-6875-479b-90db-244b9f840798')
      .first();

    if (existing) {
      // 更新
      await knex('document_templates')
        .where('id', 'ac3dfd08-6875-479b-90db-244b9f840798')
        .update({
          section_structure: JSON.stringify(sectionStructure),
          updated_at: new Date()
        });
      console.log('✅ 模板更新成功');
    } else {
      // 插入
      await knex('document_templates').insert({
        id: 'ac3dfd08-6875-479b-90db-244b9f840798',
        name: 'CSI MasterFormat 规范模板',
        template_type: 'csi_spec',
        version: 'v1.0',
        section_structure: JSON.stringify(sectionStructure),
        status: 'published',
        created_at: new Date(),
        updated_at: new Date()
      });
      console.log('✅ 模板插入成功');
    }

    await knex.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    await knex.destroy();
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
      children: []
    };
  });

  // 第二遍：建立父子关系
  flatSections.forEach(s => {
    const parts = s.code.split(/[\s.]+/).filter(p => p);
    if (parts.length === 1 || parts.length === 2) {
      roots.push(map[s.code]);
    } else {
      // 找父节点 - 简化为去掉最后一部分
      const parentParts = parts.slice(0, -1);
      const parentCode = flatSections.find(ps => {
        const psp = ps.code.split(/[\s.]+/).filter(p => p);
        return psp.length === parentParts.length &&
               psp.every((v, i) => v === parentParts[i]);
      })?.code;

      if (parentCode && map[parentCode]) {
        map[parentCode].children.push(map[s.code]);
      } else {
        // 如果找不到父节点，作为根节点
        roots.push(map[s.code]);
      }
    }
  });

  return roots;
}

exportTemplate();
