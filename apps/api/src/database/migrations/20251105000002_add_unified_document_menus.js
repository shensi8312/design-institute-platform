/**
 * 添加统一文档系统菜单配置
 */

exports.up = async function(knex) {
  // 插入统一文档系统菜单
  await knex('menus').insert([
    {
      id: 'menu_unified_doc',
      name: '统一文档',
      path: '/documents',
      icon: 'FileTextOutlined',
      parent_id: null,
      sort_order: 50,
      is_enabled: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: 'menu_unified_doc_manage',
      name: '文档管理',
      path: '/documents',
      icon: 'FolderOutlined',
      parent_id: 'menu_unified_doc',
      sort_order: 1,
      is_enabled: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: 'menu_unified_doc_templates',
      name: '模板管理',
      path: '/templates',
      icon: 'LayoutOutlined',
      parent_id: 'menu_unified_doc',
      sort_order: 2,
      is_enabled: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: 'menu_unified_doc_approval',
      name: '审批任务',
      path: '/approval-tasks',
      icon: 'AuditOutlined',
      parent_id: 'menu_unified_doc',
      sort_order: 3,
      is_enabled: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
    {
      id: 'menu_unified_doc_archive',
      name: '归档管理',
      path: '/archive-management',
      icon: 'InboxOutlined',
      parent_id: 'menu_unified_doc',
      sort_order: 4,
      is_enabled: true,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    },
  ]);

  console.log('✅ 统一文档系统菜单配置已添加');
};

exports.down = async function(knex) {
  await knex('menus').whereIn('id', [
    'menu_unified_doc',
    'menu_unified_doc_manage',
    'menu_unified_doc_templates',
    'menu_unified_doc_approval',
    'menu_unified_doc_archive',
  ]).del();

  console.log('✅ 统一文档系统菜单配置已删除');
};
