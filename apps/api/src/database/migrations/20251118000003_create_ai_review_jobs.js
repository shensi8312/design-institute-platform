exports.up = function(knex) {
  return knex.schema.createTable('ai_review_jobs', (table) => {
    table.string('id', 50).primary()
    table.string('document_id', 50).notNullable()
    table.string('project_id', 50)
    table.string('status', 20).notNullable().defaultTo('pending') // pending, processing, completed, failed
    table.text('result')
    table.text('error_message')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
    table.timestamp('completed_at')

    table.foreign('document_id').references('project_documents.id').onDelete('CASCADE')
    table.index('document_id')
    table.index('status')
    table.index('created_at')
  })
}

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('ai_review_jobs')
}
