const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const WorkflowController = require('../controllers/WorkflowController');

// 工作流管理
router.get('/', authenticate, WorkflowController.getWorkflows);
router.get('/templates', authenticate, WorkflowController.getTemplates);
router.get('/:id', authenticate, WorkflowController.getWorkflow);
router.post('/', authenticate, WorkflowController.createWorkflow);
router.put('/:id', authenticate, WorkflowController.updateWorkflow);
router.delete('/:id', authenticate, WorkflowController.deleteWorkflow);
router.post('/:id/duplicate', authenticate, WorkflowController.duplicateWorkflow);
router.post('/:id/execute', authenticate, WorkflowController.executeWorkflow);
router.get('/:id/executions', authenticate, WorkflowController.getExecutions);
router.get('/executions/:executionId', authenticate, WorkflowController.getExecution);
router.post('/executions/:executionId/stop', authenticate, WorkflowController.stopExecution);
router.get('/:id/statistics', authenticate, WorkflowController.getStatistics);
router.post('/templates/:templateId/create', authenticate, WorkflowController.createFromTemplate);
router.post('/:id/save-as-template', authenticate, WorkflowController.saveAsTemplate);
router.get('/:id/export', authenticate, WorkflowController.exportWorkflow);
router.post('/import', authenticate, WorkflowController.importWorkflow);

module.exports = router;
