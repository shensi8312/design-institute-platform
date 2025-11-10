import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ 
    headless: true
  });
  const page = await browser.newPage();
  
  // 监听控制台消息
  page.on('console', msg => {
    console.log(`[${msg.type().toUpperCase()}]`, msg.text());
  });
  
  // 监听页面错误
  page.on('pageerror', error => {
    console.log('[PAGE ERROR]', error.message);
  });
  
  // 监听请求失败
  page.on('requestfailed', request => {
    console.log('[REQUEST FAILED]', request.url(), request.failure().errorText);
  });

  console.log('访问登录页面...');
  await page.goto('http://localhost:5173/login');
  
  // 等待10秒以查看控制台输出
  await new Promise(r => setTimeout(r, 10000));
  
  console.log('\n尝试登录...');
  const loginExists = await page.$('input[placeholder="请输入用户名"]');
  
  if (loginExists) {
    await page.type('input[placeholder="请输入用户名"]', 'admin');
    await page.type('input[placeholder="请输入密码"]', 'admin123');
    await page.click('button[type="submit"]');
    
    console.log('等待导航...');
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('\n访问引擎管理页面...');
    await page.goto('http://localhost:5173/engines');
    await new Promise(r => setTimeout(r, 5000));
  } else {
    console.log('登录表单未找到，可能已经登录或页面有问题');
  }
  
  await browser.close();
})();