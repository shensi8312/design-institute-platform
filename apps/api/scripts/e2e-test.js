const axios = require('axios')

const API = 'http://localhost:3000/api'
let token = ''
let testResults = []

function log(message, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' }
  console.log(`${icons[type] || icons.info} ${message}`)
}

function logTest(module, action, success, detail = '') {
  testResults.push({ module, action, success, detail })
  log(`${module} - ${action}${detail ? ': ' + detail : ''}`, success ? 'success' : 'error')
}

async function testLogin() {
  console.log('\n📝 1. 登录流程测试')
  console.log('=' .repeat(60))

  try {
    // 测试登录
    const res = await axios.post(`${API}/auth/login`, {
      username: 'admin',
      password: '123456'
    })

    if (res.data.success && res.data.data.token) {
      token = res.data.data.token
      const user = res.data.data.user
      logTest('登录', '用户认证', true, `${user.name} (${user.username})`)
      logTest('登录', 'Token生成', true)
      return true
    }
    logTest('登录', '失败', false, res.data.message)
    return false
  } catch (e) {
    logTest('登录', '异常', false, e.message)
    return false
  }
}

async function testOrganizationCRUD() {
  console.log('\n🏢 2. 组织管理完整流程')
  console.log('=' .repeat(60))

  const headers = { Authorization: `Bearer ${token}` }
  let orgId = null

  try {
    // 2.1 读取现有组织列表
    const listRes = await axios.get(`${API}/organizations`, { headers })
    const beforeCount = listRes.data.data?.length || 0
    logTest('组织', '查询列表', true, `现有${beforeCount}个组织`)

    // 2.2 创建新组织
    const createRes = await axios.post(`${API}/organizations`, {
      name: `E2E测试组织_${Date.now()}`,
      code: `E2E_${Date.now()}`,
      type: 'design_institute',
      description: 'E2E自动化测试创建',
      status: 'active'
    }, { headers })

    if (createRes.data.success && createRes.data.data) {
      orgId = createRes.data.data.id
      logTest('组织', '创建', true, `ID: ${orgId}`)
    } else {
      logTest('组织', '创建', false, createRes.data.message)
      return false
    }

    // 2.3 读取详情
    const detailRes = await axios.get(`${API}/organizations/${orgId}`, { headers })
    if (detailRes.data.success) {
      logTest('组织', '查询详情', true, detailRes.data.data.name)
    } else {
      logTest('组织', '查询详情', false)
    }

    // 2.4 更新组织
    const updateRes = await axios.put(`${API}/organizations/${orgId}`, {
      description: 'E2E测试更新'
    }, { headers })

    if (updateRes.data.success) {
      logTest('组织', '更新', true)
    } else {
      logTest('组织', '更新', false)
    }

    // 2.5 验证列表增加
    const listRes2 = await axios.get(`${API}/organizations`, { headers })
    const afterCount = listRes2.data.data?.length || 0
    logTest('组织', '验证新增', afterCount > beforeCount, `${beforeCount} → ${afterCount}`)

    // 2.6 删除组织
    const deleteRes = await axios.delete(`${API}/organizations/${orgId}`, { headers })
    if (deleteRes.data.success) {
      logTest('组织', '删除', true)
    } else {
      logTest('组织', '删除', false)
    }

    return true
  } catch (e) {
    logTest('组织', 'CRUD流程', false, e.response?.data?.message || e.message)
    return false
  }
}

async function testUserManagement() {
  console.log('\n👤 3. 用户管理完整流程')
  console.log('=' .repeat(60))

  const headers = { Authorization: `Bearer ${token}` }
  let userId = null

  try {
    // 3.1 读取用户列表
    const listRes = await axios.get(`${API}/users`, { headers })
    const beforeCount = listRes.data.data?.list?.length || listRes.data.data?.length || 0
    logTest('用户', '查询列表', true, `现有${beforeCount}个用户`)

    // 3.2 创建新用户
    const createRes = await axios.post(`${API}/users`, {
      username: `e2e_test_user_${Date.now()}`,
      password: 'Test123456',
      email: `e2e_${Date.now()}@test.com`,
      name: 'E2E测试用户',
      status: 'active'
    }, { headers })

    if (createRes.data.success && createRes.data.data) {
      userId = createRes.data.data.id
      logTest('用户', '创建', true, `用户名: ${createRes.data.data.username}`)
    } else {
      logTest('用户', '创建', false, createRes.data.message)
      return false
    }

    // 3.3 读取用户详情
    const detailRes = await axios.get(`${API}/users/${userId}`, { headers })
    if (detailRes.data.success) {
      logTest('用户', '查询详情', true, detailRes.data.data.name)
    } else {
      logTest('用户', '查询详情', false)
    }

    // 3.4 更新用户
    const updateRes = await axios.put(`${API}/users/${userId}`, {
      name: 'E2E更新后的用户'
    }, { headers })

    if (updateRes.data.success) {
      logTest('用户', '更新', true)
    } else {
      logTest('用户', '更新', false)
    }

    // 3.5 删除用户
    const deleteRes = await axios.delete(`${API}/users/${userId}`, { headers })
    if (deleteRes.data.success) {
      logTest('用户', '删除', true)
    } else {
      logTest('用户', '删除', false)
    }

    return true
  } catch (e) {
    logTest('用户', '管理流程', false, e.response?.data?.message || e.message)
    return false
  }
}

async function testRolePermissions() {
  console.log('\n🔐 4. 角色权限流程')
  console.log('=' .repeat(60))

  const headers = { Authorization: `Bearer ${token}` }

  try {
    // 4.1 获取角色列表
    const rolesRes = await axios.get(`${API}/roles`, { headers })
    if (rolesRes.data.success) {
      const count = rolesRes.data.data?.list?.length || rolesRes.data.data?.length || 0
      logTest('角色', '查询列表', true, `${count}个角色`)
    }

    // 4.2 获取权限列表
    const permsRes = await axios.get(`${API}/permissions`, { headers })
    if (permsRes.data.success) {
      const count = permsRes.data.data?.list?.length || permsRes.data.data?.length || 0
      logTest('权限', '查询列表', true, `${count}个权限`)
    }

    // 4.3 获取权限树
    const treeRes = await axios.get(`${API}/permissions/tree`, { headers })
    if (treeRes.data.success) {
      logTest('权限', '查询树结构', true)
    }

    return true
  } catch (e) {
    logTest('角色权限', '查询', false, e.response?.data?.message || e.message)
    return false
  }
}

async function testMenus() {
  console.log('\n📋 5. 菜单管理流程')
  console.log('=' .repeat(60))

  const headers = { Authorization: `Bearer ${token}` }

  try {
    // 5.1 获取用户菜单
    const userMenuRes = await axios.get(`${API}/menus/user`, { headers })
    if (userMenuRes.data.success) {
      const count = userMenuRes.data.data?.length || 0
      logTest('菜单', '获取用户菜单', true, `${count}个菜单项`)
    } else {
      logTest('菜单', '获取用户菜单', false, userMenuRes.data.message)
    }

    // 5.2 获取菜单树
    const treeRes = await axios.get(`${API}/menus/tree`, { headers })
    if (treeRes.data.success) {
      logTest('菜单', '查询树结构', true)
    }

    return true
  } catch (e) {
    logTest('菜单', '查询', false, e.response?.data?.message || e.message)
    return false
  }
}

async function testProjects() {
  console.log('\n📁 6. 项目管理流程')
  console.log('=' .repeat(60))

  const headers = { Authorization: `Bearer ${token}` }

  try {
    // 6.1 读取项目列表
    const listRes = await axios.get(`${API}/projects`, { headers })
    const beforeCount = listRes.data.data?.list?.length || listRes.data.data?.length || 0
    logTest('项目', '查询列表', true, `现有${beforeCount}个项目`)

    // 6.2 创建项目
    const createRes = await axios.post(`${API}/projects`, {
      name: `E2E测试项目_${Date.now()}`,
      code: `PROJ_${Date.now()}`,
      type: 'construction',
      status: 'active',
      description: 'E2E测试项目'
    }, { headers })

    if (createRes.data.success) {
      const projectId = createRes.data.data.id
      logTest('项目', '创建', true, `ID: ${projectId}`)

      // 6.3 删除测试项目
      await axios.delete(`${API}/projects/${projectId}`, { headers })
      logTest('项目', '删除', true)
    } else {
      logTest('项目', '创建', false, createRes.data.message)
    }

    return true
  } catch (e) {
    logTest('项目', '管理流程', false, e.response?.data?.message || e.message)
    return false
  }
}

async function runE2ETests() {
  console.log('\n🚀 前后端端到端集成测试')
  console.log('=' .repeat(80))
  console.log('测试真实的用户操作流程...\n')

  const tests = [
    { name: '登录认证', fn: testLogin },
    { name: '组织管理', fn: testOrganizationCRUD },
    { name: '用户管理', fn: testUserManagement },
    { name: '角色权限', fn: testRolePermissions },
    { name: '菜单管理', fn: testMenus },
    { name: '项目管理', fn: testProjects }
  ]

  let passCount = 0

  for (const test of tests) {
    const result = await test.fn()
    if (result) passCount++
  }

  // 汇总报告
  console.log('\n' + '='.repeat(80))
  console.log('\n📊 E2E测试汇总')
  console.log('=' .repeat(80))

  const total = testResults.length
  const passed = testResults.filter(r => r.success).length
  const failed = testResults.filter(r => !r.success).length

  console.log(`\n总测试项: ${total}`)
  console.log(`✅ 通过: ${passed}`)
  console.log(`❌ 失败: ${failed}`)
  console.log(`\n通过率: ${((passed/total)*100).toFixed(1)}%`)

  if (failed > 0) {
    console.log('\n失败项:')
    testResults.filter(r => !r.success).forEach(r => {
      console.log(`  ❌ ${r.module} - ${r.action}: ${r.detail}`)
    })
  }

  console.log('\n' + '='.repeat(80))

  if (passed === total) {
    console.log('\n🎉 所有前后端集成测试通过!')
    console.log('✅ 前端输入 → 后端处理 → 正确响应 流程完整\n')
  } else {
    console.log('\n⚠️  部分测试失败，需要修复\n')
    process.exit(1)
  }
}

runE2ETests()
