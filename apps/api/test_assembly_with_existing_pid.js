/**
 * 使用数据库中已有的PID识别结果测试装配图生成
 */
const axios = require('axios')
const db = require('./src/config/database')

const BASE_URL = 'http://localhost:3000/api'
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2FkbWluIiwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWUsInJvbGVJZCI6InJvbGVfYWRtaW4iLCJpYXQiOjE3NjI2MTI4ODcsImV4cCI6MTc2MzIxNzY4N30.83fHbVjgd1AwzQnl9TVXFO7Czrnn_gIzDR7iVCkrXE0'

async function getLatestPIDResult() {
  console.log('\n[Step 1] 查询最新的PID识别结果...')

  const result = await db('pid_recognition_results')
    .select('id', 'file_name', 'status', 'component_count')
    .orderBy('created_at', 'desc')
    .first()

  if (!result) {
    throw new Error('数据库中没有PID识别结果')
  }

  console.log(`✅ 找到PID结果: ${result.id}`)
  console.log(`   文件: ${result.file_name}`)
  console.log(`   零件数: ${result.component_count || 0}`)

  return result.id
}

async function generateAssembly(pidResultId) {
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

async function exportBOM(taskId) {
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
  } catch (error) {
    console.error('❌ BOM导出失败:', error.response?.data || error.message)
  }
}

async function exportReport(taskId) {
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
  console.log('  装配图生成测试（使用已有PID结果）')
  console.log('========================================')

  try {
    // 1. 获取最新PID结果
    const pidResultId = await getLatestPIDResult()

    // 2. 生成装配图
    const taskId = await generateAssembly(pidResultId)

    // 3. 导出BOM
    await exportBOM(taskId)

    // 4. 导出报告
    await exportReport(taskId)

    console.log('\n========================================')
    console.log('  ✅ 测试通过!')
    console.log('========================================\n')

  } catch (error) {
    console.error('\n========================================')
    console.error('  ❌ 测试失败!')
    console.error('========================================')
    console.error(error)
  } finally {
    await db.destroy()
  }
}

runTest()
