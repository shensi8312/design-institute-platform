const knex = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

class DrawingComparisonService {
  /**
   * 创建图纸比对任务
   */
  static async createTask({ userId, v1FileUrl, v2FileUrl, projectId, description }) {
    const taskId = `cmp_${Date.now()}_${uuidv4().substring(0, 8)}`;

    const [task] = await knex('drawing_comparison_tasks')
      .insert({
        task_id: taskId,
        user_id: userId,
        project_id: projectId,
        description: description,
        v1_file_url: v1FileUrl,
        v2_file_url: v2FileUrl,
        status: 'pending',
        progress: 0,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      })
      .returning('*');

    return {
      taskId: task.task_id,
      status: task.status,
      progress: task.progress,
      createdAt: task.created_at
    };
  }

  /**
   * 更新任务状态
   */
  static async updateTaskStatus(taskId, { status, progress, currentStep, errorMessage }) {
    const updateData = {
      updated_at: knex.fn.now()
    };

    if (status) updateData.status = status;
    if (typeof progress === 'number') updateData.progress = progress;
    if (currentStep) updateData.current_step = currentStep;
    if (errorMessage) updateData.error_message = errorMessage;
    if (status === 'completed') updateData.completed_at = knex.fn.now();

    await knex('drawing_comparison_tasks')
      .where('task_id', taskId)
      .update(updateData);
  }

  /**
   * 获取任务详情
   */
  static async getTask(taskId) {
    const task = await knex('drawing_comparison_tasks')
      .where('task_id', taskId)
      .first();

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    return {
      taskId: task.task_id,
      userId: task.user_id,
      projectId: task.project_id,
      status: task.status,
      progress: task.progress,
      currentStep: task.current_step,
      errorMessage: task.error_message,
      v1FileUrl: task.v1_file_url,
      v2FileUrl: task.v2_file_url,
      annotatedImageUrl: task.annotated_image_url,
      differences: task.differences_json,
      createdAt: task.created_at,
      completedAt: task.completed_at
    };
  }

  /**
   * 保存比对结果
   */
  static async saveResult(taskId, { annotatedImageUrl, differences }) {
    await knex('drawing_comparison_tasks')
      .where('task_id', taskId)
      .update({
        annotated_image_url: annotatedImageUrl,
        differences_json: JSON.stringify(differences),
        status: 'completed',
        progress: 100,
        completed_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });
  }

  /**
   * 获取用户的任务列表
   */
  static async getUserTasks(userId, { page = 1, pageSize = 20 }) {
    const offset = (page - 1) * pageSize;

    const tasks = await knex('drawing_comparison_tasks')
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    const [{ count }] = await knex('drawing_comparison_tasks')
      .where('user_id', userId)
      .count('* as count');

    return {
      tasks: tasks.map(task => ({
        taskId: task.task_id,
        status: task.status,
        progress: task.progress,
        createdAt: task.created_at,
        completedAt: task.completed_at
      })),
      total: parseInt(count),
      page,
      pageSize
    };
  }
}

module.exports = DrawingComparisonService;
