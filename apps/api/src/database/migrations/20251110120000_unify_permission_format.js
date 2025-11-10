/**
 * 统一权限格式：将菜单的permission_code从冒号格式改为点号格式
 * system:user:view -> user.view
 * knowledge:view -> knowledge.view
 */

exports.up = async function(knex) {
  console.log('🔄 统一权限格式：冒号改为点号\n');

  // 获取所有有 permission_code 的菜单
  const menusWithPerms = await knex('menus')
    .select('id', 'name', 'permission_code')
    .whereNotNull('permission_code');

  for (const menu of menusWithPerms) {
    const oldCode = menu.permission_code;
    let newCode;

    // 特殊处理通配符
    if (oldCode === 'system:*') {
      newCode = 'system.view';
    }
    // 处理冒号格式
    else if (oldCode.includes(':')) {
      const parts = oldCode.split(':');

      if (parts.length === 3) {
        // system:user:view -> user.view
        newCode = `${parts[1]}.${parts[2]}`;
      } else if (parts.length === 2) {
        // knowledge:view -> knowledge.view
        // digital_site:view -> digital_site.view
        newCode = oldCode.replace(':', '.');
      } else {
        // 其他情况，直接替换所有冒号为点号
        newCode = oldCode.replace(/:/g, '.');
      }
    } else {
      // 已经是点号格式或其他格式，不改变
      newCode = oldCode;
    }

    if (oldCode !== newCode) {
      await knex('menus')
        .where('id', menu.id)
        .update({ permission_code: newCode });

      console.log(`  ✅ ${menu.name.padEnd(20)}: ${oldCode} -> ${newCode}`);
    }
  }

  console.log('\n✅ 权限格式统一完成');
};

exports.down = async function(knex) {
  console.log('🔄 回滚：点号改回冒号格式\n');

  // 获取所有有 permission_code 的菜单
  const menusWithPerms = await knex('menus')
    .select('id', 'name', 'permission_code')
    .whereNotNull('permission_code');

  for (const menu of menusWithPerms) {
    const newCode = menu.permission_code;
    let oldCode;

    // 特殊处理 system.view 回滚为 system:*
    if (newCode === 'system.view') {
      oldCode = 'system:*';
    }
    // 处理点号格式
    else if (newCode.includes('.')) {
      const parts = newCode.split('.');

      // 推断模块前缀
      if (parts[0] === 'knowledge' || parts[0] === 'digital_site' || parts[0] === 'mechanical') {
        // knowledge.view -> knowledge:view
        oldCode = newCode.replace('.', ':');
      } else {
        // user.view -> system:user:view
        oldCode = `system:${newCode.replace('.', ':')}`;
      }
    } else {
      oldCode = newCode;
    }

    if (oldCode !== newCode) {
      await knex('menus')
        .where('id', menu.id)
        .update({ permission_code: oldCode });

      console.log(`  ✅ ${menu.name.padEnd(20)}: ${newCode} -> ${oldCode}`);
    }
  }

  console.log('\n✅ 回滚完成');
};
