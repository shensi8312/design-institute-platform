/**
 * 初始化部门数据
 */
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('departments').del()
  
  // 插入初始部门数据
  await knex('departments').insert([
    {
      id: 'dept-1',
      name: '技术部',
      code: 'tech',
      organization_id: 'org-1',
      description: '负责技术研发和系统开发',
      sort: 1,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 'dept-2',
      name: '产品部',
      code: 'product',
      organization_id: 'org-1',
      description: '负责产品设计和需求分析',
      sort: 2,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 'dept-3',
      name: '设计部',
      code: 'design',
      organization_id: 'org-1',
      description: '负责UI/UX设计和视觉设计',
      sort: 3,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 'dept-4',
      name: '测试部',
      code: 'qa',
      organization_id: 'org-1',
      description: '负责质量保证和测试',
      sort: 4,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 'dept-5',
      name: '运营部',
      code: 'ops',
      organization_id: 'org-1',
      description: '负责运营推广和客户服务',
      sort: 5,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    }
  ])
}