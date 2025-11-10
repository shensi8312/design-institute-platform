#!/usr/bin/env node
/**
 * 装配约束推理集成测试
 * 测试 BOM + PDF图纸 -> 约束推理
 */

const fs = require('fs')
const path = require('path')

// 模拟环境变量
process.env.DB_HOST = 'localhost'
process.env.DB_PORT = '5433'
process.env.DB_NAME = 'design_platform'
process.env.DB_USER = 'postgres'
process.env.DB_PASSWORD = 'postgres'
process.env.ASSEMBLY_USE_LLM = 'false'  // 禁用LLM，只测试规则推理
process.env.LLM_PROVIDER = 'ollama'
process.env.DOCUMENT_RECOGNITION_SERVICE = 'http://localhost:8086/api/recognize'
process.env.USE_OCR_FOR_PDF = 'true'

const AssemblyReasoningService = require('./src/services/assembly/AssemblyReasoningService')

async function test() {
  console.log('🧪 开始装配约束推理集成测试...\n')

  try {
    const service = new AssemblyReasoningService()

    // 1. 读取测试BOM
    const bomPath = '/tmp/test_bom.csv'
    if (!fs.existsSync(bomPath)) {
      throw new Error(`BOM文件不存在: ${bomPath}`)
    }
    const bomBuffer = fs.readFileSync(bomPath)
    console.log(`✅ 读取BOM文件: ${bomPath} (${bomBuffer.length} bytes)\n`)

    // 2. 读取测试图纸（文本文件模拟）
    const drawingPath = '/tmp/test_drawing.txt'
    let drawingFiles = []
    if (fs.existsSync(drawingPath)) {
      const drawingBuffer = fs.readFileSync(drawingPath)
      drawingFiles = [{
        name: 'test_drawing.txt',
        buffer: drawingBuffer
      }]
      console.log(`✅ 读取图纸文件: ${drawingPath} (${drawingBuffer.length} bytes)\n`)
    } else {
      console.log(`⚠️ 图纸文件不存在: ${drawingPath}，跳过图纸解析\n`)
    }

    // 3. 执行推理
    console.log('🚀 开始推理...\n')
    const result = await service.inferConstraints(
      bomBuffer,
      drawingFiles,
      'test_user',
      'Test User'
    )

    // 4. 输出结果
    console.log('\n📊 推理结果：')
    console.log('=' .repeat(80))
    console.log(`✅ 推理成功: ${result.success}`)
    console.log(`📦 零件总数: ${result.metadata.partsCount}`)
    console.log(`   - BOM零件: ${result.metadata.bomPartsCount}`)
    console.log(`   - 图纸零件: ${result.metadata.drawingPartsCount}`)
    console.log(`🎯 约束数量: ${result.metadata.constraintsCount}`)
    console.log(`📚 触发规则: ${result.metadata.rulesApplied}`)
    console.log(`🤖 LLM增强: ${result.metadata.llmEnhanced ? '是' : '否'}`)

    if (result.constraints.length > 0) {
      console.log('\n🔗 生成的约束：')
      result.constraints.forEach((constraint, index) => {
        console.log(`\n[${index + 1}] ${constraint.type}约束`)
        console.log(`   实体: ${constraint.entities.join(' ↔ ')}`)
        console.log(`   参数: ${JSON.stringify(constraint.parameters)}`)
        console.log(`   置信度: ${(constraint.confidence * 100).toFixed(1)}%`)
        console.log(`   推理: ${constraint.reasoning}`)
        console.log(`   规则: ${constraint.ruleId}`)
      })
    }

    console.log('\n📝 推理路径：')
    result.explainability.reasoning_path.forEach((step, i) => {
      console.log(`${i + 1}. ${step}`)
    })

    console.log('\n' + '='.repeat(80))
    console.log('✅ 测试完成！')

    process.exit(0)

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

test()
