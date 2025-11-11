const knex = require('./src/config/database');

(async () => {
  try {
    // 获取所有菜单权限码（排除系统配置）
    const menus = await knex('menus')
      .whereNotNull('permission_code')
      .where('permission_code', '!=', 'system.config')
      .select('permission_code', 'name')
      .orderBy('permission_code');

    const allPerms = menus.map(m => m.permission_code);

    console.log('菜单权限码总数:', menus.length);
    console.log('前10个权限码:');
    allPerms.slice(0, 10).forEach(p => console.log('  -', p));

    // 更新manager角色
    await knex('roles')
      .where('code', 'manager')
      .update({
        permissions: JSON.stringify(allPerms),
        updated_at: knex.fn.now()
      });

    console.log('\n✅ manager角色权限已更新，共', allPerms.length, '个权限');

    // 验证
    const updated = await knex('roles').where('code', 'manager').select('permissions').first();
    console.log('验证: manager现在有', updated.permissions.length, '个权限');

    process.exit(0);
  } catch (err) {
    console.error('错误:', err);
    process.exit(1);
  }
})();
