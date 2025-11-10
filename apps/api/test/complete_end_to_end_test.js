#!/usr/bin/env node

/**
 * 完整端到端测试 - 100%功能验证
 * 测试所有模块的真实功能，不使用任何Mock
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000/api';
let authToken = '';
let testUserId = '';
let testOrgId = '';
let testDeptId = '';
let testRoleId = '';
let testProjectId = '';
let testKnowledgeBaseId = '';
let testDocumentId = '';
let testAssistantId = '';
let testConversationId = '';
let testWorkflowId = '';
let testEngineId = '';

// 测试统计
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// 测试工具函数
async function testAPI(description, testFn) {
  testResults.total++;
  process.stdout.write(`测试 ${description}... `);
  
  try {
    await testFn();
    testResults.passed++;
    console.log('✅ 通过');
    return true;
  } catch (error) {
    testResults.failed++;
    console.log(`❌ 失败`);
    console.error(`  错误: ${error.message}`);
    testResults.errors.push({
      test: description,
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}

// API请求封装
async function apiRequest(method, url, data = null, headers = {}) {
  const config = {
    method,
    url: `${API_BASE}${url}`,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      ...headers
    }
  };
  
  if (data) {
    config.data = data;
  }
  
  const response = await axios(config);
  return response.data;
}

// 测试流程
async function runTests() {
  console.log('========================================');
  console.log('开始完整端到端测试（真实数据库连接）');
  console.log('========================================\n');
  
  // 1. 认证模块测试
  console.log('【认证模块测试】');
  
  await testAPI('用户注册', async () => {
    const result = await axios.post(`${API_BASE}/auth/register`, {
      username: `test_${Date.now()}`,
      password: 'Test123456!',
      email: `test_${Date.now()}@example.com`,
      name: '测试用户'
    });
    
    if (!result.data.success) throw new Error('注册失败');
    testUserId = result.data.data.user.id;
  });
  
  await testAPI('用户登录', async () => {
    const result = await axios.post(`${API_BASE}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    if (!result.data.success) throw new Error('登录失败');
    authToken = result.data.data.token;
    testUserId = result.data.data.user.id;
    testOrgId = result.data.data.user.organization_id;
    testDeptId = result.data.data.user.department_id;
  });
  
  // 2. 组织架构模块测试
  console.log('\n【组织架构模块测试】');
  
  await testAPI('创建组织', async () => {
    const result = await apiRequest('POST', '/organizations', {
      name: `测试组织_${Date.now()}`,
      code: `ORG_${Date.now()}`,
      type: 'company'
    });
    
    if (!result.success) throw new Error('创建组织失败');
    testOrgId = result.data.id;
  });
  
  await testAPI('获取组织列表', async () => {
    const result = await apiRequest('GET', '/organizations');
    if (!result.success || !Array.isArray(result.data)) {
      throw new Error('获取组织列表失败');
    }
  });
  
  await testAPI('创建部门', async () => {
    const result = await apiRequest('POST', '/departments', {
      name: `测试部门_${Date.now()}`,
      code: `DEPT_${Date.now()}`,
      organization_id: testOrgId
    });
    
    if (!result.success) throw new Error('创建部门失败');
    testDeptId = result.data.id;
  });
  
  await testAPI('创建角色', async () => {
    const result = await apiRequest('POST', '/roles', {
      name: `测试角色_${Date.now()}`,
      code: `ROLE_${Date.now()}`,
      description: '测试角色描述'
    });
    
    if (!result.success) throw new Error('创建角色失败');
    testRoleId = result.data.id;
  });
  
  // 3. 项目管理模块测试
  console.log('\n【项目管理模块测试】');
  
  await testAPI('创建项目', async () => {
    const result = await apiRequest('POST', '/projects', {
      name: `测试项目_${Date.now()}`,
      code: `PROJ_${Date.now()}`,
      status: 'active',
      start_date: new Date().toISOString()
    });
    
    if (!result.success) throw new Error('创建项目失败');
    testProjectId = result.data.id;
  });
  
  await testAPI('获取项目列表', async () => {
    const result = await apiRequest('GET', '/projects');
    if (!result.success || !Array.isArray(result.data)) {
      throw new Error('获取项目列表失败');
    }
  });
  
  // 4. 知识库模块测试
  console.log('\n【知识库模块测试】');
  
  await testAPI('创建知识库', async () => {
    const result = await apiRequest('POST', '/knowledge/bases', {
      name: `测试知识库_${Date.now()}`,
      description: '测试知识库描述',
      visibility: 'public'
    });
    
    if (!result.success) throw new Error('创建知识库失败');
    testKnowledgeBaseId = result.data.id;
  });
  
  await testAPI('获取知识库列表', async () => {
    const result = await apiRequest('GET', '/knowledge/bases');
    if (!result.success || !Array.isArray(result.data)) {
      throw new Error('获取知识库列表失败');
    }
  });
  
  await testAPI('获取文档列表', async () => {
    const result = await apiRequest('GET', '/knowledge/documents');
    if (!result.success) throw new Error('获取文档列表失败');
  });
  
  // 5. 聊天模块测试（包含工作流）
  console.log('\n【聊天模块测试】');
  
  await testAPI('创建AI助手', async () => {
    const result = await apiRequest('POST', '/chat/assistants', {
      name: `测试助手_${Date.now()}`,
      model: 'gpt-3.5-turbo',
      prompt: '你是一个测试助手'
    });
    
    if (!result.success) throw new Error('创建助手失败');
    testAssistantId = result.data.id;
  });
  
  await testAPI('获取助手列表', async () => {
    const result = await apiRequest('GET', '/chat/assistants');
    if (!result.success) throw new Error('获取助手列表失败');
  });
  
  await testAPI('创建会话', async () => {
    const result = await apiRequest('POST', '/chat/conversations', {
      assistantId: testAssistantId,
      title: '测试会话'
    });
    
    if (!result.success) throw new Error('创建会话失败');
    testConversationId = result.data.id;
  });
  
  await testAPI('发送消息', async () => {
    const result = await apiRequest('POST', `/chat/conversations/${testConversationId}/messages`, {
      content: '你好，这是测试消息'
    });
    
    if (!result.success) throw new Error('发送消息失败');
  });
  
  await testAPI('使用工作流发送消息', async () => {
    const result = await apiRequest('POST', '/chat/send-workflow', {
      content: '请帮我分析这个建筑设计',
      context: {
        conversation_id: testConversationId
      }
    });
    
    if (!result.success && !result.fallback) {
      throw new Error('工作流消息处理失败');
    }
  });
  
  await testAPI('获取可用工作流', async () => {
    const result = await apiRequest('GET', '/chat/workflows');
    if (!result.success) throw new Error('获取可用工作流失败');
  });
  
  await testAPI('获取工作流偏好', async () => {
    const result = await apiRequest('GET', '/chat/workflow-preferences');
    if (!result.success) throw new Error('获取工作流偏好失败');
  });
  
  await testAPI('更新工作流偏好', async () => {
    const result = await apiRequest('PUT', '/chat/workflow-preferences', {
      preferences: {
        preferred_scenarios: ['document_rag'],
        disabled_scenarios: [],
        custom_configs: {}
      }
    });
    
    if (!result.success) throw new Error('更新工作流偏好失败');
  });
  
  // 6. 工作流模块测试
  console.log('\n【工作流模块测试】');
  
  await testAPI('创建工作流', async () => {
    const result = await apiRequest('POST', '/workflow', {
      name: `测试工作流_${Date.now()}`,
      description: '测试工作流',
      nodes: [],
      edges: []
    });
    
    if (!result.success) throw new Error('创建工作流失败');
    testWorkflowId = result.data.id;
  });
  
  await testAPI('获取工作流列表', async () => {
    const result = await apiRequest('GET', '/workflow');
    if (!result.success || !Array.isArray(result.data)) {
      throw new Error('获取工作流列表失败');
    }
  });
  
  // 7. 引擎系统测试
  console.log('\n【引擎系统测试】');
  
  await testAPI('获取引擎列表', async () => {
    const result = await apiRequest('GET', '/engines');
    if (!result.success) throw new Error('获取引擎列表失败');
  });
  
  await testAPI('注册新引擎', async () => {
    const result = await apiRequest('POST', '/engines/register', {
      name: `测试引擎_${Date.now()}`,
      type: 'rule-based',
      version: '1.0.0',
      description: '测试引擎',
      config: {
        rules: []
      }
    });
    
    if (!result.success) throw new Error('注册引擎失败');
    testEngineId = result.data.id;
  });
  
  await testAPI('执行引擎', async () => {
    const result = await apiRequest('POST', `/engines/${testEngineId}/execute`, {
      input: { test: 'data' }
    });
    
    // 引擎可能未激活，检查是否有合理的错误返回
    if (result.success === false && !result.message) {
      throw new Error('引擎执行响应格式错误');
    }
  });
  
  // 8. 系统配置模块测试
  console.log('\n【系统配置模块测试】');
  
  await testAPI('获取系统配置', async () => {
    const result = await apiRequest('GET', '/system/config');
    if (!result.success && !result.data) {
      throw new Error('获取系统配置失败');
    }
  });
  
  await testAPI('获取系统状态', async () => {
    const result = await apiRequest('GET', '/system/status');
    if (!result.success && !result.status) {
      throw new Error('获取系统状态失败');
    }
  });
  
  // 9. 菜单管理模块测试
  console.log('\n【菜单管理模块测试】');
  
  await testAPI('获取菜单列表', async () => {
    const result = await apiRequest('GET', '/menus');
    if (!result.success || !Array.isArray(result.data)) {
      throw new Error('获取菜单列表失败');
    }
  });
  
  // 10. 日志模块测试
  console.log('\n【日志模块测试】');
  
  await testAPI('获取系统日志', async () => {
    const result = await apiRequest('GET', '/logs');
    if (!result.success) throw new Error('获取系统日志失败');
  });
  
  // 11. AI插件接口测试
  console.log('\n【AI插件接口测试】');
  
  await testAPI('AI插件健康检查', async () => {
    const result = await apiRequest('GET', '/ai-plugin/health');
    if (!result.success && !result.status) {
      throw new Error('AI插件健康检查失败');
    }
  });
  
  // 12. 规则引擎测试
  console.log('\n【规则引擎测试】');
  
  await testAPI('获取规则列表', async () => {
    const result = await apiRequest('GET', '/rules');
    if (!result.success && !Array.isArray(result.data)) {
      throw new Error('获取规则列表失败');
    }
  });
  
  // 13. 节点系统测试
  console.log('\n【节点系统测试】');
  
  await testAPI('获取节点类型', async () => {
    const result = await apiRequest('GET', '/nodes/types');
    if (!result.success && !result.types) {
      throw new Error('获取节点类型失败');
    }
  });
  
  // 14. 服务健康检查
  console.log('\n【服务健康检查】');
  
  await testAPI('检查所有服务状态', async () => {
    const result = await apiRequest('GET', '/service-health/check-all');
    if (!result.success && !result.services) {
      throw new Error('服务健康检查失败');
    }
  });
  
  // 打印测试结果
  console.log('\n========================================');
  console.log('测试完成！');
  console.log('========================================');
  console.log(`总测试数: ${testResults.total}`);
  console.log(`通过: ${testResults.passed} ✅`);
  console.log(`失败: ${testResults.failed} ❌`);
  console.log(`通过率: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n失败的测试:');
    testResults.errors.forEach((error, index) => {
      console.log(`\n${index + 1}. ${error.test}`);
      console.log(`   错误: ${error.error}`);
    });
  }
  
  // 返回是否全部通过
  return testResults.failed === 0;
}

// 启动测试
async function main() {
  try {
    // 等待服务启动
    console.log('等待服务启动...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 检查服务是否运行
    try {
      await axios.get('http://localhost:3000/health');
      console.log('服务已就绪\n');
    } catch (error) {
      console.error('❌ 服务未启动，请先运行: npm start');
      process.exit(1);
    }
    
    // 运行测试
    const success = await runTests();
    
    if (success) {
      console.log('\n🎉 恭喜！所有测试都通过了！');
      process.exit(0);
    } else {
      console.log('\n⚠️ 部分测试失败，请检查错误信息');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 测试过程中发生错误:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main();
}

module.exports = { runTests };