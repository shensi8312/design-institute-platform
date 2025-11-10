/**
 * 规则辅助方法
 */

/**
 * 从数据库加载规则 (带缓存)
 */
async function loadRulesFromDatabase() {
  const db = require('../../config/database')

  const rules = await db('assembly_rules')
    .where({ is_active: true })
    .orderBy('priority', 'desc')

  return rules
}

/**
 * 评估条件逻辑
 */
function evaluateCondition(conditionLogic, partA, partB) {
  if (!conditionLogic) return false

  const { type, field, value, contains } = conditionLogic

  switch (type) {
    case 'both':
      // 两个零件同时满足条件
      if (contains) {
        return partA[field]?.includes(contains) && partB[field]?.includes(contains)
      }
      return partA[field] === value && partB[field] === value

    case 'thread_match':
      // 螺纹匹配
      if (!partA.thread || !partB.thread) return false
      if (partA.thread !== partB.thread) return false
      if (value) {
        return partA.thread.includes(value) && partB.thread.includes(value)
      }
      return true

    case 'bolt_nut_pair':
      // 螺栓-螺母配对
      const isBoltNut = (partA.type?.includes('螺栓') && partB.type?.includes('螺母')) ||
                        (partA.type?.includes('螺母') && partB.type?.includes('螺栓'))
      if (conditionLogic.thread_match) {
        return isBoltNut && partA.thread === partB.thread
      }
      return isBoltNut

    case 'name_contains': {
      const targetField = field || 'name'
      // 名称包含
      return (partA[targetField]?.includes(value) || partA.type?.includes(value)) &&
             (partB[targetField]?.includes(value) || partB.type?.includes(value))
    }

    case 'specific_pair': {
      if (!Array.isArray(conditionLogic.parts) || conditionLogic.parts.length < 2) return false
      const [expectedA, expectedB] = conditionLogic.parts

      const matches = (part, expected) => {
        return [part.name, part.partNumber, part.part_number]
          .filter(Boolean)
          .some(val => val === expected)
      }

      return (matches(partA, expectedA) && matches(partB, expectedB)) ||
             (matches(partA, expectedB) && matches(partB, expectedA))
    }

    case 'always':
      return true

    default:
      return false
  }
}

/**
 * 生成动作
 */
function generateAction(actionTemplate, partA, partB) {
  if (!actionTemplate) return { parameters: {} }

  const action = { ...actionTemplate }

  // 动态替换参数
  if (action.parameters) {
    const params = { ...action.parameters }

    // 如果有螺纹螺距，动态计算
    if (partA.thread && !params.pitch) {
      const match = partA.thread.match(/x([\d.]+)/)
      params.pitch = match ? parseFloat(match[1]) : 1.5
    }

    action.parameters = params
  }

  return action
}

/**
 * 生成推理说明
 */
function generateReasoning(rule, partA, partB) {
  const template = rule.description || rule.name

  return template
    .replace('{partA}', partA.name)
    .replace('{partB}', partB.name)
    .replace('{thread}', partA.thread || partB.thread || '')
}

module.exports = {
  loadRulesFromDatabase,
  evaluateCondition,
  generateAction,
  generateReasoning
}
