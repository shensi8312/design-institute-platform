/**
 * 使用真实PID图测试 PID → 装配图流程
 */
const axios = require('axios')
const FormData = require('form-data')
const fs = require('fs')
const path = require('path')

const BASE_URL = 'http://localhost:3000/api'
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2FkbWluIiwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWUsInJvbGVJZCI6InJvbGVfYWRtaW4iLCJpYXQiOjE3NjI2MTI4ODcsImV4cCI6MTc2MzIxNzY4N30.83fHbVjgd1AwzQnl9TVXFO7Czrnn_gIzDR7iVCkrXE0'

const PID_PDF_PATH = path.join(__dirname, '../../docs/solidworks/其他-301000050672-PID-V1.0.pdf')

async function step1_RecognizePID() {
  console.log('\n[Step 1] 上传并识别PID图...')

  if (!fs.existsSync(PID_PDF_PATH)) {
    throw new Error(`PID文件不存在: ${PID_PDF_PATH}`)
  }

  const form = new FormData()
  form.append('file', fs.createReadStream(PID_PDF_PATH))
  form.append('method', 'qwenvl')

  try {
    const response = await axios.post(
      `${BASE_URL}/pid/recognize`,
      form,
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          ...form.getHeaders()
        },
        timeout: 120000  // 2分钟超时
      }
    )

    if (!response.data.success) {
      throw new Error(response.data.message)
    }

    const resultId = response.data.data.result_id || response.data.data.id
    console.log(`✅ PID识别完成: ${resultId}`)
    console.log(`   零件数: ${response.data.data.components?.length || 0}`)
    console.log(`   连接数: ${response.data.data.connections?.length || 0}`)
    console.log(`   完整数据:`, JSON.stringify(response.data.data, null, 2))

    return resultId
  } catch (error) {
    console.error('❌ PID识别失败:', error.response?.data || error.message)
    throw error
  }
}

async function step2_GenerateAssembly(pidResultId) {
  console.log('\n[Step 2] 生成装配图...')

  try {
    const response = await axios.post(
      `${BASE_URL}/assembly/pid-to-3d`,
      {
        pid_result_id: pidResultId,
        line_class: 'LC-A1'
      },
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    )

    console.log('\n✅ 装配图生成成功!')
    console.log(JSON.stringify(response.data, null, 2))

    return response.data.task_id
  } catch (error) {
    console.error('❌ 装配图生成失败:', error.response?.data || error.message)
    throw error
  }
}

async function step3_ExportBOM(taskId) {
  console.log('\n[Step 3] 导出BOM...')

  try {
    const response = await axios.get(
      `${BASE_URL}/assembly/export/${taskId}?format=bom`,
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`
        },
        responseType: 'text'
      }
    )

    console.log('\n✅ BOM导出成功!')
    console.log(response.data)

    // 保存到文件
    const bomPath = path.join(__dirname, `BOM_${taskId}.csv`)
    fs.writeFileSync(bomPath, response.data)
    console.log(`\n📁 已保存到: ${bomPath}`)
  } catch (error) {
    console.error('❌ BOM导出失败:', error.response?.data || error.message)
  }
}

async function step4_ExportReport(taskId) {
  console.log('\n[Step 4] 导出验证报告...')

  try {
    const response = await axios.get(
      `${BASE_URL}/assembly/export/${taskId}?format=report`,
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`
        }
      }
    )

    console.log('\n✅ 验证报告导出成功!')
    console.log(JSON.stringify(response.data, null, 2))
  } catch (error) {
    console.error('❌ 报告导出失败:', error.response?.data || error.message)
  }
}

async function runTest() {
  console.log('========================================')
  console.log('  真实PID图 → 装配图 端到端测试')
  console.log('========================================')
  console.log(`PDF路径: ${PID_PDF_PATH}`)

  try {
    // 1. 识别PID
    const pidResultId = await step1_RecognizePID()

    // 2. 生成装配图
    const taskId = await step2_GenerateAssembly(pidResultId)

    // 3. 导出BOM
    await step3_ExportBOM(taskId)

    // 4. 导出报告
    await step4_ExportReport(taskId)

    console.log('\n========================================')
    console.log('  ✅ 测试通过!')
    console.log('========================================\n')

  } catch (error) {
    console.error('\n========================================')
    console.error('  ❌ 测试失败!')
    console.error('========================================')
    console.error(error)
    process.exit(1)
  }
}

// 运行测试
runTest()
