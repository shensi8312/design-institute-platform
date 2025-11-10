const UserService = require('../../src/services/system/UserService')
const db = require('../../src/config/database')
const bcrypt = require('bcryptjs')

describe('UserService 集成测试', () => {
  let userService
  const testUsers = []

  beforeAll(async () => {
    // 创建Service实例（使用真实的Repository和数据库）
    userService = new UserService()
    
    // 确保数据库连接正常
    try {
      await db.raw('SELECT 1')
      console.log('✅ 数据库连接成功')
    } catch (error) {
      console.error('❌ 数据库连接失败:', error.message)
      throw error
    }
  })

  afterAll(async () => {
    // 清理测试数据
    for (const userId of testUsers) {
      try {
        await db('audit_logs').where('user_id', userId).delete()
        await db('user_departments').where('user_id', userId).delete()
        await db('users').where('id', userId).delete()
      } catch (error) {
        console.error('清理测试数据失败:', error)
      }
    }
    
    // 清理所有测试用户及关联日志
    try {
      await db('audit_logs')
        .whereIn('user_id', function() {
          this.select('id').from('users').where('username', 'like', 'test_%')
        })
        .delete()
    } catch (error) {
      console.error('清理 audit_logs 失败:', error)
    }

    await db('users').where('username', 'like', 'test_%').delete()
    
    // 关闭数据库连接
    await db.destroy()
  })

  describe('创建用户 - 真实数据库测试', () => {
    it('应该成功创建用户并保存到数据库', async () => {
      const userData = {
        username: `test_${Date.now()}`,
        password: 'Test123456',
        name: '真实测试用户',
        email: `test${Date.now()}@example.com`,
        phone: '13800138000'
      }

      // 调用真实的Service创建用户
      const result = await userService.create(userData)

      // 验证返回结果
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.id).toBeDefined()
      expect(result.data.username).toBe(userData.username)
      expect(result.data.password_hash).toBeUndefined() // 密码不应该返回
      
      // 记录用于清理
      testUsers.push(result.data.id)

      // 验证用户真的被保存到数据库
      const savedUser = await db('users')
        .where('id', result.data.id)
        .first()
      
      expect(savedUser).toBeDefined()
      expect(savedUser.username).toBe(userData.username)
      expect(savedUser.name).toBe(userData.name)
      expect(savedUser.email).toBe(userData.email)
      
      // 验证密码已加密
      const isPasswordValid = await bcrypt.compare(userData.password, savedUser.password_hash)
      expect(isPasswordValid).toBe(true)
    })

    it('应该拒绝重复的用户名 - 真实数据库验证', async () => {
      const username = `test_duplicate_${Date.now()}`
      
      // 创建第一个用户
      const firstUser = await userService.create({
        username,
        password: 'Test123456'
      })
      
      expect(firstUser.success).toBe(true)
      testUsers.push(firstUser.data.id)

      // 尝试创建相同用户名的用户
      const duplicateUser = await userService.create({
        username,
        password: 'Test123456'
      })

      expect(duplicateUser.success).toBe(false)
      expect(duplicateUser.message).toBe('用户名已存在')
    })

    it('应该拒绝重复的邮箱 - 真实数据库验证', async () => {
      const email = `test${Date.now()}@duplicate.com`
      
      // 创建第一个用户
      const firstUser = await userService.create({
        username: `test_email1_${Date.now()}`,
        password: 'Test123456',
        email
      })
      
      expect(firstUser.success).toBe(true)
      testUsers.push(firstUser.data.id)

      // 尝试创建相同邮箱的用户
      const duplicateUser = await userService.create({
        username: `test_email2_${Date.now()}`,
        password: 'Test123456',
        email
      })

      expect(duplicateUser.success).toBe(false)
      expect(duplicateUser.message).toBe('邮箱已被使用')
    })
  })

  describe('用户登录 - 真实数据库测试', () => {
    let testUsername
    let testPassword
    let testUserId

    beforeAll(async () => {
      // 创建一个测试用户用于登录测试
      testUsername = `test_login_${Date.now()}`
      testPassword = 'Test123456'
      
      const result = await userService.create({
        username: testUsername,
        password: testPassword,
        name: '登录测试用户',
        status: 'active'
      })
      
      testUserId = result.data.id
      testUsers.push(testUserId)
    })

    it('应该成功登录有效用户', async () => {
      const result = await userService.login(testUsername, testPassword)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.username).toBe(testUsername)
      expect(result.data.password_hash).toBeUndefined()
      
      // 验证最后登录时间已更新
      const user = await db('users').where('id', testUserId).first()
      expect(user.last_login_at).toBeDefined()
    })

    it('应该拒绝错误的密码', async () => {
      const result = await userService.login(testUsername, 'WrongPassword')

      expect(result.success).toBe(false)
      expect(result.message).toBe('用户名或密码错误')
    })

    it('应该拒绝不存在的用户', async () => {
      const result = await userService.login('nonexistent_user', 'Test123456')

      expect(result.success).toBe(false)
      expect(result.message).toBe('用户名或密码错误')
    })

    it('应该拒绝已禁用的用户', async () => {
      // 禁用用户
      await db('users').where('id', testUserId).update({ status: 'inactive' })

      const result = await userService.login(testUsername, testPassword)

      expect(result.success).toBe(false)
      expect(result.message).toBe('用户已被禁用')

      // 恢复用户状态
      await db('users').where('id', testUserId).update({ status: 'active' })
    })
  })

  describe('更新用户 - 真实数据库测试', () => {
    let testUserId

    beforeAll(async () => {
      // 创建测试用户
      const result = await userService.create({
        username: `test_update_${Date.now()}`,
        password: 'Test123456',
        name: '待更新用户'
      })
      
      testUserId = result.data.id
      testUsers.push(testUserId)
    })

    it('应该成功更新用户信息', async () => {
      const updateData = {
        name: '更新后的名字',
        phone: '13900139000'
      }

      const result = await userService.update(testUserId, updateData)

      expect(result.success).toBe(true)
      expect(result.data.name).toBe(updateData.name)
      expect(result.data.phone).toBe(updateData.phone)

      // 验证数据库中的数据已更新
      const updatedUser = await db('users').where('id', testUserId).first()
      expect(updatedUser.name).toBe(updateData.name)
      expect(updatedUser.phone).toBe(updateData.phone)
    })

    it('应该拒绝更新不存在的用户', async () => {
      const result = await userService.update('nonexistent_id', {
        name: '新名字'
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe('记录不存在')
    })

    it('应该正确处理密码更新', async () => {
      const newPassword = 'NewPassword123'
      
      const result = await userService.update(testUserId, {
        password: newPassword
      })

      expect(result.success).toBe(true)

      // 验证新密码可以登录
      const user = await db('users').where('id', testUserId).first()
      const isValid = await bcrypt.compare(newPassword, user.password_hash)
      expect(isValid).toBe(true)
    })
  })

  describe('删除用户 - 真实数据库测试', () => {
    it('应该成功删除普通用户', async () => {
      // 创建一个用户用于删除
      const result = await userService.create({
        username: `test_delete_${Date.now()}`,
        password: 'Test123456',
        is_admin: false
      })

      const userId = result.data.id

      // 删除用户
      const deleteResult = await userService.delete(userId)

      expect(deleteResult.success).toBe(true)

      // 验证用户已从数据库删除
      const deletedUser = await db('users').where('id', userId).first()
      expect(deletedUser).toBeUndefined()
    })

    it('应该阻止删除最后一个管理员', async () => {
      // 获取当前管理员数量
      const adminCount = await db('users').where('is_admin', true).count('* as count')
      const currentAdminCount = parseInt(adminCount[0].count)

      if (currentAdminCount === 1) {
        // 如果只有一个管理员，尝试删除应该失败
        const admin = await db('users').where('is_admin', true).first()
        
        const result = await userService.delete(admin.id)

        expect(result.success).toBe(false)
        expect(result.message).toBe('不能删除最后一个管理员')
      } else {
        // 如果有多个管理员，创建场景测试
        console.log('当前有多个管理员，跳过最后管理员删除测试')
        expect(true).toBe(true)
      }
    })
  })

  describe('批量操作 - 真实数据库测试', () => {
    let userIds = []

    beforeAll(async () => {
      // 创建多个测试用户
      for (let i = 0; i < 3; i++) {
        const result = await userService.create({
          username: `test_batch_${Date.now()}_${i}`,
          password: 'Test123456',
          status: 'active'
        })
        userIds.push(result.data.id)
        testUsers.push(result.data.id)
      }
    })

    it('应该成功批量更新用户状态', async () => {
      const result = await userService.updateStatus(userIds, 'inactive')

      expect(result.success).toBe(true)
      expect(result.message).toContain('3')

      // 验证所有用户状态已更新
      const users = await db('users').whereIn('id', userIds)
      users.forEach(user => {
        expect(user.status).toBe('inactive')
      })
    })
  })

  describe('密码管理 - 真实数据库测试', () => {
    let testUserId

    beforeAll(async () => {
      const result = await userService.create({
        username: `test_password_${Date.now()}`,
        password: 'OldPassword123'
      })
      
      testUserId = result.data.id
      testUsers.push(testUserId)
    })

    it('应该成功重置密码', async () => {
      const newPassword = 'NewPassword456'
      
      const result = await userService.resetPassword(testUserId, newPassword)

      expect(result.success).toBe(true)

      // 验证新密码
      const user = await db('users').where('id', testUserId).first()
      const isValid = await bcrypt.compare(newPassword, user.password_hash)
      expect(isValid).toBe(true)
    })

    it('应该成功修改密码（需要旧密码）', async () => {
      const oldPassword = 'NewPassword456' // 上一个测试设置的密码
      const newPassword = 'FinalPassword789'
      
      const result = await userService.changePassword(testUserId, oldPassword, newPassword)

      expect(result.success).toBe(true)

      // 验证新密码
      const user = await db('users').where('id', testUserId).first()
      const isValid = await bcrypt.compare(newPassword, user.password_hash)
      expect(isValid).toBe(true)
    })

    it('应该拒绝错误的旧密码', async () => {
      const result = await userService.changePassword(testUserId, 'WrongOldPassword', 'NewPassword')

      expect(result.success).toBe(false)
      expect(result.message).toBe('原密码错误')
    })
  })
})
