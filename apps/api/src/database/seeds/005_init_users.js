const bcrypt = require('bcryptjs')

/**
 * 初始化用户数据
 */
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('user_roles').del()
  await knex('users').del()
  
  // 加密密码
  const defaultPassword = await bcrypt.hash('123456', 12)
  
  // 插入用户数据
  await knex('users').insert([
    {
      id: '1',
      username: 'admin',
      email: 'admin@mst-ai.com',
      password_hash: defaultPassword,
      real_name: '系统管理员',
      organization_id: 'org-1',
      department_id: 'dept-1',
      position: '系统管理员',
      status: 'active',
      email_verified: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '2',
      username: 'lifrontend',
      email: 'lifrontend@mst-ai.com',
      password_hash: defaultPassword,
      real_name: '李前端',
      organization_id: 'org-1',
      department_id: 'dept-1',
      position: '前端开发工程师',
      status: 'active',
      email_verified: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '3',
      username: 'wangbackend',
      email: 'wangbackend@mst-ai.com',
      password_hash: defaultPassword,
      real_name: '王后端',
      organization_id: 'org-1',
      department_id: 'dept-1',
      position: '后端开发工程师',
      status: 'active',
      email_verified: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '4',
      username: 'zhangpm',
      email: 'zhangpm@mst-ai.com',
      password_hash: defaultPassword,
      real_name: '张项目',
      organization_id: 'org-1',
      department_id: 'dept-1',
      position: '项目经理',
      status: 'active',
      email_verified: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '5',
      username: 'chenproduct',
      email: 'chenproduct@mst-ai.com',
      password_hash: defaultPassword,
      real_name: '陈产品',
      organization_id: 'org-1',
      department_id: 'dept-2',
      position: '产品经理',
      status: 'active',
      email_verified: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '6',
      username: 'liudesign',
      email: 'liudesign@mst-ai.com',
      password_hash: defaultPassword,
      real_name: '刘设计',
      organization_id: 'org-1',
      department_id: 'dept-3',
      position: 'UI设计师',
      status: 'active',
      email_verified: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '7',
      username: 'wutest',
      email: 'wutest@mst-ai.com',
      password_hash: defaultPassword,
      real_name: '吴测试',
      organization_id: 'org-1',
      department_id: 'dept-4',
      position: '测试工程师',
      status: 'active',
      email_verified: true,
      created_at: new Date(),
      updated_at: new Date()
    }
  ])
  
  // 分配用户角色
  await knex('user_roles').insert([
    // 管理员
    {
      id: knex.raw('gen_random_uuid()'),
      user_id: '1',
      role_id: 'role-1',
      assigned_by: '1',
      assigned_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    },
    // 项目经理
    {
      id: knex.raw('gen_random_uuid()'),
      user_id: '4',
      role_id: 'role-2',
      assigned_by: '1',
      assigned_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    },
    // 开发工程师
    {
      id: knex.raw('gen_random_uuid()'),
      user_id: '2',
      role_id: 'role-3',
      assigned_by: '1',
      assigned_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: knex.raw('gen_random_uuid()'),
      user_id: '3',
      role_id: 'role-3',
      assigned_by: '1',
      assigned_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    },
    // 产品经理
    {
      id: knex.raw('gen_random_uuid()'),
      user_id: '5',
      role_id: 'role-4',
      assigned_by: '1',
      assigned_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    },
    // 设计师
    {
      id: knex.raw('gen_random_uuid()'),
      user_id: '6',
      role_id: 'role-5',
      assigned_by: '1',
      assigned_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    },
    // 测试工程师
    {
      id: knex.raw('gen_random_uuid()'),
      user_id: '7',
      role_id: 'role-6',
      assigned_by: '1',
      assigned_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    }
  ])
}