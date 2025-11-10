/**
 * 同步菜单权限：为所有菜单生成permission_code
 */
const knex = require('../src/config/database');

async function main() {
  console.log('🔄 同步菜单权限\n');

  // 获取所有菜单
  const allMenus = await knex('menus')
    .select('id', 'name', 'code', 'type', 'permission_code')
    .orderBy('id');

  console.log(`📊 总菜单数: ${allMenus.length}\n`);

  let updated = 0;

  for (const menu of allMenus) {
    // 如果已有permission_code，跳过
    if (menu.permission_code) {
      continue;
    }

    let permCode;

    // 根据code生成permission_code
    if (menu.code) {
      // 跳过纯数字code
      if (/^\d+$/.test(menu.code)) {
        console.log(`  ⚠️  跳过: ${menu.name} (code是数字: ${menu.code})`);
        continue;
      }

      // 转换格式
      // workflow:editor -> workflow.editor
      // rules_unified -> rules.unified
      // engines:assembly-rules -> assembly.rules
      permCode = menu.code
        .replace(/:/g, '.')
        .replace(/_/g, '.')
        .replace(/-/g, '.');

      // 如果以 engines. 开头，去掉前缀
      if (permCode.startsWith('engines.')) {
        permCode = permCode.substring(8);
      }
    } else {
      // 没有code，根据name生成简单的权限码
      // 企业知识库 -> knowledge.enterprise
      // 个人知识库 -> knowledge.personal
      // PID识别 -> mechanical.pid
      const nameMapping = {
        '企业知识库': 'knowledge.enterprise',
        '个人知识库': 'knowledge.personal',
        'PID识别': 'mechanical.pid',
        '装配系统总览': 'mechanical.assembly',
        '文档管理': 'document.view',
        '模板管理': 'document.template',
        '审批任务': 'document.approval',
        '归档管理': 'document.archive',
        '草图识别': 'ai.sketch',
        '数据标注': 'ai.annotation',
        '模型训练': 'ai.training',
        '学习仪表板': 'ai.learning',
        '建筑布局引擎': 'engine.building.layout',
        '空间约束推理引擎': 'engine.spatial.constraint',
        'LangExtract': 'langextract.view',
        '系统配置': 'system.config',
        '系统监控': 'system.monitor',
        '系统日志': 'system.logs',
        '组织管理': 'organization.view',
        '菜单管理': 'menu.view'
      };

      permCode = nameMapping[menu.name] || `menu.${menu.id}`;
    }

    // 更新数据库
    await knex('menus')
      .where('id', menu.id)
      .update({ permission_code: permCode });

    console.log(`  ✅ ${menu.name.padEnd(25)}: ${permCode}`);
    updated++;
  }

  console.log(`\n✅ 共更新 ${updated} 个菜单权限`);

  // 显示最终统计
  const withPerms = await knex('menus')
    .whereNotNull('permission_code')
    .count('* as cnt')
    .first();

  console.log(`\n📊 最终统计：`);
  console.log(`  - 总菜单数: ${allMenus.length}`);
  console.log(`  - 有权限码: ${withPerms.cnt}`);
  console.log(`  - 无权限码: ${allMenus.length - parseInt(withPerms.cnt)}`);

  process.exit(0);
}

main().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});
