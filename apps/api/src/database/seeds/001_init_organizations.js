/**
 * 初始化组织数据
 */
exports.seed = async function(knex) {
  // 清空现有数据
  await knex('organizations').del()
  
  // 插入初始组织数据
  await knex('organizations').insert([
    {
      id: 'org-1',
      name: 'MST-AI建筑设计研究院',
      code: 'mst-ai',
      description: '专注于建筑设计和AI技术结合的研究院',
      status: 'active',
      settings: JSON.stringify({
        timezone: 'Asia/Shanghai',
        locale: 'zh-CN',
        features: {
          knowledge_base: true,
          ai_assistant: true,
          collaboration: true
        }
      }),
      created_at: new Date(),
      updated_at: new Date()
    }
  ])
}