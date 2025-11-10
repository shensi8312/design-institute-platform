const knex = require('knex')
const path = require('path')

// 数据库配置
const dbConfig = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5433,
      database: process.env.DB_NAME || 'design_platform',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres'
    },
    pool: {
      min: parseInt(process.env.DB_POOL_MIN) || 2,
      max: parseInt(process.env.DB_POOL_MAX) || 10
    },
    migrations: {
      directory: path.join(__dirname, '../database/migrations'),
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: path.join(__dirname, '../database/seeds')
    }
  },
  
  test: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5433,
      database: process.env.DB_NAME || 'design_platform',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres'
    },
    pool: {
      min: 1,
      max: 5
    },
    migrations: {
      directory: path.join(__dirname, '../database/migrations'),
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: path.join(__dirname, '../database/seeds')
    }
  },
  
  production: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5433,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    },
    pool: {
      min: parseInt(process.env.DB_POOL_MIN) || 2,
      max: parseInt(process.env.DB_POOL_MAX) || 10
    },
    migrations: {
      directory: path.join(__dirname, '../database/migrations'),
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: path.join(__dirname, '../database/seeds')
    }
  }
}

const environment = process.env.NODE_ENV || 'development'
const config = dbConfig[environment]

const db = knex(config)

// 测试数据库连接
db.raw('SELECT 1')
  .then(() => {
    console.log('✅ 数据库连接成功')
  })
  .catch((error) => {
    console.warn('⚠️  数据库连接失败，继续以开发模式启动:', error.message)
    console.warn('💡 提示：如需完整功能，请配置PostgreSQL数据库')
  })

module.exports = db