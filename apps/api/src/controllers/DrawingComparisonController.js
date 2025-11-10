const DrawingComparisonService = require('../services/drawing/DrawingComparisonService');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const MinioService = require('../services/utils/MinioService');
const fs = require('fs').promises;
const axios = require('axios');

// 配置multer存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/temp/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB限制
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 PDF、PNG、JPG 格式'));
    }
  }
});

class DrawingComparisonController {
  /**
   * 创建比对任务（上传文件）
   */
  static async createComparison(req, res) {
    try {
      const { projectId, description } = req.body;

      // 获取用户ID - 支持多种认证方式
      const userId = req.user?.userId || req.user?.id || req.userId || 'anonymous';

      console.log('[DrawingComparison] 用户ID:', userId);
      console.log('[DrawingComparison] req.user:', req.user);

      // 检查文件
      if (!req.files || !req.files.v1File || !req.files.v2File) {
        return res.status(400).json({
          success: false,
          message: '请上传V1和V2两个文件'
        });
      }

      const v1File = req.files.v1File[0];
      const v2File = req.files.v2File[0];

      // 上传到MinIO
      const timestamp = Date.now();
      const v1Result = await MinioService.uploadFile(
        v1File.path,
        `v1_${timestamp}_${v1File.originalname}`
      );

      const v2Result = await MinioService.uploadFile(
        v2File.path,
        `v2_${timestamp}_${v2File.originalname}`
      );

      // 创建任务
      const task = await DrawingComparisonService.createTask({
        userId,
        v1FileUrl: v1Result.url,
        v2FileUrl: v2Result.url,
        projectId,
        description
      });

      // 异步调用Python服务进行分析
      processDrawingComparison(task.taskId, {
        v1Path: v1File.path,
        v2Path: v2File.path,
        v1Url: v1Result.url,
        v2Url: v2Result.url
      }).catch(err => {
        console.error('比对分析失败:', err);
      });

      res.json({
        success: true,
        data: task,
        message: '任务创建成功，开始处理'
      });
    } catch (error) {
      console.error('创建比对任务失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 获取任务状态
   */
  static async getTaskStatus(req, res) {
    try {
      const { taskId } = req.params;
      const userId = req.user.userId;
      const task = await DrawingComparisonService.getTask(taskId);

      // 权限检查：确保用户只能访问自己的任务
      if (task.userId !== userId && userId !== 'anonymous') {
        return res.status(403).json({
          success: false,
          message: '无权访问此任务'
        });
      }

      res.json({
        success: true,
        data: {
          taskId: task.taskId,
          status: task.status,
          progress: task.progress,
          currentStep: task.currentStep,
          message: task.errorMessage
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 获取比对结果
   */
  static async getResult(req, res) {
    try {
      const { taskId } = req.params;
      const userId = req.user.userId;
      const task = await DrawingComparisonService.getTask(taskId);

      // 权限检查：确保用户只能访问自己的任务
      if (task.userId !== userId && userId !== 'anonymous') {
        return res.status(403).json({
          success: false,
          message: '无权访问此任务'
        });
      }

      if (task.status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: '任务尚未完成'
        });
      }

      res.json({
        success: true,
        data: {
          taskId: task.taskId,
          status: task.status,
          v2ImageUrl: task.v2FileUrl,
          annotatedImageUrl: task.annotatedImageUrl,
          differences: task.differences,
          summary: {
            totalDifferences: task.differences?.length || 0,
            byCategory: calculateCategoryStats(task.differences)
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * 获取用户任务列表
   */
  static async getUserTasks(req, res) {
    try {
      const userId = req.user.userId;

      // 验证和规范化分页参数
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));

      const result = await DrawingComparisonService.getUserTasks(userId, {
        page,
        pageSize
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

/**
 * 异步处理图纸比对
 */
async function processDrawingComparison(taskId, { v1Path, v2Path, v1Url, v2Url }) {
  try {
    console.log(`[TaskProcessor] 开始处理任务: ${taskId}`);

    // 更新状态：处理中
    await DrawingComparisonService.updateTaskStatus(taskId, {
      status: 'processing',
      progress: 10,
      currentStep: '准备文件...'
    });

    // 调用Python服务
    const PYTHON_SERVICE_URL = process.env.DOCUMENT_RECOGNITION_SERVICE || 'http://localhost:8086';

    await DrawingComparisonService.updateTaskStatus(taskId, {
      progress: 25,
      currentStep: '图像配准中...'
    });

    const response = await axios.post(`${PYTHON_SERVICE_URL}/api/drawing-diff/analyze`, {
      taskId,
      v1Path,
      v2Path
    }, {
      timeout: 300000 // 5分钟超时
    });

    if (!response.data.success) {
      throw new Error(response.data.error || '分析失败');
    }

    // 上传标注图到MinIO
    const annotatedPath = response.data.annotatedImagePath;
    const annotatedResult = await MinioService.uploadFile(
      annotatedPath,
      `annotated_${taskId}.png`
    );

    // 保存结果
    await DrawingComparisonService.saveResult(taskId, {
      annotatedImageUrl: annotatedResult.url,
      differences: response.data.differences
    });

    console.log(`[TaskProcessor] 任务完成: ${taskId}`);

    // 清理临时文件
    await Promise.all([
      fs.unlink(v1Path).catch(console.error),
      fs.unlink(v2Path).catch(console.error),
      fs.unlink(annotatedPath).catch(console.error)
    ]);

  } catch (error) {
    console.error(`[TaskProcessor] 任务失败: ${taskId}`, error);

    await DrawingComparisonService.updateTaskStatus(taskId, {
      status: 'failed',
      errorMessage: error.message
    });

    // 清理临时文件
    await Promise.all([
      fs.unlink(v1Path).catch(() => {}),
      fs.unlink(v2Path).catch(() => {})
    ]);
  }
}

// 辅助函数：计算分类统计
function calculateCategoryStats(differences) {
  if (!differences || differences.length === 0) return {};

  return differences.reduce((acc, diff) => {
    const category = diff.category || 'unknown';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
}

module.exports = {
  DrawingComparisonController,
  upload
};
