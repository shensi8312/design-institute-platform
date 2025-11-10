const express = require('express');
const router = express.Router();
const { DrawingComparisonController, upload } = require('../controllers/DrawingComparisonController');
const { authenticate } = require('../middleware/auth');

// 创建比对任务（文件上传）
router.post('/compare',
  authenticate,
  upload.fields([
    { name: 'v1File', maxCount: 1 },
    { name: 'v2File', maxCount: 1 }
  ]),
  DrawingComparisonController.createComparison
);

// 获取任务状态
router.get('/status/:taskId', authenticate, DrawingComparisonController.getTaskStatus);

// 获取比对结果
router.get('/result/:taskId', authenticate, DrawingComparisonController.getResult);

// 获取用户任务列表
router.get('/tasks', authenticate, DrawingComparisonController.getUserTasks);

module.exports = router;
