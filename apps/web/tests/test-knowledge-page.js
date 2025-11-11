// 测试企业知识库页面
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null 
  });
  const page = await browser.newPage();
  
  try {
    // 1. 登录
    await page.goto('http://localhost:5173/login');
    await page.waitForSelector('input[placeholder="请输入用户名"]');
    await page.type('input[placeholder="请输入用户名"]', 'admin');
    await page.type('input[placeholder="请输入密码"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    // 2. 进入企业知识库页面
    console.log('导航到企业知识库页面...');
    await page.goto('http://localhost:5173/knowledge/manage');
    await page.waitForTimeout(2000);
    
    // 3. 点击新建知识库按钮
    console.log('查找新建知识库按钮...');
    const newButton = await page.$('button:has-text("新建知识库")');
    if (!newButton) {
      const buttons = await page.$$eval('button', btns => btns.map(b => b.textContent));
      console.log('页面上的按钮:', buttons);
    } else {
      await newButton.click();
      await page.waitForTimeout(2000);
      
      // 4. 检查模态框中的内容
      console.log('检查权限设置部分...');
      
      // 查找权限设置卡片
      const permissionCard = await page.$('.ant-card:has-text("权限设置")');
      if (!permissionCard) {
        console.log('❌ 没有找到权限设置卡片');
        
        // 获取模态框内容
        const modalContent = await page.$eval('.ant-modal-content', el => el.innerText).catch(() => null);
        console.log('模态框内容:', modalContent);
      } else {
        console.log('✅ 找到权限设置卡片');
        
        // 检查Transfer组件
        const transfers = await page.$$('.ant-transfer');
        console.log(`找到 ${transfers.length} 个Transfer组件`);
        
        // 获取每个Transfer的标题
        for (let i = 0; i < transfers.length; i++) {
          const titles = await transfers[i].$$eval('.ant-transfer-list-header-title', els => els.map(e => e.textContent));
          console.log(`Transfer ${i + 1} 标题:`, titles);
          
          // 获取列表项数量
          const items = await transfers[i].$$('.ant-transfer-list-content-item');
          console.log(`  包含 ${items.length} 个选项`);
        }
      }
      
      // 截图
      await page.screenshot({ path: 'knowledge-modal.png', fullPage: true });
      console.log('截图已保存: knowledge-modal.png');
    }
    
  } catch (error) {
    console.error('测试失败:', error);
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
  }
  
  await browser.close();
})();