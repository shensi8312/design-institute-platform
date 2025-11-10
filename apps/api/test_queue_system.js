#!/usr/bin/env node

/**
 * 队列系统测试脚本
 * 测试 Bull Queue + Redis 批处理系统的完整功能
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2FkbWluIiwidXNlcm5hbWUiOiJhZG1pbiIsImlzQWRtaW4iOnRydWUsInJvbGVJZCI6InJvbGVfYWRtaW4iLCJpYXQiOjE3NjI3MzU3NjksImV4cCI6MTc2MzM0MDU2OX0.Ri0TYz-5E5C-PfwgzqMR7AvD2lI0dQIxjEeQTr6RQYI';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Authorization': `Bearer ${TOKEN}`
  }
});

// 辅助函数
function log(emoji, message) {
  console.log(`${emoji} ${message}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 测试函数
async function test1_checkRedis() {
  log('🔍', '测试 1: 检查 Redis 连接');
  try {
    const { spawn } = require('child_process');
    const redis = spawn('redis-cli', ['ping']);

    return new Promise((resolve) => {
      redis.stdout.on('data', (data) => {
        if (data.toString().includes('PONG')) {
          log('✅', 'Redis 正在运行');
          resolve(true);
        }
      });

      redis.on('error', () => {
        log('❌', 'Redis 未运行，请先启动 Redis');
        resolve(false);
      });

      setTimeout(() => {
        redis.kill();
        log('❌', 'Redis 连接超时');
        resolve(false);
      }, 3000);
    });
  } catch (error) {
    log('❌', `Redis 检查失败: ${error.message}`);
    return false;
  }
}

async function test2_getQueueStatus() {
  log('🔍', '测试 2: 获取队列状态');
  try {
    const response = await api.get('/api/knowledge/queue/status');

    if (response.data.success) {
      const { waiting, active, completed, failed } = response.data.data;
      log('✅', `队列状态: 等待=${waiting}, 处理中=${active}, 已完成=${completed}, 失败=${failed}`);
      return true;
    }
  } catch (error) {
    log('❌', `获取队列状态失败: ${error.message}`);
    return false;
  }
}

async function test3_uploadDocument() {
  log('🔍', '测试 3: 上传测试文档');

  // 查找测试文件
  const testFiles = [
    'test.pdf',
    'sample.pdf',
    '../test.pdf',
    '/tmp/test.pdf'
  ].map(f => path.join(__dirname, f));

  let testFile = testFiles.find(f => fs.existsSync(f));

  if (!testFile) {
    log('⚠️', '未找到测试PDF文件，创建一个小的测试PDF');

    // 创建简单的测试文本文件代替
    testFile = path.join(__dirname, 'test_queue.txt');
    fs.writeFileSync(testFile, 'This is a test document for queue system testing.\n队列系统测试文档。\n\n测试内容:\n1. Bull队列\n2. Redis\n3. 进度追踪\n4. 断点续传\n');
    log('✅', `创建测试文件: ${testFile}`);
  }

  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(testFile));
    form.append('kb_id', 'kb_default');
    form.append('name', `队列测试_${Date.now()}`);

    const response = await api.post('/api/knowledge/documents/upload', form, {
      headers: {
        ...form.getHeaders()
      },
      timeout: 30000
    });

    if (response.data.success) {
      const documentId = response.data.data.document.id;
      log('✅', `文档上传成功: ${documentId}`);
      return documentId;
    }
  } catch (error) {
    log('❌', `文档上传失败: ${error.message}`);
    if (error.response) {
      log('❌', `响应: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

async function test4_monitorProgress(documentId) {
  log('🔍', '测试 4: 监控文档处理进度');

  if (!documentId) {
    log('❌', '无文档ID，跳过进度监控');
    return false;
  }

  log('📊', '开始监控（最多2分钟，每5秒检查一次）...');

  for (let i = 0; i < 24; i++) {
    try {
      const response = await api.get(`/api/knowledge/documents/${documentId}/progress`);

      if (response.data.success) {
        const { job, progress } = response.data.data;

        if (job) {
          log('📋', `任务状态: ${job.status} | 尝试: ${job.attempts}/${job.max_attempts}`);
        }

        if (progress && progress.length > 0) {
          progress.forEach(p => {
            log('  📊', `${p.stage}: ${p.progress_percentage}% (${p.current_page}/${p.total_pages} 页, ${p.current_chunk}/${p.total_chunks} 块)`);
          });
        }

        // 检查是否完成
        if (job && (job.status === 'completed' || job.status === 'failed')) {
          log('✅', `处理${job.status === 'completed' ? '成功' : '失败'}`);

          if (job.data) {
            const result = JSON.parse(job.data);
            if (result.vectorization) {
              log('  📊', `向量化: ${result.vectorization.success ? '成功' : '失败'} (${result.vectorization.vectorCount} 个向量)`);
            }
            if (result.graphExtraction) {
              log('  📊', `图谱提取: ${result.graphExtraction.success ? '成功' : '失败'} (${result.graphExtraction.entityCount} 实体, ${result.graphExtraction.relationCount} 关系)`);
            }
          }

          return job.status === 'completed';
        }
      }
    } catch (error) {
      log('⚠️', `获取进度失败: ${error.message}`);
    }

    await sleep(5000);
  }

  log('⏱️', '监控超时（2分钟）');
  return false;
}

async function test5_getJobsList() {
  log('🔍', '测试 5: 获取任务列表');

  try {
    const response = await api.get('/api/knowledge/jobs', {
      params: {
        page: 1,
        pageSize: 5
      }
    });

    if (response.data.success) {
      const { jobs, pagination } = response.data.data;
      log('✅', `任务列表: ${jobs.length} 个任务 (共 ${pagination.total} 个)`);

      jobs.slice(0, 3).forEach(job => {
        log('  📋', `${job.document_name} - ${job.status} (${new Date(job.created_at).toLocaleString()})`);
      });

      return true;
    }
  } catch (error) {
    log('❌', `获取任务列表失败: ${error.message}`);
    return false;
  }
}

async function test6_pauseResumeQueue() {
  log('🔍', '测试 6: 暂停/恢复队列');

  try {
    // 暂停队列
    log('⏸️', '暂停队列...');
    let response = await api.post('/api/knowledge/queue/pause');
    if (!response.data.success) {
      log('❌', '暂停队列失败');
      return false;
    }
    log('✅', '队列已暂停');

    await sleep(2000);

    // 恢复队列
    log('▶️', '恢复队列...');
    response = await api.post('/api/knowledge/queue/resume');
    if (!response.data.success) {
      log('❌', '恢复队列失败');
      return false;
    }
    log('✅', '队列已恢复');

    return true;
  } catch (error) {
    log('❌', `暂停/恢复队列失败: ${error.message}`);
    return false;
  }
}

// 主测试流程
async function runTests() {
  console.log('\n========================================');
  console.log('🚀 Bull队列系统测试');
  console.log('========================================\n');

  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };

  // 测试 1: Redis 连接
  results.total++;
  const redisOk = await test1_checkRedis();
  if (redisOk) results.passed++;
  else results.failed++;

  if (!redisOk) {
    console.log('\n❌ Redis 未运行，无法继续测试');
    console.log('请先启动 Redis: redis-server\n');
    return;
  }

  console.log('');

  // 测试 2: 队列状态
  results.total++;
  const queueOk = await test2_getQueueStatus();
  if (queueOk) results.passed++;
  else results.failed++;

  console.log('');

  // 测试 3: 上传文档
  results.total++;
  const documentId = await test3_uploadDocument();
  if (documentId) results.passed++;
  else results.failed++;

  console.log('');

  // 测试 4: 监控进度
  if (documentId) {
    results.total++;
    const progressOk = await test4_monitorProgress(documentId);
    if (progressOk) results.passed++;
    else results.failed++;

    console.log('');
  }

  // 测试 5: 任务列表
  results.total++;
  const jobsListOk = await test5_getJobsList();
  if (jobsListOk) results.passed++;
  else results.failed++;

  console.log('');

  // 测试 6: 暂停/恢复
  results.total++;
  const pauseResumeOk = await test6_pauseResumeQueue();
  if (pauseResumeOk) results.passed++;
  else results.failed++;

  // 测试结果
  console.log('\n========================================');
  console.log('📊 测试结果');
  console.log('========================================');
  console.log(`总测试数: ${results.total}`);
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`📈 通过率: ${Math.round(results.passed / results.total * 100)}%`);
  console.log('========================================\n');

  if (results.failed === 0) {
    console.log('🎉 所有测试通过！队列系统运行正常。\n');
  } else {
    console.log('⚠️ 部分测试失败，请检查日志。\n');
  }
}

// 运行测试
runTests().catch(error => {
  console.error('❌ 测试执行失败:', error);
  process.exit(1);
});
