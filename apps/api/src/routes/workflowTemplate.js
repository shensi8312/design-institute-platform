const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const DocumentKnowledgeWorkflow = require('../workflows/DocumentKnowledgeWorkflow');
const WorkflowExecutor = require('../services/workflow/WorkflowExecutor');

// 获取所有工作流模板
router.get('/templates', async (req, res) => {
  try {
    const templatesDir = path.join(__dirname, '../workflows/templates');
    const files = await fs.readdir(templatesDir);
    const templates = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(templatesDir, file), 'utf-8');
        templates.push(JSON.parse(content));
      }
    }

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取特定模板
router.get('/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const templatePath = path.join(__dirname, '../workflows/templates', `${id}.json`);
    const content = await fs.readFile(templatePath, 'utf-8');
    
    res.json({
      success: true,
      data: JSON.parse(content)
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: '模板不存在'
    });
  }
});

// 执行工作流模板
router.post('/execute', async (req, res) => {
  try {
    const { workflow_id, data } = req.body;
    
    let result;
    
    // 根据工作流ID执行对应的工作流
    switch (workflow_id) {
      case 'document_knowledge_workflow':
        result = await DocumentKnowledgeWorkflow.execute(data);
        break;
        
      case 'sketch_to_3d_workflow':
        result = await executeSketchTo3D(data);
        break;
        
      default:
        // 尝试从模板创建并执行
        result = await executeFromTemplate(workflow_id, data);
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 草图转3D执行函数
async function executeSketchTo3D(data) {
  const { image_path } = data;
  
  const result = {
    workflow: '草图转3D白模',
    start_time: new Date(),
    steps: []
  };
  
  try {
    // 模拟各个步骤的执行
    
    // 1. 图像预处理
    result.steps.push({
      name: '图像预处理',
      status: 'success',
      data: { enhanced: true }
    });
    
    // 2. 建筑元素识别
    const elements = {
      walls: [
        { start: [0, 0], end: [10, 0] },
        { start: [10, 0], end: [10, 8] },
        { start: [10, 8], end: [0, 8] },
        { start: [0, 8], end: [0, 0] }
      ],
      doors: [
        { position: [5, 0], width: 0.9 }
      ],
      windows: [
        { position: [2, 0], width: 1.5 },
        { position: [7, 0], width: 1.5 }
      ]
    };
    result.steps.push({
      name: '建筑元素识别',
      status: 'success',
      data: elements
    });
    
    // 3. 生成SketchUp命令
    const commands = [];
    
    // 生成墙体命令
    elements.walls.forEach((wall, index) => {
      commands.push({
        type: 'create_wall',
        params: {
          id: `wall_${index}`,
          start_point: [...wall.start, 0],
          end_point: [...wall.end, 0],
          height: 3000,
          thickness: 240
        }
      });
    });
    
    // 生成门命令
    elements.doors.forEach((door, index) => {
      commands.push({
        type: 'create_door',
        params: {
          id: `door_${index}`,
          position: [...door.position, 0],
          width: door.width * 1000,
          height: 2100
        }
      });
    });
    
    // 生成窗户命令
    elements.windows.forEach((window, index) => {
      commands.push({
        type: 'create_window',
        params: {
          id: `window_${index}`,
          position: [...window.position, 900],
          width: window.width * 1000,
          height: 1500
        }
      });
    });
    
    result.steps.push({
      name: '生成命令序列',
      status: 'success',
      data: { commands_count: commands.length }
    });
    
    result.status = 'success';
    result.end_time = new Date();
    result.commands = commands;
    
    return result;
    
  } catch (error) {
    result.status = 'failed';
    result.error = error.message;
    throw error;
  }
}

// 从模板执行工作流
async function executeFromTemplate(workflow_id, data) {
  try {
    // 加载模板
    const templatePath = path.join(__dirname, '../workflows/templates', `${workflow_id}.json`);
    const template = JSON.parse(await fs.readFile(templatePath, 'utf-8'));
    
    // 创建工作流实例
    const instance = {
      id: `instance_${Date.now()}`,
      template: template,
      context: data,
      nodes: new Map(),
      edges: template.edges,
      results: new Map()
    };
    
    // 初始化节点
    for (const node of template.nodes) {
      instance.nodes.set(node.id, {
        ...node,
        status: 'pending',
        input: null,
        output: null
      });
    }
    
    // 执行工作流
    const executor = new WorkflowExecutor(instance);
    return await executor.execute();
    
  } catch (error) {
    throw new Error(`执行模板失败: ${error.message}`);
  }
}

// 导入工作流模板到数据库
router.post('/import', async (req, res) => {
  try {
    const { template } = req.body;
    
    // 这里可以将模板保存到数据库的workflow_scenarios表
    const knex = require('../config/database');
    
    await knex('workflow_scenarios').insert({
      key: template.id,
      name: template.name,
      description: template.description,
      triggers: JSON.stringify(template.triggers || []),
      nodes: JSON.stringify(template.nodes),
      edges: JSON.stringify(template.edges),
      config: JSON.stringify(template.variables || {}),
      priority: 50,
      enabled: true,
      created_at: new Date()
    });
    
    res.json({
      success: true,
      message: '模板导入成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;