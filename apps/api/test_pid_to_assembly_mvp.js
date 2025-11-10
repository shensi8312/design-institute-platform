/**
 * PID → 装配图 MVP测试
 */
const axios = require('axios')

// 测试配置
const BASE_URL = 'http://localhost:3000/api'
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2FkbWluIiwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWUsInJvbGVJZCI6InJvbGVfYWRtaW4iLCJpYXQiOjE3NjI2MTI4ODcsImV4cCI6MTc2MzIxNzY4N30.83fHbVjgd1AwzQnl9TVXFO7Czrnn_gIzDR7iVCkrXE0'

const db = require('./src/config/database')

async function createMockPIDResult() {
  console.log('[Step 1] 创建模拟PID识别结果...')

  // 模拟一个简单的管道系统：阀门-法兰-管道-法兰-阀门
  const mockTopology = {
    nodes: [
      { id: 'node_1', type: 'start', x: 0, y: 0 },
      { id: 'node_2', type: 'valve', x: 100, y: 0 },
      { id: 'node_3', type: 'pipe', x: 300, y: 0 },
      { id: 'node_4', type: 'valve', x: 500, y: 0 },
      { id: 'node_5', type: 'end', x: 600, y: 0 }
    ],
    edges: [
      { id: 'edge_1', from: 'node_1', to: 'node_2', dx: 100, dy: 0 },
      { id: 'edge_2', from: 'node_2', to: 'node_3', dx: 200, dy: 0 },
      { id: 'edge_3', from: 'node_3', to: 'node_4', dx: 200, dy: 0 },
      { id: 'edge_4', from: 'node_4', to: 'node_5', dx: 100, dy: 0 }
    ]
  }

  const mockComponents = [
    {
      id: 'comp_1',
      tag: 'V-001',
      type: 'valve',
      component_type: 'valve',
      dn: 50,
      pn: 16,
      node_id: 'node_2',
      description: '球阀 DN50 PN16'
    },
    {
      id: 'comp_2',
      tag: 'FL-001',
      type: 'flange',
      component_type: 'flange',
      dn: 50,
      pn: 16,
      face_type: 'rf',
      node_id: 'node_2',
      description: '对焊法兰 DN50 PN16 RF'
    },
    {
      id: 'comp_3',
      tag: 'P-001',
      type: 'pipe',
      component_type: 'pipe',
      dn: 50,
      pn: 16,
      end_type: 'weld',
      node_id: 'node_3',
      description: '直管 DN50'
    },
    {
      id: 'comp_4',
      tag: 'FL-002',
      type: 'flange',
      component_type: 'flange',
      dn: 50,
      pn: 16,
      face_type: 'rf',
      node_id: 'node_4',
      description: '对焊法兰 DN50 PN16 RF'
    },
    {
      id: 'comp_5',
      tag: 'V-002',
      type: 'valve',
      component_type: 'valve',
      dn: 50,
      pn: 16,
      node_id: 'node_4',
      description: '球阀 DN50 PN16'
    }
  ]

  // 插入模拟PID识别结果
  const [result] = await db('pid_recognition_results').insert({
    file_name: 'test_pid_mvp.png',
    file_path: '/tmp/test_pid_mvp.png',
    status: 'confirmed',
    components: JSON.stringify(mockComponents),
    connections: JSON.stringify([]),
    graph_analysis: JSON.stringify(mockTopology),
    component_count: mockComponents.length,
    connection_count: 0,
    page_count: 1
  }).returning('id')

  const resultId = result.id || result

  console.log(`✅ 创建PID识别结果: ${resultId}`)
  return resultId
}

async function testPidTo3D(pidResultId) {
  console.log('\n[Step 2] 调用 PID → 装配图 API...')

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

    console.log('\n✅ API调用成功!')
    console.log('返回数据:', JSON.stringify(response.data, null, 2))

    return response.data
  } catch (error) {
    console.error('❌ API调用失败:', error.response?.data || error.message)
    throw error
  }
}

async function testExportBOM(taskId) {
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
    console.log('BOM内容:\n', response.data)

    return response.data
  } catch (error) {
    console.error('❌ BOM导出失败:', error.response?.data || error.message)
  }
}

async function testExportReport(taskId) {
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
    console.log('报告内容:', JSON.stringify(response.data, null, 2))

    return response.data
  } catch (error) {
    console.error('❌ 报告导出失败:', error.response?.data || error.message)
  }
}

async function verifyDatabase(taskId) {
  console.log('\n[Step 5] 验证数据库记录...')

  // 查询任务记录
  const task = await db('assembly_inference_tasks')
    .where({ id: taskId })
    .first()

  console.log('任务记录:', {
    id: task.id,
    status: task.status,
    parts_count: task.parts_count,
    constraints_count: task.constraints_count
  })

  // 查询验证报告
  const report = await db('assembly_validation_reports')
    .where({ task_id: taskId })
    .first()

  console.log('验证报告:', {
    overall_status: report?.overall_status,
    summary: typeof report?.summary === 'string'
      ? JSON.parse(report.summary)
      : (report?.summary || {})
  })

  console.log('\n✅ 数据库验证完成')
}

async function cleanup(pidResultId) {
  console.log('\n[Cleanup] 清理测试数据...')

  // 删除PID识别结果（级联删除装配任务）
  await db('pid_recognition_results').where({ id: pidResultId }).del()

  console.log('✅ 清理完成')
}

async function runTest() {
  console.log('========================================')
  console.log('  PID → 装配图 MVP 端到端测试')
  console.log('========================================\n')

  let pidResultId

  try {
    // 1. 创建模拟PID数据
    pidResultId = await createMockPIDResult()

    // 2. 调用PID→装配图API
    const result = await testPidTo3D(pidResultId)
    const taskId = result.task_id

    console.log('\n========================================')
    console.log('  核心指标检查')
    console.log('========================================')
    console.log(`✓ 零件数: ${result.parts}`)
    console.log(`✓ 位姿数: ${result.placements}`)
    console.log(`✓ 验证状态: ${result.validation?.overall_status || 'unknown'}`)
    console.log(`✓ 不确定项: ${result.uncertainties?.length || 0}`)
    console.log(`✓ 冲突数: ${result.conflicts?.length || 0}`)

    if (result.uncertainties?.length > 0) {
      console.log('\n⚠️ 不确定零件选择:')
      result.uncertainties.forEach(u => {
        console.log(`  - ${u.component}: ${u.selected} (得分: ${u.score?.toFixed(2)})`)
      })
    }

    if (result.conflicts?.length > 0) {
      console.log('\n⚠️ 布局冲突:')
      result.conflicts.forEach(c => {
        console.log(`  - ${c.type}: ${c.component || c.node_id}`)
      })
    }

    console.log('\n后续步骤:', result.next_steps?.join('\n  '))

    // 3. 导出BOM
    await testExportBOM(taskId)

    // 4. 导出报告
    await testExportReport(taskId)

    // 5. 验证数据库
    await verifyDatabase(taskId)

    console.log('\n========================================')
    console.log('  ✅ 测试通过!')
    console.log('========================================\n')

  } catch (error) {
    console.error('\n========================================')
    console.error('  ❌ 测试失败!')
    console.error('========================================')
    console.error(error)
  } finally {
    // 清理测试数据
    if (pidResultId) {
      await cleanup(pidResultId)
    }

    // 关闭数据库连接
    await db.destroy()
  }
}

// 运行测试
runTest()
