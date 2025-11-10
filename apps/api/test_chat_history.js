/**
 * 测试聊天历史记录服务
 */
const ChatHistoryService = require('./src/services/chat/ChatHistoryService');
const historyService = new ChatHistoryService();

(async () => {
  console.log('=== 测试聊天历史记录服务 ===\n');

  try {
    const db = require('./src/config/database');

    // 1. 获取组织
    const org = await db('organizations').first();

    if (!org) {
      console.error('未找到组织，请先创建组织');
      process.exit(1);
    }

    console.log('✓ 找到组织:', org.name);

    // 2. 创建会话
    console.log('\n1. 创建测试会话...');
    const sessionResult = await historyService.createSession(
      'user_admin',
      org.id,
      '测试对话'
    );

    if (!sessionResult.success) {
      console.error('✗ 会话创建失败:', sessionResult.error);
      process.exit(1);
    }

    const conversationId = sessionResult.data.id;
    console.log('✓ 会话创建成功');
    console.log('  会话ID:', conversationId);
    console.log('  标题:', sessionResult.data.title);

    // 3. 添加用户消息
    console.log('\n2. 添加用户消息...');
    const userMsg = await historyService.addMessage(
      conversationId,
      'user',
      '你好！这是一条测试消息。',
      'user_admin'
    );

    if (!userMsg.success) {
      console.error('✗ 用户消息添加失败:', userMsg.error);
    } else {
      console.log('✓ 用户消息添加成功');
    }

    // 4. 添加AI回复
    console.log('\n3. 添加AI回复...');
    const aiMsg = await historyService.addMessage(
      conversationId,
      'assistant',
      '你好！我是知识问答助手。我可以帮助你查询企业知识库的内容。',
      'user_admin',
      {
        thinking: '用户打招呼，友好回应',
        sources: [
          { documentId: 'doc-123', documentName: '测试文档', score: 0.85 }
        ]
      }
    );

    if (!aiMsg.success) {
      console.error('✗ AI回复添加失败:', aiMsg.error);
    } else {
      console.log('✓ AI回复添加成功');
    }

    // 5. 获取会话消息
    console.log('\n4. 获取会话消息...');
    const messagesResult = await historyService.getSessionMessages(conversationId);

    if (!messagesResult.success) {
      console.error('✗ 获取消息失败:', messagesResult.error);
    } else {
      console.log('✓ 消息总数:', messagesResult.data.total);
      messagesResult.data.messages.forEach((m, i) => {
        console.log(`  ${i+1}. [${m.role}]: ${m.content.substring(0, 50)}...`);
        if (m.thinking) {
          console.log(`     思考: ${m.thinking}`);
        }
      });
    }

    // 6. 获取用户会话列表
    console.log('\n5. 获取用户会话列表...');
    const sessionsResult = await historyService.getUserSessions('user_admin');

    if (!sessionsResult.success) {
      console.error('✗ 获取会话列表失败:', sessionsResult.error);
    } else {
      console.log('✓ 会话总数:', sessionsResult.data.total);
      sessionsResult.data.conversations.slice(0, 5).forEach((c, i) => {
        console.log(`  ${i+1}. ${c.title || '未命名'} (${c.message_count || 0} 条消息) - ${c.scope}`);
      });
    }

    // 7. 测试获取上下文
    console.log('\n6. 获取会话上下文...');
    const contextResult = await historyService.getSessionContext(conversationId, 5);

    if (!contextResult.success) {
      console.error('✗ 获取上下文失败:', contextResult.error);
    } else {
      console.log('✓ 上下文消息数:', contextResult.data.length);
      contextResult.data.forEach((m, i) => {
        console.log(`  ${i+1}. [${m.role}]: ${m.content.substring(0, 40)}...`);
      });
    }

    // 8. 更新会话标题
    console.log('\n7. 更新会话标题...');
    const updateResult = await historyService.updateSessionTitle(
      conversationId,
      '测试对话 - 已更新'
    );

    if (!updateResult.success) {
      console.error('✗ 更新标题失败:', updateResult.error);
    } else {
      console.log('✓ 标题更新成功');
    }

    console.log('\n=== ✓ 所有测试通过 ===');
    await db.destroy();
    process.exit(0);

  } catch (error) {
    console.error('\n✗ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
