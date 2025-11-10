const DrawingComparisonService = require('../../../src/services/drawing/DrawingComparisonService');
const knex = require('../../../src/config/database');

describe('DrawingComparisonService', () => {
  let testTaskId;

  afterAll(async () => {
    await knex.destroy();
  });

  describe('createTask', () => {
    it('should create a comparison task', async () => {
      const taskData = {
        userId: 'user_test',
        v1FileUrl: 'minio://v1.pdf',
        v2FileUrl: 'minio://v2.pdf',
        projectId: 'proj_123',
        description: 'Test comparison task'
      };

      const task = await DrawingComparisonService.createTask(taskData);

      expect(task).toHaveProperty('taskId');
      expect(task.status).toBe('pending');
      expect(task.progress).toBe(0);

      // Save taskId for other tests
      testTaskId = task.taskId;
    });
  });

  describe('getTask', () => {
    it('should successfully retrieve a task', async () => {
      const task = await DrawingComparisonService.getTask(testTaskId);

      expect(task).toHaveProperty('taskId', testTaskId);
      expect(task).toHaveProperty('userId', 'user_test');
      expect(task).toHaveProperty('status', 'pending');
      expect(task).toHaveProperty('v1FileUrl', 'minio://v1.pdf');
      expect(task).toHaveProperty('v2FileUrl', 'minio://v2.pdf');
    });

    it('should throw error when task not found', async () => {
      await expect(
        DrawingComparisonService.getTask('nonexistent_task_id')
      ).rejects.toThrow('Task nonexistent_task_id not found');
    });
  });

  describe('updateTaskStatus', () => {
    it('should update status correctly', async () => {
      await DrawingComparisonService.updateTaskStatus(testTaskId, {
        status: 'processing',
        progress: 50,
        currentStep: 'Analyzing differences'
      });

      const task = await DrawingComparisonService.getTask(testTaskId);

      expect(task.status).toBe('processing');
      expect(task.progress).toBe(50);
      expect(task.currentStep).toBe('Analyzing differences');
    });
  });

  describe('saveResult', () => {
    it('should save differences and mark complete', async () => {
      const differences = [
        {
          type: 'dimension_change',
          location: { x: 100, y: 200 },
          oldValue: '10mm',
          newValue: '15mm'
        }
      ];

      await DrawingComparisonService.saveResult(testTaskId, {
        annotatedImageUrl: 'minio://annotated.png',
        differences: differences
      });

      const task = await DrawingComparisonService.getTask(testTaskId);

      expect(task.status).toBe('completed');
      expect(task.progress).toBe(100);
      expect(task.annotatedImageUrl).toBe('minio://annotated.png');
      expect(task.differences).toEqual(differences);
      expect(task.completedAt).toBeTruthy();
    });
  });
});
