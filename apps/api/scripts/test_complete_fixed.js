const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://localhost:3000/api';

// 测试配置
const testConfig = {
  token: null,
  userId: null,
  organizationId: null,
  departmentId: null,
  roleId: null,
  projectId: null,
  knowledgeBaseId: null,
  documentId: null,
  assistantId: null,
  conversationId: null,
  workflowId: null,
  engineId: null
};

// 测试结果
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  details: []
};

// 测试工具函数
async function testAPI(name, fn) {
  testResults.total++;
  console.log(`测试 ${name}...`, '');
  
  try {
    await fn();
    console.log('✅ 通过');
    testResults.passed++;
    testResults.details.push({ name, status: 'passed' });
  } catch (error) {
    console.log('❌ 失败');
    console.log(`  错误: ${error.response?.data?.message || error.message}`);
    testResults.failed++;
    testResults.details.push({
      name,
      status: 'failed',
      error: error.response?.data?.message || error.message
    });
  }
}

// 创建axios实例
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000
});

// 添加请求拦截器以自动添加token
api.interceptors.request.use(config => {
  if (testConfig.token) {
    config.headers.Authorization = `Bearer ${testConfig.token}`;
  }
  return config;
});

// 测试函数
async function runTests() {
  console.log('========================================');
  console.log('开始完整端到端测试（真实数据库连接）');
  console.log('========================================\n');

  // 【认证模块测试】
  console.log('【认证模块测试】');
  
  await testAPI('用户注册', async () => {
    const response = await api.post('/auth/register', {
      username: `test_${Date.now()}`,
      password: 'Test123456',
      name: '测试用户',
      email: 'test@example.com',
      phone: '13800138000'
    });
    if (!response.data.success) throw new Error('注册失败');
  });

  await testAPI('用户登录', async () => {
    const response = await api.post('/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    if (!response.data.success || !response.data.data.token) {
      throw new Error('登录失败');
    }
    testConfig.token = response.data.data.token;
    testConfig.userId = response.data.data.user.id;
  });

  // 【组织架构模块测试】
  console.log('\n【组织架构模块测试】');
  
  await testAPI('创建组织', async () => {
    const response = await api.post('/organizations', {
      name: `测试组织_${Date.now()}`,
      code: `ORG_${Date.now()}`,
      description: '测试组织描述'
    });
    if (!response.data.success) throw new Error('创建组织失败');
    testConfig.organizationId = response.data.data.id;
  });

  await testAPI('获取组织列表', async () => {
    const response = await api.get('/organizations');
    if (!response.data.success || !Array.isArray(response.data.data)) {
      throw new Error('获取组织列表失败');
    }
  });

  await testAPI('创建部门', async () => {
    const response = await api.post('/departments', {
      name: `测试部门_${Date.now()}`,
      code: `DEPT_${Date.now()}`,
      organization_id: testConfig.organizationId,
      parent_id: null
    });
    if (!response.data.success) throw new Error('创建部门失败');
    testConfig.departmentId = response.data.data.id;
  });

  await testAPI('创建角色', async () => {
    const response = await api.post('/roles', {
      name: `测试角色_${Date.now()}`,
      code: `ROLE_${Date.now()}`,
      description: '测试角色描述',
      permissions: []
    });
    if (!response.data.success) throw new Error('创建角色失败');
    testConfig.roleId = response.data.data.id;
  });

  // 【项目管理模块测试】
  console.log('\n【项目管理模块测试】');
  
  await testAPI('创建项目', async () => {
    const response = await api.post('/projects', {
      name: `测试项目_${Date.now()}`,
      code: `PROJ_${Date.now()}`,
      description: '测试项目描述',
      status: 'active'
    });
    if (!response.data.success) throw new Error('创建项目失败');
    testConfig.projectId = response.data.data.id;
  });

  await testAPI('获取项目列表', async () => {
    const response = await api.get('/projects');
    if (!response.data.success || !Array.isArray(response.data.data)) {
      throw new Error('获取项目列表失败');
    }
  });

  // 【知识库模块测试】
  console.log('\n【知识库模块测试】');
  
  await testAPI('创建知识库', async () => {
    const response = await api.post('/knowledge/bases', {
      name: `测试知识库_${Date.now()}`,
      description: '测试知识库描述',
      permission_level: 'personal'
    });
    if (!response.data.success) throw new Error('创建知识库失败');
    testConfig.knowledgeBaseId = response.data.data.id;
  });

  await testAPI('获取知识库列表', async () => {
    const response = await api.get('/knowledge/bases');
    if (!response.data.success) throw new Error('获取知识库列表失败');
  });

  await testAPI('获取文档列表', async () => {
    const response = await api.get('/knowledge/documents', {
      params: { kb_id: testConfig.knowledgeBaseId }
    });
    if (!response.data.success) throw new Error('获取文档列表失败');
  });

  // 【聊天模块测试】
  console.log('\n【聊天模块测试】');
  
  await testAPI('创建AI助手', async () => {
    const response = await api.post('/chat/assistants', {
      name: `测试助手_${Date.now()}`,
      description: '测试AI助手',
      model: 'gpt-3.5-turbo',
      prompt: '你是一个智能助手'
    });
    if (!response.data.success) throw new Error('创建助手失败');
    testConfig.assistantId = response.data.data.id;
  });

  await testAPI('获取助手列表', async () => {
    const response = await api.get('/chat/assistants');
    if (!response.data.success) throw new Error('获取助手列表失败');
  });

  await testAPI('创建会话', async () => {
    const response = await api.post('/chat/conversations', {
      assistant_id: testConfig.assistantId,
      title: '测试会话'
    });
    if (!response.data.success) throw new Error('创建会话失败');
    testConfig.conversationId = response.data.data.id;
  });

  await testAPI('发送消息', async () => {
    const response = await api.post('/chat/messages', {
      conversation_id: testConfig.conversationId,
      content: '你好，这是测试消息'
    });
    if (!response.data.success) throw new Error('发送消息失败');
  });

  await testAPI('使用工作流发送消息', async () => {
    const response = await api.post('/chat/messages/workflow', {
      conversation_id: testConfig.conversationId,
      content: '使用工作流处理消息',
      workflow_id: 'default'
    });
    if (!response.data.success) throw new Error('工作流消息失败');
  });

  await testAPI('获取可用工作流', async () => {
    const response = await api.get('/chat/workflows/available');
    if (!response.data.success) throw new Error('获取工作流失败');
  });

  await testAPI('获取工作流偏好', async () => {
    const response = await api.get('/chat/workflows/preferences');
    if (!response.data.success) throw new Error('获取偏好失败');
  });

  await testAPI('更新工作流偏好', async () => {
    const response = await api.put('/chat/workflows/preferences', {
      preferences: {
        default_workflow: 'knowledge_search',
        auto_trigger: true
      }
    });
    if (!response.data.success) throw new Error('更新偏好失败');
  });

  // 【工作流模块测试】
  console.log('\n【工作流模块测试】');
  
  await testAPI('创建工作流', async () => {
    const response = await api.post('/workflows', {
      name: `测试工作流_${Date.now()}`,
      description: '测试工作流',
      definition: {
        nodes: [],
        edges: []
      }
    });
    if (!response.data.success) throw new Error('创建工作流失败');
    testConfig.workflowId = response.data.data.id;
  });

  await testAPI('获取工作流列表', async () => {
    const response = await api.get('/workflows');
    if (!response.data.success) throw new Error('获取工作流列表失败');
  });

  // 【引擎系统测试】
  console.log('\n【引擎系统测试】');
  
  await testAPI('获取引擎列表', async () => {
    const response = await api.get('/engines');
    if (!response.data.success) throw new Error('获取引擎列表失败');
  });

  await testAPI('注册新引擎', async () => {
    const response = await api.post('/engines/register', {
      name: `测试引擎_${Date.now()}`,
      type: 'rule',
      endpoint: 'http://localhost:8090',
      description: '测试引擎'
    });
    if (!response.data.success) throw new Error('注册引擎失败');
    testConfig.engineId = response.data.data.id;
  });

  await testAPI('执行引擎', async () => {
    const response = await api.post(`/engines/${testConfig.engineId}/execute`, {
      input: { test: 'data' }
    });
    if (!response.data.success) throw new Error('执行引擎失败');
  });

  // 【系统配置模块测试】
  console.log('\n【系统配置模块测试】');
  
  await testAPI('获取系统配置', async () => {
    const response = await api.get('/system/config');
    if (!response.data.success) throw new Error('获取配置失败');
  });

  await testAPI('获取系统状态', async () => {
    const response = await api.get('/system/status');
    if (!response.data.success) throw new Error('获取状态失败');
  });

  // 【菜单管理模块测试】
  console.log('\n【菜单管理模块测试】');
  
  await testAPI('获取菜单列表', async () => {
    const response = await api.get('/menus');
    if (!response.data.success || !Array.isArray(response.data.data)) {
      throw new Error('获取菜单列表失败');
    }
  });

  // 【日志模块测试】
  console.log('\n【日志模块测试】');
  
  await testAPI('获取系统日志', async () => {
    const response = await api.get('/logs');
    if (!response.data.success || !Array.isArray(response.data.data)) {
      throw new Error('获取系统日志失败');
    }
  });

  // 【AI插件接口测试】
  console.log('\n【AI插件接口测试】');
  
  await testAPI('AI插件健康检查', async () => {
    const response = await api.get('/ai-plugin/health');
    if (!response.data.success) throw new Error('健康检查失败');
  });

  // 【规则引擎测试】
  console.log('\n【规则引擎测试】');
  
  await testAPI('获取规则列表', async () => {
    const response = await api.get('/rules');
    if (!response.data.success) throw new Error('获取规则失败');
  });

  // 【节点系统测试】
  console.log('\n【节点系统测试】');
  
  await testAPI('获取节点类型', async () => {
    const response = await api.get('/nodes/types');
    if (!response.data.success) throw new Error('获取节点类型失败');
  });

  // 【服务健康检查】
  console.log('\n【服务健康检查】');
  
  await testAPI('检查所有服务状态', async () => {
    const response = await api.get('/health/services');
    if (!response.data.success) throw new Error('服务检查失败');
  });

  // 输出测试结果
  console.log('\n========================================');
  console.log('测试完成！');
  console.log('========================================');
  console.log(`总测试数: ${testResults.total}`);
  console.log(`通过: ${testResults.passed} ✅`);
  console.log(`失败: ${testResults.failed} ❌`);
  console.log(`通过率: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%`);

  if (testResults.failed > 0) {
    console.log('\n失败的测试:\n');
    testResults.details
      .filter(d => d.status === 'failed')
      .forEach((d, i) => {
        console.log(`${i + 1}. ${d.name}`);
        console.log(`   错误: ${d.error}\n`);
      });
    console.log('⚠️ 部分测试失败，请检查错误信息');
  } else {
    console.log('\n🎉 所有测试通过！系统功能完全正常！');
  }

  // 保存测试结果到文件
  fs.writeFileSync(
    '/tmp/test_results_fixed.json',
    JSON.stringify(testResults, null, 2)
  );
}

// 主函数
async function main() {
  try {
    // 等待服务启动
    console.log('等待服务启动...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 检查服务是否就绪
    try {
      await axios.get(`${API_BASE_URL}/health`);
      console.log('服务已就绪\n');
    } catch (error) {
      console.log('服务未就绪，等待中...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // 运行测试
    await runTests();
    
    // 根据测试结果设置退出码
    process.exit(testResults.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('测试执行失败:', error);
    process.exit(1);
  }
}

// 执行测试
main();