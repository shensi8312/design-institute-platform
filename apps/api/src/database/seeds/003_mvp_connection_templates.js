/**
 * 连接模板种子数据 - 法兰螺栓连接 DN50 PN16
 */
exports.seed = async function(knex) {
  await knex('connection_templates').del()

  await knex('connection_templates').insert([
    // valve ↔ flange
    {
      template_id: 'VALVE_FLANGE_DN50',
      family_a: 'valve',
      family_b: 'flange',
      dn: 50,
      pn: 16,
      end_type: 'flanged',
      face_type: 'rf',
      join_rule: 'coaxial+plane_coincident',
      mate_schema: JSON.stringify({
        axis_align: true,
        angle_tol_deg: 0.5,
        gap_tol_mm: 0.1
      }),
      fasteners: JSON.stringify({
        bolt_count: 4,
        bolt_spec: 'M16',
        pcd_mm: 125,
        gasket: 'GASKET-DN50-RF'
      })
    },

    // flange ↔ valve
    {
      template_id: 'FLANGE_VALVE_DN50',
      family_a: 'flange',
      family_b: 'valve',
      dn: 50,
      pn: 16,
      end_type: 'flanged',
      face_type: 'rf',
      join_rule: 'coaxial+plane_coincident',
      mate_schema: JSON.stringify({
        axis_align: true,
        angle_tol_deg: 0.5,
        gap_tol_mm: 0.1
      }),
      fasteners: JSON.stringify({
        bolt_count: 4,
        bolt_spec: 'M16',
        pcd_mm: 125,
        gasket: 'GASKET-DN50-RF'
      })
    },

    // flange ↔ pipe
    {
      template_id: 'FLANGE_PIPE_DN50',
      family_a: 'flange',
      family_b: 'pipe',
      dn: 50,
      pn: 16,
      end_type: 'weld',
      join_rule: 'welded',
      mate_schema: JSON.stringify({
        axis_align: true,
        weld_type: 'butt',
        prep_angle_deg: 37.5
      }),
      fasteners: JSON.stringify({})
    },

    // pipe ↔ flange
    {
      template_id: 'PIPE_FLANGE_DN50',
      family_a: 'pipe',
      family_b: 'flange',
      dn: 50,
      pn: 16,
      end_type: 'weld',
      join_rule: 'welded',
      mate_schema: JSON.stringify({
        axis_align: true,
        weld_type: 'butt',
        prep_angle_deg: 37.5
      }),
      fasteners: JSON.stringify({})
    },

    // flange ↔ flange
    {
      template_id: 'FLANGE_FLANGE_DN50',
      family_a: 'flange',
      family_b: 'flange',
      dn: 50,
      pn: 16,
      end_type: 'flanged',
      face_type: 'rf',
      join_rule: 'coaxial+plane_coincident',
      mate_schema: JSON.stringify({
        axis_align: true,
        angle_tol_deg: 0.5,
        gap_tol_mm: 0.1
      }),
      fasteners: JSON.stringify({
        bolt_count: 4,
        bolt_spec: 'M16',
        pcd_mm: 125,
        gasket: 'GASKET-DN50-RF'
      })
    },

    // pipe ↔ pipe
    {
      template_id: 'PIPE_PIPE_DN50',
      family_a: 'pipe',
      family_b: 'pipe',
      dn: 50,
      pn: 16,
      end_type: 'weld',
      join_rule: 'welded',
      mate_schema: JSON.stringify({
        axis_align: true,
        weld_type: 'butt',
        prep_angle_deg: 37.5
      }),
      fasteners: JSON.stringify({})
    }
  ])
}
