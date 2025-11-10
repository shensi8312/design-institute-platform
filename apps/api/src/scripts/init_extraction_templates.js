const db = require('../config/database')

/**
 * 初始化默认提取模板
 */
async function initExtractionTemplates() {
  console.log('=== 初始化提取模板 ===\n')

  const templates = [
    {
      name: '技术参数提取',
      description: '从技术规范文档中提取关键技术参数、数值、单位等',
      category: 'technical_parameters',
      priority: 10,
      prompt_template: `请从以下文本中提取所有技术参数，包括参数名称、数值、单位等信息。

文本内容：
{{TEXT}}

请以JSON格式返回，包含一个parameters数组，每个参数包含name（参数名）、value（数值）、unit（单位）、description（说明）字段。`,
      output_schema: {
        type: 'object',
        properties: {
          parameters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                value: { type: 'string' },
                unit: { type: 'string' },
                description: { type: 'string' }
              },
              required: ['name']
            }
          }
        },
        required: ['parameters']
      }
    },
    {
      name: '设计规则提取',
      description: '提取建筑设计规范、强制性条文、设计要求等',
      category: 'design_rules',
      priority: 9,
      prompt_template: `请从以下文本中提取所有设计规则和规范要求。

文本内容：
{{TEXT}}

请以JSON格式返回，包含一个rules数组，每个规则包含title（标题）、content（内容）、level（等级：强制/推荐）、category（分类）字段。`,
      output_schema: {
        type: 'object',
        properties: {
          rules: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                content: { type: 'string' },
                level: { type: 'string', enum: ['强制', '推荐', '参考'] },
                category: { type: 'string' }
              },
              required: ['title', 'content']
            }
          }
        },
        required: ['rules']
      }
    },
    {
      name: '表格数据提取',
      description: '识别并提取文档中的表格数据',
      category: 'table_data',
      priority: 8,
      prompt_template: `请从以下文本中识别并提取表格数据。

文本内容：
{{TEXT}}

如果文本包含表格数据，请以JSON格式返回，包含一个tables数组，每个表格包含headers（表头）、rows（数据行）字段。`,
      output_schema: {
        type: 'object',
        properties: {
          tables: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                headers: {
                  type: 'array',
                  items: { type: 'string' }
                },
                rows: {
                  type: 'array',
                  items: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                }
              },
              required: ['headers', 'rows']
            }
          }
        },
        required: ['tables']
      }
    },
    {
      name: '材料规格提取',
      description: '提取材料名称、型号、规格、性能指标等信息',
      category: 'material_specs',
      priority: 7,
      prompt_template: `请从以下文本中提取材料相关信息，包括材料名称、型号、规格、性能指标等。

文本内容：
{{TEXT}}

请以JSON格式返回，包含一个materials数组，每个材料包含name（材料名）、model（型号）、spec（规格）、properties（性能）字段。`,
      output_schema: {
        type: 'object',
        properties: {
          materials: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                model: { type: 'string' },
                spec: { type: 'string' },
                properties: { type: 'object' }
              },
              required: ['name']
            }
          }
        },
        required: ['materials']
      }
    }
  ]

  try {
    for (const template of templates) {
      // 检查是否已存在
      const existing = await db('extraction_templates')
        .where('name', template.name)
        .first()

      if (existing) {
        console.log(`⏭️  跳过已存在的模板: ${template.name}`)
        continue
      }

      // 插入新模板
      await db('extraction_templates').insert({
        ...template,
        output_schema: JSON.stringify(template.output_schema)
      })

      console.log(`✅ 创建模板: ${template.name}`)
    }

    console.log('\n✅ 提取模板初始化完成!')
  } catch (error) {
    console.error('❌ 初始化失败:', error)
    throw error
  } finally {
    await db.destroy()
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  initExtractionTemplates()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}

module.exports = { initExtractionTemplates }
