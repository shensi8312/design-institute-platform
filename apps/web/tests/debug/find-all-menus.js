import puppeteer from 'puppeteer';

async function findAllMenus() {
  console.log('🔍 查找所有菜单...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 100,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  try {
    // 登录
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    
    const loginData = await loginResponse.json();
    const token = loginData.data.token;
    
    // 访问主页
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    
    // 设置token
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify({
        id: 'user_admin',
        username: 'admin'
      }));
    }, token);
    
    // 刷新页面
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 3000));
    
    // 获取菜单数据
    console.log('📝 从API获取菜单数据...');
    const menuResponse = await fetch('http://localhost:3000/api/menus', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const menuData = await menuResponse.json();
    console.log(`API返回 ${menuData.data?.length || 0} 个菜单\n`);
    
    // 分析页面DOM结构
    console.log('📝 分析页面DOM结构...\n');
    
    const domInfo = await page.evaluate(() => {
      const info = {
        hasAntMenu: document.querySelector('.ant-menu') !== null,
        hasAntMenuItem: document.querySelector('.ant-menu-item') !== null,
        hasAntSubmenu: document.querySelector('.ant-menu-submenu') !== null,
        menuCount: document.querySelectorAll('.ant-menu-item').length,
        submenuCount: document.querySelectorAll('.ant-menu-submenu').length,
        linkCount: document.querySelectorAll('a').length,
        menuTexts: []
      };
      
      // 获取所有菜单文本
      document.querySelectorAll('.ant-menu-item, .ant-menu-submenu-title').forEach(el => {
        const text = el.textContent?.trim();
        if (text) info.menuTexts.push(text);
      });
      
      return info;
    });
    
    console.log('DOM分析结果:');
    console.log(`  Ant Menu容器: ${domInfo.hasAntMenu ? '✅ 存在' : '❌ 不存在'}`);
    console.log(`  菜单项数量: ${domInfo.menuCount}`);
    console.log(`  子菜单数量: ${domInfo.submenuCount}`);
    console.log(`  链接数量: ${domInfo.linkCount}`);
    console.log(`\n找到的菜单文本:`);
    domInfo.menuTexts.forEach(text => console.log(`  - ${text}`));
    
    // 尝试点击展开所有子菜单
    console.log('\n📝 尝试展开所有子菜单...');
    
    const expandResult = await page.evaluate(() => {
      const results = [];
      const submenus = document.querySelectorAll('.ant-menu-submenu-title');
      
      submenus.forEach((submenu, index) => {
        const text = submenu.textContent?.trim();
        submenu.click();
        results.push(`点击了子菜单 ${index + 1}: ${text}`);
      });
      
      return results;
    });
    
    expandResult.forEach(r => console.log(`  ${r}`));
    
    await new Promise(r => setTimeout(r, 2000));
    
    // 重新获取展开后的菜单项
    console.log('\n📝 获取展开后的所有菜单链接...\n');
    
    const allMenuItems = await page.evaluate(() => {
      const items = [];
      
      // 方法1: 查找所有ant-menu-item
      document.querySelectorAll('.ant-menu-item').forEach(el => {
        const text = el.textContent?.trim();
        const link = el.querySelector('a');
        const onclick = el.getAttribute('onclick');
        
        items.push({
          type: 'ant-menu-item',
          text: text,
          hasLink: link !== null,
          href: link?.href || null,
          onclick: onclick
        });
      });
      
      // 方法2: 查找所有带href的链接
      document.querySelectorAll('a[href]').forEach(el => {
        const text = el.textContent?.trim();
        const href = el.href;
        const parent = el.closest('.ant-menu-item');
        
        if (parent) {
          items.push({
            type: 'link-in-menu',
            text: text,
            href: href
          });
        }
      });
      
      return items;
    });
    
    console.log(`找到 ${allMenuItems.length} 个菜单元素:\n`);
    allMenuItems.forEach((item, index) => {
      console.log(`${index + 1}. ${item.text}`);
      console.log(`   类型: ${item.type}`);
      console.log(`   链接: ${item.href || '无'}`);
      console.log('');
    });
    
    // 检查路由配置
    console.log('📝 检查路由配置...\n');
    
    const routerInfo = await page.evaluate(() => {
      // 检查是否使用了React Router
      const hasRouter = window.location.pathname !== undefined;
      const currentPath = window.location.pathname;
      const currentHash = window.location.hash;
      
      return {
        hasRouter,
        currentPath,
        currentHash,
        fullUrl: window.location.href
      };
    });
    
    console.log('路由信息:');
    console.log(`  当前路径: ${routerInfo.currentPath}`);
    console.log(`  当前Hash: ${routerInfo.currentHash}`);
    console.log(`  完整URL: ${routerInfo.fullUrl}`);
    
    // 截图
    await page.screenshot({ path: 'menu-structure.png', fullPage: true });
    console.log('\n📸 页面截图已保存: menu-structure.png');
    
  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    console.log('\n按任意键关闭...');
    await new Promise(r => setTimeout(r, 10000));
    await browser.close();
  }
}

findAllMenus();