exports.up = function(knex) {
  return knex.schema
    // 学习反馈表
    .createTable('graph_learning_feedback', table => {
      table.increments('id').primary()
      table.string('project_id').notNullable()
      table.text('query').notNullable()
      table.json('expected_result')
      table.json('actual_result')
      table.float('rating').notNullable()
      table.text('correction')
      table.string('user_id')
      table.timestamp('created_at').defaultTo(knex.fn.now())
      
      table.index('project_id')
      table.index('created_at')
    })
    
    // 查询日志表
    .createTable('graph_query_logs', table => {
      table.increments('id').primary()
      table.string('project_id').notNullable()
      table.text('query').notNullable()
      table.integer('result_count')
      table.float('execution_time')
      table.float('user_satisfaction')
      table.string('user_id')
      table.timestamp('created_at').defaultTo(knex.fn.now())
      
      table.index('project_id')
      table.index('created_at')
    })
    
    // 学习历史表
    .createTable('graph_learning_history', table => {
      table.increments('id').primary()
      table.string('project_id').notNullable()
      table.string('learning_type').notNullable() // autonomous, feedback, query_pattern, concept_drift
      table.integer('discovered_relations')
      table.integer('identified_synonyms')
      table.integer('detected_anomalies')
      table.integer('predicted_trends')
      table.json('applied_changes')
      table.json('metrics')
      table.timestamp('created_at').defaultTo(knex.fn.now())
      
      table.index('project_id')
      table.index('learning_type')
      table.index('created_at')
    })
    
    // 概念历史表
    .createTable('graph_concept_history', table => {
      table.increments('id').primary()
      table.string('project_id').notNullable()
      table.string('concept_id').notNullable()
      table.string('name').notNullable()
      table.json('definition')
      table.json('attributes')
      table.json('relationships')
      table.float('drift_score')
      table.timestamp('created_at').defaultTo(knex.fn.now())
      
      table.index('project_id')
      table.index('concept_id')
      table.index('created_at')
    })
    
    // 模型检查点表
    .createTable('model_checkpoints', table => {
      table.increments('id').primary()
      table.string('model_type').notNullable()
      table.string('checkpoint_path').notNullable()
      table.json('metrics')
      table.json('hyperparameters')
      table.timestamp('created_at').defaultTo(knex.fn.now())
      
      table.index('model_type')
      table.index('created_at')
    })
    
    // 学习配置表
    .createTable('graph_learning_config', table => {
      table.string('project_id').primary()
      table.json('config').notNullable()
      table.timestamp('created_at').defaultTo(knex.fn.now())
      table.timestamp('updated_at').defaultTo(knex.fn.now())
    })
    
    // 索引批次表（已存在则跳过）
    .then(() => {
      return knex.schema.hasTable('graph_index_batches').then(exists => {
        if (!exists) {
          return knex.schema.createTable('graph_index_batches', table => {
            table.increments('id').primary()
            table.string('project_id').notNullable()
            table.integer('document_count')
            table.string('status') // processing, completed, failed
            table.json('stats')
            table.text('error_message')
            table.timestamp('created_at').defaultTo(knex.fn.now())
            table.timestamp('completed_at')
            
            table.index('project_id')
            table.index('status')
          })
        }
      })
    })
}

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('graph_learning_feedback')
    .dropTableIfExists('graph_query_logs')
    .dropTableIfExists('graph_learning_history')
    .dropTableIfExists('graph_concept_history')
    .dropTableIfExists('model_checkpoints')
    .dropTableIfExists('graph_learning_config')
    .dropTableIfExists('graph_index_batches')
}