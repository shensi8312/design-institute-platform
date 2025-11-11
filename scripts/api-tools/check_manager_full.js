const knex = require('./src/config/database');

(async () => {
  try {
    // 1. 查看manager角色权限
    const manager = await knex('roles')
      .where('code', 'manager')
      .select('id', 'code', 'name', 'permissions')
      .first();

    console.log('=== Manager角色信息 ===');
    console.log('ID:', manager.id);
    console.log('Code:', manager.code);
    console.log('Name:', manager.name);
    console.log('权限数量:', manager.permissions.length);
    console.log('\n前10个权限:');
    manager.permissions.slice(0, 10).forEach(p => console.log('  -', p));

    // 2. 查看有权限码的菜单总数
    const menuCount = await knex('menus')
      .whereNotNull('permission_code')
      .count('* as count')
      .first();

    console.log('\n=== 数据库菜单统计 ===');
    console.log('有permission_code的菜单总数:', menuCount.count);

    // 3. 查看manager用户信息
    const managerUser = await knex('users')
      .where('username', 'manager')
      .select('id', 'username', 'role_id')
      .first();

    if (managerUser) {
      console.log('\n=== Manager用户信息 ===');
      console.log('用户ID:', managerUser.id);
      console.log('用户名:', managerUser.username);
      console.log('角色ID:', managerUser.role_id);
      console.log('角色ID匹配:', managerUser.role_id === manager.id ? '✅' : '❌');
    }

    // 4. 检查所有菜单
    const allMenus = await knex('menus')
      .select('id', 'name', 'permission_code', 'parent_id', 'visible', 'status')
      .orderBy('sort_order', 'asc');

    console.log('\n=== 所有菜单列表 ===');
    console.log('总数:', allMenus.length);
    console.log('可见且活跃的:', allMenus.filter(m => m.visible && m.status === 'active').length);
    console.log('有权限码的:', allMenus.filter(m => m.permission_code).length);

    console.log('\n菜单详情（前30个）:');
    allMenus.slice(0, 30).forEach(m => {
      const hasPermInManager = manager.permissions.includes(m.permission_code);
      const mark = m.permission_code ? (hasPermInManager ? '✅' : '❌') : '  ';
      console.log(`${mark} ${m.id.toString().padEnd(4)} ${(m.name || '').padEnd(20)} ${(m.permission_code || '无').padEnd(30)} parent:${m.parent_id || 'null'} visible:${m.visible} status:${m.status}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('错误:', err);
    process.exit(1);
  }
})();
