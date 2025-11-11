// 测试动态导入是否有问题
async function testImports() {
  try {
    console.log('测试导入 WorkflowEditor...');
    const module1 = await import('./src/pages/WorkflowEditor.tsx');
    console.log('✅ WorkflowEditor 导入成功');
  } catch (error) {
    console.error('❌ WorkflowEditor 导入失败:', error.message);
  }

  try {
    console.log('\n测试导入 AgentWorkflow...');
    const module2 = await import('./src/pages/AgentWorkflow/WorkflowDesigner.tsx');
    console.log('✅ AgentWorkflow 导入成功');
  } catch (error) {
    console.error('❌ AgentWorkflow 导入失败:', error.message);
  }

  try {
    console.log('\n测试导入 LearningDashboard...');
    const module3 = await import('./src/pages/LearningDashboard.tsx');
    console.log('✅ LearningDashboard 导入成功');
  } catch (error) {
    console.error('❌ LearningDashboard 导入失败:', error.message);
  }

  try {
    console.log('\n测试导入 DataAnnotation...');
    const module4 = await import('./src/pages/DataAnnotation.tsx');
    console.log('✅ DataAnnotation 导入成功');
  } catch (error) {
    console.error('❌ DataAnnotation 导入失败:', error.message);
  }
}

testImports();