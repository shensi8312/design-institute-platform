const knex = require('../../config/database');
const redis = require('../../config/redis');

/**
 * 文档级精细权限服务
 * 处理多维度权限标签的CRUD和权限匹配
 */
class DocumentPermissionService {
  
  /**
   * 为文档设置权限标签
   */
  static async setDocumentTags(docId, tags, userId) {
    const trx = await knex.transaction();
    
    try {
      // 1. 删除现有标签
      await trx('document_permission_tags')
        .where({ document_id: docId })
        .delete();
      
      // 2. 插入新标签
      const tagRecords = [];
      for (const tag of tags) {
        tagRecords.push({
          id: `dpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          document_id: docId,
          dimension: tag.dimension,
          tag_type: tag.type || 'required',
          tag_value: tag.value,
          created_by: userId,
          created_at: new Date()
        });
      }
      
      if (tagRecords.length > 0) {
        await trx('document_permission_tags').insert(tagRecords);
      }
      
      // 3. 更新文档的权限标签缓存
      await trx('knowledge_documents')
        .where({ id: docId })
        .update({
          permission_tags: JSON.stringify(tags),
          updated_at: new Date()
        });
      
      await trx.commit();
      
      // 4. 清除Redis缓存
      await this.clearPermissionCache(docId);
      
      return { success: true, tags: tagRecords };
      
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
  
  /**
   * 获取文档的权限标签
   */
  static async getDocumentTags(docId) {
    // 尝试从缓存获取
    const cacheKey = `doc_tags:${docId}`;
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }
    
    // 从数据库获取
    const tags = await knex('document_permission_tags')
      .where({ document_id: docId })
      .select('dimension', 'tag_type', 'tag_value')
      .orderBy('dimension')
      .orderBy('tag_type');
    
    // 缓存结果（1小时）
    if (redis && tags.length > 0) {
      await redis.setex(cacheKey, 3600, JSON.stringify(tags));
    }
    
    return tags;
  }
  
  /**
   * 为用户授予权限标签
   */
  static async grantUserTag(userId, dimension, value, grantedBy, reason, expiresAt = null) {
    const tag = {
      id: `upt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      dimension,
      tag_value: value,
      granted_by: grantedBy,
      granted_at: new Date(),
      expires_at: expiresAt,
      is_active: true,
      reason
    };
    
    // 插入或更新
    await knex('user_permission_tags')
      .insert(tag)
      .onConflict(['user_id', 'dimension', 'tag_value'])
      .merge({
        granted_by: grantedBy,
        granted_at: new Date(),
        expires_at: expiresAt,
        is_active: true,
        reason
      });
    
    // 清除用户权限缓存
    await this.clearUserCache(userId);
    
    return tag;
  }
  
  /**
   * 获取用户的所有权限标签
   */
  static async getUserTags(userId) {
    // 尝试从缓存获取
    const cacheKey = `user_tags:${userId}`;
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }
    
    // 从数据库获取活跃的标签
    const tags = await knex('user_permission_tags')
      .where({ 
        user_id: userId,
        is_active: true
      })
      .where(function() {
        this.whereNull('expires_at')
          .orWhere('expires_at', '>', new Date());
      })
      .select('dimension', 'tag_value');
    
    // 添加基于角色和部门的默认标签
    const user = await knex('users')
      .where({ id: userId })
      .first();
    
    if (user) {
      // 添加组织标签
      if (user.organization_id) {
        tags.push({
          dimension: 'organization',
          tag_value: user.organization_id
        });
      }
      
      // 添加部门标签
      if (user.department_id) {
        tags.push({
          dimension: 'department',
          tag_value: user.department_id
        });
      }
      
      // 添加角色标签
      if (user.role_id) {
        const role = await knex('roles')
          .where({ id: user.role_id })
          .first();
        if (role) {
          tags.push({
            dimension: 'role',
            tag_value: role.name
          });
          
          // 添加级别标签
          if (role.level) {
            tags.push({
              dimension: 'level',
              tag_value: `${role.level}+`
            });
          }
        }
      }
      
      // 如果是管理员，添加特殊标签
      if (user.is_admin) {
        tags.push({
          dimension: 'role',
          tag_value: 'admin'
        });
      }
    }
    
    // 缓存结果（10分钟）
    if (redis) {
      await redis.setex(cacheKey, 600, JSON.stringify(tags));
    }
    
    return tags;
  }
  
  /**
   * 检查用户是否有文档访问权限
   */
  static async checkPermission(userId, docId) {
    try {
      // 1. 获取文档信息
      const doc = await knex('knowledge_documents')
        .where({ id: docId })
        .first();
      
      if (!doc) {
        return { 
          hasAccess: false, 
          reason: '文档不存在' 
        };
      }
      
      // 2. 获取用户信息
      const user = await knex('users')
        .where({ id: userId })
        .first();
      
      // 管理员有所有权限
      if (user.is_admin) {
        await this.logAccess(userId, docId, 'access_granted', 'success', '管理员权限');
        return { 
          hasAccess: true, 
          reason: '管理员权限' 
        };
      }
      
      // 3. 检查权限模式
      if (doc.permission_mode === 'inherit') {
        // 继承知识库权限
        const kb = await knex('knowledge_bases')
          .where({ id: doc.knowledge_base_id })
          .first();
        
        const kbAccess = await this.checkKnowledgeBasePermission(userId, kb);
        if (kbAccess.hasAccess) {
          await this.logAccess(userId, docId, 'access_granted', 'success', '继承知识库权限');
          return kbAccess;
        }
      }
      
      // 4. 获取用户和文档的标签
      const userTags = await this.getUserTags(userId);
      const docTags = await this.getDocumentTags(docId);
      
      // 5. 检查必须标签
      const requiredTags = docTags.filter(t => t.tag_type === 'required');
      for (const reqTag of requiredTags) {
        const hasTag = userTags.some(ut => 
          ut.dimension === reqTag.dimension && 
          this.matchTagValue(ut.tag_value, reqTag.tag_value)
        );
        
        if (!hasTag) {
          const reason = `缺少必要权限: ${reqTag.dimension}:${reqTag.tag_value}`;
          await this.logAccess(userId, docId, 'access_denied', 'denied', reason);
          return { 
            hasAccess: false, 
            reason,
            missingTags: [reqTag]
          };
        }
      }
      
      // 6. 检查禁止标签
      const forbiddenTags = docTags.filter(t => t.tag_type === 'forbidden');
      for (const forbidTag of forbiddenTags) {
        const hasTag = userTags.some(ut => 
          ut.dimension === forbidTag.dimension && 
          this.matchTagValue(ut.tag_value, forbidTag.tag_value)
        );
        
        if (hasTag) {
          const reason = `存在禁止权限: ${forbidTag.dimension}:${forbidTag.tag_value}`;
          await this.logAccess(userId, docId, 'access_denied', 'denied', reason);
          return { 
            hasAccess: false, 
            reason,
            conflictTags: [forbidTag]
          };
        }
      }
      
      // 7. 更新访问统计
      await knex('knowledge_documents')
        .where({ id: docId })
        .update({
          access_count: knex.raw('access_count + 1'),
          last_accessed_at: new Date(),
          last_accessed_by: userId
        });
      
      await this.logAccess(userId, docId, 'access_granted', 'success', '权限匹配成功');
      
      return { 
        hasAccess: true, 
        reason: '权限匹配成功',
        matchedTags: requiredTags
      };
      
    } catch (error) {
      console.error('权限检查错误:', error);
      return { 
        hasAccess: false, 
        reason: '权限检查失败',
        error: error.message
      };
    }
  }
  
  /**
   * 检查知识库权限（简化版）
   */
  static async checkKnowledgeBasePermission(userId, kb) {
    if (!kb) {
      return { hasAccess: false, reason: '知识库不存在' };
    }
    
    const user = await knex('users').where({ id: userId }).first();
    
    switch (kb.permission_level) {
      case 'personal':
        return {
          hasAccess: kb.created_by === userId,
          reason: kb.created_by === userId ? '个人知识库' : '非所有者'
        };
        
      case 'department':
        return {
          hasAccess: user.department_id === kb.department_id,
          reason: user.department_id === kb.department_id ? '同部门' : '非同部门'
        };
        
      case 'project':
        const isMember = await knex('project_members')
          .where({ 
            project_id: kb.project_id,
            user_id: userId
          })
          .first();
        return {
          hasAccess: !!isMember,
          reason: isMember ? '项目成员' : '非项目成员'
        };
        
      case 'company':
        return {
          hasAccess: true,
          reason: '公司级公开'
        };
        
      default:
        return {
          hasAccess: false,
          reason: '未知权限级别'
        };
    }
  }
  
  /**
   * 匹配标签值（支持通配符和范围）
   */
  static matchTagValue(userValue, docValue) {
    // 完全匹配
    if (userValue === docValue) return true;
    
    // 通配符匹配 (dept:* 匹配所有部门)
    if (docValue.endsWith('*')) {
      const prefix = docValue.slice(0, -1);
      return userValue.startsWith(prefix);
    }
    
    // 级别匹配 (level:3+ 表示3级及以上)
    if (docValue.includes('+')) {
      const requiredLevel = parseInt(docValue.replace('+', ''));
      const userLevel = parseInt(userValue);
      return !isNaN(userLevel) && userLevel >= requiredLevel;
    }
    
    return false;
  }
  
  /**
   * 记录权限访问日志
   */
  static async logAccess(userId, docId, action, result, reason) {
    try {
      const userTags = await this.getUserTags(userId);
      const docTags = docId ? await this.getDocumentTags(docId) : null;
      
      await knex('permission_audit_logs').insert({
        id: `pal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        document_id: docId,
        action,
        result,
        reason,
        user_tags: JSON.stringify(userTags),
        doc_tags: JSON.stringify(docTags),
        created_at: new Date()
      });
    } catch (error) {
      console.error('记录审计日志失败:', error);
    }
  }
  
  /**
   * 清除文档权限缓存
   */
  static async clearPermissionCache(docId) {
    if (redis) {
      await redis.del(`doc_tags:${docId}`);
    }
  }
  
  /**
   * 清除用户权限缓存
   */
  static async clearUserCache(userId) {
    if (redis) {
      await redis.del(`user_tags:${userId}`);
    }
  }
  
  /**
   * 批量检查文档权限
   */
  static async batchCheckPermission(userId, docIds) {
    const results = {};
    
    for (const docId of docIds) {
      results[docId] = await this.checkPermission(userId, docId);
    }
    
    return results;
  }
  
  /**
   * 从模板应用权限
   */
  static async applyTemplate(docId, templateName, userId) {
    const template = await knex('permission_templates')
      .where({ name: templateName, is_active: true })
      .first();
    
    if (!template) {
      throw new Error(`模板 ${templateName} 不存在`);
    }
    
    const tags = template.template_tags;
    const formattedTags = [];
    
    // 解析模板标签
    if (tags.required) {
      for (const tag of tags.required) {
        const [dimension, value] = tag.split(':');
        formattedTags.push({
          dimension,
          type: 'required',
          value
        });
      }
    }
    
    if (tags.optional) {
      for (const tag of tags.optional) {
        const [dimension, value] = tag.split(':');
        formattedTags.push({
          dimension,
          type: 'optional',
          value
        });
      }
    }
    
    if (tags.forbidden) {
      for (const tag of tags.forbidden) {
        const [dimension, value] = tag.split(':');
        formattedTags.push({
          dimension,
          type: 'forbidden',
          value
        });
      }
    }
    
    return await this.setDocumentTags(docId, formattedTags, userId);
  }
  
  /**
   * 获取用户可访问的文档ID列表（用于搜索过滤）
   */
  static async getAccessibleDocumentIds(userId, kbId = null) {
    const user = await knex('users').where({ id: userId }).first();
    
    // 管理员可访问所有
    if (user.is_admin) {
      const query = knex('knowledge_documents').select('id');
      if (kbId) query.where({ kb_id: kbId });
      const docs = await query;
      return docs.map(d => d.id);
    }
    
    // 获取用户标签
    const userTags = await this.getUserTags(userId);
    
    // 构建复杂查询
    let query = knex('knowledge_documents as d')
      .select('d.id')
      .where(function() {
        // 继承模式的文档
        this.where('d.permission_mode', 'inherit')
          .whereIn('d.kb_id', function() {
            // 获取用户有权限的知识库
            this.select('id')
              .from('knowledge_bases')
              .where(function() {
                // 个人知识库
                this.where({ 
                  permission_level: 'personal',
                  created_by: userId
                })
                // 部门知识库
                .orWhere({
                  permission_level: 'department',
                  department_id: user.department_id
                })
                // 公司级知识库
                .orWhere({
                  permission_level: 'company'
                });
              });
          });
      })
      // 或者有明确权限标签匹配的文档
      .orWhereExists(function() {
        this.select(1)
          .from('document_permission_tags as dpt')
          .whereRaw('dpt.document_id = d.id')
          .where('dpt.tag_type', 'required')
          .whereIn(knex.raw('(dpt.dimension, dpt.tag_value)'), 
            userTags.map(t => [t.dimension, t.tag_value])
          );
      });
    
    if (kbId) {
      query = query.where('d.kb_id', kbId);
    }
    
    const docs = await query;
    return docs.map(d => d.id);
  }
}

module.exports = DocumentPermissionService;