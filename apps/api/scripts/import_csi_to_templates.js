/**
 * CSI MasterFormat 目录导入脚本
 * 将解析后的CSI层级数据导入到模板系统
 */

const knex = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function importCSITemplate() {
  console.log('\n🔧 CSI MasterFormat 导入模板系统\n' + '='.repeat(60) + '\n');

  try {
    // 1. 读取层级数据
    const hierarchyPath = path.join(__dirname, '../../../docs/specs/CSI 目录清单_catalog_v2_hierarchy.json');
    if (!fs.existsSync(hierarchyPath)) {
      throw new Error(`层级数据文件不存在: ${hierarchyPath}\n请先运行: node parse_csi_hierarchy_fixed.js`);
    }

    const hierarchyData = JSON.parse(fs.readFileSync(hierarchyPath, 'utf-8'));
    const { flattened, statistics } = hierarchyData;

    console.log(`📥 读取 ${flattened.length} 条层级数据\n`);
    console.log('层级统计:');
    Object.keys(statistics).forEach(level => {
      console.log(`  Level ${level}: ${statistics[level]} 条`);
    });
    console.log();

    // 2. 检查模板是否已存在
    const existingTemplate = await knex('document_templates')
      .where({ code: 'csi_masterformat_2020' })
      .first();

    let template;
    if (existingTemplate) {
      console.log('⚠️  模板已存在，将更新...\n');
      template = existingTemplate;

      // 删除旧的章节数据
      await knex('template_sections')
        .where({ template_id: template.id })
        .del();
      console.log('✅ 已清理旧章节数据\n');
    } else {
      // 3. 创建模板记录
      console.log('📝 创建CSI MasterFormat 2020模板...\n');

      const specDomainConfig = require('../src/config/domains/spec.domain');

      [template] = await knex('document_templates').insert({
        code: 'csi_masterformat_2020',
        name: 'CSI MasterFormat 2020',
        type: 'spec',
        description: 'CSI MasterFormat 2020 建筑规范标准目录',
        section_code_format: '## ## ##',
        max_level: 4,
        is_system: true,
        is_active: true,
        config: JSON.stringify(specDomainConfig),
        created_by: 'user_admin' // 系统管理员
      }).returning('*');

      console.log(`✅ 模板已创建: ${template.id}\n`);
    }

    // 4. 批量插入章节数据
    console.log(`📝 插入 ${flattened.length} 条章节数据...\n`);

    const sections = flattened.map((node, index) => ({
      template_id: template.id,
      code: node.code,
      title: node.title,
      level: node.level,
      parent_code: node.parent_code,
      sort_order: index,
      is_required: false, // CSI目录项不强制必填
      is_editable: true,
      description: `Level ${node.level} ${node.has_children ? '(含子项)' : ''}`,
      metadata: JSON.stringify({
        has_children: node.has_children,
        original_index: index
      })
    }));

    // 分批插入，避免一次性插入太多数据
    const batchSize = 100;
    for (let i = 0; i < sections.length; i += batchSize) {
      const batch = sections.slice(i, i + batchSize);
      await knex('template_sections').insert(batch);
      console.log(`  已插入 ${Math.min(i + batchSize, sections.length)}/${sections.length} 条`);
    }

    console.log('\n✅ 章节数据导入完成\n');

    // 5. 验证数据
    console.log('🔍 验证导入结果...\n');

    const templateSections = await knex('template_sections')
      .where({ template_id: template.id })
      .count('* as count')
      .first();

    console.log(`  模板ID: ${template.id}`);
    console.log(`  模板编码: ${template.code}`);
    console.log(`  模板名称: ${template.name}`);
    console.log(`  章节总数: ${templateSections.count}\n`);

    // 显示示例数据
    const sampleSections = await knex('template_sections')
      .where({ template_id: template.id })
      .orderBy('sort_order')
      .limit(10);

    console.log('示例章节数据（前10条）:');
    sampleSections.forEach(s => {
      const indent = '  '.repeat(s.level - 1);
      console.log(`${indent}Level ${s.level}: ${s.code} - ${s.title}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ CSI MasterFormat 导入成功！\n');

    return {
      success: true,
      template,
      sectionsCount: parseInt(templateSections.count)
    };

  } catch (error) {
    console.error('\n❌ 导入失败:', error.message);
    console.error(error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

// 执行导入
if (require.main === module) {
  importCSITemplate()
    .then(result => {
      if (result.success) {
        console.log('🎉 导入完成，可以开始使用模板系统了！\n');
        process.exit(0);
      } else {
        console.error('💥 导入失败\n');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 执行错误:', error);
      process.exit(1);
    });
}

module.exports = importCSITemplate;
