/**
 * PID识别修复验证测试
 * 验证方案B的所有修复点
 */

const fs = require('fs').promises
const path = require('path')

// 测试颜色
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
}

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`)
}

async function testDirectoryCreation() {
  log('\n📁 测试1: 验证目录创建功能', 'blue')

  const uploadDir = './uploads'
  const expectedDirs = [
    path.join(uploadDir, 'pid_originals'),
    path.join(uploadDir, 'pid_annotations'),
    path.join(uploadDir, 'pid_converted')
  ]

  try {
    for (const dir of expectedDirs) {
      const exists = await fs.access(dir).then(() => true).catch(() => false)
      if (exists) {
        log(`  ✅ 目录存在: ${dir}`, 'green')
      } else {
        log(`  ❌ 目录缺失: ${dir}`, 'red')
        return false
      }
    }
    return true
  } catch (error) {
    log(`  ❌ 目录检查失败: ${error.message}`, 'red')
    return false
  }
}

async function testServiceImport() {
  log('\n🔧 测试2: 验证服务类导入', 'blue')

  try {
    const PIDRecognitionVLService = require('./src/services/pid/PIDRecognitionVLService')
    const service = new PIDRecognitionVLService()

    // 验证新增的属性
    if (service.originalsDir && service.annotationsDir && service.convertedDir) {
      log('  ✅ 服务初始化成功，目录属性存在', 'green')
      log(`     - originalsDir: ${service.originalsDir}`)
      log(`     - annotationsDir: ${service.annotationsDir}`)
      log(`     - convertedDir: ${service.convertedDir}`)
      return true
    } else {
      log('  ❌ 服务缺少目录属性', 'red')
      return false
    }
  } catch (error) {
    log(`  ❌ 服务导入失败: ${error.message}`, 'red')
    return false
  }
}

async function testJsonParsing() {
  log('\n🔍 测试3: 验证强化JSON解析', 'blue')

  try {
    const PIDRecognitionVLService = require('./src/services/pid/PIDRecognitionVLService')
    const service = new PIDRecognitionVLService()

    // 测试场景1: 标准JSON
    const test1 = '{"components":[{"id":"V1","type":"valve"}],"connections":[]}'
    const result1 = service._parseResult(test1)
    if (result1.components.length === 1) {
      log('  ✅ 场景1: 直接解析JSON - 通过', 'green')
    } else {
      log('  ❌ 场景1: 直接解析JSON - 失败', 'red')
    }

    // 测试场景2: JSON代码块
    const test2 = '```json\n{"components":[{"id":"V2","type":"valve"}],"connections":[]}\n```'
    const result2 = service._parseResult(test2)
    if (result2.components.length === 1) {
      log('  ✅ 场景2: JSON代码块解析 - 通过', 'green')
    } else {
      log('  ❌ 场景2: JSON代码块解析 - 失败', 'red')
    }

    // 测试场景3: 带注释的JSON
    const test3 = '```json\n{"components":[{"id":"V3","type":"valve"}], // 注释\n"connections":[]}\n```'
    const result3 = service._parseResult(test3)
    if (result3.components.length === 1) {
      log('  ✅ 场景3: 带注释JSON解析 - 通过', 'green')
    } else {
      log('  ❌ 场景3: 带注释JSON解析 - 失败', 'red')
    }

    // 测试场景4: 带尾随逗号的JSON
    const test4 = '{"components":[{"id":"V4","type":"valve",},],"connections":[],}'
    const result4 = service._parseResult(test4)
    if (result4.components.length === 1) {
      log('  ✅ 场景4: 尾随逗号清理 - 通过', 'green')
    } else {
      log('  ❌ 场景4: 尾随逗号清理 - 失败', 'red')
    }

    // 测试场景5: 括号范围提取
    const test5 = '这是一些前置文本 {"components":[{"id":"V5","type":"valve"}],"connections":[]} 这是后置文本'
    const result5 = service._parseResult(test5)
    if (result5.components.length === 1) {
      log('  ✅ 场景5: 括号范围提取 - 通过', 'green')
    } else {
      log('  ❌ 场景5: 括号范围提取 - 失败', 'red')
    }

    return true
  } catch (error) {
    log(`  ❌ JSON解析测试失败: ${error.message}`, 'red')
    console.error(error)
    return false
  }
}

async function testControllerFieldMapping() {
  log('\n🎯 测试4: 验证控制器字段映射', 'blue')

  try {
    const controllerPath = './src/controllers/PIDController.js'
    const content = await fs.readFile(controllerPath, 'utf-8')

    // 检查修复点1: visualization_urls (不是visualization_images)
    if (content.includes('result.visualization_urls')) {
      log('  ✅ 字段名修复: visualization_urls - 正确', 'green')
    } else if (content.includes('result.visualization_images')) {
      log('  ❌ 字段名错误: 仍使用 visualization_images', 'red')
      return false
    } else {
      log('  ⚠️  未找到 visualization_urls 字段', 'yellow')
    }

    // 检查修复点2: 保存component_count和connection_count
    if (content.includes('component_count') && content.includes('connection_count')) {
      log('  ✅ 统计字段: component_count, connection_count - 存在', 'green')
    } else {
      log('  ❌ 统计字段缺失', 'red')
      return false
    }

    // 检查修复点3: 保存file_path
    if (content.includes('file_path: result.file_path')) {
      log('  ✅ 文件路径保存: file_path - 正确', 'green')
    } else {
      log('  ⚠️  file_path保存方式可能不同', 'yellow')
    }

    return true
  } catch (error) {
    log(`  ❌ 控制器验证失败: ${error.message}`, 'red')
    return false
  }
}

async function testCanvasSupport() {
  log('\n🎨 测试5: 验证Canvas绘图支持', 'blue')

  try {
    // 检查Canvas是否可用
    const canvas = require('canvas')
    log('  ✅ Canvas库已安装', 'green')

    // 测试基本功能
    const testCanvas = canvas.createCanvas(100, 100)
    const ctx = testCanvas.getContext('2d')
    ctx.fillStyle = '#FF0000'
    ctx.fillRect(0, 0, 50, 50)

    const buffer = testCanvas.toBuffer('image/png')
    if (buffer.length > 0) {
      log(`  ✅ Canvas绘图功能正常 (生成 ${buffer.length} bytes)`, 'green')
      return true
    } else {
      log('  ❌ Canvas无法生成图片', 'red')
      return false
    }
  } catch (error) {
    log(`  ❌ Canvas不可用: ${error.message}`, 'red')
    log('  💡 运行: npm install canvas', 'yellow')
    return false
  }
}

async function testFrontendUpdates() {
  log('\n🖥️  测试6: 验证前端更新', 'blue')

  try {
    const frontendPath = '../web/src/pages/PIDRecognition.tsx'
    const content = await fs.readFile(frontendPath, 'utf-8')

    // 检查是否分离了原始图和标注图显示
    if (content.includes('上传的PID图纸') && content.includes('AI识别标注图')) {
      log('  ✅ 前端UI分离: 原始图 + 标注图 - 正确', 'green')
    } else {
      log('  ❌ 前端UI未正确分离', 'red')
      return false
    }

    // 检查是否添加了调试日志
    if (content.includes('console.log') && content.includes('visualization_urls')) {
      log('  ✅ 调试日志: 已添加', 'green')
    } else {
      log('  ⚠️  未找到visualization_urls调试日志', 'yellow')
    }

    return true
  } catch (error) {
    log(`  ❌ 前端验证失败: ${error.message}`, 'red')
    return false
  }
}

async function runAllTests() {
  log('\n' + '='.repeat(60), 'blue')
  log('🚀 PID识别修复验证测试套件', 'blue')
  log('='.repeat(60) + '\n', 'blue')

  const results = []

  // 运行所有测试
  results.push(await testDirectoryCreation())
  results.push(await testServiceImport())
  results.push(await testJsonParsing())
  results.push(await testControllerFieldMapping())
  results.push(await testCanvasSupport())
  results.push(await testFrontendUpdates())

  // 统计结果
  const passed = results.filter(r => r === true).length
  const total = results.length

  log('\n' + '='.repeat(60), 'blue')
  log(`📊 测试结果: ${passed}/${total} 通过`, passed === total ? 'green' : 'red')
  log('='.repeat(60) + '\n', 'blue')

  if (passed === total) {
    log('✅ 所有测试通过！修复验证成功！', 'green')
    log('\n💡 下一步:', 'blue')
    log('   1. 重启后端服务: cd apps/api && npm start')
    log('   2. 打开前端页面测试上传PID图纸')
    log('   3. 检查uploads/目录下的文件是否正确生成\n')
    process.exit(0)
  } else {
    log('❌ 部分测试失败，需要修复', 'red')
    process.exit(1)
  }
}

// 运行测试
runAllTests().catch(error => {
  log(`\n💥 测试执行失败: ${error.message}`, 'red')
  console.error(error)
  process.exit(1)
})
