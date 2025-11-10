/**
 * 创建对话相关表
 */
exports.up = function(knex) {
  return knex.schema
    // 创建AI助手表
    .createTable('chat_assistants', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('name', 100).notNullable().comment('助手名称')
      table.text('description').comment('助手描述')
      table.string('icon', 50).defaultTo('🤖').comment('助手图标')
      table.text('system_prompt').comment('系统提示词')
      table.text('prologue').comment('开场白')
      table.string('llm_id', 50).comment('LLM模型ID')
      table.jsonb('kb_ids').defaultTo('[]').comment('关联的知识库ID列表')
      table.jsonb('settings').defaultTo('{}').comment('助手设置')
      table.uuid('owner_id').references('id').inTable('users').onDelete('SET NULL').comment('创建者')
      table.uuid('project_id').references('id').inTable('projects').onDelete('SET NULL').comment('项目ID')
      table.uuid('department_id').references('id').inTable('departments').onDelete('SET NULL').comment('部门ID')
      table.uuid('organization_id').references('id').inTable('organizations').onDelete('CASCADE').notNullable().comment('组织ID')
      table.enum('permission_level', ['personal', 'project', 'department', 'organization']).defaultTo('personal').comment('权限级别')
      table.string('ragflow_dialog_id', 100).comment('RAGFlow对话ID')
      table.enum('status', ['active', 'inactive']).defaultTo('active').comment('状态')
      table.timestamps(true, true)
      table.timestamp('deleted_at').comment('软删除时间')
      
      table.index(['owner_id'])
      table.index(['project_id'])
      table.index(['organization_id'])
      table.comment('AI助手表')
    })
    
    // 创建会话表
    .createTable('chat_conversations', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('title', 200).comment('会话标题')
      table.uuid('assistant_id').references('id').inTable('chat_assistants').onDelete('CASCADE').notNullable().comment('助手ID')
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').notNullable().comment('用户ID')
      table.uuid('organization_id').references('id').inTable('organizations').onDelete('CASCADE').notNullable().comment('组织ID')
      table.jsonb('context').defaultTo('{}').comment('会话上下文')
      table.enum('status', ['active', 'archived']).defaultTo('active').comment('状态')
      table.timestamp('last_activity_at').defaultTo(knex.fn.now()).comment('最后活动时间')
      table.timestamps(true, true)
      
      table.index(['assistant_id'])
      table.index(['user_id'])
      table.index(['last_activity_at'])
      table.comment('对话会话表')
    })
    
    // 创建消息表
    .createTable('chat_messages', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('conversation_id').references('id').inTable('chat_conversations').onDelete('CASCADE').notNullable().comment('会话ID')
      table.enum('role', ['user', 'assistant', 'system']).notNullable().comment('消息角色')
      table.text('content').notNullable().comment('消息内容')
      table.jsonb('references').defaultTo('[]').comment('引用的知识库内容')
      table.jsonb('metadata').defaultTo('{}').comment('元数据')
      table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL').comment('用户ID(仅user角色)')
      table.integer('tokens').comment('消耗的token数')
      table.timestamps(true, true)
      
      table.index(['conversation_id', 'created_at'])
      table.comment('对话消息表')
    })
}

exports.down = function(knex) {
  return knex.schema
    .dropTable('chat_messages')
    .dropTable('chat_conversations')
    .dropTable('chat_assistants')
}