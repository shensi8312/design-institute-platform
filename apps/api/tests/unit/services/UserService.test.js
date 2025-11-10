const bcrypt = require('bcryptjs')

// Mock the UserRepository module
jest.mock('../../../src/repositories/UserRepository')

// Import after mocking
const UserService = require('../../../src/services/system/UserService')
const UserRepository = require('../../../src/repositories/UserRepository')

describe('UserService 单元测试', () => {
  let userService
  let mockRepository

  beforeEach(() => {
    // 清除所有mock
    jest.clearAllMocks()
    
    // 创建mock repository实例
    mockRepository = {
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByIdWithRelations: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      count: jest.fn(),
      updateLastLogin: jest.fn(),
      transaction: jest.fn(),
      db: jest.fn(() => ({
        insert: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{
          id: 'user_123',
          username: 'testuser',
          password: 'hashed_password',
          status: 'active',
          is_admin: false
        }])
      }))
    }
    
    // Mock UserRepository constructor to return our mock
    UserRepository.mockImplementation(() => mockRepository)
    
    // 创建Service实例
    userService = new UserService()
  })

  const setupTransactionMock = (returningUser = {}) => {
    const inserted = {
      user: null,
      userDepartments: null
    }

    mockRepository.transaction.mockImplementation(async (callback) => {
      const usersReturningMock = jest.fn().mockResolvedValue([
        {
          id: 'user_123',
          username: 'testuser',
          name: '测试用户',
          email: 'test@example.com',
          status: 'active',
          is_admin: false,
          password_hash: 'hashed_password',
          ...returningUser
        }
      ])

      const usersInsertMock = jest.fn().mockImplementation((data) => {
        inserted.user = data
        return {
          returning: usersReturningMock
        }
      })

      const userDepartmentsInsertMock = jest.fn().mockImplementation((data) => {
        inserted.userDepartments = data
        return Promise.resolve(true)
      })

      const trx = (tableName) => {
        if (tableName === 'users') {
          return {
            insert: usersInsertMock
          }
        }
        if (tableName === 'user_departments') {
          return {
            insert: userDepartmentsInsertMock
          }
        }
        return {
          insert: jest.fn().mockResolvedValue(true)
        }
      }

      const result = await callback(trx)
      return result
    })

    return inserted
  }

  describe('创建用户', () => {
    it('应该成功创建用户', async () => {
      // 准备测试数据
      const userData = {
        username: 'testuser',
        password: 'Test123456',
        name: '测试用户',
        email: 'test@example.com'
      }

      // Mock repository方法
      mockRepository.findByUsername = jest.fn().mockResolvedValue(null)
      mockRepository.findByEmail = jest.fn().mockResolvedValue(null)
      const inserted = setupTransactionMock()

      // 执行测试
      const result = await userService.create(userData)

      // 断言
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.id).toBe('user_123')
      expect(result.data.password).toBeUndefined() // 密码不应该返回
      expect(mockRepository.findByUsername).toHaveBeenCalledWith('testuser')
      expect(mockRepository.findByEmail).toHaveBeenCalledWith('test@example.com')
      expect(inserted.user).toBeTruthy()
      expect(inserted.user.password_hash).toBeDefined()
    })

    it('应该拒绝重复的用户名', async () => {
      // Mock repository返回已存在的用户
      mockRepository.findByUsername = jest.fn().mockResolvedValue({
        id: 'existing_user',
        username: 'testuser'
      })

      // 执行测试
      const result = await userService.create({
        username: 'testuser',
        password: 'Test123456'
      })

      // 断言
      expect(result.success).toBe(false)
      expect(result.message).toBe('用户名已存在')
      expect(mockRepository.create).not.toHaveBeenCalled()
    })

    it('应该拒绝重复的邮箱', async () => {
      // Mock repository
      mockRepository.findByUsername = jest.fn().mockResolvedValue(null)
      mockRepository.findByEmail = jest.fn().mockResolvedValue({
        id: 'existing_user',
        email: 'test@example.com'
      })

      // 执行测试
      const result = await userService.create({
        username: 'newuser',
        password: 'Test123456',
        email: 'test@example.com'
      })

      // 断言
      expect(result.success).toBe(false)
      expect(result.message).toBe('邮箱已被使用')
      expect(mockRepository.create).not.toHaveBeenCalled()
    })

    it('应该对密码进行加密', async () => {
      // Mock repository
      mockRepository.findByUsername = jest.fn().mockResolvedValue(null)
      mockRepository.findByEmail = jest.fn().mockResolvedValue(null)
      const inserted = setupTransactionMock()

      // 执行测试
      const result = await userService.create({
        username: 'testuser',
        password: 'Test123456'
      })

      // 断言密码已加密
      expect(inserted.user).toBeTruthy()
      expect(inserted.user.password_hash).toBeDefined()
      expect(inserted.user.password_hash).toMatch(/^\$2[aby]\$/)
      expect(result.success).toBe(true)
    })
  })

  describe('用户登录', () => {
    it('应该成功登录有效用户', async () => {
      const hashedPassword = await bcrypt.hash('Test123456', 10)
      
      // Mock repository
      mockRepository.findByUsername = jest.fn().mockResolvedValue({
        id: 'user_123',
        username: 'testuser',
        password_hash: hashedPassword,
        status: 'active'
      })
      mockRepository.findByEmail = jest.fn().mockResolvedValue(null)
      
      mockRepository.findByIdWithRelations = jest.fn().mockResolvedValue({
        id: 'user_123',
        username: 'testuser',
        name: '测试用户',
        role_name: '普通用户',
        department_name: '技术部'
      })
      
      mockRepository.updateLastLogin = jest.fn().mockResolvedValue(true)

      // 执行测试
      const result = await userService.login('testuser', 'Test123456')

      // 断言
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data.password).toBeUndefined()
      expect(mockRepository.updateLastLogin).toHaveBeenCalledWith('user_123')
    })

    it('应该拒绝错误的密码', async () => {
      const hashedPassword = await bcrypt.hash('Test123456', 10)
      
      // Mock repository
      mockRepository.findByUsername = jest.fn().mockResolvedValue({
        id: 'user_123',
        username: 'testuser',
        password_hash: hashedPassword,
        status: 'active'
      })
      mockRepository.findByEmail = jest.fn().mockResolvedValue(null)

      // 执行测试
      const result = await userService.login('testuser', 'WrongPassword')

      // 断言
      expect(result.success).toBe(false)
      expect(result.message).toBe('用户名或密码错误')
      expect(mockRepository.updateLastLogin).not.toHaveBeenCalled()
    })

    it('应该拒绝不存在的用户', async () => {
      // Mock repository
      mockRepository.findByUsername = jest.fn().mockResolvedValue(null)
      mockRepository.findByEmail = jest.fn().mockResolvedValue(null)

      // 执行测试
      const result = await userService.login('nonexistent', 'Test123456')

      // 断言
      expect(result.success).toBe(false)
      expect(result.message).toBe('用户名或密码错误')
    })

    it('应该拒绝已禁用的用户', async () => {
      const hashedPassword = await bcrypt.hash('Test123456', 10)
      
      // Mock repository
      mockRepository.findByUsername = jest.fn().mockResolvedValue({
        id: 'user_123',
        username: 'testuser',
        password_hash: hashedPassword,
        status: 'inactive'
      })
      mockRepository.findByEmail = jest.fn().mockResolvedValue(null)

      // 执行测试
      const result = await userService.login('testuser', 'Test123456')

      // 断言
      expect(result.success).toBe(false)
      expect(result.message).toBe('用户已被禁用')
    })

    it('应该支持使用邮箱登录', async () => {
      const hashedPassword = await bcrypt.hash('Test123456', 10)
      
      mockRepository.findByUsername = jest.fn().mockResolvedValue(null)
      mockRepository.findByEmail = jest.fn().mockResolvedValue({
        id: 'user_123',
        username: 'testuser',
        email: 'test@example.com',
        password_hash: hashedPassword,
        status: 'active'
      })
      mockRepository.findByIdWithRelations = jest.fn().mockResolvedValue({
        id: 'user_123',
        username: 'testuser',
        email: 'test@example.com'
      })
      mockRepository.updateLastLogin = jest.fn().mockResolvedValue(true)

      // 执行测试
      const result = await userService.login('test@example.com', 'Test123456')

      // 断言
      expect(result.success).toBe(true)
      expect(result.data.email).toBe('test@example.com')
      expect(mockRepository.findByUsername).toHaveBeenCalledWith('test@example.com')
      expect(mockRepository.findByEmail).toHaveBeenCalledWith('test@example.com')
      expect(mockRepository.updateLastLogin).toHaveBeenCalledWith('user_123')
    })
  })

  describe('更新用户', () => {
    it('应该成功更新用户信息', async () => {
      // Mock repository
      mockRepository.exists = jest.fn().mockResolvedValue(true)
      mockRepository.findByUsername = jest.fn().mockResolvedValue(null)
      mockRepository.findByEmail = jest.fn().mockResolvedValue(null)
      mockRepository.update = jest.fn().mockResolvedValue({
        id: 'user_123',
        username: 'testuser',
        name: '更新后的名字',
        email: 'new@example.com'
      })

      // 执行测试
      const result = await userService.update('user_123', {
        name: '更新后的名字',
        email: 'new@example.com'
      })

      // 断言
      expect(result.success).toBe(true)
      expect(result.data.name).toBe('更新后的名字')
      expect(mockRepository.update).toHaveBeenCalled()
    })

    it('应该拒绝更新不存在的用户', async () => {
      // Mock repository
      mockRepository.exists = jest.fn().mockResolvedValue(false)

      // 执行测试
      const result = await userService.update('nonexistent', {
        name: '新名字'
      })

      // 断言
      expect(result.success).toBe(false)
      expect(result.message).toBe('记录不存在')
      expect(mockRepository.update).not.toHaveBeenCalled()
    })
  })

  describe('删除用户', () => {
    it('应该成功删除普通用户', async () => {
      // Mock repository
      mockRepository.findById = jest.fn().mockResolvedValue({
        id: 'user_123',
        username: 'testuser',
        is_admin: false
      })
      mockRepository.delete = jest.fn().mockResolvedValue({ success: true })

      // 执行测试
      const result = await userService.delete('user_123')

      // 断言
      expect(result.success).toBe(true)
      expect(mockRepository.delete).toHaveBeenCalledWith('user_123')
    })

    it('应该阻止删除最后一个管理员', async () => {
      // Mock repository
      mockRepository.findById = jest.fn().mockResolvedValue({
        id: 'admin_123',
        username: 'admin',
        is_admin: true
      })
      mockRepository.count = jest.fn().mockResolvedValue(1)

      // 执行测试
      const result = await userService.delete('admin_123')

      // 断言
      expect(result.success).toBe(false)
      expect(result.message).toBe('不能删除最后一个管理员')
      expect(mockRepository.delete).not.toHaveBeenCalled()
    })
  })
})
