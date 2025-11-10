const db = require('../config/database');

/**
 * 企业5层权限体系中间件
 * 权限级别：company > department > project > project_dept > personal
 */

class PermissionMiddleware {
    /**
     * 检查用户是否有权限创建指定级别的知识库
     */
    static async checkKnowledgeBaseCreatePermission(req, res, next) {
        try {
            const { permission_level } = req.body;
            const userId = req.user?.id;
            
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: '请先登录'
                });
            }

            // 获取用户信息及角色
            const user = await db('users')
                .leftJoin('roles', 'users.role', 'roles.name')
                .where('users.id', userId)
                .select(
                    'users.*',
                    'roles.name as role_name',
                    'roles.id as role_id'
                )
                .first();

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: '用户不存在'
                });
            }

            // 权限级别映射
            const permissionLevels = {
                'company': 5,      // 公司级 - 只有高管能创建
                'department': 4,   // 部门级 - 部门负责人及以上
                'project': 3,      // 项目级 - 项目经理及以上
                'project_dept': 2, // 项目部门级 - 项目成员
                'personal': 1      // 个人级 - 所有人
            };

            const requiredLevel = permissionLevels[permission_level] || 1;
            // 角色级别通过权限级别判断，而不是role_level
            const userLevel = user.is_admin ? 5 : 1;

            // 特殊角色权限
            if (user.is_admin) {
                req.permissionInfo = {
                    canCreate: true,
                    maxLevel: 'company',
                    user: user
                };
                return next();
            }

            // 检查用户角色级别是否足够
            if (userLevel < requiredLevel) {
                return res.status(403).json({
                    success: false,
                    message: `您的权限不足以创建${permission_level}级别的知识库`
                });
            }

            // 部门级知识库需要是部门负责人
            if (permission_level === 'department') {
                const isDeptManager = await db('departments')
                    .where({
                        id: user.department_id,
                        manager_id: userId
                    })
                    .first();
                
                if (!isDeptManager && !user.is_dept_head) {
                    return res.status(403).json({
                        success: false,
                        message: '只有部门负责人才能创建部门级知识库'
                    });
                }
            }

            // 项目级知识库需要是项目经理
            if (permission_level === 'project' && req.body.project_id) {
                const isProjectManager = await db('projects')
                    .where({
                        id: req.body.project_id,
                        manager_id: userId
                    })
                    .orWhere(function() {
                        this.where('id', req.body.project_id)
                            .whereRaw(`? = ANY(string_to_array(team_members, ','))`, [userId]);
                    })
                    .first();
                
                if (!isProjectManager) {
                    return res.status(403).json({
                        success: false,
                        message: '只有项目成员才能创建项目级知识库'
                    });
                }
            }

            req.permissionInfo = {
                canCreate: true,
                maxLevel: permission_level,
                user: user
            };
            
            next();
        } catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({
                success: false,
                message: '权限检查失败'
            });
        }
    }

    /**
     * 检查用户对文档的访问权限
     */
    static async checkDocumentAccessPermission(req, res, next) {
        try {
            const userId = req.user?.id;
            const { document_id } = req.params;
            
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: '请先登录'
                });
            }

            // 获取文档信息
            const document = await db('knowledge_documents')
                .where('id', document_id)
                .first();

            if (!document) {
                return res.status(404).json({
                    success: false,
                    message: '文档不存在'
                });
            }

            // 获取用户信息
            const user = await db('users')
                .where('id', userId)
                .first();

            // 检查权限级别
            const hasAccess = await this.checkPermissionHierarchy(
                user,
                document.visibility,
                document
            );

            if (!hasAccess) {
                return res.status(403).json({
                    success: false,
                    message: '您没有权限访问此文档'
                });
            }

            req.document = document;
            next();
        } catch (error) {
            console.error('Document access check error:', error);
            res.status(500).json({
                success: false,
                message: '权限检查失败'
            });
        }
    }

    /**
     * 检查权限层级
     */
    static async checkPermissionHierarchy(user, visibility, resource) {
        // 管理员有所有权限
        if (user.is_admin) return true;
        
        // 文档所有者有权限
        if (resource.owner_id === user.id) return true;

        switch (visibility) {
            case 'company':
                // 公司级 - 所有员工可见
                return true;
            
            case 'department':
                // 部门级 - 同部门可见
                return user.department_id === resource.department_id;
            
            case 'project': {
                // 项目级 - 项目成员可见
                if (!resource.project_id) return false;
                const projectMember = await db('project_members')
                    .where({
                        project_id: resource.project_id,
                        user_id: user.id
                    })
                    .first()
                return !!projectMember
            }
            
            case 'project_dept': {
                // 项目部门级 - 项目内同部门成员可见
                if (!resource.project_id || !resource.department_id) return false;
                const projectDeptMember = await db('project_members')
                    .where({
                        project_id: resource.project_id,
                        user_id: user.id,
                        department_id: resource.department_id
                    })
                    .first()
                return !!projectDeptMember
            }
            
            case 'personal':
                // 个人级 - 仅本人可见
                return resource.owner_id === user.id;
            
            default:
                return false;
        }
    }

    /**
     * 获取用户可访问的文档过滤条件
     */
    static async getAccessibleDocumentsFilter(userId) {
        const user = await db('users')
            .where('id', userId)
            .first();

        if (!user) return null;

        // 管理员可以看到所有文档
        if (user.is_admin) {
            return {};
        }

        // 获取用户所在的项目
        const userProjects = await db('project_members')
            .where('user_id', userId)
            .pluck('project_id');

        // 构建查询条件
        return function() {
            this.where('owner_id', userId) // 自己的文档
                .orWhere('visibility', 'company') // 公司级文档
                .orWhere(function() {
                    // 部门级文档
                    this.where('visibility', 'department')
                        .where('department_id', user.department_id);
                })
                .orWhere(function() {
                    // 项目级文档
                    this.where('visibility', 'project')
                        .whereIn('project_id', userProjects);
                })
                .orWhere(function() {
                    // 项目部门级文档
                    this.where('visibility', 'project_dept')
                        .whereIn('project_id', userProjects)
                        .where('department_id', user.department_id);
                });
        };
    }

    /**
     * 检查文档审批权限
     */
    static async checkApprovalPermission(req, res, next) {
        try {
            const userId = req.user?.id;
            const { document_id } = req.params;
            
            const document = await db('knowledge_documents')
                .where('id', document_id)
                .first();

            if (!document) {
                return res.status(404).json({
                    success: false,
                    message: '文档不存在'
                });
            }

            const user = await db('users')
                .leftJoin('roles', 'users.role', 'roles.name')
                .where('users.id', userId)
                .select('users.*', 'roles.id as role_id')
                .first();

            // 检查审批权限
            let canApprove = false;
            
            if (user.is_admin) {
                canApprove = true;
            } else if (document.visibility === 'department') {
                // 部门文档需要部门负责人审批
                const isDeptManager = await db('departments')
                    .where({
                        id: document.department_id,
                        manager_id: userId
                    })
                    .first();
                canApprove = !!isDeptManager;
            } else if (document.visibility === 'project') {
                // 项目文档需要项目经理审批
                const isProjectManager = await db('projects')
                    .where({
                        id: document.project_id,
                        manager_id: userId
                    })
                    .first();
                canApprove = !!isProjectManager;
            }

            if (!canApprove) {
                return res.status(403).json({
                    success: false,
                    message: '您没有审批权限'
                });
            }

            req.document = document;
            next();
        } catch (error) {
            console.error('Approval permission check error:', error);
            res.status(500).json({
                success: false,
                message: '审批权限检查失败'
            });
        }
    }
}

module.exports = PermissionMiddleware;
