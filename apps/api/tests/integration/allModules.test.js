const request = require('supertest')
const app = require('../../src/app')
const db = require('../../src/config/database')

/**
 * 所有模块的集成测试
 * 测试所有重构的Controller → Service → Repository → Database
 */
describe('全模块集成测试', () => {
  let adminToken
  let testIds = {
    organization: null,
    department: null,
    role: null,
    user: null,
    menu: null,
    permission: null
  }

  // 在所有测试之前，先登录获取token
  beforeAll(async () => {
    // 尝试登录管理员
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'admin123'
      })
    
    if (loginResponse.body.success) {
      adminToken = loginResponse.body.data.token
      console.log('✅ 管理员登录成功')
    } else {
      // 如果admin不存在，创建一个
      const hashedPassword = await require('bcryptjs').hash('admin123', 10)
      await db('users').insert({
        id: 'admin_' + Date.now(),
        username: 'admin',
        password_hash: hashedPassword,
        name: '系统管理员',
        is_admin: true,
        status: 'active'
      })
      
      const retryLogin = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        })
      
      adminToken = retryLogin.body.data?.token
    }
  })

  // 清理测试数据
  afterAll(async () => {
    // 按依赖顺序删除测试数据
    if (testIds.user) {
      await db('user_departments').where('user_id', testIds.user).delete()
      await db('users').where('id', testIds.user).delete()
    }
    if (testIds.permission) {
      await db('permissions').where('id', testIds.permission).delete()
    }
    if (testIds.menu) {
      await db('menus').where('id', testIds.menu).delete()
    }
    if (testIds.role) {
      await db('roles').where('id', testIds.role).delete()
    }
    if (testIds.department) {
      await db('departments').where('id', testIds.department).delete()
    }
    if (testIds.organization) {
      await db('organizations').where('id', testIds.organization).delete()
    }
    
    await db.destroy()
  })

  describe('1. 组织管理模块测试', () => {
    test('创建组织', async () => {
      const response = await request(app)
        .post('/api/organizations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `测试组织_${Date.now()}`,
          code: `ORG_${Date.now()}`,
          type: 'company',
          status: 'active'
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBeDefined()
      
      testIds.organization = response.body.data.id
    })

    test('获取组织列表', async () => {
      const response = await request(app)
        .get('/api/organizations')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data.list)).toBe(true)
    })

    test('更新组织', async () => {
      const response = await request(app)
        .put(`/api/organizations/${testIds.organization}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '更新后的组织名称'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.name).toBe('更新后的组织名称')
    })
  })

  describe('2. 部门管理模块测试', () => {
    test('创建部门', async () => {
      const response = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `测试部门_${Date.now()}`,
          code: `DEPT_${Date.now()}`,
          organization_id: testIds.organization,
          status: 'active'
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBeDefined()
      
      testIds.department = response.body.data.id
    })

    test('获取部门树', async () => {
      const response = await request(app)
        .get('/api/departments/tree')
        .query({ organizationId: testIds.organization })
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data)).toBe(true)
    })

    test('更新部门', async () => {
      const response = await request(app)
        .put(`/api/departments/${testIds.department}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '更新后的部门名称'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })

  describe('3. 角色管理模块测试', () => {
    test('创建角色', async () => {
      const response = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `测试角色_${Date.now()}`,
          code: `ROLE_${Date.now()}`,
          permissions: ['user.view', 'user.create'],
          status: 'active'
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBeDefined()
      
      testIds.role = response.body.data.id
    })

    test('获取角色列表', async () => {
      const response = await request(app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data.list)).toBe(true)
    })

    test('分配权限给角色', async () => {
      const response = await request(app)
        .post(`/api/roles/${testIds.role}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          permissions: ['user.view', 'user.create', 'user.update']
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })

  describe('4. 用户管理模块测试', () => {
    test('创建用户', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: `testuser_${Date.now()}`,
          password: 'Test123456',
          name: '测试用户',
          email: `test${Date.now()}@example.com`,
          organization_id: testIds.organization,
          department_id: testIds.department,
          role_id: testIds.role
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBeDefined()
      
      testIds.user = response.body.data.id
    })

    test('获取用户详情', async () => {
      const response = await request(app)
        .get(`/api/users/${testIds.user}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBe(testIds.user)
    })

    test('更新用户信息', async () => {
      const response = await request(app)
        .put(`/api/users/${testIds.user}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '更新后的用户名',
          phone: '13800138000'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.name).toBe('更新后的用户名')
    })
  })

  describe('5. 菜单管理模块测试', () => {
    test('创建菜单', async () => {
      const response = await request(app)
        .post('/api/menus')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `测试菜单_${Date.now()}`,
          path: `/test/${Date.now()}`,
          component: 'TestComponent',
          icon: 'test-icon',
          sort_order: 1,
          status: 'active'
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBeDefined()
      
      testIds.menu = response.body.data.id
    })

    test('获取菜单树', async () => {
      const response = await request(app)
        .get('/api/menus/tree')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data)).toBe(true)
    })

    test('更新菜单', async () => {
      const response = await request(app)
        .put(`/api/menus/${testIds.menu}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '更新后的菜单名称',
          sort_order: 2
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })

  describe('6. 权限管理模块测试', () => {
    test('创建权限', async () => {
      const response = await request(app)
        .post('/api/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '测试权限',
          code: `test.permission.${Date.now()}`,
          module: 'test',
          action: 'permission',
          type: 'operation',
          status: 'active'
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBeDefined()
      
      testIds.permission = response.body.data.id
    })

    test('获取权限树', async () => {
      const response = await request(app)
        .get('/api/permissions/tree')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data)).toBe(true)
    })

    test('检查用户权限', async () => {
      const response = await request(app)
        .get('/api/permissions/check')
        .query({ permission: 'user.view' })
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })
  })

  describe('7. 认证模块测试', () => {
    let testUserToken
    const testUsername = `authtest_${Date.now()}`

    test('用户注册', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: testUsername,
          password: 'Test123456',
          name: '认证测试用户',
          email: `authtest${Date.now()}@example.com`
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.token).toBeDefined()
      
      testUserToken = response.body.data.token
    })

    test('用户登录', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsername,
          password: 'Test123456'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.token).toBeDefined()
    })

    test('获取当前用户信息', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${testUserToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.username).toBe(testUsername)
    })

    test('修改密码', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          oldPassword: 'Test123456',
          newPassword: 'NewPass123456'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })

    test('用户登出', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${testUserToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
    })

    // 清理认证测试用户
    afterAll(async () => {
      await db('users').where('username', testUsername).delete()
    })
  })

  describe('8. 跨模块关联测试', () => {
    test('用户-部门-角色关联', async () => {
      // 获取用户信息，应包含部门和角色信息
      const response = await request(app)
        .get(`/api/users/${testIds.user}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data.department_name).toBeDefined()
      expect(response.body.data.role_name).toBeDefined()
      expect(response.body.data.organization_name).toBeDefined()
    })

    test('角色-权限关联', async () => {
      // 获取角色的权限
      const response = await request(app)
        .get(`/api/roles/${testIds.role}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(Array.isArray(response.body.data)).toBe(true)
    })

    test('部门-组织关联', async () => {
      // 获取部门信息，应包含组织信息
      const response = await request(app)
        .get(`/api/departments/${testIds.department}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.data.organization_id).toBe(testIds.organization)
    })
  })

  describe('9. 批量操作测试', () => {
    test('批量导入菜单', async () => {
      const response = await request(app)
        .post('/api/menus/batch')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          menus: [
            { name: '批量菜单1', path: '/batch1' },
            { name: '批量菜单2', path: '/batch2' }
          ]
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.imported.length).toBeGreaterThan(0)
    })

    test('批量更新用户状态', async () => {
      // 先创建几个测试用户
      const userIds = []
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            username: `batchuser_${Date.now()}_${i}`,
            password: 'Test123456'
          })
        if (res.body.success) {
          userIds.push(res.body.data.id)
        }
      }

      // 批量更新状态
      const response = await request(app)
        .put('/api/users/batch/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userIds,
          status: 'inactive'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // 清理
      for (const id of userIds) {
        await db('users').where('id', id).delete()
      }
    })
  })

  describe('10. 数据导出测试', () => {
    test('导出组织数据', async () => {
      const response = await request(app)
        .get('/api/organizations/export')
        .query({ format: 'json' })
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
    })

    test('导出角色数据为CSV', async () => {
      const response = await request(app)
        .get('/api/roles/export')
        .query({ format: 'csv' })
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toContain('text/csv')
    })
  })
})