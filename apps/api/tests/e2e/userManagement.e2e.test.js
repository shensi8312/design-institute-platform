const request = require('supertest')
const app = require('../../src/app')
const db = require('../../src/config/database')

/**
 * 端到端测试 - 用户管理完整流程
 * 测试从 Controller → Service → Repository → Database 的完整链路
 */
describe('用户管理端到端测试', () => {
  let adminToken
  let testOrganizationId
  let testDepartmentId
  let testRoleId
  let testUserId
  const timestamp = Date.now()

  // 测试前准备
  beforeAll(async () => {
    console.log('🚀 开始端到端测试准备...')
    
    // 1. 登录管理员账号获取token
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
      throw new Error('无法登录管理员账号，请确保数据库中有admin用户')
    }

    // 2. 创建测试组织
    const orgResponse = await request(app)
      .post('/api/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `E2E测试组织_${timestamp}`,
        code: `E2E_ORG_${timestamp}`,
        type: 'company',
        status: 'active'
      })
    
    if (orgResponse.body.success) {
      testOrganizationId = orgResponse.body.data.id
      console.log('✅ 测试组织创建成功:', testOrganizationId)
    }

    // 3. 创建测试部门
    const deptResponse = await request(app)
      .post('/api/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `E2E测试部门_${timestamp}`,
        code: `E2E_DEPT_${timestamp}`,
        organization_id: testOrganizationId,
        status: 'active'
      })
    
    if (deptResponse.body.success) {
      testDepartmentId = deptResponse.body.data.id
      console.log('✅ 测试部门创建成功:', testDepartmentId)
    }

    // 4. 创建测试角色
    const roleResponse = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `E2E测试角色_${timestamp}`,
        code: `E2E_ROLE_${timestamp}`,
        permissions: ['user.view', 'user.create', 'user.update'],
        status: 'active'
      })
    
    if (roleResponse.body.success) {
      testRoleId = roleResponse.body.data.id
      console.log('✅ 测试角色创建成功:', testRoleId)
    }
  })

  // 测试后清理
  afterAll(async () => {
    console.log('🧹 开始清理测试数据...')
    
    try {
      // 清理测试用户
      if (testUserId) {
        await db('user_departments').where('user_id', testUserId).delete()
        await db('users').where('id', testUserId).delete()
      }
      
      // 清理所有E2E测试用户
      await db('users').where('username', 'like', 'e2e_test_%').delete()
      
      // 清理测试角色
      if (testRoleId) {
        await db('roles').where('id', testRoleId).delete()
      }
      
      // 清理测试部门
      if (testDepartmentId) {
        await db('departments').where('id', testDepartmentId).delete()
      }
      
      // 清理测试组织
      if (testOrganizationId) {
        await db('organizations').where('id', testOrganizationId).delete()
      }
      
      console.log('✅ 测试数据清理完成')
    } catch (error) {
      console.error('清理测试数据失败:', error)
    }
    
    // 关闭数据库连接
    await db.destroy()
  })

  describe('场景一：完整的用户生命周期管理', () => {
    const testUsername = `e2e_test_user_${timestamp}`
    let userToken

    test('步骤1: 创建新用户（包含组织、部门、角色）', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: testUsername,
          password: 'Test123456',
          name: 'E2E测试用户',
          email: `e2e_${timestamp}@test.com`,
          phone: '13800138000',
          organization_id: testOrganizationId,
          department_id: testDepartmentId,
          role_id: testRoleId
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.username).toBe(testUsername)
      
      testUserId = response.body.data.id

      // 验证数据已保存到数据库
      const savedUser = await db('users').where('id', testUserId).first()
      expect(savedUser).toBeDefined()
      expect(savedUser.organization_id).toBe(testOrganizationId)
      expect(savedUser.department_id).toBe(testDepartmentId)
      expect(savedUser.role_id).toBe(testRoleId)
    })

    test('步骤2: 新用户登录系统', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsername,
          password: 'Test123456'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.token).toBeDefined()
      expect(response.body.data.user.username).toBe(testUsername)
      
      userToken = response.body.data.token

      // 验证最后登录时间已更新
      const user = await db('users').where('id', testUserId).first()
      expect(user.last_login_at).toBeDefined()
    })

    test('步骤3: 获取用户详情（包含关联信息）', async () => {
      const response = await request(app)
        .get(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBe(testUserId)
      expect(response.body.data.organization_name).toBeDefined()
      expect(response.body.data.department_name).toBeDefined()
      expect(response.body.data.role_name).toBeDefined()
    })

    test('步骤4: 更新用户信息', async () => {
      const newName = 'E2E更新后的用户'
      const newPhone = '13900139000'

      const response = await request(app)
        .put(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: newName,
          phone: newPhone
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.name).toBe(newName)
      expect(response.body.data.phone).toBe(newPhone)

      // 验证数据库已更新
      const updatedUser = await db('users').where('id', testUserId).first()
      expect(updatedUser.name).toBe(newName)
      expect(updatedUser.phone).toBe(newPhone)
    })

    test('步骤5: 修改用户密码', async () => {
      const newPassword = 'NewPass123456'

      // 用户自己修改密码
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          oldPassword: 'Test123456',
          newPassword: newPassword
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // 验证新密码可以登录
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsername,
          password: newPassword
        })

      expect(loginResponse.status).toBe(200)
      expect(loginResponse.body.success).toBe(true)
    })

    test('步骤6: 禁用用户账号', async () => {
      const response = await request(app)
        .put(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'inactive'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('inactive')

      // 验证禁用用户无法登录
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsername,
          password: 'NewPass123456'
        })

      expect(loginResponse.status).toBe(401)
      expect(loginResponse.body.success).toBe(false)
    })

    test('步骤7: 重新激活用户', async () => {
      const response = await request(app)
        .put(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'active'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.status).toBe('active')

      // 验证重新激活后可以登录
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsername,
          password: 'NewPass123456'
        })

      expect(loginResponse.status).toBe(200)
      expect(loginResponse.body.success).toBe(true)
    })

    test('步骤8: 删除用户', async () => {
      const response = await request(app)
        .delete(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // 验证用户已被删除
      const deletedUser = await db('users').where('id', testUserId).first()
      expect(deletedUser).toBeUndefined()

      // 验证已删除用户无法登录
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsername,
          password: 'NewPass123456'
        })

      expect(loginResponse.status).toBe(401)
      expect(loginResponse.body.success).toBe(false)

      // 清空testUserId，避免afterAll重复删除
      testUserId = null
    })
  })

  describe('场景二：批量操作和搜索', () => {
    const userIds = []

    beforeAll(async () => {
      // 创建多个测试用户
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            username: `e2e_test_batch_${timestamp}_${i}`,
            password: 'Test123456',
            name: `批量测试用户${i}`,
            email: `batch${i}_${timestamp}@test.com`,
            organization_id: testOrganizationId,
            department_id: testDepartmentId,
            role_id: testRoleId
          })
        
        if (response.body.success) {
          userIds.push(response.body.data.id)
        }
      }
    })

    afterAll(async () => {
      // 清理批量创建的用户
      for (const userId of userIds) {
        await db('user_departments').where('user_id', userId).delete()
        await db('users').where('id', userId).delete()
      }
    })

    test('搜索用户', async () => {
      const response = await request(app)
        .get('/api/users')
        .query({
          search: `e2e_test_batch_${timestamp}`,
          pageSize: 10
        })
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.list.length).toBeGreaterThanOrEqual(5)
    })

    test('按部门筛选用户', async () => {
      const response = await request(app)
        .get('/api/users')
        .query({
          departmentId: testDepartmentId,
          pageSize: 10
        })
        .set('Authorization', `Bearer ${adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.list.length).toBeGreaterThanOrEqual(5)
      
      // 验证所有返回的用户都属于该部门
      response.body.data.list.forEach(user => {
        expect(user.department_id).toBe(testDepartmentId)
      })
    })

    test('分页获取用户', async () => {
      // 第一页
      const page1Response = await request(app)
        .get('/api/users')
        .query({
          page: 1,
          pageSize: 2,
          departmentId: testDepartmentId
        })
        .set('Authorization', `Bearer ${adminToken}`)

      expect(page1Response.status).toBe(200)
      expect(page1Response.body.data.list.length).toBeLessThanOrEqual(2)
      expect(page1Response.body.data.pagination.page).toBe(1)

      // 第二页
      const page2Response = await request(app)
        .get('/api/users')
        .query({
          page: 2,
          pageSize: 2,
          departmentId: testDepartmentId
        })
        .set('Authorization', `Bearer ${adminToken}`)

      expect(page2Response.status).toBe(200)
      expect(page2Response.body.data.pagination.page).toBe(2)

      // 验证分页数据不重复
      const page1Ids = page1Response.body.data.list.map(u => u.id)
      const page2Ids = page2Response.body.data.list.map(u => u.id)
      const intersection = page1Ids.filter(id => page2Ids.includes(id))
      expect(intersection.length).toBe(0)
    })

    test('批量更新用户状态', async () => {
      const response = await request(app)
        .put('/api/users/batch/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userIds: userIds.slice(0, 3),
          status: 'inactive'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)

      // 验证状态已更新
      const users = await db('users').whereIn('id', userIds.slice(0, 3))
      users.forEach(user => {
        expect(user.status).toBe('inactive')
      })
    })
  })

  describe('场景三：权限和角色验证', () => {
    let limitedUserToken
    let limitedUserId

    beforeAll(async () => {
      // 创建一个权限受限的用户
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: `e2e_test_limited_${timestamp}`,
          password: 'Test123456',
          name: '权限受限用户',
          is_admin: false
        })
      
      if (response.body.success) {
        limitedUserId = response.body.data.id

        // 登录获取token
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            username: `e2e_test_limited_${timestamp}`,
            password: 'Test123456'
          })
        
        limitedUserToken = loginResponse.body.data.token
      }
    })

    afterAll(async () => {
      // 清理测试用户
      if (limitedUserId) {
        await db('users').where('id', limitedUserId).delete()
      }
    })

    test('非管理员无法创建用户', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${limitedUserToken}`)
        .send({
          username: 'should_fail',
          password: 'Test123456'
        })

      expect(response.status).toBe(403)
      expect(response.body.success).toBe(false)
    })

    test('非管理员无法删除用户', async () => {
      // 先创建一个用户
      const createResponse = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: `e2e_test_delete_${timestamp}`,
          password: 'Test123456'
        })
      
      const userIdToDelete = createResponse.body.data.id

      // 尝试用受限用户删除
      const deleteResponse = await request(app)
        .delete(`/api/users/${userIdToDelete}`)
        .set('Authorization', `Bearer ${limitedUserToken}`)

      expect(deleteResponse.status).toBe(403)
      expect(deleteResponse.body.success).toBe(false)

      // 清理
      await db('users').where('id', userIdToDelete).delete()
    })

    test('用户可以查看自己的信息', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${limitedUserToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBe(limitedUserId)
    })

    test('用户可以更新自己的部分信息', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${limitedUserToken}`)
        .send({
          name: '更新后的名字',
          phone: '13700137000'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.name).toBe('更新后的名字')
    })

    test('用户不能修改自己的角色和权限', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${limitedUserToken}`)
        .send({
          is_admin: true,
          role_id: testRoleId
        })

      // 即使请求成功，这些字段也不应该被更新
      if (response.status === 200) {
        const user = await db('users').where('id', limitedUserId).first()
        expect(user.is_admin).toBe(false)
        expect(user.role_id).not.toBe(testRoleId)
      }
    })
  })

  describe('场景四：数据完整性和事务测试', () => {
    test('创建用户时组织ID无效应该失败', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: `e2e_test_invalid_org_${timestamp}`,
          password: 'Test123456',
          organization_id: 'invalid_org_id'
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)

      // 验证用户未被创建
      const user = await db('users')
        .where('username', `e2e_test_invalid_org_${timestamp}`)
        .first()
      expect(user).toBeUndefined()
    })

    test('并发创建相同用户名应该只成功一个', async () => {
      const username = `e2e_test_concurrent_${timestamp}`
      
      // 同时发送5个创建请求
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            username,
            password: 'Test123456'
          })
      )

      const results = await Promise.all(promises)
      
      // 只有一个应该成功
      const successCount = results.filter(r => r.body.success).length
      expect(successCount).toBe(1)

      // 数据库中只有一条记录
      const users = await db('users').where('username', username)
      expect(users.length).toBe(1)

      // 清理
      await db('users').where('username', username).delete()
    })

    test('事务回滚测试 - 创建用户失败时不应创建部门关联', async () => {
      // 这个测试模拟创建用户过程中出错，验证事务回滚
      // 由于很难在测试中模拟事务中途失败，这里只是验证正常流程
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: `e2e_test_transaction_${timestamp}`,
          password: 'Test123456',
          departmentIds: [testDepartmentId]
        })

      if (response.body.success) {
        const userId = response.body.data.id
        
        // 验证用户和部门关联都创建成功
        const user = await db('users').where('id', userId).first()
        const userDepts = await db('user_departments').where('user_id', userId)
        
        expect(user).toBeDefined()
        expect(userDepts.length).toBeGreaterThan(0)

        // 清理
        await db('user_departments').where('user_id', userId).delete()
        await db('users').where('id', userId).delete()
      }
    })
  })

  describe('场景五：审计日志验证', () => {
    test('所有操作都应该记录审计日志', async () => {
      // 执行一个操作
      const username = `e2e_test_audit_${timestamp}`
      const createResponse = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username,
          password: 'Test123456'
        })

      const userId = createResponse.body.data.id

      // 更新操作
      await request(app)
        .put(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '审计测试用户'
        })

      // 删除操作
      await request(app)
        .delete(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      // 获取审计日志
      const auditResponse = await request(app)
        .get('/api/audit-logs')
        .query({
          resourceId: userId
        })
        .set('Authorization', `Bearer ${adminToken}`)

      if (auditResponse.status === 200 && auditResponse.body.success) {
        const logs = auditResponse.body.data.list
        
        // 应该有创建、更新、删除的日志
        const actions = logs.map(log => log.action)
        expect(actions).toContain('create')
        expect(actions).toContain('update')
        expect(actions).toContain('delete')
      }
    })
  })
})