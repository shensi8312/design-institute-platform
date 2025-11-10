// 测试前端页面知识库保存功能
import puppeteer from 'puppeteer';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // 监听控制台输出
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('浏览器控制台错误:', msg.text());
    }
  });
  
  // 监听网络请求
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/knowledge/bases') && response.request().method() === 'POST') {
      const status = response.status();
      console.log(`API响应状态: ${status}`);
      if (status !== 200 && status !== 201) {
        try {
          const body = await response.json();
          console.log('API错误响应:', body);
        } catch (e) {
          console.log('API错误响应:', await response.text());
        }
      }
    }
  });
  
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
    const buttonClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const newButton = buttons.find(btn => btn.textContent.includes('新建知识库'));
      if (newButton) {
        newButton.click();
        return true;
      }
      return false;
    });
    
    if (!buttonClicked) {
      console.log('❌ 未找到"新建知识库"按钮');
      await browser.close();
      return;
    }
    
    await delay(2000);
    console.log('✅ 已打开新建知识库对话框');
    
    // 4. 检查表单元素
    console.log('4. 检查表单元素...');
    const formElements = await page.evaluate(() => {
      const elements = {
        nameInput: document.querySelector('input#name'),
        descTextarea: document.querySelector('textarea#description'),
        vectorCheckbox: document.querySelector('input[type="checkbox"][id*="vector"]') || 
                        document.querySelector('input[type="checkbox"]'),
        modalFooter: document.querySelector('.ant-modal-footer'),
        confirmButton: null
      };
      
      // 查找确定按钮
      if (elements.modalFooter) {
        const buttons = Array.from(elements.modalFooter.querySelectorAll('button'));
        elements.confirmButton = buttons.find(btn => 
          btn.textContent.includes('确定') || 
          btn.textContent.includes('保存') ||
          btn.textContent.includes('OK')
        );
      }
      
      return {
        hasNameInput: !!elements.nameInput,
        hasDescTextarea: !!elements.descTextarea,
        hasVectorCheckbox: !!elements.vectorCheckbox,
        hasConfirmButton: !!elements.confirmButton,
        confirmButtonText: elements.confirmButton?.textContent || null
      };
    });
    
    console.log('表单元素检查结果:', formElements);
    
    if (!formElements.hasNameInput) {
      console.log('❌ 未找到名称输入框');
      // 截图以便调试
      await page.screenshot({ path: 'kb-form-debug.png', fullPage: false });
      await browser.close();
      return;
    }
    
    // 5. 填写表单
    console.log('5. 填写知识库信息...');
    const kbName = '浏览器测试知识库_' + Date.now();
    
    // 使用不同方法尝试填写
    await page.evaluate((name) => {
      const input = document.querySelector('input#name');
      if (input) {
        input.value = name;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, kbName);
    
    await page.evaluate(() => {
      const textarea = document.querySelector('textarea#description');
      if (textarea) {
        textarea.value = '通过Puppeteer自动化测试创建';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    console.log(`   名称: ${kbName}`);
    console.log('   描述: 已填写');
    
    // 6. 点击确定保存
    console.log('6. 点击确定保存...');
    
    // 先等待一下确保表单数据已更新
    await delay(500);
    
    const saved = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.ant-modal-footer button'));
      const confirmButton = buttons.find(btn => 
        btn.textContent.includes('确定') || 
        btn.textContent.includes('保存') ||
        btn.textContent.includes('OK')
      );
      if (confirmButton && !confirmButton.disabled) {
        confirmButton.click();
        return true;
      }
      return false;
    });
    
    if (!saved) {
      console.log('❌ 未找到或无法点击确定按钮');
      await page.screenshot({ path: 'kb-save-failed.png', fullPage: false });
    } else {
      console.log('⏳ 已点击确定，等待响应...');
      await delay(3000);
      
      // 7. 检查结果
      const modalStillVisible = await page.evaluate(() => {
        return !!document.querySelector('.ant-modal-content');
      });
      
      if (modalStillVisible) {
        console.log('❌ 保存失败！模态框仍然显示');
        
        // 检查是否有错误消息
        const errorMessage = await page.evaluate(() => {
          const msgError = document.querySelector('.ant-message-error');
          const formError = document.querySelector('.ant-form-item-explain-error');
          return msgError?.textContent || formError?.textContent || null;
        });
        
        if (errorMessage) {
          console.log('错误信息:', errorMessage);
        }
        
        await page.screenshot({ path: 'kb-error.png', fullPage: false });
      } else {
        console.log('✅ 模态框已关闭，保存可能成功');
        
        // 检查成功消息
        const successMessage = await page.evaluate(() => {
          const msg = document.querySelector('.ant-message-success');
          return msg?.textContent || null;
        });
        
        if (successMessage) {
          console.log('成功消息:', successMessage);
        }
        
        // 检查列表是否刷新
        const tableRows = await page.evaluate(() => {
          return document.querySelectorAll('tbody tr').length;
        });
        console.log(`知识库列表显示 ${tableRows} 条记录`);
      }
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    await page.screenshot({ path: 'kb-exception.png', fullPage: true });
  }
  
  console.log('\n测试完成，浏览器将在5秒后关闭...');
  await delay(5000);
  await browser.close();
})();