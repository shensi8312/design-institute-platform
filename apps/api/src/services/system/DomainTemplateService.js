const db = require('../../config/database')

/**
 * 专业领域模板服务
 */
class DomainTemplateService {
  
  /**
   * 获取半导体领域配置
   */
  static getSemiconductorTemplate() {
    return {
      name: '半导体知识库模板',
      domain: 'semiconductor',
      description: '适用于半导体器件、工艺、设计等专业知识管理',
      
      // 半导体专业实体类型
      entity_types: [
        // 器件相关
        'SEMICONDUCTOR_DEVICE', 'TRANSISTOR', 'DIODE', 'IC_CHIP', 'WAFER',
        'PACKAGE', 'PIN', 'SUBSTRATE', 'DIE', 'BOND_WIRE',
        
        // 工艺相关
        'PROCESS_STEP', 'FABRICATION_PROCESS', 'LITHOGRAPHY', 'ETCHING',
        'DEPOSITION', 'IMPLANTATION', 'ANNEALING', 'CLEANING',
        
        // 材料相关
        'SEMICONDUCTOR_MATERIAL', 'SILICON', 'GAAS', 'SIGE', 'NITRIDE',
        'OXIDE', 'METAL', 'POLYMER', 'DOPANT',
        
        // 设备相关
        'EQUIPMENT', 'STEPPER', 'SCANNER', 'REACTOR', 'FURNACE',
        'MEASUREMENT_TOOL', 'TEST_EQUIPMENT',
        
        // 参数相关
        'ELECTRICAL_PARAMETER', 'PHYSICAL_PARAMETER', 'PROCESS_PARAMETER',
        'SPECIFICATION', 'TOLERANCE', 'YIELD', 'DEFECT',
        
        // 设计相关
        'CIRCUIT_DESIGN', 'LAYOUT', 'MASK', 'DESIGN_RULE', 'LIBRARY_CELL',
        
        // 标准和规范
        'INDUSTRY_STANDARD', 'DESIGN_RULE', 'TEST_METHOD', 'QUALIFICATION'
      ],
      
      // 半导体专业关系类型
      relation_types: [
        // 组成关系
        'CONTAINS', 'PART_OF', 'COMPOSED_OF', 'INCLUDES',
        
        // 工艺关系
        'PROCESSED_BY', 'FOLLOWS', 'PRECEDES', 'REQUIRES',
        'AFFECTS', 'CONTROLS', 'MONITORS',
        
        // 性能关系
        'DETERMINES', 'INFLUENCES', 'CORRELATES_WITH', 'LIMITS',
        'OPTIMIZES', 'DEGRADES',
        
        // 设计关系
        'DESIGNED_FOR', 'COMPATIBLE_WITH', 'IMPLEMENTS', 'VIOLATES',
        'COMPLIES_WITH', 'SPECIFIED_BY',
        
        // 测试和验证
        'TESTED_BY', 'MEASURED_BY', 'VERIFIED_BY', 'QUALIFIED_FOR',
        
        // 制造关系
        'MANUFACTURED_BY', 'FABRICATED_ON', 'ASSEMBLED_WITH',
        'PACKAGED_IN'
      ],
      
      // 文档类型配置
      document_types: [
        {
          type: 'datasheet',
          name: '器件数据手册',
          extensions: ['.pdf'],
          extraction_rules: ['electrical_specs', 'package_info', 'application_notes']
        },
        {
          type: 'process_spec',
          name: '工艺规范',
          extensions: ['.pdf', '.doc', '.docx'],
          extraction_rules: ['process_steps', 'parameters', 'equipment_requirements']
        },
        {
          type: 'design_manual',
          name: '设计手册',
          extensions: ['.pdf'],
          extraction_rules: ['design_rules', 'guidelines', 'examples']
        },
        {
          type: 'test_report',
          name: '测试报告',
          extensions: ['.pdf', '.xlsx'],
          extraction_rules: ['test_conditions', 'results', 'analysis']
        },
        {
          type: 'application_note',
          name: '应用说明',
          extensions: ['.pdf'],
          extraction_rules: ['use_cases', 'circuit_examples', 'recommendations']
        }
      ],
      
      // 分类体系
      classification_schema: {
        level1: [
          { code: 'SC01', name: '半导体器件', children: [
            { code: 'SC01A', name: '二极管' },
            { code: 'SC01B', name: '晶体管' },
            { code: 'SC01C', name: '集成电路' },
            { code: 'SC01D', name: '功率器件' },
            { code: 'SC01E', name: '光电器件' }
          ]},
          { code: 'SC02', name: '制造工艺', children: [
            { code: 'SC02A', name: '前道工艺' },
            { code: 'SC02B', name: '后道工艺' },
            { code: 'SC02C', name: '封装工艺' },
            { code: 'SC02D', name: '测试工艺' }
          ]},
          { code: 'SC03', name: '设计技术', children: [
            { code: 'SC03A', name: '模拟设计' },
            { code: 'SC03B', name: '数字设计' },
            { code: 'SC03C', name: '混合信号设计' },
            { code: 'SC03D', name: '射频设计' }
          ]},
          { code: 'SC04', name: '材料科学', children: [
            { code: 'SC04A', name: '硅材料' },
            { code: 'SC04B', name: '化合物半导体' },
            { code: 'SC04C', name: '新型材料' }
          ]},
          { code: 'SC05', name: '测试测量', children: [
            { code: 'SC05A', name: '电学测试' },
            { code: 'SC05B', name: '可靠性测试' },
            { code: 'SC05C', name: '失效分析' }
          ]}
        ]
      }
    }
  }
  
  /**
   * 获取机械设计领域配置
   */
  static getMechanicalTemplate() {
    return {
      name: '机械设计知识库模板',
      domain: 'mechanical',
      description: '适用于机械设计、制造工艺、材料等专业知识管理',
      
      entity_types: [
        // 机械部件
        'MECHANICAL_PART', 'ASSEMBLY', 'SUBASSEMBLY', 'COMPONENT',
        'FASTENER', 'BEARING', 'GEAR', 'SHAFT', 'SPRING',
        
        // 材料相关
        'MATERIAL', 'METAL', 'PLASTIC', 'COMPOSITE', 'CERAMIC',
        'COATING', 'SURFACE_TREATMENT',
        
        // 加工工艺
        'MACHINING_PROCESS', 'CASTING', 'FORGING', 'WELDING',
        'ASSEMBLY_PROCESS', 'FINISHING',
        
        // 设计参数
        'DIMENSION', 'TOLERANCE', 'SURFACE_ROUGHNESS', 'STRENGTH',
        'LOAD', 'STRESS', 'DEFLECTION', 'FATIGUE_LIFE',
        
        // 设备和工具
        'MACHINE_TOOL', 'FIXTURE', 'CUTTING_TOOL', 'MEASURING_INSTRUMENT',
        
        // 标准规范
        'DESIGN_STANDARD', 'MATERIAL_STANDARD', 'PROCESS_STANDARD',
        'SAFETY_STANDARD', 'QUALITY_STANDARD'
      ],
      
      relation_types: [
        'ASSEMBLED_WITH', 'CONNECTED_TO', 'SUPPORTS', 'CONSTRAINTS',
        'MACHINED_BY', 'MADE_OF', 'HEAT_TREATED', 'COATED_WITH',
        'SPECIFIED_BY', 'COMPLIES_WITH', 'TESTED_ACCORDING_TO',
        'LOADS', 'TRANSMITS_FORCE', 'ROTATES_WITH', 'SLIDES_ON'
      ],
      
      classification_schema: {
        level1: [
          { code: 'ME01', name: '机械零件', children: [
            { code: 'ME01A', name: '轴类零件' },
            { code: 'ME01B', name: '盘套类零件' },
            { code: 'ME01C', name: '叉架类零件' },
            { code: 'ME01D', name: '箱体类零件' }
          ]},
          { code: 'ME02', name: '标准件', children: [
            { code: 'ME02A', name: '螺纹紧固件' },
            { code: 'ME02B', name: '键连接' },
            { code: 'ME02C', name: '轴承' },
            { code: 'ME02D', name: '密封件' }
          ]},
          { code: 'ME03', name: '传动机构', children: [
            { code: 'ME03A', name: '齿轮传动' },
            { code: 'ME03B', name: '带传动' },
            { code: 'ME03C', name: '链传动' },
            { code: 'ME03D', name: '蜗杆传动' }
          ]}
        ]
      }
    }
  }
  
  /**
   * 获取文献管理配置
   */
  static getLiteratureTemplate() {
    return {
      name: '文献管理模板',
      domain: 'literature',
      description: '适用于学术文献、技术报告等文献资料管理',
      
      entity_types: [
        'AUTHOR', 'INSTITUTION', 'JOURNAL', 'CONFERENCE',
        'RESEARCH_TOPIC', 'METHODOLOGY', 'DATASET', 'ALGORITHM',
        'THEORY', 'EXPERIMENT', 'RESULT', 'CONCLUSION',
        'CITATION', 'REFERENCE', 'KEYWORD', 'ABSTRACT'
      ],
      
      relation_types: [
        'AUTHORED_BY', 'AFFILIATED_WITH', 'PUBLISHED_IN',
        'CITES', 'CITED_BY', 'BUILDS_ON', 'COMPARES_WITH',
        'VALIDATES', 'REFUTES', 'EXTENDS', 'APPLIES'
      ],
      
      classification_schema: {
        level1: [
          { code: 'LT01', name: '期刊论文' },
          { code: 'LT02', name: '会议论文' },
          { code: 'LT03', name: '学位论文' },
          { code: 'LT04', name: '技术报告' },
          { code: 'LT05', name: '专利文献' },
          { code: 'LT06', name: '白皮书' }
        ]
      }
    }
  }
  
  /**
   * 获取设计规范配置
   */
  static getStandardsTemplate() {
    return {
      name: '设计规范管理模板',
      domain: 'standards',
      description: '适用于设计规范、审图标准、行业标准等管理',
      
      entity_types: [
        'DESIGN_RULE', 'STANDARD_DOCUMENT', 'SPECIFICATION',
        'REQUIREMENT', 'CONSTRAINT', 'PARAMETER_LIMIT',
        'INSPECTION_ITEM', 'QUALITY_CRITERIA', 'ACCEPTANCE_CRITERIA',
        'REVIEW_CHECKLIST', 'COMPLIANCE_REQUIREMENT'
      ],
      
      relation_types: [
        'DEFINES', 'REQUIRES', 'RESTRICTS', 'ALLOWS',
        'SUPERSEDES', 'REFERENCES', 'IMPLEMENTS', 'COMPLIES_WITH',
        'VIOLATES', 'EXEMPTS_FROM', 'APPLICABLE_TO'
      ],
      
      classification_schema: {
        level1: [
          { code: 'ST01', name: '国家标准' },
          { code: 'ST02', name: '行业标准' },
          { code: 'ST03', name: '企业标准' },
          { code: 'ST04', name: '设计规范' },
          { code: 'ST05', name: '审图标准' },
          { code: 'ST06', name: '质量标准' }
        ]
      }
    }
  }
  
  /**
   * 初始化领域模板
   */
  static async initializeDomainTemplates() {
    const templates = [
      this.getSemiconductorTemplate(),
      this.getMechanicalTemplate(),
      this.getLiteratureTemplate(),
      this.getStandardsTemplate()
    ]
    
    for (const template of templates) {
      await db('domain_templates').insert({
        name: template.name,
        description: template.description,
        domain: template.domain,
        entity_types: JSON.stringify(template.entity_types),
        relation_types: JSON.stringify(template.relation_types),
        document_types: JSON.stringify(template.document_types || []),
        classification_schema: JSON.stringify(template.classification_schema),
        is_default: true
      }).onConflict('domain').merge()
      
      // 初始化分类数据
      if (template.classification_schema) {
        await this.initializeCategories(template.domain, template.classification_schema)
      }
    }
  }
  
  /**
   * 初始化知识分类
   */
  static async initializeCategories(domain, schema) {
    for (const level1 of schema.level1) {
      const [parentId] = await db('knowledge_categories').insert({
        name: level1.name,
        code: level1.code,
        domain,
        sort_order: 0
      }).returning('id').onConflict('code').ignore()
      
      if (level1.children && parentId) {
        for (let i = 0; i < level1.children.length; i++) {
          const child = level1.children[i]
          await db('knowledge_categories').insert({
            name: child.name,
            code: child.code,
            domain,
            parent_id: parentId,
            sort_order: i
          }).onConflict('code').ignore()
        }
      }
    }
  }
  
  /**
   * 获取领域模板
   */
  static async getDomainTemplate(domain) {
    return await db('domain_templates')
      .where('domain', domain)
      .where('is_default', true)
      .first()
  }
  
  /**
   * 获取领域分类树
   */
  static async getDomainCategories(domain) {
    const categories = await db('knowledge_categories')
      .where('domain', domain)
      .orderBy('sort_order')
    
    // 构建树形结构
    const categoryMap = new Map()
    const roots = []
    
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] })
    })
    
    categories.forEach(cat => {
      const node = categoryMap.get(cat.id)
      if (cat.parent_id) {
        const parent = categoryMap.get(cat.parent_id)
        if (parent) {
          parent.children.push(node)
        }
      } else {
        roots.push(node)
      }
    })
    
    return roots
  }
}

module.exports = DomainTemplateService