exports.up = function(knex) {
  return knex.schema
    .createTable('document_processing_jobs', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('document_id', 255).notNullable().references('id').inTable('knowledge_documents').onDelete('CASCADE')
      table.string('job_type', 50).notNullable() // 'parse', 'vectorization', 'graph_extraction'
      table.string('status', 20).notNullable().defaultTo('pending') // 'pending', 'active', 'completed', 'failed', 'paused'
      table.integer('priority').defaultTo(0)
      table.integer('attempts').defaultTo(0)
      table.integer('max_attempts').defaultTo(3)
      table.jsonb('data').defaultTo('{}')
      table.jsonb('error').nullable()
      table.timestamp('started_at').nullable()
      table.timestamp('completed_at').nullable()
      table.timestamp('failed_at').nullable()
      table.timestamp('created_at').defaultTo(knex.fn.now())
      table.timestamp('updated_at').defaultTo(knex.fn.now())

      table.index(['document_id'])
      table.index(['status'])
      table.index(['job_type'])
      table.index(['created_at'])
    })
    .createTable('document_processing_progress', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('document_id', 255).notNullable().references('id').inTable('knowledge_documents').onDelete('CASCADE')
      table.string('stage', 50).notNullable() // 'parsing', 'vectorization', 'graph_extraction'
      table.integer('current_page').defaultTo(0)
      table.integer('total_pages').defaultTo(0)
      table.integer('current_chunk').defaultTo(0)
      table.integer('total_chunks').defaultTo(0)
      table.float('progress_percentage').defaultTo(0)
      table.jsonb('metadata').defaultTo('{}')
      table.timestamp('last_checkpoint_at').defaultTo(knex.fn.now())
      table.timestamp('created_at').defaultTo(knex.fn.now())
      table.timestamp('updated_at').defaultTo(knex.fn.now())

      table.unique(['document_id', 'stage'])
      table.index(['document_id'])
    })
    .createTable('pdf_page_ocr_cache', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.string('document_id', 255).notNullable().references('id').inTable('knowledge_documents').onDelete('CASCADE')
      table.integer('page_number').notNullable()
      table.text('ocr_text').notNullable()
      table.string('ocr_method', 50).notNullable() // 'deepseek-ocr', 'paddleocr', etc.
      table.integer('processing_time_ms').nullable()
      table.jsonb('metadata').defaultTo('{}')
      table.timestamp('created_at').defaultTo(knex.fn.now())

      table.unique(['document_id', 'page_number', 'ocr_method'])
      table.index(['document_id'])
    })
}

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('pdf_page_ocr_cache')
    .dropTableIfExists('document_processing_progress')
    .dropTableIfExists('document_processing_jobs')
}
