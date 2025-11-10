// 测试知识库保存功能
import puppeteer from 'puppeteer';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null 
  });
  const page = await browser.newPage();
  
  try {
    // 1. 登录
    console.log('1. 正在登录...');
    await page.goto('http://localhost:5173/login');
    await page.waitForSelector('input[placeholder="请输入用户名"]');
    await page.type('input[placeholder="请输入用户名"]', 'admin');
    await page.type('input[placeholder="请输入密码"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    // 2. 进入企业知识库页面
    console.log('2. 导航到企业知识库页面...');
    await page.goto('http://localhost:5173/knowledge/manage');
    await delay(2000);
    
    // 3. 点击新建知识库按钮
    console.log('3. 点击新建知识库按钮...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const newButton = buttons.find(btn => btn.textContent.includes('新建知识库'));
      if (newButton) newButton.click();
    });
    await delay(2000);
    
    // 4. 填写表单
    console.log('4. 填写知识库信息...');
    
    // 填写名称
    await page.type('input#name', '测试知识库' + Date.now());
    
    // 填写描述
    await page.type('textarea#description', '这是一个测试知识库');
    
    // 选择向量搜索（默认已选中）
    
    // 5. 选择一些权限
    console.log('5. 选择权限...');
    
    // 尝试点击第一个组织
    const orgTransfer = await page.$('.ant-transfer');
    if (orgTransfer) {
      await page.evaluate(() => {
        // 点击第一个可选项
        const items = document.querySelectorAll('.ant-transfer-list-content-item:not(.ant-transfer-list-content-item-disabled)');
        if (items[0]) items[0].click();
      });
      await delay(500);
      
      // 点击移动按钮
      await page.evaluate(() => {
        const buttons = document.querySelectorAll('.ant-transfer-operation button');
        if (buttons[0] && !buttons[0].disabled) buttons[0].click();
      });
      await delay(500);
    }
    
    // 6. 点击确定保存
    console.log('6. 点击确定保存...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.ant-modal-footer button'));
      const confirmButton = buttons.find(btn => btn.textContent.includes('确定'));
      if (confirmButton) confirmButton.click();
    });
    
    await delay(3000);
    
    // 7. 检查是否保存成功
    console.log('7. 检查保存结果...');
    
    // 截图最终状态
    await page.screenshot({ path: 'kb-save-result.png', fullPage: true });
    console.log('截图已保存: kb-save-result.png');
    
    // 检查是否还在模态框中（表示保存失败）
    const modalVisible = await page.$('.ant-modal-content');
    if (modalVisible) {
      console.log('❌ 保存可能失败，模态框仍然显示');
      
      // 获取可能的错误信息
      const errorMessage = await page.$eval('.ant-message-error', el => el.textContent).catch(() => null);
      if (errorMessage) {
        console.log('错误信息:', errorMessage);
      }
    } else {
      console.log('✅ 模态框已关闭，保存可能成功');
      
      // 检查是否有成功消息
      const successMessage = await page.$eval('.ant-message-success', el => el.textContent).catch(() => null);
      if (successMessage) {
        console.log('成功信息:', successMessage);
      }
      
      // 检查页面上是否显示了新创建的知识库
      const tableRows = await page.$$eval('tbody tr', rows => rows.length);
      console.log(`当前页面显示 ${tableRows} 个知识库`);
    }
    
  } catch (error) {
    console.error('测试失败:', error);
    await page.screenshot({ path: 'kb-error-screenshot.png', fullPage: true });
    console.log('错误截图已保存: kb-error-screenshot.png');
  }
  
  console.log('\n按任意键关闭浏览器...');
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
  
  await browser.close();
  process.exit(0);
})();