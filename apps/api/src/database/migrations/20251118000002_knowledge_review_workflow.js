/**
 * 知识审核工作流
 *
 * 流程: 知识入库管理 → 审核 → 企业知识库
 */

exports.up = async function(knex) {
  // 1. 知识入库管理表 (原始文档 + 加工状态)
  if (!(await knex.schema.hasTable('knowledge_ingestion'))) {
    await knex.schema.createTable('knowledge_ingestion', table => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))

      // 文档信息
      table.string('original_filename').notNullable()
      table.string('file_path').notNullable() // MinIO 对象名
      table.string('file_type', 50) // pdf, docx, etc
      table.integer('file_size')

      // 上传者
      table.string('uploaded_by', 100).notNullable()
      table.string('uploader_role', 50) // admin, expert

      // 解析状态
      table.enu('parse_status', ['pending', 'parsing', 'parsed', 'failed']).defaultTo('pending')
      table.jsonb('parse_result') // Docling 解析结果
      table.text('parse_error')

      // 清洗状态
      table.enu('clean_status', ['pending', 'cleaning', 'cleaned', 'failed']).defaultTo('pending')
      table.jsonb('clean_metadata') // 去重/去噪统计

      // 审核状态
      table.enu('review_status', ['pending', 'reviewing', 'approved', 'rejected']).defaultTo('pending')
      table.string('reviewer_id', 100)
      table.text('review_comment')
      table.timestamp('reviewed_at')

      // 入库状态
      table.boolean('ingested').defaultTo(false)
      table.timestamp('ingested_at')
      table.integer('chunks_created').defaultTo(0)

      // 知识分类
      table.string('domain', 50) // contract, spec, rule, etc
      table.string('category', 100) // 具体分类
      table.jsonb('tags') // 标签

      // 租户/项目
      table.string('tenant_id', 100).notNullable()
      table.string('project_id', 100).nullable()

      // 时间戳
      table.timestamp('created_at').defaultTo(knex.fn.now())
      table.timestamp('updated_at').defaultTo(knex.fn.now())

      // 索引
      table.index(['review_status', 'tenant_id'])
      table.index(['uploaded_by'])
      table.index(['domain', 'category'])
    })

    console.log('✅ knowledge_ingestion 表已创建')
  }

  // 2. 审核记录表 (审核历史 + 专家意见)
  if (!(await knex.schema.hasTable('knowledge_reviews'))) {
    await knex.schema.createTable('knowledge_reviews', table => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))

      table.uuid('ingestion_id').notNullable()
        .references('id').inTable('knowledge_ingestion').onDelete('CASCADE')

      // 审核人
      table.string('reviewer_id', 100).notNullable()
      table.string('reviewer_name', 200)

      // 审核结果
      table.enu('decision', ['approve', 'reject', 'request_changes']).notNullable()
      table.text('comment')

      // 审核细节
      table.jsonb('checklist') // {解析质量: true, 章节结构: true, 敏感内容: false}
      table.jsonb('corrections') // 需要修正的内容

      // 时间戳
      table.timestamp('reviewed_at').defaultTo(knex.fn.now())

      // 索引
      table.index(['ingestion_id'])
      table.index(['reviewer_id'])
    })

    console.log('✅ knowledge_reviews 表已创建')
  }

  // 3. 扩展 semantic_chunks 表 - 添加审核状态和知识库类型
  const hasSemanticChunks = await knex.schema.hasTable('semantic_chunks')

  if (hasSemanticChunks) {
    const hasStatus = await knex.schema.hasColumn('semantic_chunks', 'status')
    const hasKbType = await knex.schema.hasColumn('semantic_chunks', 'kb_type')
    const hasIngestionId = await knex.schema.hasColumn('semantic_chunks', 'ingestion_id')

    await knex.schema.alterTable('semantic_chunks', table => {
      // 审核状态
      if (!hasStatus) {
        table.enu('status', ['draft', 'pending_review', 'approved', 'rejected'])
          .defaultTo('draft')
      }

      // 知识库类型
      if (!hasKbType) {
        table.enu('kb_type', ['enterprise', 'personal', 'project'])
          .defaultTo('enterprise')
      }

      // 关联入库记录
      if (!hasIngestionId) {
        table.uuid('ingestion_id').nullable()
          .references('id').inTable('knowledge_ingestion').onDelete('SET NULL')
      }
    })

    console.log('✅ semantic_chunks 表已扩展（审核状态）')
  }

  // 4. 创建索引
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_semantic_chunks_status
    ON semantic_chunks(status, kb_type, domain)
  `)

  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_semantic_chunks_kb_type
    ON semantic_chunks(kb_type, tenant_id)
  `)
}

exports.down = async function(knex) {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_semantic_chunks_status')
  await knex.schema.raw('DROP INDEX IF EXISTS idx_semantic_chunks_kb_type')

  const hasSemanticChunks = await knex.schema.hasTable('semantic_chunks')
  if (hasSemanticChunks) {
    await knex.schema.alterTable('semantic_chunks', table => {
      table.dropColumn('status')
      table.dropColumn('kb_type')
      table.dropColumn('ingestion_id')
    })
  }

  await knex.schema.dropTableIfExists('knowledge_reviews')
  await knex.schema.dropTableIfExists('knowledge_ingestion')
}
