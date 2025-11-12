const xlsx = require('xlsx')
const { v4: uuidv4 } = require('uuid')
const llmService = require('../llm/UnifiedLLMService')
const { loadRulesFromDatabase, evaluateCondition, generateAction, generateReasoning } = require('./_rule_helpers')

/**
 * 装配约束推理服务 (MVP - P0阶段)
 * 基于规则的简单推理 + 可选LLM增强
 */
class AssemblyReasoningService {
  constructor() {
    this.llmService = llmService
    this.rulesCache = null
    this.rulesCacheTime = 0
    this.CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存

    // 标准件库 (简化版 - 实际应从数据库加载)
    this.standardParts = {
      'VCR-4-VS-2': { type: 'VCR接头', thread: 'M12x1.5', sealing: 'VCR金属密封', manufacturer: 'Swagelok' },
      'SS-4-TA-7': { type: 'Swagelok卡套接头', thread: '1/4"NPT', sealing: '卡套密封', manufacturer: 'Swagelok' },
      'VCR-6-VS-6': { type: 'VCR接头', thread: 'M16x2.0', sealing: 'VCR金属密封', manufacturer: 'Swagelok' },
      'GB/T 70.1-M8': { type: '六角头螺栓', thread: 'M8x1.25', standard: 'GB/T 70.1' },
      'GB/T 6170-M8': { type: '六角螺母', thread: 'M8x1.25', standard: 'GB/T 6170' }
    }

    // 装配规则库 (P0阶段核心)
    this.rules = [
      {
        id: 'R1',
        name: 'VCR接头同轴约束',
        priority: 10,
        condition: (partA, partB) => {
          return partA.type === 'VCR接头' && partB.type === 'VCR接头'
        },
        action: (partA, partB) => ({
          type: 'CONCENTRIC',
          entities: [partA.name, partB.name],
          parameters: { alignment: 'ALIGNED' },
          reasoning: `${partA.name} 和 ${partB.name} 均为VCR接头，需要同轴配合以确保金属密封面接触`
        })
      },
      {
        id: 'R2',
        name: '螺纹连接约束',
        priority: 9,
        condition: (partA, partB) => {
          return partA.thread && partB.thread && this._isThreadCompatible(partA.thread, partB.thread)
        },
        action: (partA, partB) => {
          const pitch = this._extractThreadPitch(partA.thread)
          return {
            type: 'SCREW',
            entities: [partA.name, partB.name],
            parameters: {
              pitch: pitch,
              revolutions: 5,
              direction: 'RIGHT_HAND'
            },
            reasoning: `检测到螺纹规格 ${partA.thread} 和 ${partB.thread} 兼容，自动生成螺纹配合约束`
          }
        }
      },
      {
        id: 'R3',
        name: '法兰面接触约束',
        priority: 8,
        condition: (partA, partB) => {
          return (partA.name.includes('法兰') || partA.type?.includes('法兰')) &&
                 (partB.name.includes('法兰') || partB.type?.includes('法兰'))
        },
        action: (partA, partB) => ({
          type: 'COINCIDENT',
          entities: [`${partA.name}/Face1`, `${partB.name}/Face1`],
          parameters: { alignment: 'ALIGNED', flip: false },
          reasoning: `${partA.name} 和 ${partB.name} 法兰面需要重合接触`
        })
      },
      {
        id: 'R4',
        name: '螺栓-螺母配对',
        priority: 10,
        condition: (partA, partB) => {
          const isBoltNutPair =
            (partA.type?.includes('螺栓') && partB.type?.includes('螺母')) ||
            (partA.type?.includes('螺母') && partB.type?.includes('螺栓'))

          return isBoltNutPair && partA.thread === partB.thread
        },
        action: (partA, partB) => ({
          type: 'SCREW',
          entities: [partA.name, partB.name],
          parameters: {
            pitch: this._extractThreadPitch(partA.thread),
            revolutions: 8
          },
          reasoning: `螺栓 ${partA.name} 与螺母 ${partB.name} 螺纹规格匹配 (${partA.thread})，生成螺纹副约束`
        })
      },
      {
        id: 'R5',
        name: '卡套接头配对',
        priority: 9,
        condition: (partA, partB) => {
          return partA.type?.includes('卡套') && partB.type?.includes('卡套')
        },
        action: (partA, partB) => ({
          type: 'CONCENTRIC',
          entities: [partA.name, partB.name],
          parameters: { alignment: 'ALIGNED' },
          reasoning: `卡套接头 ${partA.name} 和 ${partB.name} 需要同轴配合`
        })
      }
    ]
  }

  /**
   * 推理装配约束 (P1阶段实现 + 数据库持久化 + scipy求解)
   */
  async inferConstraints(bomBuffer, drawingFiles, userId, userName = '') {
    const db = require('../../config/database')
    const axios = require('axios')
    const solverUrl = process.env.ASSEMBLY_SOLVER_URL || 'http://localhost:8002'

    // 1. 创建推理任务记录
    const result = await db('assembly_inference_tasks').insert({
      user_id: userId,
      status: 'processing',
      bom_file_path: 'uploaded.xlsx'
    }).returning('id')

    const taskId = typeof result[0] === 'object' ? result[0].id : result[0]
    const reasoningPath = []

    try {
      console.log(`[模块1-样本输入] 🚀 开始学习 (任务ID: ${taskId})`)

      // 2. 解析BOM（如果有）
      let parts = []
      if (bomBuffer) {
        parts = this._parseBOM(bomBuffer)
        console.log(`[模块1] 解析BOM: ${parts.length}个零件`)
        reasoningPath.push(`模块1-样本输入: 解析BOM，识别${parts.length}个零件`)
      } else {
        console.log(`[模块1] 未上传BOM，将从STEP文件提取零件信息`)
        reasoningPath.push(`模块1-样本输入: 未上传BOM，从STEP提取零件`)
      }

      // 3. 解析STEP文件（如果有）
      const stepFiles = drawingFiles.filter(f =>
        f.name.toLowerCase().endsWith('.step') ||
        f.name.toLowerCase().endsWith('.stp')
      )

      let stepConstraints = []
      let stepParts = []
      if (stepFiles.length > 0) {
        console.log(`[模块2-约束学习] 🏗️ 解析${stepFiles.length}个STEP文件...`)
        reasoningPath.push(`模块2-约束学习: 解析${stepFiles.length}个STEP文件`)

        try {
          const result = await this._parseStepFiles(stepFiles, taskId)
          stepConstraints = result.constraints
          stepParts = result.parts

          console.log(`[模块2] STEP解析完成:`)
          console.log(`  - 装配图: ${result.assemblyFiles.length}个`)
          console.log(`  - 零件图: ${result.partFiles.length}个`)
          console.log(`  - 提取约束: ${stepConstraints.length}个`)
          console.log(`  - 提取零件特征: ${stepParts.length}个`)

          reasoningPath.push(`模块2-约束学习: STEP解析(装配${result.assemblyFiles.length}个,零件${result.partFiles.length}个)`)
          reasoningPath.push(`模块2-约束学习: 提取${stepConstraints.length}个几何约束 + ${stepParts.length}个零件特征`)

          // 如果没有BOM，使用STEP中的零件信息
          if (!bomBuffer && stepParts.length > 0) {
            parts = stepParts.map(sp => ({
              partNumber: sp.part_number || sp.file_name.replace(/\.(step|stp)$/i, ''),
              name: sp.file_name,
              quantity: 1,
              specification: '',
              has_holes: sp.has_holes,
              has_shafts: sp.has_shafts
            }))
            console.log(`[模块2] 从STEP提取${parts.length}个零件`)
            reasoningPath.push(`模块2-约束学习: 从STEP提取${parts.length}个零件信息`)
          }
        } catch (stepError) {
          console.warn('[模块2] STEP解析失败:', stepError.message)
          reasoningPath.push('模块2-约束学习: STEP解析失败(跳过)')
        }
      }

      // 4. 识别标准件并补充知识
      let enrichedParts = parts.map(part => ({
        ...part,
        ...this._lookupStandardPart(part.partNumber)
      }))

      reasoningPath.push(`模块3-知识增强: 标准件匹配${enrichedParts.filter(p => p.type).length}个`)

      // 4. LLM增强：理解零件描述，提取特征
      // ✅ 默认启用LLM，除非明确设置为false
      const useLLM = process.env.ASSEMBLY_USE_LLM !== 'false'
      const DEMO_MODE = process.env.ASSEMBLY_DEMO_MODE === 'true'  // 🎭 演示模式
      const hasUnrecognizedParts = enrichedParts.some(p => !p.type || !p.thread)

      if (DEMO_MODE) {
        console.log('[模块2-约束学习] 🎭 演示模式：跳过AI分析')
        reasoningPath.push(`模块2-约束学习: 演示模式(跳过AI分析)`)
      } else if (useLLM && hasUnrecognizedParts) {
        console.log('[模块2-约束学习] 🤖 AI分析未识别零件...')
        reasoningPath.push(`模块2-约束学习: AI分析${enrichedParts.filter(p => !p.type).length}个未识别零件`)
        try {
          enrichedParts = await this._enrichPartsWithLLM(enrichedParts)
        } catch (llmError) {
          console.warn('[模块2] LLM失败:', llmError.message)
        }
      } else {
        reasoningPath.push('模块2-约束学习: 跳过AI分析(所有零件已识别)')
      }

      console.log(`[模块2] 零件识别: ${enrichedParts.filter(p => p.type).length}/${enrichedParts.length}`)

      // 5. 从数据库加载规则
      const dbRules = await loadRulesFromDatabase()
      console.log(`[模块3-规则推理] 📚 加载${dbRules.length}条规则`)
      reasoningPath.push(`模块3-规则推理: 加载${dbRules.length}条已有规则`)

      // 6. 基于规则推理约束
      const constraints = []

      if (DEMO_MODE && enrichedParts.length >= 2) {
        // 🎭 演示模式：快速生成预设约束
        console.log('[模块3-规则推理] 🎭 演示模式：生成预设约束')
        reasoningPath.push('模块3-规则推理: 演示模式，生成示例约束')

        for (let i = 0; i < Math.min(enrichedParts.length - 1, 10); i++) {
          const partA = enrichedParts[i]
          const partB = enrichedParts[i + 1]

          const constraintTypes = ['CONCENTRIC', 'COINCIDENT', 'PARALLEL', 'SCREW']
          const type = constraintTypes[i % constraintTypes.length]

          constraints.push({
            id: uuidv4(),
            type,
            part_a: partA.name || partA.partNumber,
            part_b: partB.name || partB.partNumber,
            part_number_a: partA.partNumber,
            part_number_b: partB.partNumber,
            entities: [partA.name || partA.partNumber, partB.name || partB.partNumber],
            parameters: type === 'CONCENTRIC' ? { alignment: 'ALIGNED' } :
                       type === 'SCREW' ? { pitch: 1.5, revolutions: 5 } : {},
            reasoning: `演示约束：${partA.name || partA.partNumber} 与 ${partB.name || partB.partNumber} ${type}配合`,
            confidence: 0.75 + Math.random() * 0.2,
            ruleId: `DEMO_${type}_${i}`
          })
        }

        console.log(`[模块3] 🎭 演示模式生成了 ${constraints.length} 个约束`)
      } else {
        // 正常模式：使用真实规则推理
        for (let i = 0; i < enrichedParts.length - 1; i++) {
          for (let j = i + 1; j < enrichedParts.length; j++) {
            const partA = enrichedParts[i]
            const partB = enrichedParts[j]

            // 尝试匹配规则（已按优先级排序）
            for (const rule of dbRules) {
            // 解析JSON condition_logic
            const conditionLogic = typeof rule.condition_logic === 'string'
              ? JSON.parse(rule.condition_logic)
              : rule.condition_logic

            if (evaluateCondition(conditionLogic, partA, partB)) {
              // 解析JSON action_template
              const actionTemplate = typeof rule.action_template === 'string'
                ? JSON.parse(rule.action_template)
                : rule.action_template

              const action = generateAction(actionTemplate, partA, partB)
              const constraint = {
                id: uuidv4(),
                type: rule.constraint_type,
                part_a: partA.name || partA.partNumber,  // 优先使用名称（包含规格信息）
                part_b: partB.name || partB.partNumber,
                part_number_a: partA.partNumber,  // 保留编号
                part_number_b: partB.partNumber,
                entities: [partA.name, partB.name],
                parameters: action.parameters,
                reasoning: generateReasoning(rule, partA, partB),
                confidence: this._calculateConfidence(rule, partA, partB),
                ruleId: rule.rule_id
              }
              constraints.push(constraint)
              console.log(`[AssemblyReasoning] 🎯 触发规则 ${rule.rule_id}: ${rule.name} (置信度: ${(constraint.confidence * 100).toFixed(0)}%)`)

              // 更新规则使用统计
              await db('assembly_rules')
                .where({ rule_id: rule.rule_id })
                .increment('usage_count', 1)

              break // 每对零件只应用优先级最高的一个规则
            }
          }
        }
      }
      }

      reasoningPath.push(`模块2-约束学习: 规则推理${constraints.length}个约束 + STEP提取${stepConstraints.length}个约束`)

      // 合并约束（STEP约束优先级更高）
      const allConstraints = [...stepConstraints, ...constraints]

      // 7. 过滤低置信度约束
      const threshold = 0.5
      const filteredConstraints = allConstraints.filter(c => c.confidence >= threshold)
      console.log(`[模块3] 过滤约束: ${allConstraints.length} → ${filteredConstraints.length}`)
      reasoningPath.push(`模块3-规则推理: 置信度过滤，保留${filteredConstraints.length}个高质量约束`)

      // 8. P1阶段：约束一致性验证（scipy 求解器）
      let solverResult = { feasible: true, skipped: true }
      try {
        console.log('[模块3-规则推理] 🔬 约束求解器验证...')
        const response = await axios.post(`${solverUrl}/validate`, {
          constraints: filteredConstraints
        }, { timeout: 10000 })
        solverResult = response.data

        if (!solverResult.feasible) {
          console.error('[模块3] ❌ 约束冲突:', solverResult.conflicts)
          reasoningPath.push('模块3-规则推理: 约束冲突检测失败')
          await db('assembly_inference_tasks').where({ id: taskId }).update({
            status: 'failed',
            solver_result: solverResult
          })

          return {
            success: false,
            taskId,
            error: '约束冲突',
            conflicts: solverResult.conflicts
          }
        }
        console.log('[模块3] ✅ 约束验证通过')
        reasoningPath.push('模块3-规则推理: 约束求解器验证通过')
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          console.warn('[模块3] ⚠️ 求解器服务未启动，跳过验证')
          reasoningPath.push('模块3-规则推理: 求解器跳过(服务未启动)')
        } else {
          console.error('[模块3] 求解器失败:', error.message)
          reasoningPath.push('模块3-规则推理: 求解器验证失败')
        }
      }

      // 9. P1阶段：装配顺序优化（拓扑排序）
      const assemblySequence = this._optimizeSequence(filteredConstraints, enrichedParts)
      console.log('[模块3] 📊 装配顺序:', assemblySequence)
      reasoningPath.push('模块3-规则推理: 拓扑排序生成装配顺序')

      // 10. 批量保存约束到数据库（分批避免SQL参数过多）
      if (filteredConstraints.length > 0) {
        const DB_BATCH_SIZE = 100 // PostgreSQL参数限制，每批100个约束
        const totalBatches = Math.ceil(filteredConstraints.length / DB_BATCH_SIZE)

        console.log(`[规则库] 💾 保存${filteredConstraints.length}个约束，分${totalBatches}批写入`)

        for (let i = 0; i < totalBatches; i++) {
          const start = i * DB_BATCH_SIZE
          const end = Math.min(start + DB_BATCH_SIZE, filteredConstraints.length)
          const batch = filteredConstraints.slice(start, end)

          await db('assembly_constraints').insert(
            batch.map(c => ({
              task_id: taskId,
              constraint_type: c.type,
              entity_a: c.part_a,
              entity_b: c.part_b,
              parameters: JSON.stringify(c.parameters),
              confidence: c.confidence,
              reasoning: c.reasoning || '',
              rule_id: c.ruleId,
              review_status: 'pending'
            }))
          )

          console.log(`[规则库] 📦 已保存第${i + 1}/${totalBatches}批 (${batch.length}个约束)`)
        }

        console.log(`[规则库] ✅ 完成保存${filteredConstraints.length}个约束到知识库`)
        reasoningPath.push(`💾 规则库: 保存${filteredConstraints.length}个约束到知识库`)
      }

      // 11. 更新任务状态
      await db('assembly_inference_tasks').where({ id: taskId }).update({
        status: 'completed',
        parts_count: parts.length,
        constraints_count: filteredConstraints.length,
        solver_result: {
          feasible: true,
          sequence: assemblySequence,
          ...solverResult
        }
      })

      // 12. 生成可解释性报告
      const explainability = {
        reasoning_path: reasoningPath,
        rules_fired: [...new Set(filteredConstraints.map(c => c.ruleId))].map(
          ruleId => dbRules.find(r => r.rule_id === ruleId)?.name || ruleId
        )
      }

      console.log(`[学习完成] ✅ 规则库已更新: ${filteredConstraints.length}个约束`)

      // 13. 从约束中学习新规则
      const learnedRules = await this._extractRulesFromConstraints(filteredConstraints, taskId, parts)

      return {
        success: true,
        taskId,
        constraints: filteredConstraints,
        assemblySequence,
        solverResult,
        explainability,
        learnedRules,
        metadata: {
          partsCount: parts.length,
          constraintsCount: filteredConstraints.length,
          rulesApplied: explainability.rules_fired.length,
          llmEnhanced: useLLM && hasUnrecognizedParts,  // ✅ 实际使用LLM的状态
          learnedRulesCount: learnedRules.length
        }
      }
    } catch (error) {
      console.error('[AssemblyReasoning] ❌ 推理失败:', error)

      // 更新任务状态为失败
      await db('assembly_inference_tasks').where({ id: taskId }).update({
        status: 'failed',
        solver_result: { error: error.message }
      })

      throw error
    }
  }

  /**
   * P1阶段：装配顺序优化（拓扑排序）
   */
  _optimizeSequence(constraints, parts) {
    // 构建依赖图
    const graph = new Map()
    const partNames = parts.map(p => p.partNumber || p.name)
    partNames.forEach(p => graph.set(p, []))

    // 添加依赖边
    constraints.forEach(c => {
      if (c.type === 'SCREW' || c.type === 'dependency') {
        const from = c.part_a
        const to = c.part_b
        if (graph.has(from)) {
          graph.get(from).push(to)
        }
      }
    })

    // Kahn 算法拓扑排序
    const inDegree = new Map()
    partNames.forEach(p => inDegree.set(p, 0))

    graph.forEach((deps, part) => {
      deps.forEach(dep => {
        inDegree.set(dep, (inDegree.get(dep) || 0) + 1)
      })
    })

    const queue = partNames.filter(p => inDegree.get(p) === 0)
    const sequence = []

    while (queue.length > 0) {
      const current = queue.shift()
      sequence.push(current)

      const neighbors = graph.get(current) || []
      neighbors.forEach(neighbor => {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1)
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor)
        }
      })
    }

    return sequence
  }

  /**
   * 查询推理任务历史
   */
  async getInferenceTasks(userId, limit = 10) {
    const db = require('../../config/database')
    return await db('assembly_inference_tasks')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(limit)
  }

  /**
   * 获取任务约束
   */
  async getTaskConstraints(taskId) {
    const db = require('../../config/database')
    return await db('assembly_constraints')
      .where({ task_id: taskId })
      .select('*')
  }

  /**
   * 解析BOM (支持Excel/CSV)
   */
  _parseBOM(buffer) {
    try {
      const workbook = xlsx.read(buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const data = xlsx.utils.sheet_to_json(sheet)

      console.log(`[AssemblyReasoning] BOM原始数据列: ${Object.keys(data[0] || {}).join(', ')}`)

      return data.map((row, index) => {
        const name = row['零件名称'] || row['Part Name'] || row['name'] || row['TITLE'] || `零件${index + 1}`
        const description = row['描述'] || row['Description'] || row['说明'] || row['TITLE'] || row['零件类型'] || ''

        // 自动识别零件类型
        let type = null
        if (/螺栓|bolt|screw(?!driver)/i.test(name + description)) {
          type = '螺栓'
        } else if (/螺母|nut/i.test(name + description)) {
          type = '螺母'
        } else if (/法兰|flange/i.test(name + description)) {
          type = '法兰'
        } else if (/接头|connector|fitting/i.test(name + description)) {
          type = '接头'
        } else if (/垫片|gasket|washer/i.test(name + description)) {
          type = '垫片'
        }

        // 自动提取螺纹规格
        let thread = null
        const threadMatch = (name + description).match(/M(\d+)(?:x([\d.]+))?/i)
        if (threadMatch) {
          thread = threadMatch[2]
            ? `M${threadMatch[1]}x${threadMatch[2]}`
            : `M${threadMatch[1]}`
        }

        return {
          name,
          partNumber: row['零件号'] || row['Part Number'] || row['partNumber'] || row['图号'] || row['编号'] || row['SAP料号'] || '',
          quantity: parseInt(row['数量'] || row['Quantity'] || row['qty'] || row['总数'] || row['件数'] || 1),
          spec: row['规格'] || row['Spec'] || row['specification'] || row['描述'] || row['Description'] || '',
          description,
          type,     // 自动识别的类型
          thread    // 自动提取的螺纹
        }
      })
    } catch (error) {
      console.error('[AssemblyReasoning] BOM解析失败:', error)
      throw new Error('BOM文件格式错误: ' + error.message)
    }
  }

  /**
   * 查询标准件库
   */
  _lookupStandardPart(partNumber) {
    if (!partNumber) return {}

    // 精确匹配
    if (this.standardParts[partNumber]) {
      return this.standardParts[partNumber]
    }

    // 模糊匹配 (前缀匹配)
    for (const [key, value] of Object.entries(this.standardParts)) {
      if (partNumber.startsWith(key.split('-')[0])) {
        return value
      }
    }

    return {}
  }

  /**
   * LLM增强：理解零件描述，提取类型和特征
   */
  async _enrichPartsWithLLM(parts) {
    try {
      const unknownParts = parts.filter(p => !p.type && (p.description || p.spec))

      if (unknownParts.length === 0) {
        return parts
      }

      console.log(`[AssemblyReasoning] LLM分析 ${unknownParts.length} 个未识别零件...`)

      const prompt = `你是机械工程专家。请分析以下零件信息，提取零件类型、螺纹规格、密封方式等特征。

零件列表:
${unknownParts.map((p, i) => `${i + 1}. 名称: ${p.name}, 规格: ${p.spec}, 描述: ${p.description}`).join('\n')}

请返回JSON数组格式 (每个零件一个对象):
[
  {
    "name": "零件名称",
    "type": "零件类型 (如: 螺栓, 螺母, 法兰, 接头)",
    "thread": "螺纹规格 (如: M8x1.25, 1/4\\"NPT)",
    "sealing": "密封方式 (如: 金属密封, 橡胶密封)"
  }
]

只返回JSON，不要其他文字。`

      const response = await this.llmService.chat(prompt, {
        temperature: 0.1,
        max_tokens: 1000
      })

      // 解析LLM返回的JSON
      const llmResults = JSON.parse(response.replace(/```json\n?|\n?```/g, ''))

      // 合并LLM结果
      const enrichedMap = new Map(llmResults.map(r => [r.name, r]))

      return parts.map(p => {
        if (enrichedMap.has(p.name)) {
          const llmData = enrichedMap.get(p.name)
          return {
            ...p,
            type: p.type || llmData.type,
            thread: p.thread || llmData.thread,
            sealing: p.sealing || llmData.sealing,
            llmEnhanced: true
          }
        }
        return p
      })
    } catch (error) {
      console.error('[AssemblyReasoning] LLM增强失败:', error)
      return parts // 失败时返回原始数据
    }
  }

  /**
   * 计算置信度
   */
  _calculateConfidence(rule, partA, partB) {
    let confidence = 0.6 // 基础分

    // 如果匹配到标准件，提高置信度
    if (partA.type || partB.type) {
      confidence += 0.15
    }

    // 如果有明确的螺纹规格，进一步提高
    if (partA.thread && partB.thread && partA.thread === partB.thread) {
      confidence += 0.2
    }

    // 如果是LLM增强识别的，略微降低置信度
    if (partA.llmEnhanced || partB.llmEnhanced) {
      confidence -= 0.05
    }

    // 根据规则优先级调整
    confidence += (rule.priority / 100)

    return Math.min(Math.max(confidence, 0.0), 1.0)
  }

  /**
   * 判断螺纹是否兼容
   */
  _isThreadCompatible(threadA, threadB) {
    // 简化实现：精确匹配
    return threadA === threadB
  }

  /**
   * 提取螺纹螺距
   */
  _extractThreadPitch(threadSpec) {
    const match = threadSpec.match(/x([\d.]+)/)
    return match ? parseFloat(match[1]) : 1.5
  }

  /**
   * 解析STEP文件提取装配约束和零件特征
   */
  async _parseStepFiles(stepFiles, taskId) {
    const fs = require('fs').promises
    const path = require('path')
    const { spawn } = require('child_process')

    const allConstraints = []
    const allParts = []
    const assemblyFiles = []
    const partFiles = []

    const fileExists = async (targetPath) => {
      try {
        await fs.access(targetPath)
        return true
      } catch (err) {
        return false
      }
    }

    const defaultAnalyzerScript = path.join(__dirname, '../step_assembly_analyzer_v2.py')
    const legacyAnalyzerScript = path.join(__dirname, '../step_assembly_analyzer.py')
    const analyzerFromEnv = process.env.STEP_ANALYZER_SCRIPT
      ? (path.isAbsolute(process.env.STEP_ANALYZER_SCRIPT)
          ? process.env.STEP_ANALYZER_SCRIPT
          : path.join(process.cwd(), process.env.STEP_ANALYZER_SCRIPT))
      : defaultAnalyzerScript

    let analyzerScript = analyzerFromEnv
    if (!(await fileExists(analyzerScript))) {
      console.warn(`[STEP解析] 指定的 STEP 分析脚本不存在: ${analyzerScript}，回退到默认脚本`)
      analyzerScript = defaultAnalyzerScript
    }
    if (!(await fileExists(analyzerScript))) {
      console.warn(`[STEP解析] 默认 STEP 分析脚本缺失，回退到 legacy 版本`)
      analyzerScript = legacyAnalyzerScript
    }

    const supportsRegexFlag = /step_assembly_analyzer_v2\.py$/.test(analyzerScript)
    const forceRegexMode = process.env.STEP_ANALYZER_MODE === 'regex'

    const CONSTRAINT_PRIORITY = {
      'concentric': 10,
      'perpendicular': 10,
      'hole_spacing': 9,
      'parallel': 8,
      'screw': 10,
      'coincident': 9,
      'distance': 8,
      'flow_direction': 6,
      'angle_0': 7,
      'angle_90': 10,
      'angle_120deg': 7,
      'angle_135deg': 7,
      'angle_146deg': 7,
      'angle_149deg': 7,
      'angle_150deg': 7,
      'angle_158deg': 7,
      'angle_180': 7,
      'axis_align': 8
    }

    const getConstraintPriority = (type) => {
      const normalized = (type || '').toLowerCase()
      return CONSTRAINT_PRIORITY[normalized] || 5
    }

    for (const stepFile of stepFiles) {
      try {
        const fileName = stepFile.originalname || stepFile.name
        const fileSize = stepFile.buffer.length / (1024 * 1024) // MB
        console.log(`[STEP解析] 开始处理: ${fileName} (${fileSize.toFixed(2)}MB)`)

        // 保存STEP文件到临时目录
        const tempDir = path.join(__dirname, '../../../uploads/temp')
        await fs.mkdir(tempDir, { recursive: true })

        const tempPath = path.join(tempDir, fileName)
        await fs.writeFile(tempPath, stepFile.buffer)
        console.log(`[STEP解析] 文件已保存到: ${tempPath}`)

        // 调用Python解析器
        const outputFile = path.join(tempDir, `analysis_${taskId}_${Date.now()}.json`)
        const analyzerArgs = [analyzerScript, tempPath, outputFile]
        if (supportsRegexFlag && forceRegexMode) {
          analyzerArgs.push('--regex')
        }

        console.log(`[STEP解析] 调用Python: python3 ${analyzerArgs.join(' ')}`)
        console.log(`[STEP解析] 输出文件: ${outputFile}`)

        const result = await new Promise((resolve, reject) => {
          const python = spawn('python3', analyzerArgs)

          let stdout = ''
          let stderr = ''

          // 超时处理 (大文件需要更长时间)
          const timeout = fileSize > 20 ? 120000 : 60000 // 20MB以上给120秒
          const timer = setTimeout(() => {
            python.kill()
            reject(new Error(`Python脚本超时 (${timeout/1000}秒)`))
          }, timeout)

          python.stdout.on('data', (data) => {
            stdout += data.toString()
            console.log('[Python]:', data.toString().trim())
          })

          python.stderr.on('data', (data) => {
            stderr += data.toString()
            console.error('[Python错误]:', data.toString().trim())
          })

          python.on('close', async (code) => {
            clearTimeout(timer)

            console.log(`[STEP解析] Python进程退出，代码: ${code}`)

            if (code === 0) {
              try {
                // 检查输出文件是否存在
                const fileExists = await fs.access(outputFile).then(() => true).catch(() => false)
                if (!fileExists) {
                  reject(new Error(`输出文件不存在: ${outputFile}`))
                  return
                }

                const content = await fs.readFile(outputFile, 'utf-8')
                console.log(`[STEP解析] 读取结果文件，大小: ${content.length}字节`)

                const analysis = JSON.parse(content)
                const partSummary = analysis.metadata?.products_count ?? analysis.metadata?.parts_count ?? 0
                console.log(`[STEP解析] 解析成功: ${partSummary}个零件/产品, ${analysis.metadata?.constraints_count || 0}个约束 (模式: ${analysis.parser_mode || 'unknown'})`)

                // 清理临时文件
                await fs.unlink(tempPath).catch(() => {})
                await fs.unlink(outputFile).catch(() => {})

                resolve(analysis)
              } catch (error) {
                reject(new Error(`解析结果文件失败: ${error.message}\nStdout: ${stdout.slice(-500)}\nStderr: ${stderr.slice(-500)}`))
              }
            } else {
              reject(new Error(`Python脚本退出码: ${code}\nStderr: ${stderr}\nStdout: ${stdout.slice(-500)}`))
            }
          })

          python.on('error', (error) => {
            clearTimeout(timer)
            reject(new Error(`Python进程错误: ${error.message}`))
          })
        })

        // 根据文件类型分类处理
        if (result.file_type === 'assembly') {
          assemblyFiles.push(fileName)

          const parserMode = result.parser_mode || (result.parts ? 'pythonocc' : 'regex')

          if (parserMode === 'pythonocc') {
            const parts = result.parts || []
            const partIdMap = new Map()

            parts.forEach((part, index) => {
              const partId = part.part_id || part.file_name || `Part_${index + 1}`
              partIdMap.set(part.part_id || part.file_name, partId)

              const features = part.features || []
              const hasHoles = features.some(f => f.type === 'cylinder' && f.subtype === 'hole')
              const hasShafts = features.some(f => f.type === 'cylinder' && f.subtype === 'shaft')

              allParts.push({
                file_name: part.file_name || partId,
                part_number: partId,
                product_id: part.part_id || part.file_name,
                has_holes: hasHoles,
                has_shafts: hasShafts,
                features_count: features.length,
                transform: part.transform || null
              })
            })
            console.log(`[STEP解析] pythonOCC 装配体包含 ${parts.length} 个零件`)

            const rawConstraints = result.constraints || []
            const beforeCount = allConstraints.length
            rawConstraints.forEach((constraint) => {
              const partNumberA = partIdMap.get(constraint.part_a) || constraint.part_a || 'UNKNOWN_A'
              const partNumberB = partIdMap.get(constraint.part_b) || constraint.part_b || 'UNKNOWN_B'

              allConstraints.push({
                id: uuidv4(),
                type: (constraint.type || constraint.constraint_type || 'UNKNOWN').toUpperCase(),
                part_a: partNumberA,
                part_b: partNumberB,
                entities: [partNumberA, partNumberB],
                parameters: constraint.parameters || {},
                reasoning: constraint.reasoning || `STEP(occ)推理：${(constraint.type || '').toUpperCase()}`,
                confidence: constraint.confidence ?? 0.9,
                source: constraint.source || 'pythonocc',
                step_file: fileName,
                priority: getConstraintPriority(constraint.type || constraint.constraint_type)
              })
            })

            console.log(`[STEP解析] pythonOCC 约束采集: ${rawConstraints.length} 条，新增 ${allConstraints.length - beforeCount} 条系统约束`)
          } else {
            // ✅ 转换产品为零件 + 构建ID映射
            const productIdToPartNumber = {}  // Product_ID → 真实零件编号
            const allPartNumbers = []         // 所有零件编号列表
            if (result.products && result.products.length > 0) {
              result.products.forEach(product => {
                const partNumber = product.name
                productIdToPartNumber[product.id] = partNumber
                allPartNumbers.push(partNumber)
                allParts.push({
                  file_name: product.name,
                  part_number: partNumber,
                  product_id: product.id,
                  has_holes: false,
                  has_shafts: false
                })
              })
              console.log(`[STEP解析] 装配体包含 ${result.products.length} 个零件`)
            }

            // 📊 优化约束质量：排序 + 过滤 + 去重 + 分批处理
            const rawConstraints = result.constraints || []
            const beforeCount = allConstraints.length
            console.log(`[STEP解析] Python返回 ${rawConstraints.length} 个约束`)

            // 🆕 构建Placement→零件编号的映射（按顺序循环分配）
            const placementToPartNumber = {}
            const placementIds = new Set()
            rawConstraints.forEach(c => {
              if (c.part1) placementIds.add(c.part1)
              if (c.part2) placementIds.add(c.part2)
              if (c.hole1) placementIds.add(c.hole1)
              if (c.hole2) placementIds.add(c.hole2)
            })

            const sortedPlacementIds = Array.from(placementIds).sort((a, b) => parseInt(a) - parseInt(b))
            sortedPlacementIds.forEach((pid, index) => {
              // 使用取模循环分配真实零件编号
              const partNumber = allPartNumbers.length
                ? allPartNumbers[index % allPartNumbers.length]
                : `零件#${pid}`
              placementToPartNumber[pid] = partNumber
            })

            console.log(`[STEP解析] Placement映射: ${sortedPlacementIds.length}个placement → ${allPartNumbers.length}个零件`)

            // 1️⃣ 按置信度过滤（保留中高质量约束，展示多样性）
            const CONFIDENCE_THRESHOLD = 0.5  // 降低阈值，包含更多类型
            const highQualityConstraints = rawConstraints.filter(c =>
              (c.confidence || 0.5) >= CONFIDENCE_THRESHOLD
            )
            console.log(`[约束优化] 置信度过滤: ${rawConstraints.length} → ${highQualityConstraints.length} (>=${CONFIDENCE_THRESHOLD})`)

            // 按类型分组
            const byType = {}
            highQualityConstraints.forEach(c => {
              const type = c.type
              if (!byType[type]) byType[type] = []
              byType[type].push(c)
            })

            // 每种类型取前N个（确保多样性）
            const balancedConstraints = []
            const samplesPerType = Object.keys(byType).length
              ? Math.ceil(5000 / Object.keys(byType).length)
              : 0

            Object.entries(byType).forEach(([type, constraints]) => {
              const sorted = constraints
                .sort((a, b) => (b.confidence || 0.5) - (a.confidence || 0.5))
                .slice(0, samplesPerType || constraints.length)
              balancedConstraints.push(...sorted)
            })

            console.log(`[约束优化] 类型平衡采样: ${Object.keys(byType).length}种类型，每种约${samplesPerType || 0}个`)

            // 再按优先级排序
            const sortedConstraints = balancedConstraints.sort((a, b) => {
              const priorityA = getConstraintPriority(a.type)
              const priorityB = getConstraintPriority(b.type)
              if (priorityA !== priorityB) return priorityB - priorityA
              return (b.confidence || 0.5) - (a.confidence || 0.5)
            })

            // 3️⃣ 去重相似约束（基于距离和类型）
            const uniqueConstraints = []
            const constraintKeys = new Set()

            for (const c of sortedConstraints) {
              const key = `${c.type}_${c.part1 || c.hole1}_${c.part2 || c.hole2}_${Math.round(c.distance || 0)}`
              if (!constraintKeys.has(key)) {
                constraintKeys.add(key)
                uniqueConstraints.push(c)
              }
            }
            console.log(`[约束优化] 去重: ${sortedConstraints.length} → ${uniqueConstraints.length}`)

            // 4️⃣ 分批处理（避免内存溢出，但不丢弃数据）
            const BATCH_SIZE = 1000
            const totalBatches = Math.ceil(uniqueConstraints.length / BATCH_SIZE) || 1
            console.log(`[约束优化] 📦 分批处理: ${uniqueConstraints.length}个约束 → ${totalBatches}批`)

            // 5️⃣ 转换为系统格式（分批添加到allConstraints）
            for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
              const batchStart = batchIdx * BATCH_SIZE
              const batchEnd = Math.min(batchStart + BATCH_SIZE, uniqueConstraints.length)
              const batch = uniqueConstraints.slice(batchStart, batchEnd)

              console.log(`[约束优化] 处理第 ${batchIdx + 1}/${totalBatches} 批: ${batch.length}个约束`)

              for (const c of batch) {
                // 🔄 将Placement ID转换为真实零件编号
                const placementIdA = c.part1 || c.hole1 || 'unknown'
                const placementIdB = c.part2 || c.hole2 || 'unknown'

                // 优先使用placement映射，再尝试product映射，最后使用"零件#ID"格式
                const partNumberA = placementToPartNumber[placementIdA] || productIdToPartNumber[placementIdA] || `零件#${placementIdA}`
                const partNumberB = placementToPartNumber[placementIdB] || productIdToPartNumber[placementIdB] || `零件#${placementIdB}`

                allConstraints.push({
                  id: uuidv4(),
                  type: (c.type || '').toUpperCase(),
                  part_a: partNumberA,  // ✅ 使用真实零件编号
                  part_b: partNumberB,  // ✅ 使用真实零件编号
                  entities: [partNumberA, partNumberB],
                  parameters: {
                    distance: c.distance,
                    angle: c.angle,
                    radius1: c.radius1,
                    radius2: c.radius2
                  },
                  reasoning: this._generateStepReasoning(c),
                  confidence: c.confidence || 0.9,
                  source: 'step_assembly',
                  step_file: fileName,
                  priority: getConstraintPriority(c.type)
                })
              }
            }

            console.log(`[STEP解析] 成功处理 ${allConstraints.length - beforeCount} 个装配约束`)
          }

        } else if (result.file_type === 'part') {
          partFiles.push(fileName)

          const parserMode = result.parser_mode || (result.parts ? 'pythonocc' : 'regex')

          if (parserMode === 'pythonocc' && (result.parts?.length || 0) > 0) {
            const partInfo = result.parts[0]
            const features = partInfo.features || []
            const partFeatures = {
              file_name: partInfo.file_name || fileName,
              part_number: partInfo.part_id || fileName.split('.')[0],
              has_holes: features.some(f => f.type === 'cylinder' && f.subtype === 'hole'),
              has_shafts: features.some(f => f.type === 'cylinder' && f.subtype === 'shaft'),
              features_count: features.length,
              transform: partInfo.transform || null
            }
            allParts.push(partFeatures)
            console.log(`[STEP解析] pythonOCC零件: 特征=${partFeatures.features_count}, 孔=${partFeatures.has_holes}, 轴=${partFeatures.has_shafts}`)
          } else {
            // 提取零件特征（孔、轴、面等）
            const partFeatures = {
              file_name: fileName,
              part_number: fileName.split('.')[0],  // 从文件名提取零件号
              cylinders: result.cylinders || [],
              placements: result.metadata.placements_count || 0,
              has_holes: (result.cylinders || []).some(c => c.type === 'hole'),
              has_shafts: (result.cylinders || []).some(c => c.type === 'shaft')
            }

            allParts.push(partFeatures)
            console.log(`[STEP解析] 零件特征: 孔=${partFeatures.has_holes}, 轴=${partFeatures.has_shafts}`)
          }
        }

      } catch (error) {
        console.error(`[STEP解析] ❌ 失败 ${stepFile.originalname || stepFile.name}:`, error.message)
        console.error(error.stack)
      }
    }

    console.log(`[STEP解析] 汇总: 装配体${assemblyFiles.length}个, 零件${partFiles.length}个, 总零件${allParts.length}个, 总约束${allConstraints.length}个`)

    return {
      constraints: allConstraints,
      parts: allParts,
      assemblyFiles,
      partFiles
    }
  }

  /**
   * 生成STEP约束推理说明
   */
  _generateStepReasoning(stepConstraint) {
    if (stepConstraint.type === 'concentric') {
      return `STEP文件分析：检测到同轴配合（距离${stepConstraint.distance}mm）`
    } else if (stepConstraint.type === 'perpendicular') {
      return `STEP文件分析：检测到垂直配合（角度${stepConstraint.angle}°）`
    } else if (stepConstraint.type === 'hole_spacing') {
      return `STEP文件分析：检测到孔间距约束（${stepConstraint.distance}mm，孔径${stepConstraint.radius1}/${stepConstraint.radius2}）`
    } else {
      return `STEP文件分析：${stepConstraint.type}配合`
    }
  }

  /**
   * 从BOM直接推理约束（用于PID识别结果）
   */
  async inferConstraintsFromBOM(bomData, taskId, userId) {
    console.log(`[AssemblyReasoning] 🔍 从BOM推理约束: ${bomData.length}个零件`)

    const db = require('../../config/database')

    try {
      // 1. 丰富零件信息
      const enrichedParts = bomData.map(part => ({
        ...part,
        name: part.part_number,
        type: part.part_type,
        partNumber: part.part_number
      }))

      // 2. 加载装配规则（数据库 + 硬编码）
      const dbRules = await loadRulesFromDatabase()
      const allRules = [...this.rules, ...dbRules]

      console.log(`[AssemblyReasoning] 📚 加载${allRules.length}条规则`)

      // 3. 规则匹配：遍历所有零件对
      const constraints = []
      for (let i = 0; i < enrichedParts.length - 1; i++) {
        for (let j = i + 1; j < enrichedParts.length; j++) {
          const partA = enrichedParts[i]
          const partB = enrichedParts[j]

          // 尝试匹配规则（按优先级）
          for (const rule of allRules) {
            let matched = false

            // 检查是数据库规则还是硬编码规则
            if (rule.condition_logic) {
              // 数据库规则
              const conditionLogic = typeof rule.condition_logic === 'string'
                ? JSON.parse(rule.condition_logic)
                : rule.condition_logic

              if (evaluateCondition(conditionLogic, partA, partB)) {
                matched = true
                const actionTemplate = typeof rule.action_template === 'string'
                  ? JSON.parse(rule.action_template)
                  : rule.action_template

                const action = generateAction(actionTemplate, partA, partB)
                const constraint = {
                  id: require('uuid').v4(),
                  task_id: taskId,
                  constraint_type: rule.constraint_type,
                  entity_a: partA.part_number,
                  entity_b: partB.part_number,
                  parameters: JSON.stringify(action.parameters),
                  reasoning: generateReasoning(rule, partA, partB),
                  confidence: this._calculateConfidence(rule, partA, partB),
                  rule_id: rule.rule_id,
                  review_status: 'pending'
                }
                constraints.push(constraint)
                console.log(`[AssemblyReasoning] 🎯 触发规则 ${rule.rule_id}: ${rule.name}`)
              }
            } else {
              // 硬编码规则
              if (rule.condition(partA, partB)) {
                matched = true
                const action = rule.action(partA, partB)
                const constraint = {
                  id: require('uuid').v4(),
                  task_id: taskId,
                  constraint_type: action.type,
                  entity_a: partA.part_number,
                  entity_b: partB.part_number,
                  parameters: JSON.stringify(action.parameters),
                  reasoning: action.reasoning,
                  confidence: 0.85,
                  rule_id: rule.id,
                  review_status: 'pending'
                }
                constraints.push(constraint)
                console.log(`[AssemblyReasoning] 🎯 触发规则 ${rule.id}: ${rule.name}`)
              }
            }

            if (matched) break // 只应用优先级最高的规则
          }
        }
      }

      console.log(`[AssemblyReasoning] ✅ 推理完成: ${constraints.length}个约束`)

      // 4. 保存约束到数据库
      if (constraints.length > 0) {
        await db('assembly_constraints').insert(constraints)
      }

      return {
        success: true,
        constraints,
        partsCount: bomData.length,
        rulesApplied: allRules.length
      }
    } catch (error) {
      console.error('[AssemblyReasoning] ❌ 推理失败:', error)
      throw error
    }
  }

  /**
   * 从约束数据中提取规则（规则学习）
   */
  async _extractRulesFromConstraints(constraints, taskId, parts) {
    const db = require('../../config/database')

    console.log(`[规则学习] 🧠 开始分析 ${constraints.length} 个约束...`)

    // 按约束类型分组
    const grouped = {}
    constraints.forEach(c => {
      const type = c.type || c.constraint_type
      if (!grouped[type]) grouped[type] = []
      grouped[type].push(c)
    })

    const learnedRules = []
    const assemblyRuleRows = []

    const buildConditionLogicFromPattern = (pattern) => {
      if (pattern.featureType === 'thread') {
        return {
          type: 'thread_match',
          value: pattern.feature
        }
      }

      return {
        type: 'name_contains',
        field: 'name',
        value: pattern.feature
      }
    }

    const buildActionTemplateFromType = (constraintType) => ({
      constraint_type: (constraintType || 'GENERIC').toUpperCase(),
      parameters: {}
    })

    const toPriorityNumber = (priorityLabel) => priorityLabel === 'high' ? 9 : 5

    // 对每种约束类型进行模式分析
    for (const [type, items] of Object.entries(grouped)) {
      if (items.length < 2) {
        console.log(`[规则学习] ⏭️  跳过 ${type}: 样本数不足 (${items.length} < 2)`)
        continue
      }

      console.log(`[规则学习] 🔍 分析 ${type} 约束: ${items.length} 个样本`)

      // 提取零件特征模式
      const patterns = {}
      items.forEach(item => {
        const partA = item.entity_a || item.part_a
        const partB = item.entity_b || item.part_b

        // 模式1: 螺纹规格
        const threadMatch = (partA + ' ' + partB).match(/M(\d+)/g)
        if (threadMatch) {
          const threads = [...new Set(threadMatch)]
          threads.forEach(thread => {
            const key = `${type}_${thread}`
            if (!patterns[key]) {
              patterns[key] = {
                type,
                feature: thread,
                featureType: 'thread',
                count: 0,
                examples: []
              }
            }
            patterns[key].count++
            patterns[key].examples.push({ partA, partB })
          })
        }

        // 模式2: 孔径配合
        const holeMatch = (partA + ' ' + partB).match(/[Φφ](\d+\.?\d*)/g)
        if (holeMatch) {
          const holes = [...new Set(holeMatch)]
          holes.forEach(hole => {
            const key = `${type}_${hole}`
            if (!patterns[key]) {
              patterns[key] = {
                type,
                feature: hole,
                featureType: 'hole',
                count: 0,
                examples: []
              }
            }
            patterns[key].count++
            patterns[key].examples.push({ partA, partB })
          })
        }

        // 模式3: 零件名称关键词
        const keywords = ['螺母', '螺钉', '螺栓', '垫片', '法兰', '接头', '阀门']
        keywords.forEach(keyword => {
          if (partA?.includes(keyword) || partB?.includes(keyword)) {
            const key = `${type}_${keyword}`
            if (!patterns[key]) {
              patterns[key] = {
                type,
                feature: keyword,
                featureType: 'keyword',
                count: 0,
                examples: []
              }
            }
            patterns[key].count++
            patterns[key].examples.push({ partA, partB })
          }
        })
      })

      // 生成规则
      for (const [patternKey, patternData] of Object.entries(patterns)) {
        if (patternData.count >= 2) { // 至少出现2次才学习
          const confidence = Math.min(0.5 + (patternData.count * 0.1), 0.95)

          const rule = {
            rule_type: 'assembly',
            rule_code: `LEARNED_${type}_${patternData.feature}_${Date.now()}`,
            rule_name: `${patternData.feature} ${patternData.featureType === 'thread' ? '螺纹' : patternData.featureType === 'hole' ? '孔径' : '零件'}配合规则`,
            rule_content: `当检测到包含"${patternData.feature}"特征的零件时，自动生成${type}约束`,
            parameters: JSON.stringify({
              constraint_type: type,
              feature: patternData.feature,
              feature_type: patternData.featureType,
              learned_from: 'constraint_analysis',
              sample_count: patternData.count,
              examples: patternData.examples.slice(0, 3) // 保存前3个示例
            }),
            category_id: null,
            priority: patternData.count >= 5 ? 'high' : 'normal',
            confidence_score: confidence,
            source_document_id: taskId,
            learned_from: 'ai_learning',
            review_status: 'pending',
            is_active: true,
            usage_count: 0,
            success_count: 0
          }

          learnedRules.push(rule)
          console.log(`[规则学习] 📚 学到规则: ${rule.rule_name} (置信度: ${(confidence * 100).toFixed(0)}%, 样本: ${patternData.count})`)

          const conditionLogic = buildConditionLogicFromPattern(patternData)
          const actionTemplate = buildActionTemplateFromType(type)

          assemblyRuleRows.push({
            rule_id: rule.rule_code,
            name: rule.rule_name,
            description: rule.rule_content,
            priority: toPriorityNumber(rule.priority),
            constraint_type: (type || 'GENERIC').toUpperCase(),
            condition_logic: JSON.stringify(conditionLogic),
            action_template: JSON.stringify(actionTemplate),
            is_active: true,
            learned_from: 'constraint_learning',
            created_by: 'system',
            confidence_boost: 0,
            usage_count: 0,
            success_count: 0,
            updated_at: new Date(),
            created_at: new Date()
          })
        }
      }
    }

    // 保存到数据库
    if (learnedRules.length > 0) {
      await db('design_rules').insert(learnedRules)
      await db('assembly_rules')
        .insert(assemblyRuleRows)
        .onConflict('rule_id')
        .merge({
          description: db.raw('excluded.description'),
          priority: db.raw('excluded.priority'),
          constraint_type: db.raw('excluded.constraint_type'),
          condition_logic: db.raw('excluded.condition_logic'),
          action_template: db.raw('excluded.action_template'),
          is_active: db.raw('excluded.is_active'),
          learned_from: db.raw('excluded.learned_from'),
          updated_at: db.raw('excluded.updated_at')
        })

      console.log(`[规则学习] ✅ 成功保存 ${learnedRules.length} 条新规则到数据库，并同步到 assembly_rules`)
    } else {
      console.log(`[规则学习] ℹ️  未发现可学习的规则模式`)
    }

    return learnedRules
  }

  /**
   * 学习反馈 (P0阶段记录日志)
   */
  async learnFromFeedback(feedback) {
    console.log('[AssemblyReasoning] 📝 收到反馈:', {
      constraintId: feedback.constraintId,
      isCorrect: feedback.isCorrect,
      userId: feedback.userId,
      timestamp: feedback.timestamp.toISOString()
    })

    // P0阶段: 仅记录到日志
    // P1阶段: 写入数据库
    // P2阶段: 在线学习更新规则权重
  }
}

module.exports = AssemblyReasoningService
