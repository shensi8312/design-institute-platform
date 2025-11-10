const Bull = require('bull');
const db = require('../config/database');

// 创建文档处理队列
const documentQueue = new Bull('document-processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  },
  defaultJobOptions: {
    removeOnComplete: 100, // 保留最近100个完成的任务
    removeOnFail: false,   // 保留失败的任务
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

// 队列事件监听
documentQueue.on('completed', async (job, result) => {
  console.log(`✅ 文档处理完成: ${job.data.documentId}`);

  try {
    // 更新job记录状态为completed
    await db('document_processing_jobs')
      .where('id', job.data.jobRecordId)
      .update({
        status: 'completed',
        completed_at: new Date(),
        data: JSON.stringify(result),
        updated_at: new Date()
      });

    // 更新文档状态
    const updateData = {
      updated_at: new Date()
    };

    if (result.vectorization) {
      updateData.vectorization_status = result.vectorization.success ? 'completed' : 'failed';
    }

    if (result.graphExtraction) {
      updateData.graph_extraction_status = result.graphExtraction.success ? 'completed' : 'failed';
    }

    await db('knowledge_documents')
      .where('id', job.data.documentId)
      .update(updateData);

  } catch (error) {
    console.error(`❌ 更新完成状态失败: ${job.data.documentId}`, error);
  }
});

documentQueue.on('failed', async (job, err) => {
  console.error(`❌ 文档处理失败: ${job.data.documentId}`, err.message);

  try {
    // 更新job记录状态为failed
    await db('document_processing_jobs')
      .where('id', job.data.jobRecordId)
      .update({
        status: 'failed',
        failed_at: new Date(),
        error: JSON.stringify({ message: err.message, stack: err.stack }),
        attempts: job.attemptsMade,
        updated_at: new Date()
      });

    // 只在所有重试都失败后才更新文档状态
    if (job.attemptsMade >= job.opts.attempts) {
      await db('knowledge_documents')
        .where('id', job.data.documentId)
        .update({
          vectorization_status: 'failed',
          graph_extraction_status: 'failed',
          updated_at: new Date()
        });
    }
  } catch (error) {
    console.error(`❌ 更新失败状态失败: ${job.data.documentId}`, error);
  }
});

documentQueue.on('active', async (job) => {
  console.log(`👷 开始处理: ${job.data.documentId} - ${job.data.documentName}`);

  try {
    // 更新job记录状态为active
    await db('document_processing_jobs')
      .where('id', job.data.jobRecordId)
      .update({
        status: 'active',
        started_at: new Date(),
        attempts: job.attemptsMade + 1,
        updated_at: new Date()
      });
  } catch (error) {
    console.error(`❌ 更新活动状态失败: ${job.data.documentId}`, error);
  }
});

documentQueue.on('stalled', async (job) => {
  console.warn(`⚠️  任务停滞: ${job.data.documentId}`);
});

/**
 * 添加文档到处理队列
 */
async function addDocumentToQueue(documentInfo, options = {}) {
  try {
    const {
      enableOCR = true,
      enableVector = true,
      enableGraph = true,
      priority = 0
    } = options;

    // 1. 在数据库中创建job记录
    const [jobRecord] = await db('document_processing_jobs')
      .insert({
        document_id: documentInfo.id,
        job_type: 'full_processing',
        status: 'pending',
        priority: priority,
        data: JSON.stringify({
          enableOCR,
          enableVector,
          enableGraph,
          documentName: documentInfo.name,
          filePath: documentInfo.filePath,
          kbId: documentInfo.kbId
        }),
        created_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    // 2. 添加到Bull队列
    const job = await documentQueue.add('process-document', {
      jobRecordId: jobRecord.id,
      documentId: documentInfo.id,
      documentName: documentInfo.name,
      filePath: documentInfo.filePath,
      kbId: documentInfo.kbId,
      enableOCR,
      enableVector,
      enableGraph,
      timestamp: new Date().toISOString()
    }, {
      priority: priority,
      jobId: `doc-${documentInfo.id}-${Date.now()}`
    });

    console.log(`📥 文档已加入队列: ${documentInfo.id}, Job ID: ${job.id}, Record ID: ${jobRecord.id}`);

    return {
      success: true,
      bullJobId: job.id,
      jobRecordId: jobRecord.id
    };

  } catch (error) {
    console.error('❌ 添加到队列失败:', error);
    throw error;
  }
}

/**
 * 获取队列状态
 */
async function getQueueStatus() {
  const counts = await documentQueue.getJobCounts();

  return {
    waiting: counts.waiting,
    active: counts.active,
    completed: counts.completed,
    failed: counts.failed,
    delayed: counts.delayed
  };
}

/**
 * 获取文档处理进度
 */
async function getDocumentProgress(documentId) {
  // 从数据库获取进度记录
  const progress = await db('document_processing_progress')
    .where('document_id', documentId)
    .select('*');

  // 获取job状态
  const job = await db('document_processing_jobs')
    .where('document_id', documentId)
    .orderBy('created_at', 'desc')
    .first();

  return {
    job: job,
    progress: progress
  };
}

/**
 * 暂停队列
 */
async function pauseQueue() {
  await documentQueue.pause();
  console.log('⏸️  队列已暂停');
}

/**
 * 恢复队列
 */
async function resumeQueue() {
  await documentQueue.resume();
  console.log('▶️  队列已恢复');
}

module.exports = {
  documentQueue,
  addDocumentToQueue,
  getQueueStatus,
  getDocumentProgress,
  pauseQueue,
  resumeQueue
};
