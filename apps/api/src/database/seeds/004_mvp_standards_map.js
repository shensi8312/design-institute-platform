/**
 * 标准映射种子数据
 */
exports.seed = async function(knex) {
  await knex('standards_map').del()

  await knex('standards_map').insert([
    {
      line_class: 'LC-A1',
      defaults: JSON.stringify({
        std: 'ASME B16.5',
        face_type: 'rf',
        mat: 'A105',
        pressure_class: 150,
        temp_rating: 'up_to_400F'
      }),
      project_id: null
    },
    {
      line_class: 'LC-A2',
      defaults: JSON.stringify({
        std: 'ASME B16.5',
        face_type: 'rf',
        mat: '316L',
        pressure_class: 300,
        temp_rating: 'up_to_600F'
      }),
      project_id: null
    },
    {
      line_class: 'DEFAULT',
      defaults: JSON.stringify({
        std: 'ASME B16.5',
        face_type: 'rf',
        mat: 'WCB',
        pressure_class: 150
      }),
      project_id: null
    }
  ])
}
