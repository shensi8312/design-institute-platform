/**
 * 更新项目经理角色权限
 *
 * 问题：manager角色缺少大量子菜单权限，导致虽然能看到父菜单，但点开后无子菜单
 * 解决：补全manager角色的权限，包括知识管理、文档管理、规则管理等完整权限
 */

exports.up = async function(knex) {
  // 更新 manager 角色的权限
  await knex('roles')
    .where('code', 'role_manager')
    .update({
      permissions: JSON.stringify([
        "project.view",
        "digital_site.view",
        "knowledge.view",
        "knowledge.chat",
        "knowledge.enterprise",
        "knowledge.personal",
        "knowledge.graph",
        "knowledge.review",
        "menu.menu_unified_doc",
        "document.view",
        "document.template",
        "document.approval",
        "rules",
        "rules.unified",
        "rules.review",
        "system.view",
        "user.view",
        "dept.view",
        "system.organizations",
        "ai",
        "workflow"
      ]),
      updated_at: new Date()
    });

  console.log('✅ manager角色权限已更新');
};

exports.down = async function(knex) {
  // 恢复原来的权限（只有基础的12个权限）
  await knex('roles')
    .where('code', 'role_manager')
    .update({
      permissions: JSON.stringify([
        "project.view",
        "digital_site.view",
        "knowledge.view",
        "knowledge.enterprise",
        "knowledge.personal",
        "knowledge.graph",
        "knowledge.review",
        "menu.menu_unified_doc",
        "document.view",
        "document.template",
        "rules",
        "workflow"
      ]),
      updated_at: new Date()
    });

  console.log('✅ manager角色权限已恢复');
};
