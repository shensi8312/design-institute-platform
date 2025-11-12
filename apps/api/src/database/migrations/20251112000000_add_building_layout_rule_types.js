/**
 * 添加建筑强排规则类型
 * 扩展现有 design_rules 系统，支持：
 * - 红线退距规则 (layout_setback)
 * - 面积推导规则 (layout_area)
 * - 能耗公式规则 (layout_um)
 * - 合规检查规则 (layout_compliance)
 */

exports.up = async function(knex) {
  console.log('🏗️  添加建筑强排规则类型...')

  // 1. 添加新的规则分类
  await knex('rule_categories').insert([
    {
      id: 'layout_setback',
      name: '红线退距规则',
      code: 'SETBACK',
      level: 'national',
      sort_order: 10,
      description: '建筑与用地红线、道路、河流等的退距要求'
    },
    {
      id: 'layout_area',
      name: '面积推导规则',
      code: 'AREA',
      level: 'enterprise',
      sort_order: 11,
      description: '基于工艺参数自动推导各功能区面积'
    },
    {
      id: 'layout_um',
      name: '能耗公式规则',
      code: 'UM',
      level: 'enterprise',
      sort_order: 12,
      description: '冷热电气水等能耗计算公式'
    },
    {
      id: 'layout_compliance',
      name: '合规检查规则',
      code: 'COMPLIANCE',
      level: 'national',
      sort_order: 13,
      description: '建筑规范、消防、结构限制等合规检查'
    }
  ])

  console.log('✅ 规则分类添加完成')

  // 2. 插入示例规则
  await knex('design_rules').insert([
    {
      id: knex.raw('gen_random_uuid()::text'),
      category_id: 'layout_setback',
      rule_code: 'SETBACK-EXPRESSWAY-001',
      rule_name: '高速公路红线退距',
      rule_content: '建筑物与高速公路红线的最小退距为50米，建筑高度超过24米时增加10米',
      rule_type: 'building',
      rule_structure: JSON.stringify({
        meta: {
          rule_type: 'layout_setback',
          version: '1.0',
          author: 'system',
          created_at: '2025-11-12'
        },
        scope: {
          boundary_type: 'expressway',
          building_types: ['fab', 'warehouse', 'office'],
          regions: ['全国']
        },
        rule: {
          base_distance: 50,
          unit: 'meters',
          conditions: [
            {
              condition_type: 'building_height',
              operator: '>',
              threshold: 24,
              adjustment: 10
            }
          ]
        },
        evaluation: {
          formula: 'base_distance + (building_height > 24 ? 10 : 0)',
          result_unit: 'meters'
        }
      }),
      parameters: JSON.stringify({
        base_distance: 50,
        height_threshold: 24,
        additional_distance: 10
      }),
      extraction_method: 'manual',
      learned_from: 'manual',
      review_status: 'approved',
      confidence_score: 1.0,
      priority: 'high',
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()::text'),
      category_id: 'layout_setback',
      rule_code: 'SETBACK-MAINROAD-001',
      rule_name: '主干道红线退距',
      rule_content: '建筑物与主干道红线的最小退距为30米',
      rule_type: 'building',
      rule_structure: JSON.stringify({
        meta: {
          rule_type: 'layout_setback',
          version: '1.0',
          author: 'system'
        },
        scope: {
          boundary_type: 'main_road',
          building_types: ['fab', 'warehouse', 'office']
        },
        rule: {
          base_distance: 30,
          unit: 'meters',
          conditions: []
        },
        evaluation: {
          formula: 'base_distance',
          result_unit: 'meters'
        }
      }),
      parameters: JSON.stringify({
        base_distance: 30
      }),
      extraction_method: 'manual',
      learned_from: 'manual',
      review_status: 'approved',
      confidence_score: 1.0,
      priority: 'high',
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()::text'),
      category_id: 'layout_area',
      rule_code: 'AREA-FAB-CLEANROOM-001',
      rule_name: 'Fab洁净室面积推导',
      rule_content: '洁净室面积 = 月产能(片) × 2.5 + 基础面积1000平米',
      rule_type: 'building',
      rule_structure: JSON.stringify({
        meta: {
          rule_type: 'layout_area',
          version: '1.0',
          facility_type: 'fab',
          author: 'system'
        },
        scope: {
          process_type: 'semiconductor_fab',
          technology_node: ['28nm', '14nm', '7nm']
        },
        rule: {
          target_area: 'cleanroom',
          dependencies: ['chips_per_month'],
          formula: {
            expression: 'chips_per_month * 2.5 + 1000',
            coefficients: {
              per_chip_area: 2.5,
              base_area: 1000
            }
          },
          constraints: {
            min_area: 500,
            max_area: 50000,
            multiple_of: 100
          }
        },
        evaluation: {
          formula: 'chips_per_month * 2.5 + 1000',
          result_unit: 'square_meters'
        }
      }),
      parameters: JSON.stringify({
        coefficient: 2.5,
        base_area: 1000,
        min_area: 500,
        max_area: 50000
      }),
      extraction_method: 'ai_learning',
      learned_from: 'ai_learning',
      review_status: 'approved',
      confidence_score: 0.92,
      priority: 'high',
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()::text'),
      category_id: 'layout_area',
      rule_code: 'AREA-FAB-OFFICE-001',
      rule_name: 'Fab办公区面积推导',
      rule_content: '办公区面积 = 洁净室面积 × 0.3',
      rule_type: 'building',
      rule_structure: JSON.stringify({
        meta: {
          rule_type: 'layout_area',
          version: '1.0',
          facility_type: 'fab'
        },
        scope: {
          process_type: 'semiconductor_fab'
        },
        rule: {
          target_area: 'office',
          dependencies: ['cleanroom_area'],
          formula: {
            expression: 'cleanroom_area * 0.3',
            coefficients: {
              ratio: 0.3
            }
          },
          constraints: {
            min_area: 200,
            max_area: 10000
          }
        },
        evaluation: {
          formula: 'cleanroom_area * 0.3',
          result_unit: 'square_meters'
        }
      }),
      parameters: JSON.stringify({
        ratio: 0.3,
        min_area: 200,
        max_area: 10000
      }),
      extraction_method: 'ai_learning',
      learned_from: 'ai_learning',
      review_status: 'approved',
      confidence_score: 0.88,
      priority: 'normal',
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()::text'),
      category_id: 'layout_area',
      rule_code: 'AREA-FAB-WAREHOUSE-001',
      rule_name: 'Fab仓库面积推导',
      rule_content: '仓库面积 = 洁净室面积 × 0.15',
      rule_type: 'building',
      rule_structure: JSON.stringify({
        meta: {
          rule_type: 'layout_area',
          version: '1.0',
          facility_type: 'fab'
        },
        scope: {
          process_type: 'semiconductor_fab'
        },
        rule: {
          target_area: 'warehouse',
          dependencies: ['cleanroom_area'],
          formula: {
            expression: 'cleanroom_area * 0.15',
            coefficients: {
              ratio: 0.15
            }
          },
          constraints: {
            min_area: 100,
            max_area: 5000
          }
        },
        evaluation: {
          formula: 'cleanroom_area * 0.15',
          result_unit: 'square_meters'
        }
      }),
      parameters: JSON.stringify({
        ratio: 0.15,
        min_area: 100,
        max_area: 5000
      }),
      extraction_method: 'ai_learning',
      learned_from: 'ai_learning',
      review_status: 'approved',
      confidence_score: 0.85,
      priority: 'normal',
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()::text'),
      category_id: 'layout_um',
      rule_code: 'UM-POWER-FAB-001',
      rule_name: 'Fab电力负荷计算',
      rule_content: '总电力负荷 = 洁净室面积×800W/m² + 办公区×50W/m² + 仓库×30W/m²，冗余系数1.2',
      rule_type: 'building',
      rule_structure: JSON.stringify({
        meta: {
          rule_type: 'layout_um',
          version: '1.0',
          utility_type: 'power',
          author: 'system'
        },
        scope: {
          facility_type: 'fab'
        },
        rule: {
          target_utility: 'power_consumption',
          dependencies: ['cleanroom_area', 'office_area', 'warehouse_area'],
          formula: {
            expression: '(cleanroom_area * 800 + office_area * 50 + warehouse_area * 30) * 1.2',
            coefficients: {
              cleanroom_coef: 800,
              office_coef: 50,
              warehouse_coef: 30,
              redundancy_factor: 1.2
            }
          }
        },
        evaluation: {
          formula: '(cleanroom_area * 800 + office_area * 50 + warehouse_area * 30) * 1.2',
          result_unit: 'watts'
        }
      }),
      parameters: JSON.stringify({
        cleanroom_power_density: 800,
        office_power_density: 50,
        warehouse_power_density: 30,
        redundancy_factor: 1.2
      }),
      extraction_method: 'manual',
      learned_from: 'manual',
      review_status: 'approved',
      confidence_score: 1.0,
      priority: 'high',
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()::text'),
      category_id: 'layout_um',
      rule_code: 'UM-COOLING-FAB-001',
      rule_name: 'Fab冷量需求计算',
      rule_content: '总冷量需求 = 洁净室面积×500W/m² + 办公区×100W/m²，冗余系数1.15',
      rule_type: 'building',
      rule_structure: JSON.stringify({
        meta: {
          rule_type: 'layout_um',
          version: '1.0',
          utility_type: 'cooling'
        },
        scope: {
          facility_type: 'fab'
        },
        rule: {
          target_utility: 'cooling_load',
          dependencies: ['cleanroom_area', 'office_area'],
          formula: {
            expression: '(cleanroom_area * 500 + office_area * 100) * 1.15',
            coefficients: {
              cleanroom_coef: 500,
              office_coef: 100,
              redundancy_factor: 1.15
            }
          }
        },
        evaluation: {
          formula: '(cleanroom_area * 500 + office_area * 100) * 1.15',
          result_unit: 'watts'
        }
      }),
      parameters: JSON.stringify({
        cleanroom_cooling_density: 500,
        office_cooling_density: 100,
        redundancy_factor: 1.15
      }),
      extraction_method: 'manual',
      learned_from: 'manual',
      review_status: 'approved',
      confidence_score: 1.0,
      priority: 'high',
      is_active: true
    },
    {
      id: knex.raw('gen_random_uuid()::text'),
      category_id: 'layout_compliance',
      rule_code: 'COMPLIANCE-FIRE-SPACING-001',
      rule_name: '建筑防火间距检查',
      rule_content: 'GB50016-2014: 高层建筑防火间距不小于13米，多层建筑不小于10米',
      rule_type: 'building',
      rule_structure: JSON.stringify({
        meta: {
          rule_type: 'layout_compliance',
          version: '1.0',
          standard_code: 'GB50016-2014',
          standard_name: '建筑设计防火规范',
          section: '5.2.2'
        },
        scope: {
          building_types: ['fab', 'warehouse', 'office'],
          check_type: 'fire_safety'
        },
        rule: {
          check_items: [
            {
              item: 'building_spacing',
              description: '建筑防火间距',
              conditions: [
                {
                  if: 'building_height <= 24 && fire_resistance_rating >= 2',
                  then: 'spacing >= 10',
                  requirement: '多层建筑间距≥10米'
                },
                {
                  if: 'building_height > 24',
                  then: 'spacing >= 13',
                  requirement: '高层建筑间距≥13米'
                }
              ]
            }
          ]
        },
        evaluation: {
          type: 'boolean',
          all_must_pass: true
        }
      }),
      parameters: JSON.stringify({
        multilevel_spacing: 10,
        highlevel_spacing: 13,
        height_threshold: 24
      }),
      extraction_method: 'manual',
      learned_from: 'manual',
      review_status: 'approved',
      confidence_score: 1.0,
      priority: 'critical',
      is_active: true
    }
  ])

  console.log('✅ 建筑强排规则添加完成 (8条示例规则)')
  console.log('   - 2条退距规则')
  console.log('   - 3条面积推导规则')
  console.log('   - 2条能耗公式规则')
  console.log('   - 1条合规检查规则')
}

exports.down = async function(knex) {
  console.log('🔧 回滚建筑强排规则...')

  // 删除规则
  await knex('design_rules').whereIn('category_id', [
    'layout_setback',
    'layout_area',
    'layout_um',
    'layout_compliance'
  ]).del()

  // 删除分类
  await knex('rule_categories').whereIn('id', [
    'layout_setback',
    'layout_area',
    'layout_um',
    'layout_compliance'
  ]).del()

  console.log('✅ 回滚完成')
}
