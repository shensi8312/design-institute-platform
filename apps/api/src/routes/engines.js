const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const EngineController = require('../controllers/EngineController.refactored');

// 引擎管理
router.get('/', authenticate, EngineController.getEngines);
router.get('/:id', authenticate, EngineController.getEngine);
router.post('/', authenticate, EngineController.createEngine);
router.post('/register', authenticate, EngineController.registerEngine);
router.put('/:id', authenticate, EngineController.updateEngine);
router.delete('/:id', authenticate, EngineController.deleteEngine);
router.post('/:id/deploy', authenticate, EngineController.deployEngine);
router.post('/:id/execute', authenticate, EngineController.executeEngine);

module.exports = router;
