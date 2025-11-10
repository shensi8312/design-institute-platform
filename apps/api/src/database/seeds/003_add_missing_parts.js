/**
 * 补充缺失的DN50零件
 */
exports.seed = async function(knex) {
  await knex('parts_catalog').insert([
    // DN50球阀
    {
      part_id: 'VALVE-BALL-DN50-PN16',
      family: 'valve',
      dn: 50,
      pn: 16,
      end_type: 'flanged',
      face_type: 'rf',
      std: 'ASME B16.34',
      mat: 'WCB',
      meta: JSON.stringify({
        length_mm: 180,
        weight_kg: 12.5,
        cv: 85,
        operator: 'manual'
      }),
      geom_fingerprint: JSON.stringify({ type: 'ball_valve', ports: 2 }),
      stock_qty: 20
    },

    // DN50直管
    {
      part_id: 'PIPE-DN50-SCH40',
      family: 'pipe',
      dn: 50,
      pn: 16,
      end_type: 'weld',
      std: 'ASME B36.10',
      mat: 'A106 Gr.B',
      meta: JSON.stringify({
        length_mm: 6000,
        od_mm: 60.3,
        wall_mm: 3.9
      }),
      geom_fingerprint: JSON.stringify({ type: 'straight_pipe' }),
      stock_qty: 100
    },

    // DN50闸阀
    {
      part_id: 'VALVE-GATE-DN50-PN16',
      family: 'valve',
      dn: 50,
      pn: 16,
      end_type: 'flanged',
      face_type: 'rf',
      std: 'ASME B16.34',
      mat: 'WCB',
      meta: JSON.stringify({
        length_mm: 230,
        weight_kg: 18,
        cv: 90
      }),
      geom_fingerprint: JSON.stringify({ type: 'gate_valve', ports: 2 }),
      stock_qty: 15
    },

    // DN50弯头90°
    {
      part_id: 'ELBOW-90-DN50-PN16',
      family: 'elbow',
      dn: 50,
      pn: 16,
      end_type: 'weld',
      std: 'ASME B16.9',
      mat: 'A234 WPB',
      meta: JSON.stringify({
        angle: 90,
        radius_mm: 76.2,  // 1.5D
        weight_kg: 1.2
      }),
      geom_fingerprint: JSON.stringify({ type: 'elbow', angle: 90 }),
      stock_qty: 50
    },

    // DN50三通
    {
      part_id: 'TEE-DN50-PN16',
      family: 'tee',
      dn: 50,
      pn: 16,
      end_type: 'weld',
      std: 'ASME B16.9',
      mat: 'A234 WPB',
      meta: JSON.stringify({
        type: 'equal',
        weight_kg: 2.8
      }),
      geom_fingerprint: JSON.stringify({ type: 'tee', ports: 3 }),
      stock_qty: 30
    }
  ])
}
