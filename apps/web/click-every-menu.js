import puppeteer from 'puppeteer';
import fs from 'fs';

async function clickEveryMenu() {
  console.log('🖱️ 开始点击每个菜单项测试...\n');
  
  const browser = await puppeteer.launch({
    headless: false, // 设置为false可以看到实际浏览器
    slowMo: 500, // 放慢操作速度，便于观察
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // 设置视口大小
  await page.setViewport({ width: 1920, height: 1080 });
  
  // 监听所有错误
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const error = `Console Error: ${msg.text()}`;
      console.log(`❌ ${error}`);
      errors.push(error);
    }
  });
  
  page.on('pageerror', error => {
    console.log(`❌ Page Error: ${error.message}`);
    errors.push(`Page Error: ${error.message}`);
  });
  
  // 监听网络请求失败
  page.on('requestfailed', request => {
    console.log(`❌ Request Failed: ${request.url()} - ${request.failure().errorText}`);
  });
  
  try {
    // 1. 先登录
    console.log('📝 步骤1: 访问登录页...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
    console.log('   ✅ 登录页加载成功');
    
    // 等待登录表单出现
    console.log('📝 步骤2: 填写登录信息...');
    await page.waitForSelector('input', { timeout: 5000 });
    
    // 查找并填写用户名
    const inputs = await page.$$('input');
    if (inputs.length >= 2) {
      await inputs[0].type('admin');
      console.log('   ✅ 输入用户名: admin');
    }
    
    // 查找并填写密码
    if (inputs.length >= 2) {
      await inputs[1].type('admin123');
      console.log('   ✅ 输入密码: admin123');
    }
    
    // 点击登录按钮
    console.log('📝 步骤3: 点击登录按钮...');
    await page.click('button[type="submit"]');
    
    // 等待跳转或菜单出现
    try {
      await page.waitForSelector('.ant-menu', { timeout: 5000 });
      console.log('   ✅ 登录成功，菜单已加载');
    } catch {
      console.log('   ⚠️ 未找到菜单，可能登录失败');
    }
    const currentUrl = page.url();
    console.log(`   当前URL: ${currentUrl}\n`);
    
    // 2. 获取所有菜单项
    console.log('📝 步骤4: 获取所有菜单项...');
    await new Promise(r => setTimeout(r, 2000));
    
    // 查找所有菜单项
    const menuItems = await page.evaluate(() => {
      const items = [];
      // 查找所有antd菜单项
      const menuElements = document.querySelectorAll('.ant-menu-item, .ant-menu-submenu-title');
      menuElements.forEach(el => {
        const text = el.textContent?.trim();
        if (text) {
          items.push({
            text: text,
            class: el.className,
            hasSubmenu: el.className.includes('submenu')
          });
        }
      });
      return items;
    });
    
    console.log(`   找到 ${menuItems.length} 个菜单项:\n`);
    menuItems.forEach(item => {
      console.log(`   - ${item.text} ${item.hasSubmenu ? '(有子菜单)' : ''}`);
    });
    
    // 3. 逐个点击菜单
    console.log('\n📝 步骤5: 逐个点击菜单并测试...\n');
    
    for (let i = 0; i < menuItems.length; i++) {
      const menuItem = menuItems[i];
      console.log(`\n🔍 测试菜单 ${i+1}/${menuItems.length}: ${menuItem.text}`);
      
      try {
        // 如果是子菜单，先展开
        if (menuItem.hasSubmenu) {
          const submenuTitle = await page.$x(`//span[contains(text(), "${menuItem.text}")]`);
          if (submenuTitle && submenuTitle[0]) {
            await submenuTitle[0].click();
            console.log(`   📂 展开子菜单: ${menuItem.text}`);
            await new Promise(r => setTimeout(r, 500));
            
            // 获取子菜单项
            const subItems = await page.evaluate((parentText) => {
              const items = [];
              const parent = Array.from(document.querySelectorAll('.ant-menu-submenu-title'))
                .find(el => el.textContent?.includes(parentText));
              if (parent) {
                const submenu = parent.closest('.ant-menu-submenu');
                if (submenu) {
                  const subMenuItems = submenu.querySelectorAll('.ant-menu-item');
                  subMenuItems.forEach(el => {
                    const text = el.textContent?.trim();
                    if (text) items.push(text);
                  });
                }
              }
              return items;
            }, menuItem.text);
            
            // 点击每个子菜单
            for (const subItem of subItems) {
              console.log(`   🖱️ 点击子菜单: ${subItem}`);
              
              const subMenuItem = await page.$x(`//li[contains(@class, "ant-menu-item")]//span[contains(text(), "${subItem}")]`);
              if (subMenuItem && subMenuItem[0]) {
                await subMenuItem[0].click();
                await new Promise(r => setTimeout(r, 1500));
                
                // 检查URL变化
                const newUrl = page.url();
                console.log(`      URL: ${newUrl}`);
                
                // 检查是否有错误
                const hasError = await page.$('.ant-result-error, .ant-result-404');
                const hasEmpty = await page.$('.ant-empty');
                const hasContent = await page.$('.ant-card, .ant-table');
                
                if (hasError) {
                  console.log(`      ❌ 页面显示错误`);
                } else if (hasContent) {
                  console.log(`      ✅ 页面正常显示内容`);
                } else if (hasEmpty) {
                  console.log(`      ⚠️ 页面无数据`);
                } else {
                  console.log(`      ❓ 页面状态未知`);
                }
                
                // 截图
                const screenshotName = `${menuItem.text}-${subItem}`.replace(/[\/\s]/g, '-');
                await page.screenshot({ 
                  path: `menu-screenshots/${screenshotName}.png`,
                  fullPage: false 
                });
                console.log(`      📸 截图保存: ${screenshotName}.png`);
              }
            }
          }
        } else {
          // 直接点击菜单项
          const menuElement = await page.$x(`//li[contains(@class, "ant-menu-item")]//span[contains(text(), "${menuItem.text}")]`);
          if (menuElement && menuElement[0]) {
            await menuElement[0].click();
            console.log(`   🖱️ 点击菜单: ${menuItem.text}`);
            await new Promise(r => setTimeout(r, 1500));
            
            // 检查URL变化
            const newUrl = page.url();
            console.log(`      URL: ${newUrl}`);
            
            // 检查页面状态
            const hasError = await page.$('.ant-result-error, .ant-result-404');
            const hasEmpty = await page.$('.ant-empty');
            const hasContent = await page.$('.ant-card, .ant-table');
            
            if (hasError) {
              console.log(`      ❌ 页面显示错误`);
            } else if (hasContent) {
              console.log(`      ✅ 页面正常显示内容`);
            } else if (hasEmpty) {
              console.log(`      ⚠️ 页面无数据`);
            } else {
              console.log(`      ❓ 页面状态未知`);
            }
            
            // 截图
            const screenshotName = menuItem.text.replace(/[\/\s]/g, '-');
            await page.screenshot({ 
              path: `menu-screenshots/${screenshotName}.png`,
              fullPage: false 
            });
            console.log(`      📸 截图保存: ${screenshotName}.png`);
          }
        }
      } catch (error) {
        console.log(`   ❌ 点击失败: ${error.message}`);
      }
    }
    
    // 4. 总结
    console.log('\n\n📊 测试总结:');
    console.log(`   总共测试: ${menuItems.length} 个菜单项`);
    console.log(`   错误数量: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ 错误列表:');
      errors.forEach(err => console.log(`   - ${err}`));
    }
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
  } finally {
    console.log('\n按任意键关闭浏览器...');
    await new Promise(r => setTimeout(r, 5000)); // 等待5秒后关闭
    await browser.close();
  }
}

// 创建截图目录
try {
  fs.mkdirSync('menu-screenshots', { recursive: true });
} catch {}

// 运行测试
clickEveryMenu();