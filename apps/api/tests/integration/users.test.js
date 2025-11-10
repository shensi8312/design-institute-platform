const request = require('supertest')
const app = require('../../src/app')
const db = require('../../src/config/database')

describe('用户API集成测试', () => {
  let token
  let testUserId
  const testUsername = `testuser_${Date.now()}`

  // 在所有测试之前，先登录获取token
  beforeAll(async () => {
    // 创建管理员账号用于测试
    const adminResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'admin123'
      })
    
    if (adminResponse.body.success) {
      token = adminResponse.body.data.token
    } else {
      console.error('无法登录管理员账号，请确保数据库中有admin用户')
    }
  })

  // 清理测试数据
  afterAll(async () => {
    if (testUserId) {
      await db('users').where('id', testUserId).delete()
    }
    await db('users').where('username', 'like', 'testuser_%').delete()
  })

  describe('POST /api/users - 创建用户', () => {
    it('应该成功创建新用户', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          username: testUsername,
          password: 'Test123456',
          name: '测试用户',
          email: `${testUsername}@example.com`,
          phone: '13800138000'
        })

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeDefined()
      expect(response.body.data.id).toBeDefined()
      
      testUserId = response.body.data.id
    })

    it('应该拒绝重复的用户名', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          username: testUsername, // 使用已存在的用户名
          password: 'Test123456'
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toContain('已存在')
    })

    it('应该验证必填字段', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          // 缺少username和password
          name: '测试用户'
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it('应该拒绝未授权的请求', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({
          username: 'unauthorizeduser',
          password: 'Test123456'
        })

      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/users - 获取用户列表', () => {
    it('应该返回用户列表', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.list).toBeDefined()
      expect(Array.isArray(response.body.data.list)).toBe(true)
    })

    it('应该支持分页', async () => {
      const response = await request(app)
        .get('/api/users')
        .query({ page: 1, pageSize: 5 })
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.data.pagination).toBeDefined()
      expect(response.body.data.pagination.pageSize).toBe(5)
    })

    it('应该支持搜索', async () => {
      const response = await request(app)
        .get('/api/users')
        .query({ search: testUsername })
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.data.list.length).toBeGreaterThan(0)
      expect(response.body.data.list[0].username).toBe(testUsername)
    })
  })

  describe('GET /api/users/:id - 获取用户详情', () => {
    it('应该返回用户详情', async () => {
      const response = await request(app)
        .get(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.id).toBe(testUserId)
      expect(response.body.data.username).toBe(testUsername)
    })

    it('应该返回404当用户不存在', async () => {
      const response = await request(app)
        .get('/api/users/nonexistent_id')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })
  })

  describe('PUT /api/users/:id - 更新用户', () => {
    it('应该成功更新用户信息', async () => {
      const response = await request(app)
        .put(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: '更新后的名字',
          phone: '13900139000'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.name).toBe('更新后的名字')
    })

    it('应该拒绝更新不存在的用户', async () => {
      const response = await request(app)
        .put('/api/users/nonexistent_id')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: '新名字'
        })

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })
  })

  describe('DELETE /api/users/:id - 删除用户', () => {
    it('应该成功删除用户', async () => {
      // 先创建一个用户用于删除
      const createResponse = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          username: `delete_test_${Date.now()}`,
          password: 'Test123456'
        })

      const userIdToDelete = createResponse.body.data.id

      // 删除用户
      const deleteResponse = await request(app)
        .delete(`/api/users/${userIdToDelete}`)
        .set('Authorization', `Bearer ${token}`)

      expect(deleteResponse.status).toBe(200)
      expect(deleteResponse.body.success).toBe(true)

      // 验证用户已被删除
      const getResponse = await request(app)
        .get(`/api/users/${userIdToDelete}`)
        .set('Authorization', `Bearer ${token}`)

      expect(getResponse.status).toBe(404)
    })

    it('应该返回404当删除不存在的用户', async () => {
      const response = await request(app)
        .delete('/api/users/nonexistent_id')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(404)
      expect(response.body.success).toBe(false)
    })
  })

  describe('POST /api/auth/login - 用户登录', () => {
    it('应该成功登录', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsername,
          password: 'Test123456'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.token).toBeDefined()
      expect(response.body.data.user).toBeDefined()
    })

    it('应该拒绝错误的密码', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsername,
          password: 'WrongPassword'
        })

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })

    it('应该拒绝不存在的用户', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistentuser',
          password: 'Test123456'
        })

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })
})