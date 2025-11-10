const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const TemplateManager = require('../services/document/TemplateManager');

const upload = multer({ storage: multer.memoryStorage() });

// 检查管理员权限的辅助函数
const checkAdmin = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({
      success: false,
      message: '需要管理员权限'
    });
  }
  next();
};

/**
 * 获取所有模板列表
 * GET /api/templates
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { type } = req.query;
    const templates = TemplateManager.getTemplatesList(type);

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('[模板管理] 获取模板列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模板列表失败',
      error: error.message
    });
  }
});

/**
 * 获取指定模板信息
 * GET /api/templates/:type/:id
 */
router.get('/:type/:id', authenticate, async (req, res) => {
  try {
    const { type, id } = req.params;
    const templateInfo = TemplateManager.getTemplateInfo(type, id);

    if (!templateInfo) {
      return res.status(404).json({
        success: false,
        message: '模板不存在'
      });
    }

    res.json({
      success: true,
      data: templateInfo
    });
  } catch (error) {
    console.error('[模板管理] 获取模板信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取模板信息失败',
      error: error.message
    });
  }
});

/**
 * 上传/更新模板（仅管理员）
 * POST /api/templates/:type/:id
 */
router.post('/:type/:id', authenticate, checkAdmin, upload.single('file'), async (req, res) => {
  try {
    const { type, id } = req.params;
    const { name, description, variables } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请上传模板文件'
      });
    }

    // 验证文件类型
    const allowedTypes = {
      word: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      excel: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ppt: ['application/vnd.openxmlformats-officedocument.presentationml.presentation']
    };

    if (!allowedTypes[type] || !allowedTypes[type].includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: `不支持的文件类型，请上传${type}格式文件`
      });
    }

    const result = await TemplateManager.uploadTemplate(
      type,
      id,
      req.file.buffer,
      {
        name,
        description,
        variables: variables ? JSON.parse(variables) : [],
        uploadBy: req.user.name
      }
    );

    res.json({
      success: true,
      message: '模板上传成功',
      data: result
    });
  } catch (error) {
    console.error('[模板管理] 上传模板失败:', error);
    res.status(500).json({
      success: false,
      message: '上传模板失败',
      error: error.message
    });
  }
});

/**
 * 删除模板（仅管理员）
 * DELETE /api/templates/:type/:id
 */
router.delete('/:type/:id', authenticate, checkAdmin, async (req, res) => {
  try {
    const { type, id } = req.params;

    await TemplateManager.deleteTemplate(type, id);

    res.json({
      success: true,
      message: '模板删除成功'
    });
  } catch (error) {
    console.error('[模板管理] 删除模板失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '删除模板失败'
    });
  }
});

module.exports = router;
