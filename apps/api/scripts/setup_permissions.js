/**
 * 完善权限系统 - 补充缺失的权限并配置角色权限
 */

const knex = require('../src/config/database');

/**
 * 定义完整的权限列表
 */
const PERMISSIONS = [
  // ========== 系统管理 ==========
  { code: 'system.view', name: '系统管理菜单'},
  { code: 'system.config', name: '系统配置'},
  { code: 'system.logs', name: '查看日志'},
  { code: 'system.monitor', name: '系统监控'},

  // 用户管理
  { code: 'user.view', name: '查看用户'},
  { code: 'user.create', name: '创建用户'},
  { code: 'user.update', name: '编辑用户'},
  { code: 'user.delete', name: '删除用户'},

  // 角色管理
  { code: 'role.view', name: '查看角色'},
  { code: 'role.create', name: '创建角色'},
  { code: 'role.update', name: '编辑角色'},
  { code: 'role.delete', name: '删除角色'},

  // 权限管理
  { code: 'permission.view', name: '查看权限'},
  { code: 'permission.create', name: '创建权限'},
  { code: 'permission.update', name: '编辑权限'},
  { code: 'permission.delete', name: '删除权限'},

  // 菜单管理
  { code: 'menu.view', name: '查看菜单'},
  { code: 'menu.create', name: '创建菜单'},
  { code: 'menu.update', name: '编辑菜单'},
  { code: 'menu.delete', name: '删除菜单'},

  // 组织管理
  { code: 'organization.view', name: '查看组织'},
  { code: 'organization.create', name: '创建组织'},
  { code: 'organization.update', name: '编辑组织'},
  { code: 'organization.delete', name: '删除组织'},

  // 部门管理
  { code: 'department.view', name: '查看部门'},
  { code: 'department.create', name: '创建部门'},
  { code: 'department.update', name: '编辑部门'},
  { code: 'department.delete', name: '删除部门'},

  // ========== 知识中心 ==========
  { code: 'knowledge.view', name: '知识中心菜单'},
  { code: 'knowledge.enterprise.view', name: '查看企业知识库'},
  { code: 'knowledge.personal.view', name: '查看个人知识库'},
  { code: 'knowledge.upload', name: '上传文档'},
  { code: 'knowledge.update', name: '编辑文档'},
  { code: 'knowledge.delete', name: '删除文档'},
  { code: 'knowledge.qa', name: '智能问答'},
  { code: 'knowledge.graph.view', name: '查看知识图谱'},
  { code: 'knowledge.graph.edit', name: '编辑知识图谱'},
  { code: 'knowledge.review', name: '知识审核'},

  // ========== 项目管理 ==========
  { code: 'project.view', name: '项目中心菜单'},
  { code: 'project.list', name: '查看项目列表'},
  { code: 'project.create', name: '创建项目'},
  { code: 'project.update', name: '编辑项目'},
  { code: 'project.delete', name: '删除项目'},
  { code: 'project.assign', name: '项目分配'},

  // ========== 机械设计 ==========
  { code: 'mechanical.view', name: '机械设计菜单'},
  { code: 'mechanical.pid.view', name: 'PID识别'},
  { code: 'mechanical.pid.recognize', name: '执行PID识别'},
  { code: 'mechanical.assembly.view', name: '查看装配设计'},
  { code: 'mechanical.assembly.create', name: '创建装配设计'},
  { code: 'mechanical.assembly.export', name: '导出装配设计'},
  { code: 'mechanical.drawing.comparison', name: '图纸比对'},
  { code: 'mechanical.workflow.view', name: '装配系统总览'},

  // ========== 规则管理 ==========
  { code: 'rules.view', name: '规则管理菜单'},
  { code: 'rules.unified.view', name: '统一规则管理'},
  { code: 'rules.assembly.view', name: '规则库管理'},
  { code: 'rules.review', name: '规则审核'},
  { code: 'rules.learning.view', name: '样本学习'},
  { code: 'rules.learning.config', name: '规则学习配置'},

  // ========== 数字工地 ==========
  { code: 'digital_site.view', name: '数字工地菜单'},
  { code: 'digital_site.overview', name: '数字工地概览'},
  { code: 'digital_site.stats', name: '数字工地统计'},
  { code: 'digital_site.alert.list', name: '告警列表查看'},
  { code: 'digital_site.alert.create', name: '告警创建'},
  { code: 'digital_site.alert.ack', name: '告警确认'},
  { code: 'digital_site.alert.resolve', name: '告警关闭'},
  { code: 'digital_site.tag.list', name: '标签读取'},

  // ========== 工作流 ==========
  { code: 'workflow.view', name: '我的任务'},
  { code: 'workflow.editor', name: '工作流编辑'},
  { code: 'workflow.agent', name: 'Agent工作流'},
  { code: 'workflow.execute', name: '执行工作流'},

  // ========== 文档管理 ==========
  { code: 'document.view', name: '文档管理'},
  { code: 'document.template.view', name: '查看模板'},
  { code: 'document.template.edit', name: '编辑模板'},
  { code: 'document.unified.view', name: '统一文档'},
  { code: 'document.archive', name: '归档管理'},
  { code: 'document.approval', name: '审批任务'},

  // ========== AI工具 ==========
  { code: 'ai.view', name: 'AI工具菜单'},
  { code: 'ai.sketch', name: '草图识别'},
  { code: 'ai.annotation', name: '数据标注'},
  { code: 'ai.training', name: '模型训练'},
  { code: 'ai.learning', name: '学习仪表板'},

  // ========== 引擎管理 ==========
  { code: 'engine.view', name: '引擎管理'},
  { code: 'engine.building_layout', name: '建筑布局引擎'},
  { code: 'engine.spatial_constraint', name: '空间约束推理引擎'},

  // ========== 其他 ==========
  { code: 'debug.view', name: '调试工具'},
  { code: 'langextract.view', name: 'LangExtract'},
];

/**
 * 角色权限配置
 */
const ROLE_PERMISSIONS = {
  // admin - 所有权限
  admin: 'ALL',

  // manager - 除了系统配置外的所有权限
  manager: [
    // 系统管理（受限）
    'user.view', 'user.create', 'user.update',
    'role.view',
    'department.view', 'department.create', 'department.update',
    'organization.view',
    'system.logs', 'system.monitor',

    // 知识中心（全部）
    'knowledge.view', 'knowledge.enterprise.view', 'knowledge.personal.view',
    'knowledge.upload', 'knowledge.update', 'knowledge.delete',
    'knowledge.qa', 'knowledge.graph.view', 'knowledge.graph.edit',
    'knowledge.review',

    // 项目管理（全部）
    'project.view', 'project.list', 'project.create', 'project.update',
    'project.delete', 'project.assign',

    // 机械设计（全部）
    'mechanical.view', 'mechanical.pid.view', 'mechanical.pid.recognize',
    'mechanical.assembly.view', 'mechanical.assembly.create', 'mechanical.assembly.export',
    'mechanical.drawing.comparison', 'mechanical.workflow.view',

    // 规则管理（全部）
    'rules.view', 'rules.unified.view', 'rules.assembly.view',
    'rules.review', 'rules.learning.view', 'rules.learning.config',

    // 数字工地（全部）
    'digital_site.view', 'digital_site.overview', 'digital_site.stats',
    'digital_site.alert.list', 'digital_site.alert.create',
    'digital_site.alert.ack', 'digital_site.alert.resolve',
    'digital_site.tag.list',

    // 工作流（全部）
    'workflow.view', 'workflow.editor', 'workflow.agent', 'workflow.execute',

    // 文档管理（全部）
    'document.view', 'document.template.view', 'document.template.edit',
    'document.unified.view', 'document.archive', 'document.approval',

    // AI工具（全部）
    'ai.view', 'ai.sketch', 'ai.annotation', 'ai.training', 'ai.learning',

    // 引擎管理（全部）
    'engine.view', 'engine.building_layout', 'engine.spatial_constraint',
  ],

  // user - 只有知识库和智能问答
  user: [
    'knowledge.view',
    'knowledge.enterprise.view',
    'knowledge.personal.view',
    'knowledge.qa',
    'knowledge.graph.view',
  ],
};

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始完善权限系统...\n');

  // 1. 清理旧权限（除了已有的43个）
  console.log('📋 第1步：补充缺失的权限记录\n');

  const existingPerms = await knex('permissions').select('code');
  const existingCodes = new Set(existingPerms.map(p => p.code));

  const newPerms = PERMISSIONS.filter(p => !existingCodes.has(p.code));

  if (newPerms.length > 0) {
    console.log(`   添加 ${newPerms.length} 个新权限:`);
    newPerms.slice(0, 10).forEach(p => {
      console.log(`   - ${p.code.padEnd(35)} ${p.name}`);
    });
    if (newPerms.length > 10) {
      console.log(`   ... 还有 ${newPerms.length - 10} 个`);
    }

    // 逐条插入避免Knex字段问题
    for (const perm of newPerms) {
      await knex.raw(`
        INSERT INTO permissions (id, code, name, created_at, updated_at)
        VALUES (gen_random_uuid(), ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [perm.code, perm.name]);
    }

    console.log(`   ✅ 已添加 ${newPerms.length} 个权限\n`);
  } else {
    console.log('   ✅ 权限记录已完整\n');
  }

  // 2. 清空并重新配置角色权限
  console.log('📋 第2步：配置角色权限\n');

  await knex('role_permissions').del();
  console.log('   清空了旧的角色权限配置\n');

  // 获取所有权限（用于admin）
  const allPermissions = await knex('permissions').select('code');
  const allPermCodes = allPermissions.map(p => p.code);

  // 获取角色
  const roles = await knex('roles').select('*');

  for (const role of roles) {
    let permCodes = [];

    if (ROLE_PERMISSIONS[role.code] === 'ALL') {
      permCodes = allPermCodes;
    } else if (ROLE_PERMISSIONS[role.code]) {
      permCodes = ROLE_PERMISSIONS[role.code];
    }

    if (permCodes.length > 0) {
      const rolePerms = permCodes.map(code => ({
        role_id: role.id,
        permission_code: code,
        created_at: knex.fn.now(),
      }));

      await knex('role_permissions').insert(rolePerms);
      console.log(`   ✅ ${role.name.padEnd(15)} - ${permCodes.length} 个权限`);
    }
  }

  console.log('\n📊 权限配置汇总:\n');

  // 显示各角色权限数
  for (const role of roles) {
    const count = await knex('role_permissions')
      .where('role_id', role.id)
      .count('* as cnt')
      .first();

    console.log(`   ${role.name.padEnd(15)} - ${count.cnt} 个权限`);
  }

  console.log('\n✅ 权限系统配置完成！\n');
  console.log('用户角色说明:');
  console.log('  - admin:   拥有所有权限（系统管理员）');
  console.log('  - manager: 拥有除系统配置外的所有权限（项目经理）');
  console.log('  - user:    只能访问知识库和智能问答（普通用户）');
  console.log('');
}

main()
  .then(() => {
    console.log('✅ 完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 失败:', error);
    process.exit(1);
  });
