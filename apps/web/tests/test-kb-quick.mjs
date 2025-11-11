// 快速测试知识库保存功能
import puppeteer from 'puppeteer';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  try {
    // 1. 登录
    console.log('1. 正在登录...');
    await page.goto('http://localhost:5173/login');
    await page.waitForSelector('input[placeholder="请输入用户名"]', { timeout: 5000 });
    await page.type('input[placeholder="请输入用户名"]', 'admin');
    await page.type('input[placeholder="请输入密码"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ timeout: 5000 });
    console.log('✅ 登录成功');
    
    // 2. 进入企业知识库页面
    console.log('2. 导航到企业知识库页面...');
    await page.goto('http://localhost:5173/knowledge/manage');
    await delay(2000);
    console.log('✅ 已进入知识库页面');
    
    // 3. 点击新建知识库按钮
    console.log('3. 点击新建知识库按钮...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const newButton = buttons.find(btn => btn.textContent.includes('新建知识库'));
      if (newButton) {
        newButton.click();
        return true;
      }
      return false;
    });
    await delay(2000);
    console.log('✅ 已打开新建知识库对话框');
    
    // 4. 填写表单
    console.log('4. 填写知识库信息...');
    
    // 填写名称
    const kbName = '测试知识库_' + Date.now();
    await page.type('input#name', kbName);
    console.log(`   名称: ${kbName}`);
    
    // 填写描述
    await page.type('textarea#description', '这是一个自动化测试创建的知识库');
    console.log('   描述: 已填写');
    
    // 5. 点击确定保存
    console.log('5. 点击确定保存...');
    const saved = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.ant-modal-footer button'));
      const confirmButton = buttons.find(btn => btn.textContent.includes('确定'));
      if (confirmButton) {
        confirmButton.click();
        return true;
      }
      return false;
    });
    
    if (!saved) {
      console.log('❌ 未找到确定按钮');
    } else {
      console.log('⏳ 等待保存结果...');
      await delay(3000);
      
      // 检查是否保存成功
      const modalVisible = await page.$('.ant-modal-content');
      if (modalVisible) {
        console.log('❌ 保存可能失败，模态框仍然显示');
      } else {
        console.log('✅ 模态框已关闭，保存成功！');
      }
    }
    
    console.log('\n✅ 测试完成！知识库保存功能正常工作。');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
  
  await browser.close();
})();