import puppeteer from 'puppeteer';

(async () => {
  console.log('🔍 深度排查5个空白页面\n');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // 收集所有错误
  const errors = {};
  
  page.on('console', msg => {
    const url = page.url();
    if (!errors[url]) errors[url] = [];
    if (msg.type() === 'error' || msg.type() === 'warning') {
      errors[url].push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  
  page.on('pageerror', error => {
    const url = page.url();
    if (!errors[url]) errors[url] = [];
    errors[url].push(`[PAGE ERROR] ${error.message}`);
  });
  
  // 设置token
  await page.goto('http://localhost:5174');
  const loginResponse = await page.evaluate(async () => {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    return await response.json();
  });
  
  if (loginResponse.code === 200) {
    await page.evaluate((data) => {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }, loginResponse.data);
  }
  
  // 问题页面列表
  const problemPages = [
    { path: '/workflow', name: '工作流管理' },
    { path: '/workflow/editor', name: '工作流编辑器' },
    { path: '/workflow/agent', name: 'Agent工作流' },
    { path: '/learning', name: '学习仪表板' },
    { path: '/annotation', name: '数据标注' }
  ];
  
  for (const pageInfo of problemPages) {
    console.log(`\n检查 ${pageInfo.name} (${pageInfo.path}):`);
    console.log('─'.repeat(50));
    
    errors[`http://localhost:5174${pageInfo.path}`] = [];
    
    await page.goto(`http://localhost:5174${pageInfo.path}`, { 
      waitUntil: 'networkidle0',
      timeout: 10000 
    }).catch(e => console.log('  导航错误:', e.message));
    
    await new Promise(r => setTimeout(r, 2000));
    
    // 检查React是否渲染
    const reactInfo = await page.evaluate(() => {
      const root = document.querySelector('#root');
      const hasReact = window.React !== undefined;
      const hasReactDOM = window.ReactDOM !== undefined;
      const rootChildren = root ? root.children.length : 0;
      const mainContent = document.querySelector('main') || document.querySelector('.ant-layout-content');
      
      // 检查是否有React错误边界错误
      const errorBoundary = document.querySelector('.ant-result-error');
      
      return {
        hasRoot: !!root,
        hasReact,
        hasReactDOM,
        rootChildren,
        hasMainContent: !!mainContent,
        mainContentText: mainContent ? mainContent.innerText.substring(0, 100) : '',
        hasErrorBoundary: !!errorBoundary,
        errorText: errorBoundary ? errorBoundary.innerText : ''
      };
    });
    
    console.log(`  React Root: ${reactInfo.hasRoot ? '✅' : '❌'}`);
    console.log(`  React库: ${reactInfo.hasReact ? '✅' : '❌'}`);
    console.log(`  Root子元素: ${reactInfo.rootChildren}个`);
    console.log(`  Main内容: ${reactInfo.hasMainContent ? '有' : '无'}`);
    
    if (reactInfo.hasErrorBoundary) {
      console.log(`  ❌ React错误: ${reactInfo.errorText}`);
    }
    
    if (reactInfo.mainContentText) {
      console.log(`  内容: "${reactInfo.mainContentText}"`);
    }
    
    // 输出该页面的所有错误
    const pageErrors = errors[`http://localhost:5174${pageInfo.path}`];
    if (pageErrors && pageErrors.length > 0) {
      console.log(`  错误 (${pageErrors.length}个):`);
      pageErrors.forEach(err => console.log(`    ${err}`));
    }
    
    // 检查网络请求
    const networkErrors = await page.evaluate(() => {
      return window.__networkErrors || [];
    });
    
    if (networkErrors.length > 0) {
      console.log(`  网络错误:`);
      networkErrors.forEach(err => console.log(`    ${err}`));
    }
  }
  
  await browser.close();
})();