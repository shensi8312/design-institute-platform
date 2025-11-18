/**
 * V3.0 权限系统配置
 * 创建日期: 2025-11-18
 *
 * 添加项目文档和AI审查相关的权限
 */

exports.up = async function(knex) {
  // V3.0 文档权限列表 (移除module字段,数据库表可能没有此列)
  const permissions = [
    // 合同文档权限
    { code: 'doc.upload.contract', name: '上传合同文档', description: '允许用户上传合同类型文档' },
    { code: 'doc.view.contract', name: '查看合同文档', description: '允许用户查看合同文档' },
    { code: 'doc.edit.contract', name: '编辑合同文档', description: '允许用户编辑合同文档信息' },
    { code: 'doc.delete.contract', name: '删除合同文档', description: '允许用户删除合同文档' },
    { code: 'doc.ai_review.contract', name: 'AI审查合同', description: '允许用户启动合同AI审查' },

    // 投标文档权限
    { code: 'doc.upload.our_bid', name: '上传我方投标书', description: '允许用户上传我方投标书' },
    { code: 'doc.upload.competitor_bid', name: '上传竞争对手投标书', description: '允许用户上传竞争对手投标书' },
    { code: 'doc.ai_review.our_bid', name: 'AI审查我方投标书', description: '允许用户AI审查我方投标书' },

    // 招标文档权限
    { code: 'doc.upload.bidding_doc', name: '上传招标文件', description: '允许用户上传招标文件' },
    { code: 'doc.view.bidding_doc', name: '查看招标文件', description: '允许用户查看招标文件' },

    // 报告生成权限
    { code: 'report.generate.contract_review', name: '生成合同审查报告', description: '允许用户生成合同审查报告' },
    { code: 'report.download', name: '下载报告', description: '允许用户下载生成的报告' },

    // 项目文档管理通用权限
    { code: 'project.documents.view_all', name: '查看所有项目文档', description: '允许用户查看项目中所有类型的文档' },
    { code: 'project.documents.manage', name: '管理项目文档', description: '允许用户管理项目文档(上传、编辑、删除)' }
  ]

  // 检查 permissions 表是否存在
  const hasPermissionsTable = await knex.schema.hasTable('permissions')

  if (!hasPermissionsTable) {
    console.warn('⚠️  permissions表不存在，跳过权限配置')
    return
  }

  // 插入权限数据 (忽略已存在的)
  let insertedCount = 0
  for (const permission of permissions) {
    const exists = await knex('permissions').where({ code: permission.code }).first()
    if (!exists) {
      await knex('permissions').insert(permission)
      insertedCount++
    }
  }

  console.log(`✅ V3.0 权限配置完成，新增${insertedCount}个权限`)

  // TODO: 角色权限分配需要根据实际表结构调整
  // 暂时跳过，Week 2 手动配置
  console.log('⚠️  角色权限分配跳过，需要手动配置')
}

exports.down = async function(knex) {
  // 删除V3.0相关权限
  const permissionCodes = [
    'doc.upload.contract',
    'doc.view.contract',
    'doc.edit.contract',
    'doc.delete.contract',
    'doc.ai_review.contract',
    'doc.upload.our_bid',
    'doc.upload.competitor_bid',
    'doc.ai_review.our_bid',
    'doc.upload.bidding_doc',
    'doc.view.bidding_doc',
    'report.generate.contract_review',
    'report.download',
    'project.documents.view_all',
    'project.documents.manage'
  ]

  const hasPermissionsTable = await knex.schema.hasTable('permissions')
  if (hasPermissionsTable) {
    await knex('permissions').whereIn('code', permissionCodes).delete()
    console.log('✅ V3.0权限已删除')
  }
}
