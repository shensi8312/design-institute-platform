import puppeteer from 'puppeteer';
import fs from 'fs';

async function clickEveryMenuDirectly() {
  console.log('🖱️ 开始直接测试菜单点击...\n');
  
  const browser = await puppeteer.launch({
    headless: false, // 设置为false可以看到实际浏览器
    slowMo: 300, // 放慢操作速度，便于观察
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
  
  try {
    // 1. 先通过API登录获取token
    console.log('📝 步骤1: 通过API获取登录token...');
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    
    const loginData = await loginResponse.json();
    const token = loginData.data.token;
    console.log('   ✅ 获取到token\n');
    
    // 2. 设置localStorage并直接访问主页
    console.log('📝 步骤2: 设置token并访问主页...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    
    // 注入token到localStorage
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify({
        id: 'user_admin',
        username: 'admin',
        email: 'admin@mst.com'
      }));
    }, token);
    
    // 刷新页面让token生效
    await page.reload({ waitUntil: 'networkidle0' });
    console.log('   ✅ 已设置token并刷新页面\n');
    
    // 等待菜单出现
    await new Promise(r => setTimeout(r, 2000));
    
    // 3. 获取所有菜单路径并逐个访问
    console.log('📝 步骤3: 获取所有菜单路径...');
    
    const menuPaths = [
      { name: '首页', path: '/' },
      { name: '引擎管理', path: '/engines' },
      { name: '工作流管理', path: '/workflow' },
      { name: '模型训练', path: '/training' },
      { name: '草图识别', path: '/sketch-recognition' },
      { name: '学习仪表板', path: '/learning' },
      { name: '数据标注', path: '/annotation' },
      { name: '知识库管理', path: '/knowledge/manage' },
      { name: '知识图谱', path: '/knowledge/graph' },
      { name: '知识搜索', path: '/knowledge/search' },
      { name: 'AI聊天', path: '/knowledge/chat' },
      { name: '用户管理', path: '/system/users' },
      { name: '权限管理', path: '/system/permissions' },
      { name: '系统日志', path: '/system/logs' },
      { name: '服务监控', path: '/system/monitor' },
      { name: '项目管理', path: '/projects' },
      { name: '我的项目', path: '/workspace/my-projects' },
      { name: '我的文档', path: '/workspace/my-documents' },
      { name: '我的任务', path: '/workspace/my-tasks' },
      { name: '我的知识库', path: '/personal/my-knowledge' },
      { name: '上传文档', path: '/personal/upload' },
      { name: 'AI助手', path: '/personal/ai-assistant' }
    ];
    
    console.log(`   找到 ${menuPaths.length} 个页面路径\n`);
    
    // 4. 逐个访问每个页面
    console.log('📝 步骤4: 逐个访问页面并测试...\n');
    
    const results = [];
    
    for (let i = 0; i < menuPaths.length; i++) {
      const menuItem = menuPaths[i];
      console.log(`🔍 测试页面 ${i+1}/${menuPaths.length}: ${menuItem.name}`);
      
      try {
        // 直接访问URL
        const url = `http://localhost:5173${menuItem.path}`;
        console.log(`   访问: ${url}`);
        
        await page.goto(url, { 
          waitUntil: 'networkidle0',
          timeout: 10000
        });
        
        // 等待一秒看是否有内容加载
        await new Promise(r => setTimeout(r, 1000));
        
        // 检查页面状态
        const pageTitle = await page.title();
        const hasError = await page.$('.ant-result-error, .ant-result-404') !== null;
        const hasEmpty = await page.$('.ant-empty') !== null;
        const hasContent = await page.$('.ant-card, .ant-table, .ant-form') !== null;
        const hasMenus = await page.$('.ant-menu') !== null;
        
        let status = '❓ 未知状态';
        if (hasError) {
          status = '❌ 页面错误';
        } else if (hasContent) {
          status = '✅ 有内容';
        } else if (hasEmpty) {
          status = '⚠️ 无数据';
        } else if (hasMenus) {
          status = '📋 页面框架正常';
        }
        
        console.log(`   状态: ${status}`);
        console.log(`   标题: ${pageTitle}`);
        
        results.push({
          name: menuItem.name,
          path: menuItem.path,
          status: status,
          title: pageTitle
        });
        
        // 截图
        const screenshotName = `${menuItem.name}`.replace(/[\/\s]/g, '-');
        await page.screenshot({ 
          path: `menu-screenshots/${screenshotName}.png`,
          fullPage: false 
        });
        console.log(`   📸 截图: ${screenshotName}.png\n`);
        
      } catch (error) {
        console.log(`   ❌ 访问失败: ${error.message}\n`);
        results.push({
          name: menuItem.name,
          path: menuItem.path,
          status: '❌ 访问失败',
          error: error.message
        });
      }
    }
    
    // 5. 总结
    console.log('\n\n📊 测试总结:');
    console.log(`   总共测试: ${menuPaths.length} 个页面`);
    
    const successCount = results.filter(r => r.status.includes('✅')).length;
    const errorCount = results.filter(r => r.status.includes('❌')).length;
    const emptyCount = results.filter(r => r.status.includes('⚠️')).length;
    
    console.log(`   ✅ 正常页面: ${successCount}`);
    console.log(`   ⚠️ 无数据页面: ${emptyCount}`);
    console.log(`   ❌ 错误页面: ${errorCount}`);
    
    console.log('\n📋 详细结果:');
    console.log('----------------------------------------');
    results.forEach(r => {
      console.log(`${r.status} ${r.name.padEnd(20)} ${r.path}`);
    });
    
    // 保存结果到文件
    fs.writeFileSync('menu-test-results.json', JSON.stringify(results, null, 2));
    console.log('\n📁 结果已保存到 menu-test-results.json');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
  } finally {
    console.log('\n等待5秒后关闭浏览器...');
    await new Promise(r => setTimeout(r, 5000));
    await browser.close();
  }
}

// 创建截图目录
try {
  fs.mkdirSync('menu-screenshots', { recursive: true });
} catch {}

// 运行测试
clickEveryMenuDirectly();