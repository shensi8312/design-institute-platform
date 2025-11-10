#!/usr/bin/env node
const { getDomainConfig } = require('./src/config/DomainConfig')

const config = getDomainConfig('intelligent_standards')

console.log('========== 配置信息 ==========')
console.log('Domain Name:', config.domainName)
console.log('\n========== Prompts ==========')
console.log('Available prompts:', Object.keys(config.config.prompts || {}))
console.log('\n========== Document Analysis Prompt ==========')
const prompt = config.getPrompt('document_analysis', {
  title: '测试标题',
  content: '测试内容'
})
console.log(prompt.substring(0, 500))
console.log('\n========== Rule Types ==========')
const ruleTypes = config.config.rule_extraction?.rule_types || []
console.log(`Found ${ruleTypes.length} rule types`)
ruleTypes.forEach((rt, idx) => {
  console.log(`${idx + 1}. ${rt.name} (${rt.code})`)
})
