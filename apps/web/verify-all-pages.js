import puppeteer from 'puppeteer';

(async () => {
  console.log('🔍 验证所有页面功能');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // 登录
  console.log('\n登录中...');
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[placeholder="请输入用户名"]', { timeout: 5000 });
  await page.type('input[placeholder="请输入用户名"]', 'admin');
  await page.type('input[placeholder="请输入密码"]', 'admin123');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 2000));

  // 所有页面列表
  const pages = [
    '/engines',
    '/workflow',
    '/workflow/editor', 
    '/workflow/agent',
    '/training',
    '/sketch-recognition',
    '/learning',
    '/annotation',
    '/langextract',
    '/projects',
    '/knowledge/manage',
    '/knowledge/upload',
    '/knowledge/search',
    '/knowledge/graph',
    '/knowledge/chat',
    '/knowledge/my-documents',
    '/users',
    '/roles',
    '/permissions',
    '/system/logs',
    '/system/settings',
    '/system/monitoring'
  ];

  let workingCount = 0;
  let totalCount = pages.length;

  console.log(`\n测试 ${totalCount} 个页面:\n`);

  for (const path of pages) {
    process.stdout.write(`${path.padEnd(30)}`);
    
    try {
      await page.goto(`http://localhost:5173${path}`, { 
        waitUntil: 'networkidle0',
        timeout: 10000 
      });
      
      // 等待页面渲染
      await new Promise(r => setTimeout(r, 1000));
      
      // 检查是否有内容
      const hasContent = await page.evaluate(() => {
        const main = document.querySelector('main') || 
                      document.querySelector('.ant-layout-content') ||
                      document.querySelector('[class*="content"]');
        if (!main) return false;
        const text = main.innerText || '';
        // 检查是否有实际内容（不只是空白）
        return text.trim().length > 0;
      });
      
      if (hasContent) {
        console.log('✅ 正常');
        workingCount++;
      } else {
        console.log('❌ 空白');
      }
    } catch (error) {
      console.log('❌ 错误');
    }
  }

  console.log(`\n========================================`);
  console.log(`测试结果: ${workingCount}/${totalCount} 页面正常工作`);
  console.log(`成功率: ${Math.round(workingCount/totalCount*100)}%`);
  
  if (workingCount === totalCount) {
    console.log('🎉 100% 页面全部通过测试！');
  } else {
    console.log(`⚠️ 还有 ${totalCount - workingCount} 个页面需要修复`);
  }

  await browser.close();
})();