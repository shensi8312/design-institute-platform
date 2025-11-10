/**
 * 初始化角色数据
 */
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('roles').del()
  
  // 获取所有权限
  
  // 系统管理员权限
  const adminPermissions = ['*']
  
  // 项目经理权限
  const projectManagerPermissions = [
    'system:user:view', 'system:user:list:project', 'system:user:detail',
    'system:dept:view', 'system:dept:list',
    'system:project:view', 'system:project:list', 'system:project:create', 'system:project:edit', 'system:project:members',
    'knowledge:view', 'knowledge:category:list', 'knowledge:category:create', 'knowledge:category:edit',
    'knowledge:document:list', 'knowledge:document:create', 'knowledge:document:edit', 'knowledge:document:download'
  ]
  
  // 开发工程师权限
  const developerPermissions = [
    'system:user:view', 'system:user:list:project', 'system:user:detail',
    'system:project:view', 'system:project:list',
    'knowledge:view', 'knowledge:category:list',
    'knowledge:document:list', 'knowledge:document:create', 'knowledge:document:edit', 'knowledge:document:download'
  ]
  
  // 普通用户权限
  const userPermissions = [
    'knowledge:view', 'knowledge:category:list',
    'knowledge:document:list', 'knowledge:document:create', 'knowledge:document:download'
  ]
  
  // 插入角色数据
  await knex('roles').insert([
    {
      id: 'role-1',
      name: '超级管理员',
      code: 'admin',
      organization_id: 'org-1',
      description: '系统超级管理员，拥有所有权限',
      permissions: JSON.stringify(adminPermissions),
      type: 'system',
      is_default: false,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 'role-2',
      name: '项目经理',
      code: 'project_manager',
      organization_id: 'org-1',
      description: '项目经理，负责项目管理和团队协调',
      permissions: JSON.stringify(projectManagerPermissions),
      type: 'custom',
      is_default: false,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 'role-3',
      name: '开发工程师',
      code: 'developer',
      organization_id: 'org-1',
      description: '开发工程师，负责技术开发和实现',
      permissions: JSON.stringify(developerPermissions),
      type: 'custom',
      is_default: false,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 'role-4',
      name: '产品经理',
      code: 'product_manager',
      organization_id: 'org-1',
      description: '产品经理，负责产品设计和需求管理',
      permissions: JSON.stringify(projectManagerPermissions),
      type: 'custom',
      is_default: false,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 'role-5',
      name: '设计师',
      code: 'designer',
      organization_id: 'org-1',
      description: '设计师，负责UI/UX设计',
      permissions: JSON.stringify(userPermissions),
      type: 'custom',
      is_default: false,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 'role-6',
      name: '测试工程师',
      code: 'tester',
      organization_id: 'org-1',
      description: '测试工程师，负责质量保证',
      permissions: JSON.stringify(userPermissions),
      type: 'custom',
      is_default: false,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 'role-7',
      name: '普通用户',
      code: 'user',
      organization_id: 'org-1',
      description: '普通用户，基础权限',
      permissions: JSON.stringify(userPermissions),
      type: 'custom',
      is_default: true,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    }
  ])
}
