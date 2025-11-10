/**
 * MVP种子数据：零件端口（ports显式化）
 */
exports.seed = async function(knex) {
  await knex('part_ports').del()

  await knex('part_ports').insert([
    // 法兰端口（DN25）
    {
      part_id: 'FLANGE-DN25-PN16-RF',
      port_id: 'PORT-1',
      port_type: 'bore',
      axis: JSON.stringify([0, 0, 1]),      // Z轴正向
      origin: JSON.stringify([0, 0, 0]),
      dn: 25,
      face_type: 'rf',
      meta: JSON.stringify({ bore_diameter: 27, pcd: 85 })
    },
    {
      part_id: 'FLANGE-DN25-PN16-RF',
      port_id: 'PORT-2',
      port_type: 'face',
      axis: JSON.stringify([0, 0, 1]),
      origin: JSON.stringify([0, 0, 10]),   // 法兰厚度10mm
      dn: 25,
      face_type: 'rf',
      meta: JSON.stringify({ face_diameter: 60 })
    },

    // 法兰端口（DN40）
    {
      part_id: 'FLANGE-DN40-PN16-RF',
      port_id: 'PORT-1',
      port_type: 'bore',
      axis: JSON.stringify([0, 0, 1]),
      origin: JSON.stringify([0, 0, 0]),
      dn: 40,
      face_type: 'rf',
      meta: JSON.stringify({ bore_diameter: 43, pcd: 110 })
    },
    {
      part_id: 'FLANGE-DN40-PN16-RF',
      port_id: 'PORT-2',
      port_type: 'face',
      axis: JSON.stringify([0, 0, 1]),
      origin: JSON.stringify([0, 0, 12]),
      dn: 40,
      face_type: 'rf',
      meta: JSON.stringify({ face_diameter: 75 })
    },

    // 法兰端口（DN50）
    {
      part_id: 'FLANGE-DN50-PN16-RF',
      port_id: 'PORT-1',
      port_type: 'bore',
      axis: JSON.stringify([0, 0, 1]),
      origin: JSON.stringify([0, 0, 0]),
      dn: 50,
      face_type: 'rf',
      meta: JSON.stringify({ bore_diameter: 53, pcd: 125 })
    },
    {
      part_id: 'FLANGE-DN50-PN16-RF',
      port_id: 'PORT-2',
      port_type: 'face',
      axis: JSON.stringify([0, 0, 1]),
      origin: JSON.stringify([0, 0, 14]),
      dn: 50,
      face_type: 'rf',
      meta: JSON.stringify({ face_diameter: 90 })
    },

    // 法兰端口（DN80）
    {
      part_id: 'FLANGE-DN80-PN16-RF',
      port_id: 'PORT-1',
      port_type: 'bore',
      axis: JSON.stringify([0, 0, 1]),
      origin: JSON.stringify([0, 0, 0]),
      dn: 80,
      face_type: 'rf',
      meta: JSON.stringify({ bore_diameter: 82, pcd: 160 })
    },
    {
      part_id: 'FLANGE-DN80-PN16-RF',
      port_id: 'PORT-2',
      port_type: 'face',
      axis: JSON.stringify([0, 0, 1]),
      origin: JSON.stringify([0, 0, 16]),
      dn: 80,
      face_type: 'rf',
      meta: JSON.stringify({ face_diameter: 125 })
    },

    // 阀门端口（DN25）- 球阀两端
    {
      part_id: 'VALVE-BALL-DN25-PN16',
      port_id: 'INLET',
      port_type: 'bore',
      axis: JSON.stringify([0, 0, 1]),
      origin: JSON.stringify([0, 0, 0]),
      dn: 25,
      face_type: 'rf',
      meta: JSON.stringify({ connection_type: 'flanged' })
    },
    {
      part_id: 'VALVE-BALL-DN25-PN16',
      port_id: 'OUTLET',
      port_type: 'bore',
      axis: JSON.stringify([0, 0, -1]),     // 反向
      origin: JSON.stringify([0, 0, 120]),  // 阀门长度120mm
      dn: 25,
      face_type: 'rf',
      meta: JSON.stringify({ connection_type: 'flanged' })
    },

    // 阀门端口（DN50）- 球阀两端
    {
      part_id: 'VALVE-BALL-DN50-PN16',
      port_id: 'INLET',
      port_type: 'bore',
      axis: JSON.stringify([0, 0, 1]),
      origin: JSON.stringify([0, 0, 0]),
      dn: 50,
      face_type: 'rf',
      meta: JSON.stringify({ connection_type: 'flanged' })
    },
    {
      part_id: 'VALVE-BALL-DN50-PN16',
      port_id: 'OUTLET',
      port_type: 'bore',
      axis: JSON.stringify([0, 0, -1]),
      origin: JSON.stringify([0, 0, 180]),
      dn: 50,
      face_type: 'rf',
      meta: JSON.stringify({ connection_type: 'flanged' })
    },

    // 阀门端口（DN80）- 闸阀两端
    {
      part_id: 'VALVE-GATE-DN80-PN16',
      port_id: 'INLET',
      port_type: 'bore',
      axis: JSON.stringify([0, 0, 1]),
      origin: JSON.stringify([0, 0, 0]),
      dn: 80,
      face_type: 'rf',
      meta: JSON.stringify({ connection_type: 'flanged' })
    },
    {
      part_id: 'VALVE-GATE-DN80-PN16',
      port_id: 'OUTLET',
      port_type: 'bore',
      axis: JSON.stringify([0, 0, -1]),
      origin: JSON.stringify([0, 0, 250]),
      dn: 80,
      face_type: 'rf',
      meta: JSON.stringify({ connection_type: 'flanged' })
    },

    // 直管端口（DN25）
    {
      part_id: 'PIPE-DN25-SCH40',
      port_id: 'END-1',
      port_type: 'bore',
      axis: JSON.stringify([0, 0, 1]),
      origin: JSON.stringify([0, 0, 0]),
      dn: 25,
      meta: JSON.stringify({ connection_type: 'weld', od: 33.7, wall: 3.4 })
    },
    {
      part_id: 'PIPE-DN25-SCH40',
      port_id: 'END-2',
      port_type: 'bore',
      axis: JSON.stringify([0, 0, -1]),
      origin: JSON.stringify([0, 0, 6000]),  // 6米标准管
      dn: 25,
      meta: JSON.stringify({ connection_type: 'weld', od: 33.7, wall: 3.4 })
    },

    // 直管端口（DN50）
    {
      part_id: 'PIPE-DN50-SCH40',
      port_id: 'END-1',
      port_type: 'bore',
      axis: JSON.stringify([0, 0, 1]),
      origin: JSON.stringify([0, 0, 0]),
      dn: 50,
      meta: JSON.stringify({ connection_type: 'weld', od: 60.3, wall: 3.9 })
    },
    {
      part_id: 'PIPE-DN50-SCH40',
      port_id: 'END-2',
      port_type: 'bore',
      axis: JSON.stringify([0, 0, -1]),
      origin: JSON.stringify([0, 0, 6000]),
      dn: 50,
      meta: JSON.stringify({ connection_type: 'weld', od: 60.3, wall: 3.9 })
    }
  ])
}
