// Use demo token which is accepted without JWT verification
const axios = require('axios');

const token = 'demo-token-test-123';

console.log('🔑 Using demo token\n');

axios.get('http://localhost:3000/api/menus', {
  headers: { Authorization: `Bearer ${token}` }
})
.then(res => {
  const menus = res.data.data || [];
  const withPerms = menus.filter(m => m.permission_code);

  console.log(`📊 菜单统计:`);
  console.log(`  - 总菜单数: ${menus.length}`);
  console.log(`  - 有权限码: ${withPerms.length}`);
  console.log(`\n前20个有权限码的菜单:`);

  withPerms.slice(0, 20).forEach(m => {
    console.log(`  - ${m.name.padEnd(22)} [${m.permission_code}]`);
  });

  console.log(`\n✅ /api/menus 工作正常`);
  console.log(`\n现在前端应该能正确显示权限列表`);
})
.catch(err => {
  console.error('❌ 错误:', err.response?.data?.message || err.message);
});
