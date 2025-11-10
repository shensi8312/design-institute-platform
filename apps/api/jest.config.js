module.exports = {
  // 测试环境
  testEnvironment: 'node',
  
  // 测试文件位置
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/unit/**/*.spec.js'
  ],
  
  // 覆盖率报告
  collectCoverage: false,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/config/**',
    '!src/database/migrations/**'
  ],
  
  // 覆盖率阈值
  coverageThreshold: undefined,
  
  // 测试超时时间
  testTimeout: 10000,
  
  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // 模块路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // 忽略的文件
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  
  // 详细输出
  verbose: true
}
