import puppeteer from 'puppeteer';

(async () => {
  console.log('🔍 捕获4个空白页面的具体错误\n');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // 捕获所有控制台消息
  const consoleMessages = [];
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    consoleMessages.push({ type, text });
    
    // 打印错误
    if (type === 'error' && !text.includes('Warning')) {
      console.log(`[ERROR] ${text}`);
      
      // 尝试获取更多错误详情
      msg.args().forEach(async (arg, index) => {
        try {
          const val = await arg.jsonValue();
          if (val && typeof val === 'object' && val.stack) {
            console.log(`  Stack trace:`, val.stack);
          }
        } catch (e) {}
      });
    }
  });
  
  // 捕获未处理的页面错误
  page.on('pageerror', error => {
    console.log('[PAGE ERROR]', error.message);
    console.log('  Stack:', error.stack);
  });
  
  // 登录
  await page.goto('http://localhost:5173');
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
  
  // 测试问题页面
  const problemPages = [
    '/workflow',
    '/workflow/editor',
    '/learning',
    '/annotation'
  ];
  
  for (const path of problemPages) {
    console.log(`\n\n========== 测试 ${path} ==========`);
    consoleMessages.length = 0;
    
    await page.goto(`http://localhost:5173${path}`, { 
      waitUntil: 'domcontentloaded'
    });
    
    await new Promise(r => setTimeout(r, 3000));
    
    // 尝试从页面获取React错误
    const reactError = await page.evaluate(() => {
      // 查找错误边界显示的错误
      const errorElement = document.querySelector('.ant-result-subtitle');
      if (errorElement) {
        return errorElement.textContent;
      }
      
      // 检查React Fiber节点
      const root = document.querySelector('#root');
      if (root && root._reactRootContainer) {
        const fiber = root._reactRootContainer._internalRoot.current;
        if (fiber && fiber.memoizedState && fiber.memoizedState.error) {
          return {
            message: fiber.memoizedState.error.message,
            stack: fiber.memoizedState.error.stack
          };
        }
      }
      
      return null;
    });
    
    if (reactError) {
      console.log('React错误:', reactError);
    }
    
    // 执行一些调试代码
    const debugInfo = await page.evaluate(() => {
      const results = {};
      
      // 检查组件是否加载
      results.hasRoot = !!document.querySelector('#root');
      results.hasContent = !!document.querySelector('.ant-layout-content');
      
      // 检查是否有React
      results.hasReact = typeof window.React !== 'undefined';
      results.hasReactDOM = typeof window.ReactDOM !== 'undefined';
      
      // 尝试手动导入看是否报错
      try {
        if (window.require) {
          const test = window.require('reactflow');
          results.reactflowLoaded = !!test;
        }
      } catch (e) {
        results.requireError = e.message;
      }
      
      return results;
    });
    
    console.log('调试信息:', debugInfo);
  }
  
  
  await browser.close();
})();