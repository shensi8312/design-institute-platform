const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticate } = require('../middleware/auth');

// 智能RAG服务配置
const INTELLIGENT_RAG_SERVICE = 'http://localhost:8090';  // 智能RAG服务端口

/**
 * 智能聊天接口 - 使用增强的RAG服务
 * POST /api/intelligent-chat/send
 */
router.post('/send', authenticate, async (req, res) => {
  try {
    const { message, kb_id, conversation_id } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: '消息不能为空'
      });
    }

    // 调用智能RAG服务
    const ragResponse = await axios.post(
      `${INTELLIGENT_RAG_SERVICE}/api/answer`,
      {
        question: message,
        kb_id: kb_id,
        user_id: userId,
        conversation_id: conversation_id
      },
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const result = ragResponse.data;

    // 返回智能回答
    res.json({
      success: true,
      data: {
        answer: result.answer,
        intent: result.intent,
        sources: result.sources,
        conversation_id: conversation_id || result.conversation_id,
        timestamp: result.timestamp
      }
    });

  } catch (error) {
    console.error('智能聊天错误:', error);
    
    // 降级处理 - 如果智能RAG服务不可用，使用基础回答
    if (error.code === 'ECONNREFUSED') {
      return res.json({
        success: true,
        data: {
          answer: '抱歉，智能助手服务暂时不可用。请稍后再试或联系管理员。',
          intent: 'service_unavailable',
          sources: {},
          conversation_id: req.body.conversation_id,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(500).json({
      success: false,
      error: '处理请求时发生错误'
    });
  }
});

/**
 * 获取聊天建议
 * GET /api/intelligent-chat/suggestions
 */
router.get('/suggestions', authenticate, async (req, res) => {
  try {
    const suggestions = [
      {
        category: '设计规范',
        questions: [
          '建筑防火规范有哪些要求？',
          '高层建筑的疏散距离要求是什么？',
          '地下室防水等级如何确定？'
        ]
      },
      {
        category: '结构设计',
        questions: [
          '框架结构和剪力墙结构的区别？',
          '如何计算楼板荷载？',
          '抗震设防烈度如何确定？'
        ]
      },
      {
        category: '材料选择',
        questions: [
          'C30混凝土的强度是多少？',
          'HRB400钢筋的特性是什么？',
          '防水材料如何选择？'
        ]
      },
      {
        category: '施工工艺',
        questions: [
          '混凝土浇筑的注意事项？',
          '钢结构安装流程是什么？',
          '幕墙施工的关键点？'
        ]
      }
    ];

    res.json({
      success: true,
      data: suggestions
    });

  } catch (error) {
    console.error('获取建议失败:', error);
    res.status(500).json({
      success: false,
      error: '获取建议失败'
    });
  }
});

/**
 * 分析用户意图
 * POST /api/intelligent-chat/analyze-intent
 */
router.post('/analyze-intent', authenticate, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: '消息不能为空'
      });
    }

    // 简单的意图分析
    const intents = {
      '规范查询': ['规范', '标准', 'gb', 'jgj', '规程'],
      '设计咨询': ['设计', '方案', '布局', '平面'],
      '材料选择': ['材料', '混凝土', '钢筋', '防水'],
      '施工工艺': ['施工', '工艺', '流程', '步骤'],
      '结构分析': ['结构', '框架', '剪力墙', '荷载']
    };

    let detectedIntent = '一般咨询';
    const messageLower = message.toLowerCase();

    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(keyword => messageLower.includes(keyword))) {
        detectedIntent = intent;
        break;
      }
    }

    res.json({
      success: true,
      data: {
        intent: detectedIntent,
        confidence: 0.8
      }
    });

  } catch (error) {
    console.error('意图分析失败:', error);
    res.status(500).json({
      success: false,
      error: '意图分析失败'
    });
  }
});

module.exports = router;