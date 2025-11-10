/**
 * 创建用户表
 */
exports.up = function(knex) {
  return knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.string('username', 50).notNullable().comment('用户名')
    table.string('email', 100).notNullable().comment('邮箱')
    table.string('phone', 20).comment('手机号')
    table.string('password_hash').notNullable().comment('密码哈希')
    table.string('real_name', 50).comment('真实姓名')
    table.string('avatar').comment('头像URL')
    table.uuid('organization_id').references('id').inTable('organizations').onDelete('CASCADE').notNullable().comment('组织ID')
    table.uuid('department_id').references('id').inTable('departments').onDelete('SET NULL').comment('部门ID')
    table.enum('gender', ['male', 'female', 'other']).comment('性别')
    table.date('birthday').comment('生日')
    table.string('position', 50).comment('职位')
    table.text('bio').comment('个人简介')
    table.jsonb('settings').defaultTo('{}').comment('用户设置')
    table.enum('status', ['active', 'inactive', 'locked']).defaultTo('active').comment('状态')
    table.timestamp('last_login_at').comment('最后登录时间')
    table.string('last_login_ip', 45).comment('最后登录IP')
    table.timestamp('password_changed_at').comment('密码修改时间')
    table.boolean('email_verified').defaultTo(false).comment('邮箱是否验证')
    table.boolean('phone_verified').defaultTo(false).comment('手机号是否验证')
    table.timestamps(true, true)
    table.timestamp('deleted_at').comment('软删除时间')
    
    table.unique(['organization_id', 'username'], 'users_org_username_unique')
    table.unique(['organization_id', 'email'], 'users_org_email_unique')
    table.index(['email'])
    table.index(['phone'])
    table.comment('用户表')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTable('users')
}