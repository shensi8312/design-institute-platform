/**
 * MVP种子数据：零件目录 + 连接模板 + 标准映射
 */
exports.seed = async function(knex) {
  // 1. 零件目录
  await knex('parts_catalog').del()
  await knex('parts_catalog').insert([
    // 直管
    { part_id: 'PIPE-DN25-SCH40', family: 'pipe', dn: 25, pn: 16, end_type: 'weld', std: 'ASME B36.10', mat: '304', meta: JSON.stringify({ length: 6000, wall_thickness: 3.4 }) },
    { part_id: 'PIPE-DN40-SCH40', family: 'pipe', dn: 40, pn: 16, end_type: 'weld', std: 'ASME B36.10', mat: '304', meta: JSON.stringify({ length: 6000, wall_thickness: 3.7 }) },
    { part_id: 'PIPE-DN50-SCH40', family: 'pipe', dn: 50, pn: 16, end_type: 'weld', std: 'ASME B36.10', mat: '304', meta: JSON.stringify({ length: 6000, wall_thickness: 3.9 }) },
    { part_id: 'PIPE-DN80-SCH40', family: 'pipe', dn: 80, pn: 16, end_type: 'weld', std: 'ASME B36.10', mat: '304', meta: JSON.stringify({ length: 6000, wall_thickness: 5.5 }) },

    // 法兰
    { part_id: 'FLANGE-DN25-PN16-RF', family: 'flange', dn: 25, pn: 16, end_type: 'flanged', face_type: 'rf', std: 'ASME B16.5', mat: 'A105', meta: JSON.stringify({ pcd: 85, bolt_count: 4, bolt_spec: 'M12' }) },
    { part_id: 'FLANGE-DN40-PN16-RF', family: 'flange', dn: 40, pn: 16, end_type: 'flanged', face_type: 'rf', std: 'ASME B16.5', mat: 'A105', meta: JSON.stringify({ pcd: 110, bolt_count: 4, bolt_spec: 'M16' }) },
    { part_id: 'FLANGE-DN50-PN16-RF', family: 'flange', dn: 50, pn: 16, end_type: 'flanged', face_type: 'rf', std: 'ASME B16.5', mat: 'A105', meta: JSON.stringify({ pcd: 125, bolt_count: 4, bolt_spec: 'M16' }) },
    { part_id: 'FLANGE-DN80-PN16-RF', family: 'flange', dn: 80, pn: 16, end_type: 'flanged', face_type: 'rf', std: 'ASME B16.5', mat: 'A105', meta: JSON.stringify({ pcd: 160, bolt_count: 8, bolt_spec: 'M16' }) },

    // 阀门
    { part_id: 'VALVE-BALL-DN25-PN16', family: 'valve', dn: 25, pn: 16, end_type: 'flanged', std: 'API 6D', mat: '316', meta: JSON.stringify({ type: 'ball', length: 120, handle_height: 150 }) },
    { part_id: 'VALVE-BALL-DN50-PN16', family: 'valve', dn: 50, pn: 16, end_type: 'flanged', std: 'API 6D', mat: '316', meta: JSON.stringify({ type: 'ball', length: 180, handle_height: 200 }) },
    { part_id: 'VALVE-GATE-DN80-PN16', family: 'valve', dn: 80, pn: 16, end_type: 'flanged', std: 'API 600', mat: '316', meta: JSON.stringify({ type: 'gate', length: 250, handwheel_dia: 300 }) },

    // 垫片
    { part_id: 'GASKET-DN25-PN16-RF', family: 'gasket', dn: 25, pn: 16, face_type: 'rf', std: 'ASME B16.20', mat: 'Graphite', meta: JSON.stringify({ thickness: 1.5, id: 27, od: 60 }) },
    { part_id: 'GASKET-DN50-PN16-RF', family: 'gasket', dn: 50, pn: 16, face_type: 'rf', std: 'ASME B16.20', mat: 'Graphite', meta: JSON.stringify({ thickness: 1.5, id: 53, od: 90 }) },
    { part_id: 'GASKET-DN80-PN16-RF', family: 'gasket', dn: 80, pn: 16, face_type: 'rf', std: 'ASME B16.20', mat: 'Graphite', meta: JSON.stringify({ thickness: 1.5, id: 82, od: 125 }) },

    // 螺栓
    { part_id: 'BOLT-M12X50', family: 'bolt', std: 'GB/T 70.1', mat: 'B7', meta: JSON.stringify({ thread: 'M12x1.75', length: 50, head_type: 'hex' }) },
    { part_id: 'BOLT-M16X60', family: 'bolt', std: 'GB/T 70.1', mat: 'B7', meta: JSON.stringify({ thread: 'M16x2.0', length: 60, head_type: 'hex' }) }
  ])

  // 2. 连接模板
  await knex('connection_templates').del()
  await knex('connection_templates').insert([
    // 管-法兰
    {
      template_id: 'PIPE_FLANGE_DN50_PN16',
      family_a: 'pipe',
      family_b: 'flange',
      dn: 50,
      pn: 16,
      join_rule: 'coaxial+plane_coincident',
      mate_schema: JSON.stringify({ axis_align: true, angle_tol_deg: 2, gap_tol_mm: 0.1, face_offset_mm: 0 }),
      fasteners: JSON.stringify({ bolt_count: 4, bolt_spec: 'M16', pcd_mm: 125, gasket: true }),
      selector: JSON.stringify({ dn: 50, pn: 16 })
    },

    // 法兰-阀门
    {
      template_id: 'FLANGE_VALVE_DN50_PN16',
      family_a: 'flange',
      family_b: 'valve',
      dn: 50,
      pn: 16,
      join_rule: 'coaxial+plane_coincident',
      mate_schema: JSON.stringify({ axis_align: true, angle_tol_deg: 2, gap_tol_mm: 0.1, face_offset_mm: 0 }),
      fasteners: JSON.stringify({ bolt_count: 4, bolt_spec: 'M16', pcd_mm: 125, gasket: true }),
      selector: JSON.stringify({ dn: 50, pn: 16 })
    },

    // 法兰-法兰（通用参数化模板）
    {
      template_id: 'FLANGE_FLANGE_GENERIC',
      family_a: 'flange',
      family_b: 'flange',
      dn: null,  // 通用
      pn: null,
      join_rule: 'coaxial+plane_coincident',
      mate_schema: JSON.stringify({ axis_align: true, angle_tol_deg: 1, gap_tol_mm: 0.05, face_offset_mm: 0 }),
      fasteners: null,
      formula: JSON.stringify({
        pcd_mm: '85 + (dn-25)*1.5',
        bolt_count: 'dn<=50 ? 4 : 8',
        bolt_spec: 'dn<=40 ? "M12" : "M16"'
      }),
      selector: JSON.stringify({})
    }
  ])

  // 3. 标准映射
  await knex('standards_map').del()
  await knex('standards_map').insert([
    {
      line_class: 'LC-A1',
      defaults: JSON.stringify({ std: 'ASME B16.5', face_type: 'rf', mat: 'A105', unit_system: 'metric' })
    },
    {
      line_class: 'LC-B2',
      defaults: JSON.stringify({ std: 'GB/T 9119', face_type: 'ff', mat: 'Q235', unit_system: 'metric' })
    }
  ])
}
