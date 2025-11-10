// 测试环境设置
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-key'
process.env.DB_HOST = 'localhost'
process.env.DB_PORT = 5433
process.env.DB_NAME = 'design_platform'
process.env.DB_USER = 'postgres'
process.env.DB_PASSWORD = 'postgres'

// 设置测试超时
jest.setTimeout(10000)

// 全局测试辅助函数
global.testHelpers = {
  // 生成测试数据
  generateTestData: {
    user: () => ({
      username: `testuser_${Date.now()}`,
      password: 'Test123456',
      name: '测试用户',
      email: `test${Date.now()}@example.com`,
      phone: `138${Date.now().toString().slice(-8)}`
    }),
    
    organization: () => ({
      name: `测试组织_${Date.now()}`,
      code: `ORG_${Date.now()}`,
      type: 'company',
      status: 'active'
    }),
    
    department: (orgId) => ({
      name: `测试部门_${Date.now()}`,
      code: `DEPT_${Date.now()}`,
      organization_id: orgId,
      status: 'active'
    }),
    
    role: () => ({
      code: `ROLE_${Date.now()}`,
      name: `测试角色_${Date.now()}`,
      permissions: ['test.view', 'test.create'],
      status: 'active'
    })
  },
  
  // 清理测试数据
  cleanupTestData: async (db, table, condition) => {
    if (condition) {
      await db(table).where(condition).delete()
    }
  }
}

// 数据库连接管理
const db = require('../src/config/database')

// 在所有测试之前
beforeAll(async () => {
  // 等待数据库连接
  try {
    await db.raw('SELECT 1')
    console.log('✅ 测试数据库连接成功')
  } catch (error) {
    console.error('❌ 测试数据库连接失败:', error.message)
    process.exit(1)
  }
})

// 在所有测试之后
afterAll(async () => {
  // 关闭数据库连接
  await db.destroy()
})