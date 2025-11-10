const axios = require('axios')

const API = 'http://localhost:3000/api'

async function runTest() {
  console.log('🔍 平台基础功能测试\n')
  console.log('=' .repeat(60))

  // 1. 登录
  console.log('\n1️⃣ 认证测试')
  let token
  try {
    const loginRes = await axios.post(`${API}/auth/login`, {
      username: 'admin',
      password: '123456'
    })
    token = loginRes.data.data.token
    console.log(`   ✅ 登录成功 (${loginRes.data.data.user.name})`)
  } catch (e) {
    console.log('   ❌ 登录失败:', e.message)
    process.exit(1)
  }

  const headers = { Authorization: `Bearer ${token}` }

  // 2. 测试各模块
  const modules = [
    { name: '组织', path: '/organizations' },
    { name: '部门', path: '/departments' },
    { name: '用户', path: '/users' },
    { name: '角色', path: '/roles' },
    { name: '权限', path: '/permissions' },
    { name: '菜单', path: '/menus' },
    { name: '项目', path: '/projects' },
    { name: '知识库', path: '/knowledge/bases' }
  ]

  console.log('\n2️⃣ 核心模块API测试')
  let passCount = 0
  for (const mod of modules) {
    try {
      const res = await axios.get(`${API}${mod.path}`, { headers })
      const count = Array.isArray(res.data.data) ? res.data.data.length :
                    res.data.data?.list?.length || res.data.data?.total || 0
      console.log(`   ✅ ${mod.name}: ${count}条数据`)
      passCount++
    } catch (e) {
      console.log(`   ❌ ${mod.name}: ${e.response?.data?.message || e.message}`)
    }
  }

  // 3. 前端检查
  console.log('\n3️⃣ 前端服务')
  try {
    const frontendRes = await axios.get('http://localhost:5173', { timeout: 2000 })
    console.log('   ✅ 前端运行中 (端口: 5173)')
  } catch (e) {
    console.log('   ❌ 前端未运行')
  }

  // 4. 汇总
  console.log('\n' + '='.repeat(60))
  console.log(`\n📊 测试结果: ${passCount}/${modules.length} 模块通过`)

  if (passCount === modules.length) {
    console.log('\n✅ 所有基础功能正常，可以开始知识库开发！')
  } else {
    console.log('\n⚠️  部分模块需要检查')
  }
}

runTest()
