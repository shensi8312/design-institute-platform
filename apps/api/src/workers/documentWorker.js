// 加载环境变量 - 修复PM2启动时无法读取.env的问题
require('dotenv').config();

const { documentQueue } = require('../queues/documentQueue');
const realTimeProcessor = require('../services/document/realTimeDocumentProcessor');
const db = require('../config/database');

/**
 * 更新文档处理进度到数据库
 */
async function updateProgress(documentId, stage, progressData) {
  try {
    await db('document_processing_progress')
      .insert({
        document_id: documentId,
        stage: stage,
        current_page: progressData.currentPage || 0,
        total_pages: progressData.totalPages || 0,
        current_chunk: progressData.currentChunk || 0,
        total_chunks: progressData.totalChunks || 0,
        progress_percentage: progressData.percentage || 0,
        metadata: JSON.stringify(progressData.metadata || {}),
        last_checkpoint_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      })
      .onConflict(['document_id', 'stage'])
      .merge({
        current_page: progressData.currentPage || 0,
        total_pages: progressData.totalPages || 0,
        current_chunk: progressData.currentChunk || 0,
        total_chunks: progressData.totalChunks || 0,
        progress_percentage: progressData.percentage || 0,
        metadata: JSON.stringify(progressData.metadata || {}),
        last_checkpoint_at: new Date(),
        updated_at: new Date()
      });
  } catch (error) {
    console.error(`❌ 更新进度失败 [${stage}]:`, error.message);
  }
}

// 队列消费者 - 处理文档
documentQueue.process('process-document', async (job) => {
  const { documentId, documentName, filePath, kbId, enableOCR, enableVector, enableGraph } = job.data;

  console.log(`👷 Worker开始处理: ${documentId} - ${documentName}`);
  console.log(`📋 配置: OCR=${enableOCR}, Vector=${enableVector}, Graph=${enableGraph}`);

  try {
    // 监听处理进度事件
    realTimeProcessor.on('step:start', async (data) => {
      if (data.step) {
        console.log(`🚀 开始阶段: ${data.step}`);
        await updateProgress(documentId, data.step, {
          percentage: 0,
          metadata: { started: new Date().toISOString() }
        });
        job.progress(0);
      }
    });

    realTimeProcessor.on('step:progress', async (data) => {
      if (data.step && data.progress !== undefined) {
        console.log(`📊 ${data.step} 进度: ${data.progress}%`);
        await updateProgress(documentId, data.step, {
          percentage: data.progress,
          currentPage: data.currentPage,
          totalPages: data.totalPages,
          currentChunk: data.currentChunk,
          totalChunks: data.totalChunks,
          metadata: data.metadata || {}
        });
        job.progress(data.progress);
      }
    });

    realTimeProcessor.on('step:complete', async (data) => {
      if (data.step) {
        console.log(`✅ 完成阶段: ${data.step}`);
        await updateProgress(documentId, data.step, {
          percentage: 100,
          metadata: {
            completed: new Date().toISOString(),
            ...data.metadata
          }
        });
        job.progress(100);
      }
    });

    // 调用现有的realTimeDocumentProcessor
    const result = await realTimeProcessor.processDocument(
      {
        id: documentId,
        name: documentName,
        filePath: filePath,
        kbId: kbId
      },
      {
        enableOCR: enableOCR !== false,
        enableVector: enableVector !== false,
        enableGraph: enableGraph !== false,
        extractEntities: true,
        async: false  // 同步处理，等待完成
      }
    );

    console.log(`✅ Worker处理完成: ${documentId}`);
    console.log(`📊 结果: 向量化=${result.results?.vectorized}, 实体=${result.results?.entitiesExtracted}, 关系=${result.results?.relationsExtracted}`);

    // 返回结构化结果，触发completed事件
    return {
      success: true,
      documentId: documentId,
      documentName: documentName,
      vectorization: {
        success: result.results?.vectorized || false,
        vectorCount: result.results?.vectorCount || 0
      },
      graphExtraction: {
        success: result.results?.entitiesExtracted > 0 || false,
        entityCount: result.results?.entitiesExtracted || 0,
        relationCount: result.results?.relationsExtracted || 0
      },
      processing: {
        startTime: result.startTime,
        endTime: result.endTime,
        duration: result.duration
      }
    };

  } catch (error) {
    console.error(`❌ Worker处理失败: ${documentId}`, error);
    throw error;  // 抛出错误，触发failed事件
  }
});

// 启动Worker
function startWorker() {
  console.log('🚀 文档处理Worker已启动');
  console.log('📋 队列名称: document-processing');
  console.log('🔄 并发数: 1 (默认)');

  // 定期报告队列状态
  setInterval(async () => {
    const counts = await documentQueue.getJobCounts();
    const { waiting, active, completed, failed } = counts;

    if (waiting > 0 || active > 0) {
      console.log(`📊 队列状态: 等待=${waiting}, 处理中=${active}, 已完成=${completed}, 失败=${failed}`);
    }
  }, 30000); // 每30秒报告一次
}

// 如果直接运行此文件，启动worker
if (require.main === module) {
  startWorker();

  // 优雅关闭
  process.on('SIGTERM', async () => {
    console.log('⚠️  收到SIGTERM信号，准备关闭worker...');
    await documentQueue.close();
    console.log('✅ Worker已关闭');
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('⚠️  收到SIGINT信号，准备关闭worker...');
    await documentQueue.close();
    console.log('✅ Worker已关闭');
    process.exit(0);
  });
}

module.exports = {
  startWorker
};
