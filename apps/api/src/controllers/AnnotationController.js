const db = require('../config/database')

class AnnotationController {
    // 创建标注任务
    static async createTask(req, res) {
        try {
            const {
                name,
                description,
                type = 'image', // image, text, cad, bim
                visibility = 'department',
                projectId,
                departmentId,
                assigneeId
            } = req.body
            
            const file = req.file
            const userId = req.user?.id || 'user_admin'
            
            if (!file) {
                return res.status(400).json({
                    success: false,
                    message: '请上传需要标注的文件'
                })
            }
            
            const [task] = await db('annotation_tasks')
                .insert({
                    id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    name,
                    description,
                    type,
                    file_path: file.path || `/uploads/annotations/${file.filename}`,
                    visibility,
                    project_id: projectId,
                    department_id: departmentId || req.user?.departmentId,
                    assignee_id: assigneeId || userId,
                    status: 'pending',
                    created_at: new Date(),
                    updated_at: new Date()
                })
                .returning('*')
            
            res.json({
                success: true,
                message: '标注任务创建成功',
                data: task
            })
            
        } catch (error) {
            console.error('Create annotation task error:', error)
            res.status(500).json({
                success: false,
                message: '创建标注任务失败: ' + error.message
            })
        }
    }
    
    // 获取标注任务列表
    static async getTasks(req, res) {
        try {
            const { page = 1, pageSize = 20, status = 'all', type = 'all' } = req.query
            const userId = req.user?.id || 'user_admin'
            const userDeptId = req.user?.departmentId || 'admin_dept'
            
            let query = db('annotation_tasks as at')
                .leftJoin('users as u', 'at.assignee_id', 'u.id')
                .leftJoin('departments as d', 'at.department_id', 'd.id')
                .leftJoin('projects as p', 'at.project_id', 'p.id')
            
            // 根据权限过滤
            query = query.where(function() {
                this.where('at.visibility', 'company')
                    .orWhere(function() {
                        this.where('at.visibility', 'department')
                            .where('at.department_id', userDeptId)
                    })
                    .orWhere('at.assignee_id', userId)
            })
            
            // 状态筛选
            if (status !== 'all') {
                query = query.where('at.status', status)
            }
            
            // 类型筛选
            if (type !== 'all') {
                query = query.where('at.type', type)
            }
            
            const countResult = await query.clone().count('* as total').first()
            const total = parseInt(countResult?.total) || 0
            
            const tasks = await query
                .select(
                    'at.*',
                    'u.name as assignee_name',
                    'd.name as department_name',
                    'p.name as project_name'
                )
                .orderBy('at.created_at', 'desc')
                .limit(pageSize)
                .offset((page - 1) * pageSize)
            
            res.json({
                success: true,
                data: {
                    list: tasks.map(task => ({
                        ...task,
                        annotations: task.annotations ? JSON.parse(task.annotations) : []
                    })),
                    pagination: {
                        page: parseInt(page),
                        pageSize: parseInt(pageSize),
                        total,
                        totalPages: Math.ceil(total / pageSize)
                    }
                }
            })
            
        } catch (error) {
            console.error('Get annotation tasks error:', error)
            res.status(500).json({
                success: false,
                message: '获取标注任务失败: ' + error.message
            })
        }
    }
    
    // 保存标注数据
    static async saveAnnotation(req, res) {
        try {
            const { taskId } = req.params
            const { annotations, status = 'in_progress' } = req.body
            const userId = req.user?.id || 'user_admin'
            
            // 检查任务是否存在
            const task = await db('annotation_tasks')
                .where('id', taskId)
                .first()
            
            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: '标注任务不存在'
                })
            }
            
            // 检查权限
            if (task.assignee_id !== userId && task.visibility !== 'company') {
                return res.status(403).json({
                    success: false,
                    message: '无权限修改此标注任务'
                })
            }
            
            // 更新标注数据
            const updateData = {
                annotations: JSON.stringify(annotations),
                status,
                updated_at: new Date()
            }
            
            if (status === 'completed') {
                updateData.completed_at = new Date()
            }
            
            await db('annotation_tasks')
                .where('id', taskId)
                .update(updateData)
            
            res.json({
                success: true,
                message: '标注数据保存成功',
                data: { taskId, status }
            })
            
        } catch (error) {
            console.error('Save annotation error:', error)
            res.status(500).json({
                success: false,
                message: '保存标注数据失败: ' + error.message
            })
        }
    }
    
    // 自动标注（调用AI服务）
    static async autoAnnotate(req, res) {
        try {
            const { taskId } = req.params
            const { model = 'yolo' } = req.body
            
            // 获取任务信息
            const task = await db('annotation_tasks')
                .where('id', taskId)
                .first()
            
            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: '标注任务不存在'
                })
            }
            
            // 模拟AI自动标注
            const autoAnnotations = await AnnotationController.callAIAnnotation(task, model)
            
            // 更新标注数据
            await db('annotation_tasks')
                .where('id', taskId)
                .update({
                    annotations: JSON.stringify(autoAnnotations),
                    status: 'in_progress',
                    updated_at: new Date()
                })
            
            res.json({
                success: true,
                message: '自动标注完成',
                data: {
                    taskId,
                    annotations: autoAnnotations
                }
            })
            
        } catch (error) {
            console.error('Auto annotate error:', error)
            res.status(500).json({
                success: false,
                message: '自动标注失败: ' + error.message
            })
        }
    }
    
    // 辅助方法：调用AI标注服务
    static async callAIAnnotation(task, model) {
        // TODO: 实际调用AI标注服务
        // 这里返回模拟数据
        
        if (task.type === 'image') {
            return [
                {
                    type: 'bbox',
                    label: '柱子',
                    coordinates: [100, 100, 200, 200],
                    confidence: 0.95
                },
                {
                    type: 'bbox',
                    label: '梁',
                    coordinates: [300, 150, 450, 250],
                    confidence: 0.88
                },
                {
                    type: 'polygon',
                    label: '墙体',
                    points: [[50, 50], [150, 50], [150, 300], [50, 300]],
                    confidence: 0.92
                }
            ]
        } else if (task.type === 'text') {
            return [
                {
                    type: 'entity',
                    text: '混凝土强度',
                    label: '材料参数',
                    start: 10,
                    end: 25
                },
                {
                    type: 'entity',
                    text: 'C30',
                    label: '强度等级',
                    start: 26,
                    end: 29
                }
            ]
        } else {
            return []
        }
    }
}

module.exports = AnnotationController