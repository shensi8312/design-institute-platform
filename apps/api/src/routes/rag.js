const express = require('express')
const router = express.Router()
const RAGController = require('../controllers/RAGController')
const { authenticate } = require('../middleware/auth')

// 所有RAG接口需要认证
router.use(authenticate)

// 初始化RAG服务
router.post('/initialize', (req, res) => RAGController.initialize(req, res))

// 文档向量化处理
router.post('/process-document', (req, res) => RAGController.processDocument(req, res))

// RAG检索
router.post('/retrieve', (req, res) => RAGController.retrieve(req, res))

// RAG完整查询
router.post('/query', (req, res) => RAGController.query(req, res))

// RAG流式查询
router.post('/query-stream', (req, res) => RAGController.queryStream(req, res))

// 聊天接口
router.post('/chat', (req, res) => RAGController.chat(req, res))

module.exports = router
