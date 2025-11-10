const axios = require('axios')

const API = 'http://localhost:3000/api'

async function test() {
  console.log('🔍 测试核心模块 API\n')

  // 1. 登录 (尝试多个用户)
  console.log('1️⃣ 登录...')
  let token
  const testUsers = [
    { username: 'admin', password: '123456' },
    { username: 'admin', password: 'admin123' },
    { username: 'zhangsan', password: '123456' }
  ]

  for (const user of testUsers) {
    try {
      const loginRes = await axios.post(`${API}/auth/login`, user)
      if (loginRes.data.success && loginRes.data.data?.token) {
        token = loginRes.data.data.token
        console.log(`   ✅ 登录成功 (用户: ${user.username})\n`)
        break
      }
    } catch (e) {
      console.log(`   ⚠️  ${user.username} 登录失败: ${e.response?.data?.message || e.message}`)
    }
  }

  if (!token) {
    throw new Error('所有用户登录都失败')
  }

  const headers = { Authorization: `Bearer ${token}` }

  // 2. 测试组织
  console.log('2️⃣ 组织管理')
  const orgs = await axios.get(`${API}/organizations`, { headers })
  console.log(`   ✅ 组织数量: ${orgs.data.data?.length || 0}`)
  if (orgs.data.data?.length > 0) {
    console.log(`   示例: ${orgs.data.data[0].name}`)
  }

  // 3. 测试部门
  console.log('\n3️⃣ 部门管理')
  const depts = await axios.get(`${API}/departments`, { headers })
  console.log(`   ✅ 部门数量: ${depts.data.data?.length || 0}`)

  // 4. 测试用户
  console.log('\n4️⃣ 用户管理')
  const users = await axios.get(`${API}/users`, { headers })
  console.log(`   ✅ 用户数量: ${users.data.data?.length || 0}`)
  if (users.data.data?.length > 0) {
    console.log(`   示例用户: ${users.data.data.slice(0, 3).map(u => u.username).join(', ')}`)
  }

  // 5. 测试角色
  console.log('\n5️⃣ 角色管理')
  const roles = await axios.get(`${API}/roles`, { headers })
  console.log(`   ✅ 角色数量: ${roles.data.data?.length || 0}`)
  if (roles.data.data?.length > 0) {
    console.log(`   角色列表: ${roles.data.data.map(r => r.name).join(', ')}`)
  }

  // 6. 测试权限
  console.log('\n6️⃣ 权限管理')
  const perms = await axios.get(`${API}/permissions`, { headers })
  console.log(`   ✅ 权限数量: ${perms.data.data?.length || 0}`)

  // 7. 测试菜单
  console.log('\n7️⃣ 菜单管理')
  const menus = await axios.get(`${API}/menus/user`, { headers })
  console.log(`   ✅ 用户菜单数量: ${menus.data.data?.length || 0}`)
  if (menus.data.data?.length > 0) {
    console.log(`   菜单: ${menus.data.data.map(m => m.name).join(', ')}`)
  }

  // 8. 测试项目
  console.log('\n8️⃣ 项目管理')
  const projects = await axios.get(`${API}/projects`, { headers })
  console.log(`   ✅ 项目数量: ${projects.data.data?.length || 0}`)

  console.log('\n✅ 所有核心模块测试通过!')
  console.log('\n📊 总结:')
  console.log(`   组织: ${orgs.data.data?.length || 0}`)
  console.log(`   部门: ${depts.data.data?.length || 0}`)
  console.log(`   用户: ${users.data.data?.length || 0}`)
  console.log(`   角色: ${roles.data.data?.length || 0}`)
  console.log(`   权限: ${perms.data.data?.length || 0}`)
  console.log(`   菜单: ${menus.data.data?.length || 0}`)
  console.log(`   项目: ${projects.data.data?.length || 0}`)
}

test().catch(err => {
  console.error('\n❌ 测试失败:', err.response?.data || err.message)
  process.exit(1)
})
