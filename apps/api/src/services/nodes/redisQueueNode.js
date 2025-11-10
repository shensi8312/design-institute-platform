/**
 * Redis队列服务节点
 * 用于工作流中的异步任务队列处理
 */

const redis = require('redis');
const { v4: uuidv4 } = require('uuid');

class RedisQueueNode {
  constructor(config = {}) {
    this.nodeType = 'service';
    this.name = 'Redis队列服务';
    this.description = '任务队列管理，支持入队和出队操作';
    
    // Redis连接配置
    this.client = redis.createClient({
      host: config.host || 'localhost',
      port: config.port || 6379,
      password: config.password
    });
    
    this.client.connect().catch(console.error);
  }

  /**
   * 节点元数据
   */
  getMetadata() {
    return {
      id: 'redis-queue-node',
      type: this.nodeType,
      name: this.name,
      description: this.description,
      inputs: {
        action: {
          type: 'string',
          required: true,
          enum: ['enqueue', 'dequeue', 'peek', 'length'],
          description: '操作类型'
        },
        queue: {
          type: 'string',
          required: true,
          description: '队列名称'
        },
        data: {
          type: 'object',
          required: false,
          description: '入队数据（仅enqueue时需要）'
        },
        priority: {
          type: 'number',
          required: false,
          default: 0,
          description: '优先级（0-9，数字越大优先级越高）'
        }
      },
      outputs: {
        success: 'boolean',
        taskId: 'string',
        data: 'object',
        queueLength: 'number'
      }
    };
  }

  /**
   * 执行节点逻辑
   */
  async execute(input) {
    const { action, queue, data, priority = 0 } = input;
    
    try {
      switch (action) {
        case 'enqueue':
          return await this.enqueue(queue, data, priority);
        
        case 'dequeue':
          return await this.dequeue(queue);
        
        case 'peek':
          return await this.peek(queue);
        
        case 'length':
          return await this.getLength(queue);
        
        default:
          throw new Error(`不支持的操作: ${action}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 入队操作
   */
  async enqueue(queueName, data, priority) {
    const taskId = uuidv4();
    const task = {
      id: taskId,
      data,
      priority,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    
    // 使用有序集合实现优先级队列
    const score = Date.now() - (priority * 1000000); // 优先级越高，分数越低
    await this.client.zAdd(`queue:${queueName}`, {
      score,
      value: JSON.stringify(task)
    });
    
    // 发布消息通知
    await this.client.publish(`queue:${queueName}:event`, JSON.stringify({
      event: 'task_added',
      taskId
    }));
    
    const length = await this.client.zCard(`queue:${queueName}`);
    
    return {
      success: true,
      taskId,
      queueLength: length
    };
  }

  /**
   * 出队操作
   */
  async dequeue(queueName) {
    // 获取分数最低的元素（优先级最高）
    const results = await this.client.zRangeWithScores(`queue:${queueName}`, 0, 0);
    
    if (results.length === 0) {
      return {
        success: false,
        message: '队列为空'
      };
    }
    
    const task = JSON.parse(results[0].value);
    
    // 从队列中移除
    await this.client.zRem(`queue:${queueName}`, results[0].value);
    
    // 更新任务状态
    task.status = 'processing';
    task.processedAt = new Date().toISOString();
    
    // 存储处理中的任务
    await this.client.set(
      `task:${task.id}`,
      JSON.stringify(task),
      { EX: 3600 } // 1小时过期
    );
    
    const length = await this.client.zCard(`queue:${queueName}`);
    
    return {
      success: true,
      taskId: task.id,
      data: task.data,
      queueLength: length
    };
  }

  /**
   * 查看队首元素（不移除）
   */
  async peek(queueName) {
    const results = await this.client.zRange(`queue:${queueName}`, 0, 0);
    
    if (results.length === 0) {
      return {
        success: false,
        message: '队列为空'
      };
    }
    
    const task = JSON.parse(results[0]);
    
    return {
      success: true,
      data: task
    };
  }

  /**
   * 获取队列长度
   */
  async getLength(queueName) {
    const length = await this.client.zCard(`queue:${queueName}`);
    
    return {
      success: true,
      queueLength: length
    };
  }

  /**
   * 清理资源
   */
  async destroy() {
    await this.client.quit();
  }
}

module.exports = RedisQueueNode;