/**
 * STEP文件加载路由
 * 服务端解析STEP，返回Three.js格式
 */
const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

/**
 * 加载单个STEP文件
 * GET /api/step-loader/:partName
 */
router.get('/:partName', async (req, res) => {
  try {
    const { partName } = req.params;
    const stepFile = path.join(__dirname, '../../../../docs/solidworks', `${partName}.STEP`);

    // 检查文件是否存在
    try {
      await fs.access(stepFile);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: `STEP文件不存在: ${partName}`
      });
    }

    // 使用Python脚本解析STEP
    const pythonScript = path.join(__dirname, '../services/assembly/parse_step_to_json.py');

    // 使用cad环境的Python (Python 3.12 + pythonocc-core)
    const condaBase = process.env.CONDA_PREFIX || '/opt/anaconda3';
    const cadPython = `${condaBase}/envs/cad/bin/python`;

    const python = spawn(cadPython, [pythonScript, stepFile]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        console.error('[STEP解析失败]', stderr);
        return res.status(500).json({
          success: false,
          message: 'STEP解析失败',
          error: stderr
        });
      }

      try {
        const result = JSON.parse(stdout);
        res.json({
          success: true,
          data: {
            partName,
            geometry: result.geometry,
            color: result.color,
            boundingBox: result.boundingBox,
            metadata: result.metadata
          }
        });
      } catch (error) {
        console.error('[JSON解析失败]', error);
        res.status(500).json({
          success: false,
          message: 'JSON解析失败',
          error: error.message
        });
      }
    });
  } catch (error) {
    console.error('[STEP加载失败]', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
});

/**
 * 批量加载STEP文件
 * POST /api/step-loader/batch
 * Body: { partNames: ['P0000009449', 'P0000009450'] }
 */
router.post('/batch', async (req, res) => {
  try {
    const { partNames } = req.body;

    if (!Array.isArray(partNames)) {
      return res.status(400).json({
        success: false,
        message: 'partNames必须是数组'
      });
    }

    const results = [];

    for (const partName of partNames) {
      try {
        const stepFile = path.join(__dirname, '../../../../docs/solidworks', `${partName}.STEP`);
        await fs.access(stepFile);

        // TODO: 调用Python解析
        results.push({
          partName,
          success: true,
          message: '准备解析'
        });
      } catch (error) {
        results.push({
          partName,
          success: false,
          message: '文件不存在'
        });
      }
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('[批量加载失败]', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
});

module.exports = router;
