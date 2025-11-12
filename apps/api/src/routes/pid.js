const express = require('express')
const router = express.Router()
const multer = require('multer')
const PIDController = require('../controllers/PIDController')
const { authenticate } = require('../middleware/auth')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
})

const pidController = new PIDController()

/**
 * @route POST /api/pid/recognize
 * @desc 识别PID图纸
 * @query method - 识别方法: opencv | qwenvl (默认: opencv)
 * @access Private
 */
router.post('/recognize', authenticate, upload.single('file'), (req, res) => pidController.recognizePID(req, res))

/**
 * @route POST /api/pid/compare
 * @desc 对比两种识别方法（OpenCV vs QWEN-VL）
 * @access Private
 */
router.post('/compare', authenticate, upload.single('file'), (req, res) => pidController.compareRecognitionMethods(req, res))

/**
 * @route GET /api/pid/test-ocr
 * @desc 测试OCR服务连接
 * @access Private
 */
router.get('/test-ocr', authenticate, (req, res) => pidController.testOCR(req, res))

/**
 * @route POST /api/pid/generate-assembly
 * @desc 根据识别结果生成装配文件
 * @access Private
 */
router.post('/generate-assembly', authenticate, (req, res) => pidController.generateAssembly(req, res))

/**
 * @route POST /api/pid/save
 * @desc 保存PID识别结果
 * @access Private
 */
router.post('/save', authenticate, (req, res) => pidController.saveRecognitionResult(req, res))

/**
 * @route GET /api/pid/results
 * @desc 查询PID识别结果列表
 * @access Private
 */
router.get('/results', authenticate, (req, res) => pidController.getRecognitionResults(req, res))

/**
 * @route GET /api/pid/results/:id
 * @desc 查询单个PID识别结果
 * @access Private
 */
router.get('/results/:id', authenticate, (req, res) => pidController.getRecognitionResultById(req, res))

/**
 * @route PUT /api/pid/results/:id
 * @desc 更新PID识别结果（确认/拒绝）
 * @access Private
 */
router.put('/results/:id', authenticate, (req, res) => pidController.updateRecognitionResult(req, res))

/**
 * @route DELETE /api/pid/results/:id
 * @desc 删除PID识别结果
 * @access Private
 */
router.delete('/results/:id', authenticate, (req, res) => pidController.deleteRecognitionResult(req, res))

/**
 * @route POST /api/pid/results/:pidResultId/to-assembly
 * @desc 将PID识别结果转为装配任务
 * @access Private
 */
router.post('/results/:pidResultId/to-assembly', authenticate, (req, res) => pidController.createAssemblyFromPID(req, res))

/**
 * @route POST /api/pid/:id/learn
 * @desc 从PID识别结果学习装配规则
 * @access Private
 */
router.post('/:id/learn', authenticate, (req, res) => pidController.learnFromPID(req, res))

/**
 * @route POST /api/pid/learn/batch
 * @desc 批量学习（所有已确认的PID）
 * @access Private
 */
router.post('/learn/batch', authenticate, (req, res) => pidController.learnBatch(req, res))

/**
 * @route GET /api/pid/learned-rules
 * @desc 获取从PID学习到的规则
 * @access Private
 */
router.get('/learned-rules', authenticate, (req, res) => pidController.getLearnedRules(req, res))

module.exports = router
