const axios = require('axios')
const fs = require('fs')
const path = require('path')

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2FkbWluIiwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWUsInJvbGVJZCI6InJvbGVfYWRtaW4iLCJpYXQiOjE3NjI2MTI4ODcsImV4cCI6MTc2MzIxNzY4N30.83fHbVjgd1AwzQnl9TVXFO7Czrnn_gIzDR7iVCkrXE0'
const db = require('./apps/api/src/config/database')

async function exportLatestAssembly() {
  // 获取最新装配任务
  const task = await db('assembly_inference_tasks')
    .orderBy('created_at', 'desc')
    .first()

  if (!task) {
    console.log('没有找到装配任务')
    return
  }

  console.log('\n=== 最新装配任务 ===')
  console.log('ID:', task.id)
  console.log('状态:', task.status)
  console.log('零件数:', task.parts_count)
  console.log('约束数:', task.constraints_count)
  console.log('创建时间:', task.created_at)

  const BASE_URL = 'http://localhost:3000/api/assembly'
  const outputDir = path.join(__dirname, 'assembly_output')

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir)
  }

  // 1. 导出BOM
  try {
    const bomResponse = await axios.get(
      BASE_URL + '/export/' + task.id + '?format=bom',
      {
        headers: { 'Authorization': 'Bearer ' + TOKEN },
        responseType: 'text'
      }
    )

    const bomPath = path.join(outputDir, 'BOM_' + task.id + '.csv')
    fs.writeFileSync(bomPath, bomResponse.data, 'utf8')
    console.log('\n✅ BOM已保存:', bomPath)
    console.log('\n--- BOM内容 ---')
    console.log(bomResponse.data)
  } catch (error) {
    console.error('BOM导出失败:', error.message)
  }

  // 2. 导出验证报告
  try {
    const reportResponse = await axios.get(
      BASE_URL + '/export/' + task.id + '?format=report',
      {
        headers: { 'Authorization': 'Bearer ' + TOKEN }
      }
    )

    const reportPath = path.join(outputDir, 'Report_' + task.id + '.json')
    fs.writeFileSync(reportPath, JSON.stringify(reportResponse.data, null, 2), 'utf8')
    console.log('\n✅ 报告已保存:', reportPath)
    console.log('\n--- 验证报告 ---')
    console.log(JSON.stringify(reportResponse.data, null, 2))
  } catch (error) {
    console.error('报告导出失败:', error.message)
  }

  // 3. 显示装配位姿数据
  const solverResult = typeof task.solver_result === 'string'
    ? JSON.parse(task.solver_result)
    : task.solver_result

  console.log('\n=== 装配位姿数据 ===')
  if (solverResult.placements && solverResult.placements.length > 0) {
    console.log('零件位置 (' + solverResult.placements.length + '个):')
    solverResult.placements.slice(0, 5).forEach(function(p, i) {
      const pn = p.part_number || p.type
      const x = p.position.x.toFixed(1)
      const y = p.position.y.toFixed(1)
      const z = p.position.z.toFixed(1)
      console.log('  ' + (i+1) + '. ' + pn + ': (' + x + ', ' + y + ', ' + z + ')')
    })
  }

  if (solverResult.conflicts && solverResult.conflicts.length > 0) {
    console.log('\n冲突检测 (' + solverResult.conflicts.length + '个):')
    solverResult.conflicts.slice(0, 5).forEach(function(c, i) {
      const msg = c.suggestion || c.resolution || c.type
      console.log('  ' + (i+1) + '. ' + c.type + ': ' + msg)
    })
  }

  if (solverResult.elevation_layers) {
    console.log('\n层次布局: ' + solverResult.elevation_layers.length + ' 层')
  }

  console.log('\n=== 文件位置 ===')
  console.log('输出目录:', outputDir)

  await db.destroy()
}

exportLatestAssembly().catch(console.error)
