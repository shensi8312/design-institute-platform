/**
 * 创建数字工地告警表
 */
exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('site_alerts')
  if (hasTable) {
    return
  }

  await knex.schema.createTable('site_alerts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()')).comment('告警ID')
    table.string('site_id', 50).notNullable().comment('工地或园区ID')
    table.string('project_id', 50).comment('关联项目ID')
    table.string('camera_id', 50).comment('摄像头ID')
    table.string('area', 100).comment('位置/区域信息')
    table.string('alert_code', 50).notNullable().comment('告警类型编码')
    table.string('alert_level', 20).notNullable().defaultTo('info').comment('告警等级')
    table.string('alert_title', 120).notNullable().comment('告警标题')
    table.text('alert_message').comment('告警描述')
    table.timestamp('detected_at').notNullable().defaultTo(knex.fn.now()).comment('检测时间')
    table.text('image_url').comment('截图地址')
    table.text('video_url').comment('视频地址')
    table.jsonb('tags').notNullable().defaultTo('[]').comment('标签信息')
    table.jsonb('raw_payload').comment('原始识别结果')
    table.string('ack_status', 20).notNullable().defaultTo('unread').comment('处理状态')
    table.string('ack_by', 50).comment('处理人')
    table.text('ack_note').comment('处理备注')
    table.timestamp('ack_at').comment('处理时间')
    table.string('created_by', 50).defaultTo('system').comment('创建来源')
    table.string('organization_id', 50).comment('组织ID')
    table.string('department_id', 50).comment('部门ID')
    table.jsonb('extra_metadata').notNullable().defaultTo('{}').comment('扩展字段')
    table.timestamps(true, true)

    table.index(['site_id', 'detected_at'], 'idx_site_alerts_site_time')
    table.index(['alert_level'], 'idx_site_alerts_level')
    table.index(['ack_status'], 'idx_site_alerts_status')
    table.index(['project_id'], 'idx_site_alerts_project')
    table.index(['camera_id'], 'idx_site_alerts_camera')
    table.index(['organization_id'], 'idx_site_alerts_org')
  })
}

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('site_alerts')
}
