exports.up = async function(knex) {
  // semantic_chunks 表
  if (!(await knex.schema.hasTable('semantic_chunks'))) {
    await knex.schema.createTable('semantic_chunks', table => {
      table.string('id', 100).primary()
      table.string('domain', 50).notNullable()
      table.string('type', 50).notNullable()
      table.text('text').notNullable()
      table.jsonb('metadata')
      table.string('content_hash', 32)
      table.string('tenant_id', 100).nullable()
      table.string('project_id', 100).nullable()
      table.timestamp('indexed_at').defaultTo(knex.fn.now())
      table.timestamp('updated_at').defaultTo(knex.fn.now())
    })

    // Create indexes separately
    await knex.schema.raw('CREATE INDEX IF NOT EXISTS semantic_chunks_domain_index ON semantic_chunks(domain)')
    await knex.schema.raw('CREATE INDEX IF NOT EXISTS semantic_chunks_content_hash_index ON semantic_chunks(content_hash)')
    await knex.schema.raw('CREATE INDEX IF NOT EXISTS semantic_chunks_tenant_id_index ON semantic_chunks(tenant_id)')
    await knex.schema.raw('CREATE INDEX IF NOT EXISTS semantic_chunks_project_id_index ON semantic_chunks(project_id)')
    await knex.schema.raw('CREATE INDEX IF NOT EXISTS semantic_chunks_domain_type_index ON semantic_chunks(domain, type)')
    await knex.schema.raw('CREATE INDEX IF NOT EXISTS semantic_chunks_tenant_domain_index ON semantic_chunks(tenant_id, domain)')
  }

  // embedding_jobs 表
  if (!(await knex.schema.hasTable('embedding_jobs'))) {
    await knex.schema.createTable('embedding_jobs', table => {
      table.increments('id').primary()
      table.string('chunk_id', 100).notNullable().unique()
      table.string('status', 20).notNullable().defaultTo('pending')
      table.text('error').nullable()
      table.integer('retry_count').defaultTo(0)
      table.timestamp('created_at').defaultTo(knex.fn.now())
      table.timestamp('completed_at').nullable()

      table.foreign('chunk_id').references('semantic_chunks.id').onDelete('CASCADE')
    })

    // Create index separately
    await knex.schema.raw('CREATE INDEX IF NOT EXISTS embedding_jobs_status_index ON embedding_jobs(status)')
  }

  console.log('✅ 语义层表创建成功')
}

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('embedding_jobs')
  await knex.schema.dropTableIfExists('semantic_chunks')
}
