/**
 * V2.1 语义层增强:
 * 1. embedding_model & embedding_version (支持模型升级)
 * 2. is_active (软删除)
 * 3. semantic_search_logs (搜索日志分析)
 */

exports.up = async function(knex) {
  // 1. 扩展 semantic_chunks 表 - 检查列是否存在
  const hasTable = await knex.schema.hasTable('semantic_chunks')

  if (hasTable) {
    const hasEmbeddingModel = await knex.schema.hasColumn('semantic_chunks', 'embedding_model')
    const hasEmbeddingVersion = await knex.schema.hasColumn('semantic_chunks', 'embedding_version')
    const hasIsActive = await knex.schema.hasColumn('semantic_chunks', 'is_active')

    await knex.schema.alterTable('semantic_chunks', table => {
      // Embedding 模型追踪
      if (!hasEmbeddingModel) {
        table.string('embedding_model', 100).nullable()
      }
      if (!hasEmbeddingVersion) {
        table.string('embedding_version', 50).nullable()
      }

      // 软删除/失效标记
      if (!hasIsActive) {
        table.boolean('is_active').defaultTo(true).notNullable()
      }
    })

    console.log('✅ semantic_chunks 表已扩展')
  }

  // 2. 创建搜索日志表
  if (!(await knex.schema.hasTable('semantic_search_logs'))) {
    await knex.schema.createTable('semantic_search_logs', table => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))

      // 搜索参数
      table.text('query').notNullable()
      table.string('domain', 50).nullable()
      table.string('type', 50).nullable()
      table.integer('top_k').defaultTo(10)

      // 用户/租户
      table.string('user_id', 100).nullable()
      table.string('tenant_id', 100).nullable()
      table.string('project_id', 100).nullable()

      // 搜索结果
      table.integer('result_count').defaultTo(0)
      table.jsonb('result_ids').nullable() // 返回的文档 ID 列表

      // 性能指标
      table.integer('latency_ms').nullable()
      table.boolean('cache_hit').defaultTo(false)

      // 用户反馈 (可选)
      table.string('clicked_id', 100).nullable() // 用户点击的结果 ID
      table.integer('clicked_rank').nullable()    // 点击的结果排名

      // 时间戳
      table.timestamp('searched_at').defaultTo(knex.fn.now())

      // 索引
      table.index(['domain', 'searched_at'])
      table.index(['tenant_id', 'searched_at'])
      table.index(['user_id', 'searched_at'])
      table.index(['cache_hit'])
    })

    console.log('✅ semantic_search_logs 表已创建')
  }

  // 3. 创建 embedding 模型索引 (用于批量重算)
  if (hasTable) {
    await knex.schema.raw(`
      CREATE INDEX IF NOT EXISTS idx_semantic_chunks_embedding_model
      ON semantic_chunks(embedding_model, embedding_version)
    `)

    await knex.schema.raw(`
      CREATE INDEX IF NOT EXISTS idx_semantic_chunks_active
      ON semantic_chunks(is_active, domain, type)
    `)

    console.log('✅ 索引已创建')
  }
}

exports.down = async function(knex) {
  // 删除索引
  await knex.schema.raw('DROP INDEX IF EXISTS idx_semantic_chunks_embedding_model')
  await knex.schema.raw('DROP INDEX IF EXISTS idx_semantic_chunks_active')

  // 删除搜索日志表
  await knex.schema.dropTableIfExists('semantic_search_logs')

  // 移除新增字段
  const hasTable = await knex.schema.hasTable('semantic_chunks')
  if (hasTable) {
    await knex.schema.alterTable('semantic_chunks', table => {
      table.dropColumn('embedding_model')
      table.dropColumn('embedding_version')
      table.dropColumn('is_active')
      table.dropColumn('updated_at')
    })
  }
}
