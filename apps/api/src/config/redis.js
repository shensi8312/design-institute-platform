const { createClient } = require('redis');

// Redis配置
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || 'redis123',
  db: process.env.REDIS_DB || 0,
  // 连接配置
  socket: {
    connectTimeout: 60000,
    lazyConnect: true,
  },
  // 重试配置
  retry: {
    retries: 3,
    delay: 1000
  }
};

// 创建Redis客户端（不设置密码，因为默认Redis无密码）
const redisClient = createClient({
  socket: {
    host: redisConfig.host,
    port: redisConfig.port,
  },
  // password: redisConfig.password, // 默认无密码
  database: redisConfig.db
});

// 连接事件监听
redisClient.on('connect', () => {
  console.log('✅ Redis连接成功');
});

redisClient.on('error', (err) => {
  console.warn('⚠️  Redis连接失败，继续以开发模式启动:', err.message);
  console.warn('💡 提示：如需完整功能，请启动Redis服务');
});

redisClient.on('disconnect', () => {
  console.log('🔌 Redis连接已断开');
});

// 初始化连接
const initRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error) {
    console.warn('Redis初始化失败，将在需要时重试:', error.message);
  }
};

// 导出客户端和工具函数
module.exports = {
  client: redisClient,
  
  // 安全的get方法
  async get(key) {
    try {
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
      return await redisClient.get(key);
    } catch (error) {
      console.warn(`Redis GET失败 ${key}:`, error.message);
      return null;
    }
  },
  
  // 安全的set方法
  async set(key, value, expireSeconds) {
    try {
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
      if (expireSeconds) {
        return await redisClient.setEx(key, expireSeconds, value);
      } else {
        return await redisClient.set(key, value);
      }
    } catch (error) {
      console.warn(`Redis SET失败 ${key}:`, error.message);
      return false;
    }
  },
  
  // 安全的del方法
  async del(key) {
    try {
      if (!redisClient.isOpen) {
        await redisClient.connect();
      }
      return await redisClient.del(key);
    } catch (error) {
      console.warn(`Redis DEL失败 ${key}:`, error.message);
      return 0;
    }
  },
  
  // 初始化方法
  init: initRedis
};

// 优雅关闭
process.on('SIGINT', async () => {
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
});

process.on('SIGTERM', async () => {
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
});