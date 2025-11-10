/**
 * 权限感知的知识服务
 * 将5层权限体系与RAGFlow/GraphRAG集成
 */

const axios = require('axios');
const db = require('../../config/database');

class PermissionAwareKnowledgeService {
    constructor() {
        // 使用真正的向量服务替代假的ragflow-lite
        this.ragflowUrl = process.env.RAGFLOW_URL || 'http://localhost:8085';  // 真正的向量服务
        this.graphragUrl = process.env.GRAPHRAG_URL || 'http://localhost:8081';
        this.vectorServiceUrl = 'http://localhost:8085';  // 真正的向量服务
        this.documentRecognitionUrl = process.env.DOCUMENT_RECOGNITION_URL || 'http://localhost:8086';  // 文档识别服务
    }

    /**
     * 创建带权限的知识库
     * 为不同权限级别创建独立的向量空间
     */
    async createKnowledgeBase(knowledgeBaseData, user) {
        const { 
            name, 
            permission_level, 
            department_id, 
            project_id,
            project_dept_id 
        } = knowledgeBaseData;

        // 1. 创建数据库记录
        const [kb] = await db('knowledge_bases')
            .insert({
                id: `kb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name,
                permission_level,
                department_id,
                project_id,
                project_dept_id,
                owner_id: user.id,
                owner_type: user.role_name,
                created_by: user.id,
                created_at: new Date(),
                updated_at: new Date()
            })
            .returning('*');

        // 2. 在RAGFlow中创建独立的数据集
        const ragflowDatasetName = this.generateDatasetName(kb);
        try {
            const ragflowResponse = await axios.post(
                `${this.ragflowUrl}/api/datasets`,
                {
                    name: ragflowDatasetName,
                    description: `${permission_level} level knowledge base: ${name}`,
                    metadata: {
                        kb_id: kb.id,
                        permission_level,
                        department_id,
                        project_id,
                        created_by: user.id
                    }
                }
            );
            
            // 更新数据库中的RAGFlow dataset ID
            await db('knowledge_bases')
                .where('id', kb.id)
                .update({
                    ragflow_dataset_id: ragflowResponse.data.dataset_id
                });
        } catch (error) {
            console.error('Failed to create RAGFlow dataset:', error);
        }

        // 3. 在GraphRAG中创建独立的工作空间
        try {
            const graphragResponse = await axios.post(
                `${this.graphragUrl}/workspace/create`,
                {
                    name: ragflowDatasetName,
                    type: 'permission_scoped',
                    metadata: {
                        kb_id: kb.id,
                        permission_level,
                        scope: this.getPermissionScope(kb)
                    }
                }
            );
            
            await db('knowledge_bases')
                .where('id', kb.id)
                .update({
                    graphrag_workspace_id: graphragResponse.data.workspace_id
                });
        } catch (error) {
            console.error('Failed to create GraphRAG workspace:', error);
        }

        return kb;
    }

    /**
     * 上传文档到带权限的知识库
     * 文档会继承知识库的权限级别
     */
    async uploadDocument(documentData, knowledgeBase, user) {
        const { file_path, content, name } = documentData;
        
        // 1. 验证用户是否有权限上传到该知识库
        const hasPermission = await this.checkUploadPermission(user, knowledgeBase);
        if (!hasPermission) {
            throw new Error('没有权限上传到该知识库');
        }

        // 2. 创建文档记录，继承知识库权限
        const [document] = await db('knowledge_documents')
            .insert({
                id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name,
                kb_id: knowledgeBase.id,
                visibility: knowledgeBase.permission_level,
                department_id: knowledgeBase.department_id,
                project_id: knowledgeBase.project_id,
                project_dept_id: knowledgeBase.project_dept_id,
                owner_id: user.id,
                file_path,
                minio_status: 'pending',
                vector_status: 'pending',
                graph_status: 'pending',
                created_at: new Date()
            })
            .returning('*');

        // 3. 向量化处理 - 带权限元数据
        await this.vectorizeWithPermission(document, knowledgeBase, content);
        
        // 4. 图谱提取 - 带权限标记
        await this.extractGraphWithPermission(document, knowledgeBase, content);

        return document;
    }

    /**
     * 向量化文档并标记权限
     * 调用RAGFlow进行向量化，添加权限元数据
     */
    async vectorizeWithPermission(document, knowledgeBase, filePath) {
        try {
            let content = '';
            
            // 1. 先调用文档识别服务提取文本
            console.log(`🔍 开始文档识别流程，文档ID: ${document.id}, 文件路径: ${filePath}`);
            try {
                const fs = require('fs');
                const path = require('path');
                const FormData = require('form-data');
                
                // 确保文件路径是绝对路径，考虑后端工作目录
                const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
                console.log(`📄 正在识别文档: ${document.name}, 文件路径: ${absolutePath}`);
                
                // 检查文件是否存在
                if (!fs.existsSync(absolutePath)) {
                    throw new Error(`文件不存在: ${absolutePath}`);
                }
                
                const form = new FormData();
                form.append('file', fs.createReadStream(absolutePath));
                const recognizeResponse = await axios.post(`${this.documentRecognitionUrl}/api/recognize`, form, {
                    headers: {
                        ...form.getHeaders()
                    },
                    timeout: 180000 // 3分钟超时，适应OCR处理
                });
                
                if (recognizeResponse.data.success) {
                    // 支持多种响应格式
                    let extractedContent = '';
                    const responseData = recognizeResponse.data.data;
                    
                    if (responseData?.extracted_text) {
                        // 简单文本格式
                        extractedContent = responseData.extracted_text;
                    } else if (responseData?.recognition?.content) {
                        // 简单文档格式 (txt等)
                        extractedContent = responseData.recognition.content;
                    } else if (responseData?.recognition?.pages && Array.isArray(responseData.recognition.pages)) {
                        // PDF等分页文档格式
                        extractedContent = responseData.recognition.pages
                            .map(page => page.text || '')
                            .join('\n\n');
                    }
                    
                    content = extractedContent.trim();
                    if (content) {
                        console.log(`✅ 文档识别成功，提取文本 ${content.length} 字符 (${responseData?.recognition?.pages ? 'PDF分页' : '简单'}格式)`);
                    } else {
                        throw new Error('文档识别成功但未提取到文本内容');
                    }
                } else {
                    throw new Error('文档识别失败或无法提取文本');
                }
            } catch (recognizeError) {
                console.error('❌ 文档识别失败:', recognizeError.message);
                console.error('❌ 错误详情:', recognizeError.stack);
                console.error('❌ 错误响应:', recognizeError.response?.data);
                // 如果文档识别失败，使用文档描述作为备用
                content = document.description || document.name || '';
                console.log('⚠️ 使用文档名称作为备用内容');
            }
            
            // 2. 检查内容是否为空
            if (!content.trim()) {
                throw new Error('文本不能为空');
            }
            
            // 3. 调用向量服务进行向量化
            console.log(`🔢 正在向量化文档: ${document.name}`);
            const response = await axios.post(`${this.ragflowUrl}/api/vectorize`, {
                doc_id: document.id,
                text: content,
                metadata: {
                    doc_id: document.id,
                    kb_id: knowledgeBase.id,
                    permission_level: knowledgeBase.permission_level,
                    department_id: knowledgeBase.department_id,
                    project_id: knowledgeBase.project_id,
                    owner_id: document.owner_id,
                    permission_chain: this.getPermissionChain(knowledgeBase)
                }
            });

            // 更新状态
            await db('knowledge_documents')
                .where('id', document.id)
                .update({ 
                    vector_status: 'completed',
                    ragflow_doc_id: response.data?.doc_id
                });
        } catch (error) {
            console.error('RAGFlow vectorization failed:', error);
            await db('knowledge_documents')
                .where('id', document.id)
                .update({ vector_status: 'failed' });
        }
    }

    /**
     * 提取知识图谱并标记权限
     */
    async extractGraphWithPermission(document, knowledgeBase, content) {
        try {
            const graphData = await axios.post(`${this.graphragUrl}/extract`, {
                text: content,
                doc_id: document.id,
                workspace_id: knowledgeBase.graphrag_workspace_id,
                metadata: {
                    permission_level: knowledgeBase.permission_level,
                    visibility_scope: this.getVisibilityScope(knowledgeBase)
                }
            });

            // 为提取的实体和关系添加权限标记
            const { nodes, edges } = graphData.data.graph;
            
            // 存储带权限的节点
            for (const node of nodes) {
                await db('knowledge_graph_nodes').insert({
                    id: node.id,
                    label: node.label,
                    type: node.type,
                    document_id: document.id,
                    kb_id: knowledgeBase.id,
                    permission_level: knowledgeBase.permission_level,
                    metadata: JSON.stringify({
                        ...node.properties,
                        access_control: this.getAccessControl(knowledgeBase)
                    })
                });
            }

            // 存储带权限的边
            for (const edge of edges) {
                await db('knowledge_graph_edges').insert({
                    source: edge.source,
                    target: edge.target,
                    relation: edge.label,
                    document_id: document.id,
                    kb_id: knowledgeBase.id,
                    permission_level: knowledgeBase.permission_level
                });
            }

            await db('knowledge_documents')
                .where('id', document.id)
                .update({ graph_status: 'completed' });
        } catch (error) {
            console.error('Graph extraction failed:', error);
            await db('knowledge_documents')
                .where('id', document.id)
                .update({ graph_status: 'failed' });
        }
    }

    /**
     * 权限感知的向量搜索
     * 只返回用户有权限访问的结果
     */
    async searchWithPermission(query, user, options = {}) {
        // 1. 获取用户可访问的知识库列表
        const accessibleKnowledgeBases = await this.getAccessibleKnowledgeBases(user);
        
        if (accessibleKnowledgeBases.length === 0) {
            return { results: [], total: 0 };
        }

        // 2. 构建权限过滤器
        const permissionFilter = this.buildPermissionFilter(user, accessibleKnowledgeBases);
        
        // 3. 调用真正的向量服务进行语义搜索
        // 使用实际的向量服务端口8085
        const vectorServiceUrl = 'http://localhost:8085';
        let vectorResults;
        
        try {
            vectorResults = await axios.post(`${vectorServiceUrl}/api/search`, {
                query,
                kb_id: options.kb_id || accessibleKnowledgeBases[0]?.id,
                limit: options.limit || 10
            });
        } catch (error) {
            console.error('Vector search failed:', error.message);
            // 如果向量搜索失败，尝试使用数据库全文搜索
            const dbResults = await db('knowledge_documents')
                .whereIn('kb_id', accessibleKnowledgeBases.map(kb => kb.id))
                .andWhere(function() {
                    this.where('name', 'ilike', `%${query}%`)
                        .orWhere('description', 'ilike', `%${query}%`)
                        .orWhere('content_text', 'ilike', `%${query}%`);
                })
                .limit(options.limit || 10);
            
            return {
                results: dbResults.map(doc => ({
                    id: doc.id,
                    name: doc.name,
                    description: doc.description,
                    score: 0.5,
                    metadata: {
                        doc_id: doc.id,
                        kb_id: doc.kb_id,
                        permission_level: doc.visibility
                    }
                })),
                total: dbResults.length,
                query,
                searched_bases: accessibleKnowledgeBases.length,
                search_type: 'database_fallback'
            };
        }

        // 4. 后处理 - 再次验证权限
        const filteredResults = [];
        // 真正的向量服务返回格式：data.data.items
        const results = vectorResults.data?.data?.items || vectorResults.data?.items || vectorResults.data?.results || [];
        for (const result of results) {
            const hasAccess = await this.verifyDocumentAccess(
                result.metadata?.doc_id || result.id, 
                user
            );
            if (hasAccess) {
                filteredResults.push({
                    ...result,
                    permission_level: result.metadata?.permission_level || result.visibility,
                    accessible_by: this.getAccessibleBy(result.metadata || {})
                });
            }
        }

        return {
            results: filteredResults,
            total: filteredResults.length,
            query,
            searched_bases: accessibleKnowledgeBases.length
        };
    }

    /**
     * 权限感知的图谱查询
     */
    async queryGraphWithPermission(query, user, options = {}) {
        // 1. 获取用户可访问的图谱工作空间
        const accessibleWorkspaces = await this.getAccessibleGraphWorkspaces(user);
        
        // 2. 并行查询多个工作空间
        const graphQueries = accessibleWorkspaces.map(workspace => 
            axios.post(`${this.graphragUrl}/query`, {
                query,
                workspace_id: workspace.graphrag_workspace_id,
                filter: {
                    permission_level: this.getUserPermissionLevels(user),
                    department_id: user.department_id,
                    project_ids: user.project_ids
                }
            }).catch(err => ({ data: { graph: { nodes: [], edges: [] } } }))
        );

        const results = await Promise.all(graphQueries);
        
        // 3. 合并结果并去重
        const mergedNodes = new Map();
        const mergedEdges = new Map();
        
        for (const result of results) {
            if (result.data?.graph) {
                // 合并节点
                for (const node of result.data.graph.nodes) {
                    if (!mergedNodes.has(node.id)) {
                        mergedNodes.set(node.id, node);
                    }
                }
                // 合并边
                for (const edge of result.data.graph.edges) {
                    const edgeKey = `${edge.source}-${edge.target}-${edge.label}`;
                    if (!mergedEdges.has(edgeKey)) {
                        mergedEdges.set(edgeKey, edge);
                    }
                }
            }
        }

        return {
            graph: {
                nodes: Array.from(mergedNodes.values()),
                edges: Array.from(mergedEdges.values())
            },
            workspaces_searched: accessibleWorkspaces.length
        };
    }

    /**
     * 获取用户可访问的知识库
     */
    async getAccessibleKnowledgeBases(user) {
        const query = db('knowledge_bases').where(function() {
            // 公司级 - 所有人可访问
            this.where('permission_level', 'company')
                // 部门级 - 同部门可访问
                .orWhere(function() {
                    this.where('permission_level', 'department')
                        .where('department_id', user.department_id);
                })
                // 项目级 - 项目成员可访问
                .orWhere(function() {
                    this.where('permission_level', 'project')
                        .whereIn('project_id', user.project_ids || []);
                })
                // 个人级 - 仅本人
                .orWhere(function() {
                    this.where('permission_level', 'personal')
                        .where('owner_id', user.id);
                });
        });

        // 管理员可以访问所有
        if (user.is_admin) {
            return await db('knowledge_bases').select('*');
        }

        return await query.select('*');
    }

    /**
     * 生成知识库的数据集名称
     */
    generateDatasetName(kb) {
        const prefix = {
            'company': 'company',
            'department': `dept_${kb.department_id}`,
            'project': `proj_${kb.project_id}`,
            'project_dept': `proj_${kb.project_id}_dept_${kb.department_id}`,
            'personal': `user_${kb.owner_id}`
        };
        
        return `${prefix[kb.permission_level]}_${kb.name}_${kb.id}`;
    }

    /**
     * 获取权限链
     */
    getPermissionChain(kb) {
        const chain = [];
        
        // 个人级总是可访问
        if (kb.owner_id) {
            chain.push(`user:${kb.owner_id}`);
        }
        
        // 根据权限级别构建继承链
        switch (kb.permission_level) {
            case 'company':
                chain.push('company:all');
                break;
            case 'department':
                chain.push(`department:${kb.department_id}`);
                chain.push('company:all'); // 向上继承
                break;
            case 'project':
                chain.push(`project:${kb.project_id}`);
                if (kb.department_id) {
                    chain.push(`department:${kb.department_id}`);
                }
                chain.push('company:all');
                break;
            case 'project_dept':
                chain.push(`project_dept:${kb.project_id}_${kb.department_id}`);
                chain.push(`project:${kb.project_id}`);
                chain.push(`department:${kb.department_id}`);
                chain.push('company:all');
                break;
            case 'personal':
                // 仅个人，不继承
                break;
        }
        
        return chain;
    }

    /**
     * 构建权限过滤器
     */
    buildPermissionFilter(user, knowledgeBases) {
        const kbIds = knowledgeBases.map(kb => kb.id);
        
        return {
            $or: [
                // 用户自己的文档
                { 'metadata.owner_id': user.id },
                // 用户有权限的知识库
                { 'metadata.kb_id': { $in: kbIds } },
                // 公司级文档
                { 'metadata.permission_level': 'company' },
                // 部门级文档（同部门）
                {
                    $and: [
                        { 'metadata.permission_level': 'department' },
                        { 'metadata.department_id': user.department_id }
                    ]
                },
                // 项目级文档（项目成员）
                {
                    $and: [
                        { 'metadata.permission_level': 'project' },
                        { 'metadata.project_id': { $in: user.project_ids || [] } }
                    ]
                }
            ]
        };
    }

    /**
     * 验证文档访问权限
     */
    async verifyDocumentAccess(documentId, user) {
        // 验证参数
        if (!documentId || !user) {
            console.warn('verifyDocumentAccess: missing documentId or user', { documentId, userId: user?.id });
            return false;
        }
        
        const document = await db('knowledge_documents')
            .where({ id: documentId })
            .first();
        
        if (!document) return false;
        
        // 文档所有者
        if (document.owner_id === user.id) return true;
        
        // 管理员
        if (user.is_admin) return true;
        
        // 根据可见性级别检查
        switch (document.visibility) {
            case 'company':
                return true;
            case 'department':
                return document.department_id === user.department_id;
            case 'project':
                return user.project_ids?.includes(document.project_id);
            case 'project_dept':
                return user.project_ids?.includes(document.project_id) &&
                       document.department_id === user.department_id;
            case 'personal':
                return document.owner_id === user.id;
            default:
                return false;
        }
    }


    /**
     * 获取谁可以访问
     */
    getAccessibleBy(metadata) {
        return metadata.permission_chain || [];
    }

    /**
     * 获取用户权限级别
     */
    getUserPermissionLevels(user) {
        const levels = [];
        if (user.is_admin) levels.push('company', 'department', 'project', 'personal');
        else levels.push('personal');
        return levels;
    }

    /**
     * 获取可访问的GraphRAG工作空间
     */
    async getAccessibleGraphWorkspaces(user) {
        return this.getAccessibleKnowledgeBases(user);
    }

    /**
     * 获取权限范围
     */
    getPermissionScope(kb) {
        return {
            level: kb.permission_level,
            department_id: kb.department_id,
            project_id: kb.project_id
        };
    }

    /**
     * 获取可见性范围
     */
    getVisibilityScope(kb) {
        return this.getPermissionScope(kb);
    }

    /**
     * 获取访问控制
     */
    getAccessControl(kb) {
        return {
            level: kb.permission_level,
            owner_id: kb.owner_id,
            department_id: kb.department_id,
            project_id: kb.project_id
        };
    }

    /**
     * 检查上传权限
     */
    async checkUploadPermission(user, knowledgeBase) {
        // 知识库所有者
        if (knowledgeBase.owner_id === user.id) return true;
        
        // 管理员
        if (user.is_admin) return true;
        
        // 根据知识库权限级别检查
        switch (knowledgeBase.permission_level) {
            case 'department':
                // 同部门成员可上传
                return user.department_id === knowledgeBase.department_id;
            case 'project':
                // 项目成员可上传
                return user.project_ids?.includes(knowledgeBase.project_id);
            case 'personal':
                // 仅所有者可上传
                return knowledgeBase.owner_id === user.id;
            default:
                return false;
        }
    }
}

module.exports = PermissionAwareKnowledgeService;