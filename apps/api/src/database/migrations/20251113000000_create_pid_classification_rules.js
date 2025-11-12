/**
 * PID组件分类规则
 */
exports.up = async function(knex) {
  // 创建PID规则类别
  const pidCategoryExists = await knex('rule_categories').where('id', 'pid_classification').first();
  if (!pidCategoryExists) {
    await knex('rule_categories').insert({
      id: 'pid_classification',
      name: 'PID组件分类规则',
      code: 'PID_CLASS',
      level: 'enterprise',
      sort_order: 5,
      description: 'PID图纸中组件的自动分类规则（设备/接口/介质/规格）',
      is_active: true
    });
  }

  // 插入PID分类规则
  const rules = [
    {
      category_id: 'pid_classification',
      rule_code: 'PID_CLASS_DEVICE_BY_LEGEND',
      rule_name: 'PID设备识别-基于图例',
      rule_content: '根据图例中定义的符号类型，识别设备组件',
      rule_structure: {
        category: 'device',
        method: 'legend_match',
        priority: 1,
        description: '如果tag与图例中的设备类型匹配（如CV、RG、MFC、PT、V、F、NV），则分类为设备'
      },
      extraction_method: 'manual',
      confidence_score: 0.95,
      review_status: 'approved',
      priority: 'high',
      applicable_scope: '所有PID图纸',
      is_active: true
    },
    {
      category_id: 'pid_classification',
      rule_code: 'PID_CLASS_MEDIUM_EXACT',
      rule_name: 'PID介质识别-精确匹配',
      rule_content: '识别常见气体介质名称',
      rule_structure: {
        category: 'medium',
        method: 'exact_match',
        priority: 2,
        values: ['Ar', 'N2', 'H2', 'He', 'O2', 'NH3', 'CO2', 'Air', 'H2+He', 'Ar-P', 'N2+H2'],
        description: '精确匹配常见气体介质名称'
      },
      extraction_method: 'manual',
      confidence_score: 0.98,
      review_status: 'approved',
      priority: 'high',
      applicable_scope: '所有PID图纸',
      is_active: true
    },
    {
      category_id: 'pid_classification',
      rule_code: 'PID_CLASS_MEDIUM_PATTERN',
      rule_name: 'PID介质识别-模式匹配',
      rule_content: '通过正则表达式识别气体介质（如N2、Ar等）',
      rule_structure: {
        category: 'medium',
        method: 'regex',
        priority: 3,
        pattern: '^[A-Z][a-z]?[0-9]*(\\+[A-Z][a-z]?[0-9]*)*(-P)?$',
        description: '匹配化学式格式的介质名称（如N2、Ar、H2+He、Ar-P）'
      },
      extraction_method: 'manual',
      confidence_score: 0.90,
      review_status: 'approved',
      priority: 'normal',
      applicable_scope: '所有PID图纸',
      is_active: true
    },
    {
      category_id: 'pid_classification',
      rule_code: 'PID_CLASS_SPEC_PRESSURE',
      rule_name: 'PID规格识别-压力范围',
      rule_content: '识别压力规格标注（含PSIG/Torr单位）',
      rule_structure: {
        category: 'spec',
        method: 'regex',
        priority: 4,
        pattern: '(\\d+\\.?\\d*\\s*~?\\s*\\d*\\.?\\d*\\s*)?(PSIG|Torr|PSI|kPa|MPa|Bar|<\\d+)',
        description: '匹配压力规格，如 "0~60 PSIG"、"<700Torr"、"-15~100PSIG"'
      },
      extraction_method: 'manual',
      confidence_score: 0.92,
      review_status: 'approved',
      priority: 'normal',
      applicable_scope: '所有PID图纸',
      is_active: true
    },
    {
      category_id: 'pid_classification',
      rule_code: 'PID_CLASS_SPEC_FLOW',
      rule_name: 'PID规格识别-流量范围',
      rule_content: '识别流量规格标注（含SCCM/SLPM单位）',
      rule_structure: {
        category: 'spec',
        method: 'regex',
        priority: 5,
        pattern: '\\d+\\s*(SCCM|SLPM|LPM|CFM|L/min)',
        description: '匹配流量规格，如 "MFC3 2000 SCCM"、"500 SLPM"'
      },
      extraction_method: 'manual',
      confidence_score: 0.92,
      review_status: 'approved',
      priority: 'normal',
      applicable_scope: '所有PID图纸',
      is_active: true
    },
    {
      category_id: 'pid_classification',
      rule_code: 'PID_CLASS_SPEC_PIPE',
      rule_name: 'PID规格识别-管道尺寸',
      rule_content: '识别管道尺寸标注（英寸/毫米）',
      rule_structure: {
        category: 'spec',
        method: 'regex',
        priority: 6,
        pattern: '^\\d+/\\d+"?$|^\\d+"$|^DN\\d+$|^φ\\d+$',
        description: '匹配管道规格，如 "1/4\\""、"DN50"、"φ25"'
      },
      extraction_method: 'manual',
      confidence_score: 0.95,
      review_status: 'approved',
      priority: 'normal',
      applicable_scope: '所有PID图纸',
      is_active: true
    },
    {
      category_id: 'pid_classification',
      rule_code: 'PID_CLASS_SPEC_DESCRIPTION',
      rule_name: 'PID规格识别-设备描述',
      rule_content: '识别设备规格描述文本',
      rule_structure: {
        category: 'spec',
        method: 'keyword',
        priority: 7,
        keywords: ['ADJUSTABLE', 'REGULATOR', 'PRESSURE', 'FLOW', 'CONTROLLER', 'GAUGE'],
        min_keywords: 2,
        description: '包含多个设备描述关键词的文本标注为规格说明'
      },
      extraction_method: 'manual',
      confidence_score: 0.85,
      review_status: 'approved',
      priority: 'normal',
      applicable_scope: '所有PID图纸',
      is_active: true
    },
    {
      category_id: 'pid_classification',
      rule_code: 'PID_CLASS_INTERFACE_PATTERN',
      rule_name: 'PID接口识别-方向关键词',
      rule_content: '识别接口连接标注',
      rule_structure: {
        category: 'interface',
        method: 'regex',
        priority: 8,
        pattern: '^(TO|FROM|BTM)\\s+',
        description: '匹配接口标注，如 "TO VAC1"、"FROM PUMP"、"BTM / Vent"'
      },
      extraction_method: 'manual',
      confidence_score: 0.95,
      review_status: 'approved',
      priority: 'high',
      applicable_scope: '所有PID图纸',
      is_active: true
    }
  ];

  await knex('design_rules').insert(rules);

  console.log('✓ PID分类规则创建完成');
};

exports.down = async function(knex) {
  await knex('design_rules').where('category_id', 'pid_classification').delete();
  await knex('rule_categories').where('id', 'pid_classification').delete();
};
