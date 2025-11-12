const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const KnowledgeController = require('../controllers/KnowledgeController');
const db = require('../config/database');
const {
  documentQueue,
  getQueueStatus,
  getDocumentProgress,
  pauseQueue,
  resumeQueue,
  addDocumentToQueue
} = require('../queues/documentQueue');

// 文档生成服务
const WordGeneratorService = require('../services/document/WordGeneratorService');
const ExcelGeneratorService = require('../services/document/ExcelGeneratorService');
const PPTGeneratorService = require('../services/document/PPTGeneratorService');
const TemplateManager = require('../services/document/TemplateManager');
const MinioClient = require('../services/storage/MinioClient');
const ChatHistoryService = require('../services/chat/ChatHistoryService');

// 配置文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    try {
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    } catch (e) {
      console.error('[文件上传] 文件名编码转换失败:', e.message);
    }
    cb(null, true);
  }
});

// 路由定义
router.get('/bases', authenticate, KnowledgeController.getKnowledgeBases);
router.post('/bases', authenticate, KnowledgeController.createKnowledgeBase);
router.put('/bases/:id', authenticate, KnowledgeController.updateKnowledgeBase);
router.delete('/bases/:id', authenticate, KnowledgeController.deleteKnowledgeBase);
router.get('/documents', KnowledgeController.getDocuments);
router.post('/documents/upload', authenticate, upload.single('file'), KnowledgeController.uploadDocument);
router.post('/batch-upload', upload.single('file'), KnowledgeController.uploadDocument);
router.post('/documents/upload-extract', upload.single('file'), KnowledgeController.uploadDocument);
router.delete('/documents/:id', authenticate, KnowledgeController.deleteDocument);
router.post('/documents/:id/reclassify', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const DocumentClassifierService = require('../services/document/DocumentClassifierService');
    const classifierService = new DocumentClassifierService();
    const result = await classifierService.reclassifyDocument(id);
    res.json(result);
  } catch (error) {
    console.error('[重新分类] 失败:', error);
    res.status(500).json({ success: false, message: '重新分类失败', error: error.message });
  }
});
router.post('/documents/batch-classify', authenticate, async (req, res) => {
  try {
    const { document_ids, organization_id } = req.body;
    if (!document_ids || !Array.isArray(document_ids)) {
      return res.status(400).json({ success: false, message: '参数错误：document_ids必须是数组' });
    }
    const DocumentClassifierService = require('../services/document/DocumentClassifierService');
    const classifierService = new DocumentClassifierService();
    const results = await classifierService.batchClassifyDocuments(document_ids, organization_id);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('[批量分类] 失败:', error);
    res.status(500).json({ success: false, message: '批量分类失败', error: error.message });
  }
});
router.get('/categories', authenticate, async (req, res) => {
  try {
    const db = require('../config/database');
    const { organization_id } = req.query;
    const query = db('knowledge_categories').where({ status: 'active' }).whereNull('deleted_at');
    if (organization_id) query.where({ organization_id });
    const categories = await query.select('*').orderBy('sort', 'asc');
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('[获取分类] 失败:', error);
    res.status(500).json({ success: false, message: '获取分类失败', error: error.message });
  }
});
router.post('/categories', authenticate, async (req, res) => {
  try {
    const db = require('../config/database');
    const { name, code, parent_id, organization_id, description, icon, color, sort } = req.body;
    if (!name || !code || !organization_id) {
      return res.status(400).json({ success: false, message: '缺少必填参数：name, code, organization_id' });
    }
    const [category] = await db('knowledge_categories').insert({ name, code, parent_id, organization_id, description, icon, color, sort: sort || 0, status: 'active' }).returning('*');
    res.json({ success: true, data: category });
  } catch (error) {
    console.error('[创建分类] 失败:', error);
    res.status(500).json({ success: false, message: '创建分类失败', error: error.message });
  }
});
router.put('/categories/:id', authenticate, async (req, res) => {
  try {
    const db = require('../config/database');
    const { id } = req.params;
    const { name, description, icon, color, sort, status } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (sort !== undefined) updateData.sort = sort;
    if (status !== undefined) updateData.status = status;
    const [category] = await db('knowledge_categories').where({ id }).update(updateData).returning('*');
    res.json({ success: true, data: category });
  } catch (error) {
    console.error('[更新分类] 失败:', error);
    res.status(500).json({ success: false, message: '更新分类失败', error: error.message });
  }
});
router.delete('/categories/:id', authenticate, async (req, res) => {
  try {
    const db = require('../config/database');
    const { id } = req.params;
    await db('knowledge_categories').where({ id }).update({ status: 'inactive', deleted_at: db.fn.now() });
    res.json({ success: true, message: '分类已删除' });
  } catch (error) {
    console.error('[删除分类] 失败:', error);
    res.status(500).json({ success: false, message: '删除分类失败', error: error.message });
  }
});

// 智能问答 - SSE流式输出
router.post('/chat', authenticate, upload.array('files', 10), async (req, res) => {
  const { question, scope, history } = req.body;
  const files = req.files;
  const userId = req.user.id;

  console.log('[智能问答-流式] 收到问题:', question);
  console.log('[智能问答-流式] history类型:', typeof history, '值:', history ? history.substring(0, 100) : 'undefined');

  // 设置SSE响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders(); // 立即发送响应头

  try {
    // 1. 使用深度搜索服务（向量检索 + 知识图谱增强）
    let vectorContext = '';
    let sources = [];
    let graphEnhanced = false;

    // 检查问题是否有效（长度至少2个字符，且不是纯符号）
    const isValidQuery = question.trim().length >= 2 && /[\u4e00-\u9fa5a-zA-Z0-9]/.test(question);

    try {
      const DeepSearchService = require('../services/chat/DeepSearchService');
      const deepSearch = new DeepSearchService();

      if (isValidQuery) {
        console.log(`[智能问答] 使用深度搜索: "${question}"`);

        const searchResult = await deepSearch.search(question, {
          userId: userId,
          topK: 5,
          minScore: 10.0,  // 提高阈值，只保留真正相关的结果（内积距离，分数越高越相关）
          includeGraph: true // 启用知识图谱增强
        });

        if (searchResult.success && searchResult.data.totalResults > 0) {
          vectorContext = searchResult.data.context;
          sources = searchResult.data.sources || [];
          graphEnhanced = searchResult.data.graphEnhanced || false;

          console.log(`[智能问答] 深度搜索成功: ${sources.length} 个来源, 图谱增强=${graphEnhanced}`);
        } else {
          console.log(`[智能问答] 深度搜索未找到相关内容`);
        }
      } else {
        console.log(`[智能问答] 问题过于简单，跳过深度搜索: "${question}"`);
      }
    } catch (error) {
      console.error('[智能问答] 深度搜索失败:', error);
      // 搜索失败不影响问答，继续使用LLM直接回答
    }

    // 只有真正有高质量搜索结果时才包含参考资料
    let systemPrompt = `你是MST智能设计平台的专业助手。`;

    if (sources.length > 0) {
      systemPrompt += `

**重要：在回答时请引用来源！**
当引用知识库内容时，使用 [来源X] 标记，例如：
- "根据[来源1]，建筑高度不应超过100米。"
- "根据[来源1]和[来源2]，住宅建筑需要满足..."
引用编号对应上方参考资料中的编号。`;
    }

    systemPrompt += `

当用户要求生成文档时，请在回答的**最后**添加一个JSON格式的工具调用指令（使用<TOOL_CALL>标记）：

支持的工具：
1. generate_word: 生成Word文档 - 用于报告、方案、纪要等文本内容
2. generate_excel: 生成Excel表格 - 用于数据统计、清单、算量表等表格数据
3. generate_ppt: 生成PPT演示 - 用于演示汇报、展示材料

**重要：根据用户需求选择正确的工具！**
- 表格、清单、算量、统计 → 使用 generate_excel
- 文档、报告、方案、纪要 → 使用 generate_word
- 演示、汇报、展示 → 使用 generate_ppt`;

    // 构建消息
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      }
    ];

    // 只有有搜索结果时才添加参考资料
    if (vectorContext && sources.length > 0) {
      messages.push({
        role: 'system',
        content: `以下是从知识库检索到的参考资料：\n\n${vectorContext}`
      });
    }


    // 2. 处理上传文件
    let fileContext = '';
    if (files && files.length > 0) {
      const DocumentParserService = require('../services/document/DocumentParserService');
      const parser = new DocumentParserService();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const content = await parser.parseDocument(file.buffer, file.mimetype, file.originalname);
          if (content && content.trim()) {
            fileContext += `\n\n【附件 ${i + 1}: ${file.originalname}】\n${content.substring(0, 5000)}\n`;
          }
        } catch (error) {
          console.error(`[智能问答-流式] 提取文件内容失败: ${file.originalname}`, error.message);
        }
      }
    }

    // 3. 构建提示词（包含对话历史）
    const UnifiedLLMService = require('../services/llm/UnifiedLLMService');

    // 处理对话历史
    let conversationHistory = [];
    if (history) {
      try {
        // 先解析（FormData传来的是字符串）
        const parsedHistory = typeof history === 'string' ? JSON.parse(history) : history;

        if (Array.isArray(parsedHistory)) {
          // 只保留最近10轮对话
          conversationHistory = parsedHistory.slice(-10).map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          }));
          console.log(`[智能问答] 加载了 ${conversationHistory.length} 条历史对话`);
        }
      } catch (e) {
        console.warn('[智能问答] 历史对话解析失败:', e.message);
      }
    }

    // 构建上下文信息
    let systemContext = '';
    if (vectorContext || fileContext) {
      systemContext = `以下是相关参考资料：\n${vectorContext}${fileContext}\n`;
    }

    // 构建系统提示词
    const systemPrompt = `你是MST智能设计平台的专业助手。${systemContext ? '请结合以下参考资料回答用户问题：\n' + systemContext : '请简洁准确地回答用户问题。'}

${sources.length > 0 ? `**重要：在回答时请引用来源！**
当引用知识库内容时，使用 [来源X] 标记，例如：
- "根据[来源1]，建筑高度不应超过100米。"
- "根据[来源1]和[来源2]，住宅建筑需要满足..."
引用编号对应上方参考资料中的编号。` : ''}

**文档生成功能**：
当用户明确要求"生成Word"、"导出Word"、"输出Word文档"、"生成Excel"、"生成PPT"时，你必须在回答的最后添加工具调用标记。

格式（必须严格遵守）：

<TOOL_CALL>
{"function":"工具名称","arguments":{"参数名":"参数值"}}
</TOOL_CALL>

支持的工具：
1. generate_word - 生成Word文档
   必填参数：title(文档标题), content(完整内容，支持Markdown格式)
   可选参数：template(模板类型，可不填)

2. generate_excel - 生成Excel表格
   必填参数：title(表格标题), data(数据数组)
   可选参数：template(模板类型，可不填)

3. generate_ppt - 生成PPT演示
   必填参数：title(PPT标题), slides(幻灯片数组，每个对象包含title和content)
   可选参数：template(模板类型，可不填)

注意：
1. template字段完全可选，不确定时可以不填，系统会自动选择合适的模板
2. 工具调用标记不会显示给用户，会被系统自动处理
3. 必须在回答内容之后添加工具调用标记

示例1 - 生成Word：
用户："帮我生成项目进度报告"
你的回答：
好的，我来为您整理项目进度报告。

## 项目进度
本周完成了以下工作：
1. 完成设计方案初稿
2. 提交评审材料

<TOOL_CALL>
{"function":"generate_word","arguments":{"title":"项目进度报告","content":"## 项目进度\\n本周完成了以下工作：\\n1. 完成设计方案初稿\\n2. 提交评审材料"}}
</TOOL_CALL>

示例2 - 生成Excel：
用户："生成工程算量表"
你的回答：
好的，我来为您生成工程算量表。

<TOOL_CALL>
{"function":"generate_excel","arguments":{"title":"工程算量表","data":[{"分项名称":"混凝土","单位":"m³","工程量":125.6,"单价":450},{"分项名称":"钢筋","单位":"吨","工程量":8.2,"单价":4200}]}}
</TOOL_CALL>

示例3 - 生成PPT：
用户："做个项目汇报PPT"
你的回答：
好的，我来为您生成项目汇报PPT。

<TOOL_CALL>
{"function":"generate_ppt","arguments":{"title":"项目汇报","slides":[{"title":"项目概况","content":"..."},{"title":"进展情况","content":"..."}]}}
</TOOL_CALL>`;

    // 重新构建消息数组
    const chatMessages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...conversationHistory,  // 添加历史对话
      {
        role: 'user',
        content: question
      }
    ];

    // 流式响应 - 过滤工具调用标记
    let fullResponse = '';
    let displayBuffer = ''; // 用于发送给用户的内容
    let isInToolCall = false;
    await UnifiedLLMService.generateStreamWithMessages(chatMessages, {
      temperature: 0.3,  // 降低温度提高稳定性
      max_tokens: 4000   // 增加token限制
    }, async (chunk) => {
      if (chunk.content) {
        fullResponse += chunk.content;

        // 逐字符检查是否进入工具调用
        for (let char of chunk.content) {
          displayBuffer += char;

          // 检测到 <TOOL_CALL> 开始
          if (displayBuffer.endsWith('<TOOL_CALL>')) {
            isInToolCall = true;
            // 移除 <TOOL_CALL> 标记
            displayBuffer = displayBuffer.slice(0, -11);
            // 发送缓冲区内容
            if (displayBuffer) {
              res.write(`data: ${JSON.stringify({
                type: 'chunk',
                content: displayBuffer
              })}\n\n`);
              if (res.flush) res.flush();
              displayBuffer = '';
            }
          }

          // 检测到 </TOOL_CALL> 结束
          if (displayBuffer.endsWith('</TOOL_CALL>')) {
            isInToolCall = false;
            displayBuffer = ''; // 清空缓冲区
          }

          // 如果不在工具调用内，积累内容准备发送
          if (!isInToolCall && displayBuffer.length > 50) {
            res.write(`data: ${JSON.stringify({
              type: 'chunk',
              content: displayBuffer
            })}\n\n`);
            if (res.flush) res.flush();
            displayBuffer = '';
          }
        }
      }

      // 发送thinking（如果有）
      if (chunk.thinking) {
        res.write(`data: ${JSON.stringify({
          type: 'chunk',
          thinking: chunk.thinking
        })}\n\n`);
        if (res.flush) res.flush();
      }
    });

    // 发送剩余内容
    if (displayBuffer && !isInToolCall) {
      res.write(`data: ${JSON.stringify({
        type: 'chunk',
        content: displayBuffer
      })}\n\n`);
      if (res.flush) res.flush();
    }

    // 检测并处理工具调用（提示词工程方案）
    const toolCallMatch = fullResponse.match(/<TOOL_CALL>([\s\S]*?)<\/TOOL_CALL>/);
    if (toolCallMatch) {
      try {
        const toolCallJSON = toolCallMatch[1].trim();
        const toolCall = JSON.parse(toolCallJSON);

        console.log('[工具调用] 检测到:', toolCall.function, toolCall.arguments);

        let file = null;
        const args = toolCall.arguments;

        // 根据工具类型调用对应服务
        if (toolCall.function === 'generate_word') {
          const result = await WordGeneratorService.generate({
            title: args.title,
            content: args.content,
            template: args.template || 'general', // ✅ 默认使用general
            author: req.user.name,
            metadata: { project_name: args.project_name }
          });

          // 上传到MinIO
          const filename = `generated/${Date.now()}_${result.filename}`;
          await MinioClient.upload('knowledge-documents', filename, result.buffer, {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          });
          const url = await MinioClient.getDownloadUrl('knowledge-documents', filename, 7 * 24 * 3600);

          file = { name: result.filename, url, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };

        } else if (toolCall.function === 'generate_excel') {
          const result = await ExcelGeneratorService.generate({
            title: args.title,
            data: args.data,
            template: args.template || 'general', // ✅ 默认使用general
            metadata: {}
          });

          const filename = `generated/${Date.now()}_${result.filename}`;
          await MinioClient.upload('knowledge-documents', filename, result.buffer, {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });
          const url = await MinioClient.getDownloadUrl('knowledge-documents', filename, 7 * 24 * 3600);

          file = { name: result.filename, url, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };

        } else if (toolCall.function === 'generate_ppt') {
          const result = await PPTGeneratorService.generate({
            title: args.title,
            slides: args.slides,
            template: args.template || 'general', // ✅ 默认使用general
            metadata: { author: req.user.name }
          });

          const filename = `generated/${Date.now()}_${result.filename}`;
          await MinioClient.upload('knowledge-documents', filename, result.buffer, {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          });
          const url = await MinioClient.getDownloadUrl('knowledge-documents', filename, 7 * 24 * 3600);

          file = { name: result.filename, url, type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
        }

        // 返回文件信息
        if (file) {
          res.write(`data: ${JSON.stringify({ type: 'file', file })}\n\n`);
          if (res.flush) res.flush();

          res.write(`data: ${JSON.stringify({ type: 'chunk', content: `\n\n✅ 文档已生成，请点击上方下载链接。\n` })}\n\n`);
          if (res.flush) res.flush();
        }
      } catch (toolError) {
        console.error('[工具调用失败]', toolError);
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: `\n\n⚠️ 文档生成失败: ${toolError.message}\n` })}\n\n`);
        if (res.flush) res.flush();
      }
    }

    // 清理sources数据，只保留前端需要的基本字段
    const cleanSources = sources.map(s => ({
      id: s.id,
      citation: s.citation || '',
      document_name: s.document_name || '',
      document_id: s.document_id,
      section: s.section || null,
      article: s.article || null,
      page: s.page || null,
      score: s.score || 0,
      preview: (s.preview || '').substring(0, 200),  // 限制preview长度
      file_type: s.file_type || ''
    }));

    // 发送完成信号
    res.write(`data: ${JSON.stringify({ type: 'done', sources: cleanSources })}\n\n`);
    if (res.flush) {
      res.flush();
    }
    res.end();
  } catch (error) {
    console.error('[智能问答-流式] 错误:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message || '生成回答时出错' })}\n\n`);
    if (res.flush) {
      res.flush();
    }
    res.end();
  }
});

// 审核相关
router.get('/review', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 10, status = 'pending' } = req.query;
    const offset = (page - 1) * pageSize;

    let query = db('knowledge_review').where('status', status);
    const countResult = await query.clone().count('* as count');
    const total = parseInt(countResult[0].count);

    const list = await query
      .select('*')
      .orderBy('upload_time', 'desc')
      .limit(pageSize)
      .offset(offset);

    res.json({
      success: true,
      data: {
        list,
        pagination: { page: parseInt(page), pageSize: parseInt(pageSize), total }
      }
    });
  } catch (error) {
    console.error('[内容审核] 错误:', error);
    res.status(500).json({ success: false, message: '获取审核列表失败', error: error.message });
  }
});

router.post('/review/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, comment } = req.body;
    const userId = req.user.id;

    await db('knowledge_review')
      .where('id', id)
      .update({
        status: approved ? 'approved' : 'rejected',
        reviewer_id: userId,
        review_time: db.fn.now(),
        review_comment: comment || '',
        updated_at: db.fn.now()
      });

    if (approved) {
      const review = await db('knowledge_review').where('id', id).first();
      if (review && review.document_id) {
        await db('knowledge_documents')
          .where('id', review.document_id)
          .update({ status: 'published', published_at: db.fn.now(), updated_at: db.fn.now() });
      }
    }

    res.json({ success: true, message: approved ? '审核通过' : '审核拒绝' });
  } catch (error) {
    console.error('[内容审核] 错误:', error);
    res.status(500).json({ success: false, message: '审核操作失败', error: error.message });
  }
});

// 版本管理
router.get('/documents/:id/versions', authenticate, KnowledgeController.getDocumentVersions);
router.post('/documents/:id/versions', authenticate, upload.single('file'), KnowledgeController.uploadNewVersion);
router.put('/documents/:id/versions/:versionId/activate', authenticate, KnowledgeController.switchDocumentVersion);

// 语义搜索
router.post('/search/semantic', authenticate, async (req, res) => {
  try {
    const { query, kb_id, doc_ids, top_k = 5, threshold = 0.7 } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, message: '请输入搜索内容' });
    }

    const KnowledgeService = require('../services/system/KnowledgeService');
    const service = new KnowledgeService();

    const result = await service.semanticSearch(query, {
      kb_id, doc_ids, top_k, threshold, userId: req.user.id
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('[语义搜索] 错误:', error);
    res.status(500).json({ success: false, message: '搜索失败', error: error.message });
  }
});

// 重新处理文档
router.post('/documents/:id/revectorize', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    await db('knowledge_documents')
      .where({ id })
      .update({ vectorization_status: 'processing', vectorization_error: null, updated_at: db.fn.now() });

    setImmediate(async () => {
      try {
        const KnowledgeService = require('../services/system/KnowledgeService');
        const service = new KnowledgeService();
        await service.vectorizeDocument(id);

        await db('knowledge_documents')
          .where({ id })
          .update({
            vectorization_status: 'completed',
            vectorization_time: db.fn.now(),
            vector_status: 'completed',
            vector_indexed_at: db.fn.now(),
            updated_at: db.fn.now()
          });
      } catch (error) {
        console.error(`[重新向量化] 失败:`, error);
        await db('knowledge_documents')
          .where({ id })
          .update({ vectorization_status: 'failed', vectorization_error: error.message, updated_at: db.fn.now() });
      }
    });

    res.json({ success: true, message: '向量化任务已提交' });
  } catch (error) {
    console.error('[重新向量化] 错误:', error);
    res.status(500).json({ success: false, message: '提交失败', error: error.message });
  }
});

router.post('/documents/:id/reextract-graph', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    await db('knowledge_documents')
      .where({ id })
      .update({ graph_extraction_status: 'processing', graph_extraction_error: null, updated_at: db.fn.now() });

    setImmediate(async () => {
      try {
        const KnowledgeService = require('../services/system/KnowledgeService');
        const service = new KnowledgeService();
        await service.extractGraph(id);

        await db('knowledge_documents')
          .where({ id })
          .update({
            graph_extraction_status: 'completed',
            graph_extraction_time: db.fn.now(),
            graph_status: 'completed',
            graph_indexed_at: db.fn.now(),
            updated_at: db.fn.now()
          });
      } catch (error) {
        console.error(`[重新提取图谱] 失败:`, error);
        await db('knowledge_documents')
          .where({ id })
          .update({ graph_extraction_status: 'failed', graph_extraction_error: error.message, updated_at: db.fn.now() });
      }
    });

    res.json({ success: true, message: '图谱提取任务已提交' });
  } catch (error) {
    console.error('[重新提取图谱] 错误:', error);
    res.status(500).json({ success: false, message: '提交失败', error: error.message });
  }
});

router.post('/documents/:id/reprocess', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    await db('knowledge_documents')
      .where({ id })
      .update({
        vectorization_status: 'processing',
        graph_extraction_status: 'processing',
        vectorization_error: null,
        graph_extraction_error: null,
        updated_at: db.fn.now()
      });

    setImmediate(async () => {
      try {
        const KnowledgeService = require('../services/system/KnowledgeService');
        const service = new KnowledgeService();

        await service.vectorizeDocument(id);
        await service.extractGraph(id);
      } catch (error) {
        console.error(`[重新处理] 失败:`, error);
      }
    });

    res.json({ success: true, message: '文档重新处理任务已提交' });
  } catch (error) {
    console.error('[重新处理] 错误:', error);
    res.status(500).json({ success: false, message: '提交失败', error: error.message });
  }
});

// 下载文档
router.get('/documents/:id/download', async (req, res) => {
  try {
    const { id } = req.params;

    const document = await db('knowledge_documents').where({ id }).first();

    if (!document) {
      return res.status(404).json({ success: false, message: '文档不存在' });
    }

    const MinioService = require('../services/utils/MinioService');
    const stream = await MinioService.getObject('knowledge-documents', document.minio_path);

    res.setHeader('Content-Type', document.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.name)}"`);

    stream.pipe(res);
  } catch (error) {
    console.error('[文档下载] 错误:', error);
    res.status(500).json({ success: false, message: '下载失败', error: error.message });
  }
});

// 预览文档 - 原文件不修改
router.get('/documents/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;

    const document = await db('knowledge_documents').where({ id }).first();

    if (!document) {
      return res.status(404).json({ success: false, message: '文档不存在' });
    }

    const MinioService = require('../services/utils/MinioService');
    const stream = await MinioService.getObject('knowledge-documents', document.minio_path);

    res.setHeader('Content-Type', document.file_type || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.name)}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');

    stream.pipe(res);
  } catch (error) {
    console.error('[文档预览] 错误:', error);
    res.status(500).json({ success: false, message: '预览失败', error: error.message });
  }
});

// 获取队列状态
router.get('/queue/status', authenticate, async (req, res) => {
  try {
    const status = await getQueueStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('[队列状态] 错误:', error);
    res.status(500).json({ success: false, message: '获取队列状态失败', error: error.message });
  }
});

// 获取文档处理进度
router.get('/documents/:id/progress', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const progress = await getDocumentProgress(id);
    res.json({ success: true, data: progress });
  } catch (error) {
    console.error('[文档进度] 错误:', error);
    res.status(500).json({ success: false, message: '获取文档进度失败', error: error.message });
  }
});

// 暂停队列
router.post('/queue/pause', authenticate, async (req, res) => {
  try {
    await pauseQueue();
    res.json({ success: true, message: '队列已暂停' });
  } catch (error) {
    console.error('[暂停队列] 错误:', error);
    res.status(500).json({ success: false, message: '暂停队列失败', error: error.message });
  }
});

// 恢复队列
router.post('/queue/resume', authenticate, async (req, res) => {
  try {
    await resumeQueue();
    res.json({ success: true, message: '队列已恢复' });
  } catch (error) {
    console.error('[恢复队列] 错误:', error);
    res.status(500).json({ success: false, message: '恢复队列失败', error: error.message });
  }
});

// 获取所有处理任务
router.get('/jobs', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, document_id } = req.query;
    const offset = (page - 1) * pageSize;

    let query = db('document_processing_jobs')
      .select('document_processing_jobs.*', 'knowledge_documents.name as document_name')
      .leftJoin('knowledge_documents', 'document_processing_jobs.document_id', 'knowledge_documents.id')
      .orderBy('document_processing_jobs.created_at', 'desc');

    if (status) {
      query = query.where('document_processing_jobs.status', status);
    }

    if (document_id) {
      query = query.where('document_processing_jobs.document_id', document_id);
    }

    const countResult = await query.clone().count('* as count');
    const total = parseInt(countResult[0].count);

    const jobs = await query.limit(pageSize).offset(offset);

    res.json({
      success: true,
      data: {
        jobs,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total
        }
      }
    });
  } catch (error) {
    console.error('[获取任务列表] 错误:', error);
    res.status(500).json({ success: false, message: '获取任务列表失败', error: error.message });
  }
});

// 获取单个任务详情
router.get('/jobs/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const job = await db('document_processing_jobs')
      .select('document_processing_jobs.*', 'knowledge_documents.name as document_name')
      .leftJoin('knowledge_documents', 'document_processing_jobs.document_id', 'knowledge_documents.id')
      .where('document_processing_jobs.id', id)
      .first();

    if (!job) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }

    // 获取进度信息
    const progress = await db('document_processing_progress')
      .where('document_id', job.document_id)
      .select('*');

    res.json({
      success: true,
      data: {
        job,
        progress
      }
    });
  } catch (error) {
    console.error('[获取任务详情] 错误:', error);
    res.status(500).json({ success: false, message: '获取任务详情失败', error: error.message });
  }
});

// 重试失败的任务
router.post('/jobs/:id/retry', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const job = await db('document_processing_jobs').where('id', id).first();

    if (!job) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }

    if (job.status !== 'failed') {
      return res.status(400).json({ success: false, message: '只能重试失败的任务' });
    }

    // 获取文档信息
    const document = await db('knowledge_documents').where('id', job.document_id).first();

    if (!document) {
      return res.status(404).json({ success: false, message: '文档不存在' });
    }

    // 重新加入队列
    const jobData = JSON.parse(job.data || '{}');

    const result = await addDocumentToQueue({
      id: document.id,
      name: document.name,
      filePath: document.minio_path,
      kbId: document.kb_id
    }, {
      enableOCR: jobData.enableOCR !== false,
      enableVector: jobData.enableVector !== false,
      enableGraph: jobData.enableGraph !== false,
      priority: job.priority || 0
    });

    // 标记旧任务为已重试
    await db('document_processing_jobs')
      .where('id', id)
      .update({
        status: 'retried',
        updated_at: new Date()
      });

    res.json({
      success: true,
      message: '任务已重新加入队列',
      data: {
        oldJobId: id,
        newJobRecordId: result.jobRecordId,
        newBullJobId: result.bullJobId
      }
    });
  } catch (error) {
    console.error('[重试任务] 错误:', error);
    res.status(500).json({ success: false, message: '重试任务失败', error: error.message });
  }
});

// Office文档预览 - 使用Google Docs Viewer预览原始文件
router.get('/documents/:id/office-preview', async (req, res) => {
  try {
    const { id } = req.params;

    const document = await db('knowledge_documents').where({ id }).first();

    if (!document) {
      return res.status(404).json({ success: false, message: '文档不存在' });
    }

    const fileType = document.file_type || '';
    const fileName = document.name || '';

    // PPT文档 - 提取幻灯片为图片预览
    if (fileType.includes('powerpoint') || fileType.includes('officedocument.presentation') || fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) {
      try {
        const MinioService = require('../services/utils/MinioService');
        const stream = await MinioService.getObject('knowledge-documents', document.minio_path);

        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        // 使用JSZip提取PPTX内容
        const JSZip = require('jszip');
        const zip = await JSZip.loadAsync(buffer);

        // 提取所有图片和媒体文件
        const imageFiles = [];
        const slideRelFiles = [];

        // 找到所有幻灯片关系文件
        for (const [path, file] of Object.entries(zip.files)) {
          if (path.startsWith('ppt/slides/_rels/') && path.endsWith('.xml.rels')) {
            slideRelFiles.push({ path, file });
          }
        }

        // 提取媒体文件
        for (const [path, file] of Object.entries(zip.files)) {
          if (path.startsWith('ppt/media/') && !file.dir) {
            const ext = path.split('.').pop().toLowerCase();
            if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'emf', 'wmf'].includes(ext)) {
              const content = await file.async('base64');
              const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
              imageFiles.push({
                name: path.split('/').pop(),
                data: `data:${mimeType};base64,${content}`,
                path
              });
            }
          }
        }

        console.log(`[PPT预览] 找到 ${imageFiles.length} 个媒体文件`);

        // 读取幻灯片XML来获取文本内容
        const slides = [];
        for (let i = 1; i <= 100; i++) {
          const slidePath = `ppt/slides/slide${i}.xml`;
          if (zip.files[slidePath]) {
            const slideXml = await zip.files[slidePath].async('text');

            // 简单提取文本内容
            const textMatches = slideXml.match(/<a:t>([^<]+)<\/a:t>/g) || [];
            const texts = textMatches.map(m => m.replace(/<\/?a:t>/g, '').trim()).filter(t => t);

            slides.push({
              number: i,
              texts,
              images: imageFiles.filter((_, idx) => Math.floor(idx / (imageFiles.length / slides.length + 1)) === i - 1)
            });
          } else {
            break;
          }
        }

        console.log(`[PPT预览] 解析了 ${slides.length} 张幻灯片`);

        // 生成HTML幻灯片预览
        const slidesHtml = slides.map((slide, idx) => `
          <div class="slide" data-slide="${idx}" style="${idx === 0 ? 'display:block;' : 'display:none;'}">
            <div class="slide-number">幻灯片 ${slide.number} / ${slides.length}</div>
            <div class="slide-content">
              ${slide.images.map(img => `<img src="${img.data}" alt="图片" />`).join('')}
              ${slide.texts.map(text => `<p>${text}</p>`).join('')}
            </div>
          </div>
        `).join('');

        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      user-select: none !important;
      box-sizing: border-box;
    }
    body {
      font-family: 'Microsoft YaHei', Arial, sans-serif;
      background: #1a1a1a;
      overflow: hidden;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .slideshow {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #2a2a2a;
      position: relative;
    }
    .slide {
      width: 90%;
      max-width: 1200px;
      height: 80vh;
      background: white;
      padding: 40px;
      box-shadow: 0 10px 50px rgba(0,0,0,0.5);
      overflow-y: auto;
      position: relative;
    }
    .slide-number {
      position: absolute;
      top: 10px;
      right: 20px;
      background: rgba(0,0,0,0.6);
      color: white;
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 14px;
    }
    .slide-content {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .slide-content img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto;
      pointer-events: none;
    }
    .slide-content p {
      font-size: 18px;
      line-height: 1.8;
      color: #333;
      margin: 10px 0;
    }
    .controls {
      background: #1a1a1a;
      padding: 20px;
      display: flex;
      justify-content: center;
      gap: 20px;
      align-items: center;
    }
    button {
      background: #4CAF50;
      color: white;
      border: none;
      padding: 12px 30px;
      font-size: 16px;
      border-radius: 5px;
      cursor: pointer;
      transition: all 0.3s;
      pointer-events: auto;
      user-select: auto !important;
    }
    button:hover {
      background: #45a049;
      transform: translateY(-2px);
    }
    button:disabled {
      background: #666;
      cursor: not-allowed;
      transform: none;
    }
    .progress {
      color: white;
      font-size: 16px;
      min-width: 150px;
      text-align: center;
    }
  </style>
  <script>
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('copy', e => e.preventDefault());
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey) {
        if (['c', 'a', 's', 'p', 'u'].includes(e.key.toLowerCase())) {
          e.preventDefault();
        }
      }
      if (e.key === 'F12') e.preventDefault();

      // 键盘导航
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 'ArrowRight') nextSlide();
    });

    let currentSlide = 0;
    const totalSlides = ${slides.length};

    function showSlide(n) {
      const slides = document.querySelectorAll('.slide');
      if (n < 0) n = totalSlides - 1;
      if (n >= totalSlides) n = 0;

      slides.forEach((slide, idx) => {
        slide.style.display = idx === n ? 'block' : 'none';
      });

      currentSlide = n;
      document.getElementById('progress').textContent = \`幻灯片 \${n + 1} / \${totalSlides}\`;
      document.getElementById('prevBtn').disabled = n === 0;
      document.getElementById('nextBtn').disabled = n === totalSlides - 1;
    }

    function nextSlide() {
      showSlide(currentSlide + 1);
    }

    function prevSlide() {
      showSlide(currentSlide - 1);
    }

    window.onload = () => showSlide(0);
  </script>
</head>
<body>
  <div class="slideshow">
    ${slidesHtml}
  </div>
  <div class="controls">
    <button id="prevBtn" onclick="prevSlide()">◀ 上一页</button>
    <div class="progress" id="progress">幻灯片 1 / ${slides.length}</div>
    <button id="nextBtn" onclick="nextSlide()">下一页 ▶</button>
  </div>
</body>
</html>
        `;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
        console.log(`[PPT预览] 成功生成HTML幻灯片预览: ${fileName}`);
        return;

      } catch (pptError) {
        console.error(`[PPT预览] 生成预览失败:`, pptError);

        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${fileName}</title>
  <style>
    * { user-select: none !important; }
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      font-family: 'Microsoft YaHei', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .message {
      text-align: center;
      padding: 60px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      max-width: 500px;
    }
    h2 {
      color: #667eea;
      margin-bottom: 20px;
      font-size: 32px;
    }
    p {
      color: #666;
      line-height: 1.8;
      font-size: 16px;
    }
    .icon {
      font-size: 80px;
      margin-bottom: 20px;
    }
    .error {
      background: #ffebee;
      padding: 15px;
      border-radius: 8px;
      margin-top: 20px;
      color: #c62828;
      font-size: 14px;
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="message">
    <div class="icon">📊</div>
    <h2>PPT预览失败</h2>
    <p><strong>${fileName}</strong></p>
    <p style="margin-top: 20px;">无法生成幻灯片预览</p>
    <div class="error">${pptError.message}</div>
  </div>
</body>
</html>
        `;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
        return;
      }
    }

    // Word文档
    if (fileType.includes('word') || fileType.includes('officedocument.wordprocessing') || fileName.endsWith('.docx')) {
      const MinioService = require('../services/utils/MinioService');
      const stream = await MinioService.getObject('knowledge-documents', document.minio_path);

      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const mammoth = require('mammoth');
      const result = await mammoth.convertToHtml({ buffer });

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${fileName}</title>
  <style>
    * { user-select: none !important; }
    body {
      font-family: 'Microsoft YaHei', Arial, sans-serif;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
      background: #f5f5f5;
    }
    .content {
      background: white;
      padding: 40px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    img { max-width: 100%; pointer-events: none; }
    p { line-height: 1.8; }
  </style>
  <script>
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('copy', e => e.preventDefault());
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey) {
        if (['c', 'a', 's', 'p', 'u'].includes(e.key.toLowerCase())) e.preventDefault();
      }
      if (e.key === 'F12') e.preventDefault();
    });
  </script>
</head>
<body>
  <div class="content">${result.value}</div>
</body>
</html>
      `;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
      return;
    }

    // Excel文档
    if (fileType.includes('excel') || fileType.includes('officedocument.spreadsheet') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const MinioService = require('../services/utils/MinioService');
      const stream = await MinioService.getObject('knowledge-documents', document.minio_path);

      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const XLSX = require('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let htmlContent = '';

      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const htmlTable = XLSX.utils.sheet_to_html(worksheet);
        htmlContent += `<h2>Sheet: ${sheetName}</h2>${htmlTable}`;
      });

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${fileName}</title>
  <style>
    * { user-select: none !important; }
    body { font-family: 'Microsoft YaHei', Arial, sans-serif; padding: 20px; background: #f5f5f5; }
    table { border-collapse: collapse; width: 100%; background: white; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    h2 { color: #333; margin-top: 30px; }
  </style>
  <script>
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('copy', e => e.preventDefault());
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey) {
        if (['c', 'a', 's', 'p', 'u'].includes(e.key.toLowerCase())) e.preventDefault();
      }
      if (e.key === 'F12') e.preventDefault();
    });
  </script>
</head>
<body>
  <h1>${fileName}</h1>
  ${htmlContent}
</body>
</html>
      `;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
      return;
    }

    res.status(400).json({ success: false, message: '不支持的文件格式' });

  } catch (error) {
    console.error('[Office预览] 错误:', error);
    res.status(500).json({ success: false, message: 'Office文档预览失败', error: error.message });
  }
});

// ==========================================
// Bull Queue API Endpoints
// ==========================================

/**
 * 获取队列状态
 * GET /api/knowledge/queue/status
 */
router.get('/queue/status', authenticate, async (req, res) => {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      documentQueue.getWaitingCount(),
      documentQueue.getActiveCount(),
      documentQueue.getCompletedCount(),
      documentQueue.getFailedCount(),
      documentQueue.getDelayedCount()
    ]);

    const isPaused = await documentQueue.isPaused();

    res.json({
      success: true,
      data: {
        waiting,
        active,
        completed,
        failed,
        delayed,
        isPaused,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[队列状态] 获取失败:', error);
    res.status(500).json({ success: false, message: '获取队列状态失败', error: error.message });
  }
});

/**
 * 暂停队列
 * POST /api/knowledge/queue/pause
 */
router.post('/queue/pause', authenticate, async (req, res) => {
  try {
    await documentQueue.pause();
    res.json({
      success: true,
      message: '队列已暂停'
    });
  } catch (error) {
    console.error('[队列暂停] 失败:', error);
    res.status(500).json({ success: false, message: '暂停队列失败', error: error.message });
  }
});

/**
 * 恢复队列
 * POST /api/knowledge/queue/resume
 */
router.post('/queue/resume', authenticate, async (req, res) => {
  try {
    await documentQueue.resume();
    res.json({
      success: true,
      message: '队列已恢复'
    });
  } catch (error) {
    console.error('[队列恢复] 失败:', error);
    res.status(500).json({ success: false, message: '恢复队列失败', error: error.message });
  }
});

/**
 * 获取文档处理进度
 * GET /api/knowledge/documents/:id/progress
 */
router.get('/documents/:id/progress', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. 查询任务记录
    const job = await db('document_processing_jobs')
      .where({ document_id: id })
      .orderBy('created_at', 'desc')
      .first();

    if (!job) {
      return res.json({
        success: true,
        data: {
          job: null,
          progress: [],
          message: '未找到处理任务'
        }
      });
    }

    // 2. 查询进度记录
    const progress = await db('document_processing_progress')
      .where({ document_id: id })
      .orderBy('stage', 'asc')
      .select('*');

    res.json({
      success: true,
      data: {
        job: {
          id: job.id,
          status: job.status,
          attempts: job.attempts,
          max_attempts: job.max_attempts,
          error: job.error_message,
          data: job.result_data,
          created_at: job.created_at,
          completed_at: job.completed_at
        },
        progress: progress.map(p => ({
          stage: p.stage,
          progress_percentage: p.progress_percentage,
          current_page: p.current_page,
          total_pages: p.total_pages,
          current_chunk: p.current_chunk,
          total_chunks: p.total_chunks,
          metadata: p.metadata,
          last_checkpoint_at: p.last_checkpoint_at
        }))
      }
    });
  } catch (error) {
    console.error('[文档进度] 获取失败:', error);
    res.status(500).json({ success: false, message: '获取文档进度失败', error: error.message });
  }
});

/**
 * 获取任务列表
 * GET /api/knowledge/jobs?page=1&pageSize=10&status=all
 */
router.get('/jobs', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 10, status = 'all' } = req.query;
    const offset = (page - 1) * pageSize;

    let query = db('document_processing_jobs')
      .leftJoin('knowledge_documents', 'document_processing_jobs.document_id', 'knowledge_documents.id')
      .select(
        'document_processing_jobs.id',
        'document_processing_jobs.document_id',
        'knowledge_documents.name as document_name',
        'document_processing_jobs.job_type',
        'document_processing_jobs.status',
        'document_processing_jobs.attempts',
        'document_processing_jobs.max_attempts',
        'document_processing_jobs.error_message',
        'document_processing_jobs.created_at',
        'document_processing_jobs.started_at',
        'document_processing_jobs.completed_at'
      );

    if (status !== 'all') {
      query = query.where('document_processing_jobs.status', status);
    }

    const [jobs, countResult] = await Promise.all([
      query
        .orderBy('document_processing_jobs.created_at', 'desc')
        .limit(pageSize)
        .offset(offset),
      db('document_processing_jobs')
        .count('* as count')
        .where(status === 'all' ? {} : { status })
        .first()
    ]);

    res.json({
      success: true,
      data: {
        jobs,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: parseInt(countResult.count),
          totalPages: Math.ceil(countResult.count / pageSize)
        }
      }
    });
  } catch (error) {
    console.error('[任务列表] 获取失败:', error);
    res.status(500).json({ success: false, message: '获取任务列表失败', error: error.message });
  }
});

/**
 * 获取任务详情
 * GET /api/knowledge/jobs/:id
 */
router.get('/jobs/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const job = await db('document_processing_jobs')
      .leftJoin('knowledge_documents', 'document_processing_jobs.document_id', 'knowledge_documents.id')
      .where('document_processing_jobs.id', id)
      .select(
        'document_processing_jobs.*',
        'knowledge_documents.name as document_name',
        'knowledge_documents.file_path',
        'knowledge_documents.kb_id'
      )
      .first();

    if (!job) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }

    // 获取进度记录
    const progress = await db('document_processing_progress')
      .where({ document_id: job.document_id })
      .orderBy('stage', 'asc')
      .select('*');

    res.json({
      success: true,
      data: {
        job,
        progress
      }
    });
  } catch (error) {
    console.error('[任务详情] 获取失败:', error);
    res.status(500).json({ success: false, message: '获取任务详情失败', error: error.message });
  }
});

/**
 * 重试失败任务
 * POST /api/knowledge/jobs/:id/retry
 */
router.post('/jobs/:id/retry', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // 1. 获取任务信息
    const job = await db('document_processing_jobs')
      .where({ id })
      .first();

    if (!job) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }

    if (job.status !== 'failed') {
      return res.status(400).json({ success: false, message: '只能重试失败的任务' });
    }

    // 2. 获取文档信息
    const document = await db('knowledge_documents')
      .where({ id: job.document_id })
      .first();

    if (!document) {
      return res.status(404).json({ success: false, message: '文档不存在' });
    }

    // 3. 重新加入队列
    await documentQueue.add('process-document', {
      documentId: document.id,
      documentName: document.name,
      filePath: document.file_path,
      kbId: document.kb_id,
      enableOCR: true,
      enableVector: true,
      enableGraph: true
    });

    // 4. 更新任务状态
    await db('document_processing_jobs')
      .where({ id })
      .update({
        status: 'pending',
        attempts: 0,
        error_message: null,
        updated_at: new Date()
      });

    res.json({
      success: true,
      message: '任务已重新加入队列'
    });
  } catch (error) {
    console.error('[任务重试] 失败:', error);
    res.status(500).json({ success: false, message: '重试任务失败', error: error.message });
  }
});

module.exports = router;
