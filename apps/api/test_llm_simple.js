#!/usr/bin/env node
const llmService = require('./src/services/llm/UnifiedLLMService')

async function test() {
  try {
    console.log('测试简单LLM调用...')
    const result = await llmService.chat(
      [
        { role: 'user', content: '请用一句话介绍什么是建筑技术规程' }
      ]
    )
    console.log('✅ 成功:', result.content)
  } catch (error) {
    console.error('❌ 失败:', error.message)
    console.error('详细:', error.response?.data || error)
  }
}

test()
