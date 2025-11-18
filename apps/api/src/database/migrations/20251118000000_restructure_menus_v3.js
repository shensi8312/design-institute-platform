/**
 * V3.0 菜单结构重构
 * 按照项目中心/文档中心/知识中心/知识入库管理/规则管理/AI工具/机械设计/系统管理 八大模块重组
 */

const { v4: uuidv4 } = require('uuid');

exports.up = async function(knex) {
  // 清空现有菜单（保留系统管理的部分菜单）
  await knex('menus').where('type', 'directory').whereNotIn('id', ['system']).delete();

  const now = new Date();
  const menus = [];

  // ========== 1级菜单：首页 ==========
  menus.push({
    id: 'home',
    name: '首页',
    path: '/',
    component: 'Home',
    icon: 'HomeOutlined',
    type: 'menu',
    visible: true,
    status: 'active',
    sort_order: 0,
    parent_id: null,
    created_at: now,
    updated_at: now
  });

  // ========== 1级菜单：项目中心 ==========
  const projectCenterId = 'project-center';
  menus.push({
    id: projectCenterId,
    name: '项目中心',
    path: '/projects',
    icon: 'ProjectOutlined',
    type: 'directory',
    visible: true,
    status: 'active',
    sort_order: 10,
    parent_id: null,
    created_at: now,
    updated_at: now
  });

  // 项目中心 - 2级菜单
  menus.push(
    {
      id: 'project-my',
      name: '我的项目',
      path: '/projects/my',
      component: 'ProjectManagement',
      icon: 'UserOutlined',
      type: 'menu',
      visible: true,
      status: 'active',
      sort_order: 1,
      parent_id: projectCenterId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'project-all',
      name: '所有项目',
      path: '/projects/all',
      component: 'ProjectManagement',
      icon: 'AppstoreOutlined',
      type: 'menu',
      permission_code: 'project.view_all',
      visible: true,
      status: 'active',
      sort_order: 2,
      parent_id: projectCenterId,
      created_at: now,
      updated_at: now
    }
  );

  // 项目中心 - 3级按钮
  menus.push(
    {
      id: 'project-create-btn',
      name: '创建项目',
      type: 'button',
      permission_code: 'project.create',
      visible: true,
      status: 'active',
      sort_order: 1,
      parent_id: 'project-my',
      created_at: now,
      updated_at: now
    },
    {
      id: 'project-view-btn',
      name: '进入项目',
      type: 'button',
      permission_code: 'project.view',
      visible: true,
      status: 'active',
      sort_order: 2,
      parent_id: 'project-my',
      created_at: now,
      updated_at: now
    },
    {
      id: 'project-assign-btn',
      name: '分配成员',
      type: 'button',
      permission_code: 'project.assign',
      visible: true,
      status: 'active',
      sort_order: 3,
      parent_id: 'project-all',
      created_at: now,
      updated_at: now
    },
    {
      id: 'project-delete-btn',
      name: '删除项目',
      type: 'button',
      permission_code: 'project.delete',
      visible: true,
      status: 'active',
      sort_order: 4,
      parent_id: 'project-all',
      created_at: now,
      updated_at: now
    }
  );

  // ========== 1级菜单：文档中心 ==========
  const docCenterId = 'document-center';
  menus.push({
    id: docCenterId,
    name: '文档中心',
    path: '/documents',
    icon: 'FileTextOutlined',
    type: 'directory',
    visible: true,
    status: 'active',
    sort_order: 20,
    parent_id: null,
    created_at: now,
    updated_at: now
  });

  // 文档中心 - 2级菜单
  menus.push(
    {
      id: 'doc-management',
      name: '文档管理',
      path: '/documents',
      component: 'DocumentManagement',
      icon: 'FileOutlined',
      type: 'menu',
      visible: true,
      status: 'active',
      sort_order: 1,
      parent_id: docCenterId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'doc-templates',
      name: '模板管理',
      path: '/templates',
      component: 'TemplateManagement',
      icon: 'ContainerOutlined',
      type: 'menu',
      permission_code: 'template.view',
      visible: true,
      status: 'active',
      sort_order: 2,
      parent_id: docCenterId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'doc-approval',
      name: '审批任务',
      path: '/approval-tasks',
      component: 'ApprovalTasks',
      icon: 'AuditOutlined',
      type: 'menu',
      permission_code: 'approval.view',
      visible: true,
      status: 'active',
      sort_order: 3,
      parent_id: docCenterId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'doc-archive',
      name: '归档管理',
      path: '/archive-management',
      component: 'ArchiveManagement',
      icon: 'InboxOutlined',
      type: 'menu',
      permission_code: 'archive.view',
      visible: true,
      status: 'active',
      sort_order: 4,
      parent_id: docCenterId,
      created_at: now,
      updated_at: now
    }
  );

  // 文档中心 - 3级按钮
  menus.push(
    {
      id: 'doc-upload-global-btn',
      name: '上传全局文档',
      type: 'button',
      permission_code: 'document.upload_global',
      visible: true,
      status: 'active',
      sort_order: 1,
      parent_id: 'doc-management',
      created_at: now,
      updated_at: now
    },
    {
      id: 'doc-download-btn',
      name: '批量下载',
      type: 'button',
      permission_code: 'document.download',
      visible: true,
      status: 'active',
      sort_order: 2,
      parent_id: 'doc-management',
      created_at: now,
      updated_at: now
    },
    {
      id: 'doc-delete-btn',
      name: '删除文档',
      type: 'button',
      permission_code: 'document.delete',
      visible: true,
      status: 'active',
      sort_order: 3,
      parent_id: 'doc-management',
      created_at: now,
      updated_at: now
    },
    {
      id: 'template-create-btn',
      name: '新建模板',
      type: 'button',
      permission_code: 'template.create',
      visible: true,
      status: 'active',
      sort_order: 1,
      parent_id: 'doc-templates',
      created_at: now,
      updated_at: now
    },
    {
      id: 'template-edit-btn',
      name: '编辑模板',
      type: 'button',
      permission_code: 'template.edit',
      visible: true,
      status: 'active',
      sort_order: 2,
      parent_id: 'doc-templates',
      created_at: now,
      updated_at: now
    },
    {
      id: 'template-delete-btn',
      name: '删除模板',
      type: 'button',
      permission_code: 'template.delete',
      visible: true,
      status: 'active',
      sort_order: 3,
      parent_id: 'doc-templates',
      created_at: now,
      updated_at: now
    },
    {
      id: 'approval-approve-btn',
      name: '审批通过',
      type: 'button',
      permission_code: 'approval.approve',
      visible: true,
      status: 'active',
      sort_order: 1,
      parent_id: 'doc-approval',
      created_at: now,
      updated_at: now
    },
    {
      id: 'approval-reject-btn',
      name: '审批拒绝',
      type: 'button',
      permission_code: 'approval.reject',
      visible: true,
      status: 'active',
      sort_order: 2,
      parent_id: 'doc-approval',
      created_at: now,
      updated_at: now
    },
    {
      id: 'archive-request-btn',
      name: '申请归档',
      type: 'button',
      permission_code: 'archive.request',
      visible: true,
      status: 'active',
      sort_order: 1,
      parent_id: 'doc-archive',
      created_at: now,
      updated_at: now
    }
  );

  // ========== 1级菜单：知识中心 ==========
  const knowledgeCenterId = 'knowledge-center';
  menus.push({
    id: knowledgeCenterId,
    name: '知识中心',
    path: '/knowledge',
    icon: 'BookOutlined',
    type: 'directory',
    visible: true,
    status: 'active',
    sort_order: 30,
    parent_id: null,
    created_at: now,
    updated_at: now
  });

  // 知识中心 - 2级菜单
  menus.push(
    {
      id: 'knowledge-enterprise',
      name: '企业知识库',
      path: '/knowledge/enterprise',
      component: 'EnterpriseKnowledge',
      icon: 'BankOutlined',
      type: 'menu',
      visible: true,
      status: 'active',
      sort_order: 1,
      parent_id: knowledgeCenterId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'knowledge-personal',
      name: '个人知识库',
      path: '/knowledge/personal',
      component: 'PersonalKnowledge',
      icon: 'UserOutlined',
      type: 'menu',
      visible: true,
      status: 'active',
      sort_order: 2,
      parent_id: knowledgeCenterId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'knowledge-qa',
      name: '智能问答',
      path: '/knowledge/qa',
      component: 'IntelligentQA',
      icon: 'QuestionCircleOutlined',
      type: 'menu',
      visible: true,
      status: 'active',
      sort_order: 3,
      parent_id: knowledgeCenterId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'knowledge-graph',
      name: '知识图谱',
      path: '/knowledge/graph',
      component: 'KnowledgeGraph',
      icon: 'PartitionOutlined',
      type: 'menu',
      permission_code: 'knowledge.graph.view',
      visible: true,
      status: 'active',
      sort_order: 4,
      parent_id: knowledgeCenterId,
      created_at: now,
      updated_at: now
    }
  );

  // 知识中心 - 3级按钮
  menus.push(
    {
      id: 'knowledge-download-btn',
      name: '下载文档',
      type: 'button',
      permission_code: 'knowledge.download',
      visible: true,
      status: 'active',
      sort_order: 1,
      parent_id: 'knowledge-enterprise',
      created_at: now,
      updated_at: now
    },
    {
      id: 'personal-upload-btn',
      name: '上传文档',
      type: 'button',
      permission_code: 'knowledge.upload_personal',
      visible: true,
      status: 'active',
      sort_order: 1,
      parent_id: 'knowledge-personal',
      created_at: now,
      updated_at: now
    },
    {
      id: 'personal-edit-btn',
      name: '编辑文档',
      type: 'button',
      permission_code: 'knowledge.edit_personal',
      visible: true,
      status: 'active',
      sort_order: 2,
      parent_id: 'knowledge-personal',
      created_at: now,
      updated_at: now
    },
    {
      id: 'qa-ask-btn',
      name: '提问',
      type: 'button',
      permission_code: 'qa.ask',
      visible: true,
      status: 'active',
      sort_order: 1,
      parent_id: 'knowledge-qa',
      created_at: now,
      updated_at: now
    }
  );

  // ========== 1级菜单：知识入库管理 ==========
  const ingestionId = 'knowledge-ingestion';
  menus.push({
    id: ingestionId,
    name: '知识入库管理',
    path: '/knowledge-ingestion',
    icon: 'CloudUploadOutlined',
    type: 'directory',
    permission_code: 'ingestion.view',
    visible: true,
    status: 'active',
    sort_order: 40,
    parent_id: null,
    created_at: now,
    updated_at: now
  });

  // 知识入库管理 - 2级菜单
  menus.push(
    {
      id: 'ingestion-upload',
      name: '上传原始知识',
      path: '/knowledge-ingestion/upload',
      component: 'KnowledgeUpload',
      icon: 'UploadOutlined',
      type: 'menu',
      permission_code: 'ingestion.upload',
      visible: true,
      status: 'active',
      sort_order: 1,
      parent_id: ingestionId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'ingestion-parse',
      name: '解析任务',
      path: '/knowledge-ingestion/parse',
      component: 'KnowledgeParseTask',
      icon: 'FileSearchOutlined',
      type: 'menu',
      permission_code: 'ingestion.parse',
      visible: true,
      status: 'active',
      sort_order: 2,
      parent_id: ingestionId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'ingestion-review',
      name: '内容审核',
      path: '/knowledge-ingestion/review',
      component: 'ContentReview',
      icon: 'CheckCircleOutlined',
      type: 'menu',
      permission_code: 'ingestion.review',
      visible: true,
      status: 'active',
      sort_order: 3,
      parent_id: ingestionId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'ingestion-publish',
      name: '入库发布',
      path: '/knowledge-ingestion/publish',
      component: 'KnowledgePublish',
      icon: 'RocketOutlined',
      type: 'menu',
      permission_code: 'ingestion.publish',
      visible: true,
      status: 'active',
      sort_order: 4,
      parent_id: ingestionId,
      created_at: now,
      updated_at: now
    }
  );

  // 知识入库管理 - 3级按钮
  menus.push(
    {
      id: 'ingestion-batch-upload-btn',
      name: '批量上传',
      type: 'button',
      permission_code: 'ingestion.batch_upload',
      visible: true,
      status: 'active',
      sort_order: 1,
      parent_id: 'ingestion-upload',
      created_at: now,
      updated_at: now
    },
    {
      id: 'ingestion-parse-start-btn',
      name: '开始解析',
      type: 'button',
      permission_code: 'ingestion.start_parse',
      visible: true,
      status: 'active',
      sort_order: 1,
      parent_id: 'ingestion-parse',
      created_at: now,
      updated_at: now
    },
    {
      id: 'ingestion-retry-btn',
      name: '重试失败',
      type: 'button',
      permission_code: 'ingestion.retry',
      visible: true,
      status: 'active',
      sort_order: 2,
      parent_id: 'ingestion-parse',
      created_at: now,
      updated_at: now
    },
    {
      id: 'ingestion-approve-btn',
      name: '审核通过',
      type: 'button',
      permission_code: 'ingestion.approve',
      visible: true,
      status: 'active',
      sort_order: 1,
      parent_id: 'ingestion-review',
      created_at: now,
      updated_at: now
    },
    {
      id: 'ingestion-reject-btn',
      name: '审核拒绝',
      type: 'button',
      permission_code: 'ingestion.reject',
      visible: true,
      status: 'active',
      sort_order: 2,
      parent_id: 'ingestion-review',
      created_at: now,
      updated_at: now
    },
    {
      id: 'ingestion-publish-btn',
      name: '发布到企业库',
      type: 'button',
      permission_code: 'ingestion.publish_enterprise',
      visible: true,
      status: 'active',
      sort_order: 1,
      parent_id: 'ingestion-publish',
      created_at: now,
      updated_at: now
    }
  );

  // ========== 1级菜单：规则管理 ==========
  const ruleId = 'rule-management';
  menus.push({
    id: ruleId,
    name: '规则管理',
    path: '/rules',
    icon: 'ControlOutlined',
    type: 'directory',
    permission_code: 'rule.view',
    visible: true,
    status: 'active',
    sort_order: 50,
    parent_id: null,
    created_at: now,
    updated_at: now
  });

  // 规则管理 - 2级菜单
  menus.push(
    {
      id: 'rule-library',
      name: '统一规则库',
      path: '/rules',
      component: 'UnifiedRuleManagement',
      icon: 'DatabaseOutlined',
      type: 'menu',
      permission_code: 'rule.view',
      visible: true,
      status: 'active',
      sort_order: 1,
      parent_id: ruleId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'rule-learning',
      name: '规则学习配置',
      path: '/rules/learning',
      component: 'RuleLearningConfig',
      icon: 'ExperimentOutlined',
      type: 'menu',
      permission_code: 'rule.learning',
      visible: true,
      status: 'active',
      sort_order: 2,
      parent_id: ruleId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'rule-review',
      name: '规则审核',
      path: '/rules/review',
      component: 'RuleReview',
      icon: 'AuditOutlined',
      type: 'menu',
      permission_code: 'rule.review',
      visible: true,
      status: 'active',
      sort_order: 3,
      parent_id: ruleId,
      created_at: now,
      updated_at: now
    }
  );

  // ========== 1级菜单：AI 工具 ==========
  const aiToolId = 'ai-tools';
  menus.push({
    id: aiToolId,
    name: 'AI 工具',
    path: '/ai',
    icon: 'RobotOutlined',
    type: 'directory',
    permission_code: 'ai.view',
    visible: true,
    status: 'active',
    sort_order: 60,
    parent_id: null,
    created_at: now,
    updated_at: now
  });

  // AI 工具 - 2级菜单
  menus.push(
    {
      id: 'ai-tasks',
      name: '我的任务',
      path: '/ai/tasks',
      component: 'MyTasks',
      icon: 'UnorderedListOutlined',
      type: 'menu',
      permission_code: 'ai.task.view',
      visible: true,
      status: 'active',
      sort_order: 1,
      parent_id: aiToolId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'ai-workflow',
      name: '工作流编排',
      path: '/ai/workflow',
      component: 'WorkflowEditor',
      icon: 'ApartmentOutlined',
      type: 'menu',
      permission_code: 'ai.workflow.edit',
      visible: true,
      status: 'active',
      sort_order: 2,
      parent_id: aiToolId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'ai-agent-workflow',
      name: 'Agent 工作流',
      path: '/ai/agent-workflow',
      component: 'AgentWorkflow',
      icon: 'DeploymentUnitOutlined',
      type: 'menu',
      permission_code: 'ai.agent.edit',
      visible: true,
      status: 'active',
      sort_order: 3,
      parent_id: aiToolId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'ai-engines',
      name: '引擎管理',
      path: '/ai/engines',
      component: 'EngineManagement',
      icon: 'SettingOutlined',
      type: 'menu',
      permission_code: 'ai.engine.manage',
      visible: true,
      status: 'active',
      sort_order: 4,
      parent_id: aiToolId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'ai-drawing',
      name: '图纸识别',
      path: '/ai/drawing',
      component: 'PIDRecognition',
      icon: 'FileImageOutlined',
      type: 'menu',
      permission_code: 'ai.drawing.recognize',
      visible: true,
      status: 'active',
      sort_order: 5,
      parent_id: aiToolId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'ai-annotation',
      name: '数据标注',
      path: '/ai/annotation',
      component: 'GraphAnnotation',
      icon: 'EditOutlined',
      type: 'menu',
      permission_code: 'ai.annotation.edit',
      visible: true,
      status: 'active',
      sort_order: 6,
      parent_id: aiToolId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'ai-debug',
      name: '调试工具',
      path: '/ai/debug',
      component: 'DebugMenu',
      icon: 'BugOutlined',
      type: 'menu',
      permission_code: 'ai.debug',
      visible: true,
      status: 'active',
      sort_order: 7,
      parent_id: aiToolId,
      created_at: now,
      updated_at: now
    }
  );

  // ========== 1级菜单：机械设计 ==========
  const mechanicalId = 'mechanical-design';
  menus.push({
    id: mechanicalId,
    name: '机械设计',
    path: '/mechanical',
    icon: 'ToolOutlined',
    type: 'directory',
    permission_code: 'mechanical.view',
    visible: true,
    status: 'active',
    sort_order: 70,
    parent_id: null,
    created_at: now,
    updated_at: now
  });

  // 机械设计 - 2级菜单
  menus.push(
    {
      id: 'mechanical-pid',
      name: 'PID识别',
      path: '/mechanical/pid',
      component: 'PIDRecognition',
      icon: 'LineChartOutlined',
      type: 'menu',
      permission_code: 'mechanical.pid',
      visible: true,
      status: 'active',
      sort_order: 1,
      parent_id: mechanicalId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'mechanical-assembly-rules',
      name: '装配规则库管理',
      path: '/mechanical/assembly-rules',
      component: 'AssemblyRuleManagement',
      icon: 'BlockOutlined',
      type: 'menu',
      permission_code: 'mechanical.assembly.rules',
      visible: true,
      status: 'active',
      sort_order: 2,
      parent_id: mechanicalId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'mechanical-sample-learning',
      name: '样本学习',
      path: '/mechanical/sample-learning',
      component: 'ModelTraining',
      icon: 'ExperimentOutlined',
      type: 'menu',
      permission_code: 'mechanical.sample.learn',
      visible: true,
      status: 'active',
      sort_order: 3,
      parent_id: mechanicalId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'mechanical-assembly-design',
      name: '装配设计',
      path: '/mechanical/assembly-design',
      component: 'AssemblyDesignManagement',
      icon: 'AppstoreAddOutlined',
      type: 'menu',
      permission_code: 'mechanical.assembly.design',
      visible: true,
      status: 'active',
      sort_order: 4,
      parent_id: mechanicalId,
      created_at: now,
      updated_at: now
    },
    {
      id: 'mechanical-drawing-comparison',
      name: '图纸比对',
      path: '/mechanical/drawing-comparison',
      component: 'DrawingComparison',
      icon: 'DiffOutlined',
      type: 'menu',
      permission_code: 'mechanical.drawing.compare',
      visible: true,
      status: 'active',
      sort_order: 5,
      parent_id: mechanicalId,
      created_at: now,
      updated_at: now
    }
  );

  // ========== 1级菜单：系统管理（保留现有，补充缺失） ==========
  const systemExists = await knex('menus').where('id', 'system').first();
  if (!systemExists) {
    menus.push({
      id: 'system',
      name: '系统管理',
      path: '/system',
      icon: 'SettingOutlined',
      type: 'directory',
      permission_code: 'system.view',
      visible: true,
      status: 'active',
      sort_order: 80,
      parent_id: null,
      created_at: now,
      updated_at: now
    });
  }

  // 系统管理 - 2级菜单（补充缺失的）
  const systemMenus = [
    { id: 'system-users', name: '用户管理', path: '/system/users', component: 'UserManagement', icon: 'UserOutlined', permission: 'user.view' },
    { id: 'system-roles', name: '角色管理', path: '/system/roles', component: 'RoleManagement', icon: 'TeamOutlined', permission: 'role.view' },
    { id: 'system-departments', name: '部门管理', path: '/system/departments', component: 'DepartmentManagement', icon: 'ApartmentOutlined', permission: 'department.view' },
    { id: 'system-organizations', name: '组织管理', path: '/system/organizations', component: 'OrganizationManagement', icon: 'BankOutlined', permission: 'organization.view' },
    { id: 'system-menus', name: '菜单管理', path: '/system/menus', component: 'MenuManagement', icon: 'MenuOutlined', permission: 'menu.view' },
    { id: 'system-permissions', name: '权限管理', path: '/system/permissions', component: 'PermissionManagement', icon: 'LockOutlined', permission: 'permission.view' },
    { id: 'system-project-assign', name: '项目分配', path: '/system/project-assign', component: 'ProjectManagement', icon: 'ProjectOutlined', permission: 'project.assign' },
    { id: 'system-ai-models', name: 'AI模型配置', path: '/system/ai-models', component: 'SystemConfig', icon: 'RobotOutlined', permission: 'system.ai.config' },
    { id: 'system-audit', name: '操作审计', path: '/system/audit', component: 'SystemLogs', icon: 'FileSearchOutlined', permission: 'system.audit.view' }
  ];

  let sortOrder = 1;
  for (const menu of systemMenus) {
    const exists = await knex('menus').where('id', menu.id).first();
    if (!exists) {
      menus.push({
        id: menu.id,
        name: menu.name,
        path: menu.path,
        component: menu.component,
        icon: menu.icon,
        type: 'menu',
        permission_code: menu.permission,
        visible: true,
        status: 'active',
        sort_order: sortOrder++,
        parent_id: 'system',
        created_at: now,
        updated_at: now
      });
    }
  }

  // 批量插入菜单
  if (menus.length > 0) {
    await knex('menus').insert(menus);
  }

  console.log(`✅ V3.0 菜单结构重构完成，共创建 ${menus.length} 个菜单项`);
};

exports.down = async function(knex) {
  // 回滚时清空所有菜单（谨慎使用）
  await knex('menus').delete();
  console.log('⚠️  菜单已回滚');
};
