import puppeteer from 'puppeteer';

async function debugPages() {
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  
  // 收集控制台错误
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log('❌ 错误:', msg.text());
    }
  });
  
  page.on('pageerror', error => {
    console.log('❌ 页面错误:', error.message);
  });
  
  // 登录
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const { data } = await loginRes.json();
  
  await page.goto('http://localhost:5173/login');
  await page.evaluate((token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, data.token, data.user);
  
  // 测试问题页面
  const problemPages = [
    '/workflow',
    '/workflow/editor', 
    '/workflow/agent',
    '/learning',
    '/annotation'
  ];
  
  for (const path of problemPages) {
    console.log(`\n测试页面: ${path}`);
    errors.length = 0;
    
    await page.goto(`http://localhost:5173${path}`, { 
      waitUntil: 'networkidle0',
      timeout: 10000 
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    // 检查是否有内容
    const hasContent = await page.evaluate(() => {
      const body = document.body.textContent || '';
      return body.trim().length > 100;
    });
    
    console.log(`内容: ${hasContent ? '有' : '无'}`);
    
    if (errors.length > 0) {
      console.log('错误详情:');
      errors.forEach(e => console.log(`  - ${e}`));
    }
  }
  
  console.log('\n按回车关闭浏览器...');
  await new Promise(r => setTimeout(r, 30000));
  await browser.close();
}

debugPages();