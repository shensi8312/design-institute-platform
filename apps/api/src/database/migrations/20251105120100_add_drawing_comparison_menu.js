exports.up = async function(knex) {
  // 插入图纸比对菜单
  await knex('menus').insert({
    id: knex.raw('gen_random_uuid()::text'),
    name: '图纸比对',
    code: 'drawing_comparison',
    path: '/mechanical-design/drawing-comparison',
    component: 'DrawingComparison',
    icon: 'DiffOutlined',
    parent_id: 'fb094603-8855-43d5-9e86-b46cb46c5c7b', // 机械设计父菜单ID
    type: 'menu',
    sort_order: 5,
    status: 'active',
    visible: true,
    permission_code: 'mechanical:drawing:comparison',
    permissions: JSON.stringify([
      { action: 'view', name: '查看图纸比对' },
      { action: 'compare', name: '执行比对' },
      { action: 'export', name: '导出报告' }
    ])
  });
};

exports.down = function(knex) {
  return knex('menus').where('code', 'drawing_comparison').del();
};
