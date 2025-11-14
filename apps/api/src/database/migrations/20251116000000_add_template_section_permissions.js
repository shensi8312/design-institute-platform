exports.up = async function(knex) {
  await knex.schema.alterTable('template_sections', (table) => {
    table.jsonb('editable_user_ids')
      .notNullable()
      .defaultTo(knex.raw(`'[]'::jsonb`))
      .comment('允许编辑该章节的用户ID列表，空数组表示所有人可编辑');
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('template_sections', (table) => {
    table.dropColumn('editable_user_ids');
  });
};
