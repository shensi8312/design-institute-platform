/**
 * 初始化权限数据
 */
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('permissions').del()
  
  // 插入权限数据
  await knex('permissions').insert([
    // 系统管理权限
    { id: knex.raw('gen_random_uuid()'), name: '系统管理', code: 'system:*', module: 'system', description: '系统管理所有权限', type: 'menu', sort: 1 },
    
    // 用户管理权限
    { id: knex.raw('gen_random_uuid()'), name: '用户管理查看', code: 'system:user:view', module: 'system', description: '查看用户管理页面', type: 'menu', sort: 10 },
    { id: knex.raw('gen_random_uuid()'), name: '用户列表查看', code: 'system:user:list', module: 'system', description: '查看用户列表', type: 'api', sort: 11 },
    { id: knex.raw('gen_random_uuid()'), name: '用户列表全部', code: 'system:user:list:all', module: 'system', description: '查看所有用户', type: 'data', sort: 12 },
    { id: knex.raw('gen_random_uuid()'), name: '用户列表部门', code: 'system:user:list:department', module: 'system', description: '查看本部门用户', type: 'data', sort: 13 },
    { id: knex.raw('gen_random_uuid()'), name: '用户列表项目', code: 'system:user:list:project', module: 'system', description: '查看项目相关用户', type: 'data', sort: 14 },
    { id: knex.raw('gen_random_uuid()'), name: '用户详情查看', code: 'system:user:detail', module: 'system', description: '查看用户详情', type: 'api', sort: 15 },
    { id: knex.raw('gen_random_uuid()'), name: '创建用户', code: 'system:user:create', module: 'system', description: '创建新用户', type: 'api', sort: 16 },
    { id: knex.raw('gen_random_uuid()'), name: '编辑用户', code: 'system:user:edit', module: 'system', description: '编辑用户信息', type: 'api', sort: 17 },
    { id: knex.raw('gen_random_uuid()'), name: '删除用户', code: 'system:user:delete', module: 'system', description: '删除用户', type: 'api', sort: 18 },
    { id: knex.raw('gen_random_uuid()'), name: '重置密码', code: 'system:user:resetPassword', module: 'system', description: '重置用户密码', type: 'api', sort: 19 },
    { id: knex.raw('gen_random_uuid()'), name: '批量操作', code: 'system:user:batch', module: 'system', description: '批量操作用户', type: 'api', sort: 20 },
    
    // 部门管理权限
    { id: knex.raw('gen_random_uuid()'), name: '部门管理查看', code: 'system:dept:view', module: 'system', description: '查看部门管理页面', type: 'menu', sort: 30 },
    { id: knex.raw('gen_random_uuid()'), name: '部门列表查看', code: 'system:dept:list', module: 'system', description: '查看部门列表', type: 'api', sort: 31 },
    { id: knex.raw('gen_random_uuid()'), name: '部门列表全部', code: 'system:dept:list:all', module: 'system', description: '查看所有部门', type: 'data', sort: 32 },
    { id: knex.raw('gen_random_uuid()'), name: '创建部门', code: 'system:dept:create', module: 'system', description: '创建新部门', type: 'api', sort: 33 },
    { id: knex.raw('gen_random_uuid()'), name: '编辑部门', code: 'system:dept:edit', module: 'system', description: '编辑部门信息', type: 'api', sort: 34 },
    { id: knex.raw('gen_random_uuid()'), name: '删除部门', code: 'system:dept:delete', module: 'system', description: '删除部门', type: 'api', sort: 35 },
    
    // 项目管理权限
    { id: knex.raw('gen_random_uuid()'), name: '项目管理查看', code: 'system:project:view', module: 'system', description: '查看项目管理页面', type: 'menu', sort: 40 },
    { id: knex.raw('gen_random_uuid()'), name: '项目列表查看', code: 'system:project:list', module: 'system', description: '查看项目列表', type: 'api', sort: 41 },
    { id: knex.raw('gen_random_uuid()'), name: '项目列表全部', code: 'system:project:list:all', module: 'system', description: '查看所有项目', type: 'data', sort: 42 },
    { id: knex.raw('gen_random_uuid()'), name: '项目列表部门', code: 'system:project:list:department', module: 'system', description: '查看本部门项目', type: 'data', sort: 43 },
    { id: knex.raw('gen_random_uuid()'), name: '创建项目', code: 'system:project:create', module: 'system', description: '创建新项目', type: 'api', sort: 44 },
    { id: knex.raw('gen_random_uuid()'), name: '编辑项目', code: 'system:project:edit', module: 'system', description: '编辑项目信息', type: 'api', sort: 45 },
    { id: knex.raw('gen_random_uuid()'), name: '删除项目', code: 'system:project:delete', module: 'system', description: '删除项目', type: 'api', sort: 46 },
    { id: knex.raw('gen_random_uuid()'), name: '项目成员管理', code: 'system:project:members', module: 'system', description: '管理项目成员', type: 'api', sort: 47 },
    
    // 角色管理权限
    { id: knex.raw('gen_random_uuid()'), name: '角色管理查看', code: 'system:role:view', module: 'system', description: '查看角色管理页面', type: 'menu', sort: 50 },
    { id: knex.raw('gen_random_uuid()'), name: '角色列表查看', code: 'system:role:list', module: 'system', description: '查看角色列表', type: 'api', sort: 51 },
    { id: knex.raw('gen_random_uuid()'), name: '创建角色', code: 'system:role:create', module: 'system', description: '创建新角色', type: 'api', sort: 52 },
    { id: knex.raw('gen_random_uuid()'), name: '编辑角色', code: 'system:role:edit', module: 'system', description: '编辑角色信息', type: 'api', sort: 53 },
    { id: knex.raw('gen_random_uuid()'), name: '删除角色', code: 'system:role:delete', module: 'system', description: '删除角色', type: 'api', sort: 54 },
    { id: knex.raw('gen_random_uuid()'), name: '角色权限配置', code: 'system:role:permissions', module: 'system', description: '配置角色权限', type: 'api', sort: 55 },
    
    // 权限管理权限
    { id: knex.raw('gen_random_uuid()'), name: '权限管理查看', code: 'system:permission:view', module: 'system', description: '查看权限管理页面', type: 'menu', sort: 60 },
    { id: knex.raw('gen_random_uuid()'), name: '权限列表查看', code: 'system:permission:list', module: 'system', description: '查看权限列表', type: 'api', sort: 61 },
    
    // 知识库权限
    { id: knex.raw('gen_random_uuid()'), name: '知识库查看', code: 'knowledge:view', module: 'knowledge', description: '查看知识库', type: 'menu', sort: 100 },
    { id: knex.raw('gen_random_uuid()'), name: '知识分类管理', code: 'knowledge:category:list', module: 'knowledge', description: '查看知识分类', type: 'api', sort: 101 },
    { id: knex.raw('gen_random_uuid()'), name: '创建知识分类', code: 'knowledge:category:create', module: 'knowledge', description: '创建知识分类', type: 'api', sort: 102 },
    { id: knex.raw('gen_random_uuid()'), name: '编辑知识分类', code: 'knowledge:category:edit', module: 'knowledge', description: '编辑知识分类', type: 'api', sort: 103 },
    { id: knex.raw('gen_random_uuid()'), name: '删除知识分类', code: 'knowledge:category:delete', module: 'knowledge', description: '删除知识分类', type: 'api', sort: 104 },
    
    { id: knex.raw('gen_random_uuid()'), name: '知识文档管理', code: 'knowledge:document:list', module: 'knowledge', description: '查看知识文档', type: 'api', sort: 110 },
    { id: knex.raw('gen_random_uuid()'), name: '创建知识文档', code: 'knowledge:document:create', module: 'knowledge', description: '创建知识文档', type: 'api', sort: 111 },
    { id: knex.raw('gen_random_uuid()'), name: '编辑知识文档', code: 'knowledge:document:edit', module: 'knowledge', description: '编辑知识文档', type: 'api', sort: 112 },
    { id: knex.raw('gen_random_uuid()'), name: '删除知识文档', code: 'knowledge:document:delete', module: 'knowledge', description: '删除知识文档', type: 'api', sort: 113 },
    { id: knex.raw('gen_random_uuid()'), name: '下载知识文档', code: 'knowledge:document:download', module: 'knowledge', description: '下载知识文档', type: 'api', sort: 114 },

    // 数字工地权限
    { id: knex.raw('gen_random_uuid()'), name: '数字工地菜单', code: 'digital_site:view', module: 'digital_site', description: '查看数字工地入口', type: 'menu', sort: 200 },
    { id: knex.raw('gen_random_uuid()'), name: '数字工地概览', code: 'digital_site:overview', module: 'digital_site', description: '查看数字工地概览数据', type: 'api', sort: 201 },
    { id: knex.raw('gen_random_uuid()'), name: '数字工地统计', code: 'digital_site:stats', module: 'digital_site', description: '查看数字工地统计数据', type: 'api', sort: 202 },
    { id: knex.raw('gen_random_uuid()'), name: '告警列表查看', code: 'digital_site:alert:list', module: 'digital_site', description: '查看数字工地告警列表', type: 'api', sort: 203 },
    { id: knex.raw('gen_random_uuid()'), name: '告警创建', code: 'digital_site:alert:create', module: 'digital_site', description: '创建数字工地告警', type: 'api', sort: 204 },
    { id: knex.raw('gen_random_uuid()'), name: '告警确认', code: 'digital_site:alert:ack', module: 'digital_site', description: '确认数字工地告警', type: 'api', sort: 205 },
    { id: knex.raw('gen_random_uuid()'), name: '告警关闭', code: 'digital_site:alert:resolve', module: 'digital_site', description: '关闭数字工地告警', type: 'api', sort: 206 },
    { id: knex.raw('gen_random_uuid()'), name: '标签读取', code: 'digital_site:tag:list', module: 'digital_site', description: '获取数字工地标签配置', type: 'api', sort: 207 }
  ])
}
