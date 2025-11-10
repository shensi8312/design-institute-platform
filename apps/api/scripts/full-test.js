const axios = require('axios')

const API = 'http://localhost:3000/api'
let token = ''
let testResults = []

function logTest(module, test, passed, message = '') {
  const result = { module, test, passed, message }
  testResults.push(result)
  const icon = passed ? '✅' : '❌'
  console.log(`   ${icon} ${test}${message ? ': ' + message : ''}`)
}

async function testAuth() {
  console.log('\n1️⃣ 认证模块')
  try {
    const res = await axios.post(`${API}/auth/login`, {
      username: 'admin',
      password: '123456'
    }, {
      headers: { 'Content-Type': 'application/json' }
    })
    if (res.data.success && res.data.data?.token) {
      token = res.data.data.token
      logTest('认证', '登录', true, `用户: ${res.data.data.user.username}`)
      return true
    }
    logTest('认证', '登录', false, '响应格式错误')
    return false
  } catch (e) {
    logTest('认证', '登录', false, e.response?.data?.message || e.message)
    return false
  }
}

async function testModule(name, endpoint) {
  console.log(`\n${name}`)
  const headers = { Authorization: `Bearer ${token}` }

  try {
    const res = await axios.get(`${API}${endpoint}`, { headers })
    const count = Array.isArray(res.data.data) ? res.data.data.length :
                  res.data.data?.list?.length || 0
    logTest(name, 'GET列表', true, `${count}条数据`)
    return true
  } catch (e) {
    logTest(name, 'GET列表', false, e.response?.data?.message || e.message)
    return false
  }
}

async function testDatabase() {
  console.log('\n🗄️ 数据库状态')
  const headers = { Authorization: `Bearer ${token}` }

  const modules = [
    { name: '组织', endpoint: '/organizations' },
    { name: '部门', endpoint: '/departments' },
    { name: '用户', endpoint: '/users' },
    { name: '角色', endpoint: '/roles' },
    { name: '权限', endpoint: '/permissions' },
    { name: '菜单', endpoint: '/menus' },
    { name: '项目', endpoint: '/projects' },
    { name: '知识库', endpoint: '/knowledge/bases' }
  ]

  for (const mod of modules) {
    try {
      const res = await axios.get(`${API}${mod.endpoint}`, { headers })
      const count = Array.isArray(res.data.data) ? res.data.data.length :
                    res.data.data?.list?.length || 0
      console.log(`   ✅ ${mod.name}: ${count}条`)
    } catch (e) {
      console.log(`   ❌ ${mod.name}: ${e.response?.data?.message || e.message}`)
    }
  }
}

async function runFullTest() {
  console.log('🚀 完整功能测试\n')
  console.log('=' .repeat(60))

  // 1. 认证测试
  const authOk = await testAuth()
  if (!authOk) {
    console.log('\n❌ 认证失败，终止测试')
    return
  }

  // 2. 核心模块测试
  await testModule('2️⃣ 组织管理', '/organizations')
  await testModule('3️⃣ 部门管理', '/departments')
  await testModule('4️⃣ 用户管理', '/users')
  await testModule('5️⃣ 角色管理', '/roles')
  await testModule('6️⃣ 权限管理', '/permissions')
  await testModule('7️⃣ 菜单管理', '/menus')
  await testModule('8️⃣ 项目管理', '/projects')
  await testModule('9️⃣ 知识库管理', '/knowledge/bases')

  // 3. 数据库状态
  await testDatabase()

  // 4. 汇总
  console.log('\n' + '='.repeat(60))
  console.log('\n📊 测试汇总')
  const passed = testResults.filter(r => r.passed).length
  const total = testResults.length
  console.log(`   通过: ${passed}/${total}`)

  if (passed === total) {
    console.log('\n✅ 所有测试通过！基础功能完整')
  } else {
    console.log('\n⚠️  部分测试失败，请检查')
    testResults.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.module}: ${r.test} - ${r.message}`)
    })
  }
}

runFullTest().catch(err => {
  console.error('\n❌ 测试异常:', err.message)
  process.exit(1)
})
