import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Space, message, Spin, Breadcrumb } from 'antd'
import { HomeOutlined, FolderOutlined, UploadOutlined, FileTextOutlined } from '@ant-design/icons'
import axios from '../utils/axios'
import DocumentTabs from '../components/project/DocumentTabs'
import DocumentList from '../components/project/DocumentList'
import UploadDocumentModal from '../components/project/UploadDocumentModal'
import ContractEditor from '../components/contract/ContractEditor'

/**
 * V3.0 项目工作台
 *
 * 功能:
 * - 项目文档管理 (合同、投标书等)
 * - 文档类型Tab切换
 * - 文档上传
 * - AI审查入口
 */

export type DocumentType = 'contract' | 'bidding_doc' | 'our_bid' | 'competitor_bid' | 'evaluation' | 'other'

interface Project {
  id: string
  name: string
  code: string
  status: string
}

interface Document {
  id: string
  title: string
  document_type: DocumentType
  document_subtype?: string
  status: string
  file_name: string
  file_size: number
  created_at: string
  updated_at: string
}

const ProjectWorkspace: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<Project | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [activeType, setActiveType] = useState<DocumentType>('contract')
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [editorVisible, setEditorVisible] = useState(false)
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null)

  // 加载项目信息
  useEffect(() => {
    if (projectId) {
      loadProject()
    }
  }, [projectId])

  // 加载文档列表
  useEffect(() => {
    if (projectId) {
      loadDocuments()
    }
  }, [projectId, activeType])

  const loadProject = async () => {
    try {
      const response = await axios.get(`/api/projects/${projectId}`)
      if (response.data.success) {
        setProject(response.data.data)
      }
    } catch (error) {
      console.error('加载项目失败:', error)
      message.error('加载项目信息失败')
    } finally {
      setLoading(false)
    }
  }

  const loadDocuments = async () => {
    try {
      const response = await axios.get(`/api/projects/${projectId}/documents`, {
        params: { type: activeType }
      })
      if (response.data.success) {
        setDocuments(response.data.data.items || [])
      }
    } catch (error) {
      console.error('加载文档列表失败:', error)
      message.error('加载文档列表失败')
    }
  }

  const handleUploadSuccess = () => {
    setUploadModalVisible(false)
    loadDocuments()
    message.success('文档上传成功')
  }

  const handleAIReview = (document: Document) => {
    setCurrentDocument(document)
    setEditorVisible(true)
  }

  const handleDelete = async (documentId: string) => {
    try {
      const response = await axios.delete(`/api/projects/${projectId}/documents/${documentId}`)
      if (response.data.success) {
        message.success('删除成功')
        loadDocuments()
      }
    } catch (error) {
      console.error('删除失败:', error)
      message.error('删除文档失败')
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  if (!project) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <p>项目不存在</p>
        <Button onClick={() => navigate('/projects')}>返回项目列表</Button>
      </div>
    )
  }

  // 如果打开了编辑器，显示编辑器全屏
  if (editorVisible && currentDocument) {
    return (
      <ContractEditor
        document={currentDocument}
        projectId={projectId!}
        onClose={() => {
          setEditorVisible(false)
          setCurrentDocument(null)
        }}
      />
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 面包屑导航 */}
      <Breadcrumb style={{ marginBottom: 16 }}>
        <Breadcrumb.Item>
          <HomeOutlined />
          <span style={{ marginLeft: 8 }}>首页</span>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <FolderOutlined />
          <span style={{ marginLeft: 8 }}>项目中心</span>
        </Breadcrumb.Item>
        <Breadcrumb.Item>{project.name}</Breadcrumb.Item>
      </Breadcrumb>

      {/* 项目信息卡片 */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, marginBottom: 8 }}>
              <FileTextOutlined style={{ marginRight: 8 }} />
              {project.name}
            </h2>
            <Space size="large">
              <span>项目编号: {project.code}</span>
              <span>状态: {project.status}</span>
            </Space>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setUploadModalVisible(true)}
            >
              上传文档
            </Button>
          </Space>
        </div>
      </Card>

      {/* 文档类型Tab */}
      <Card>
        <DocumentTabs
          activeType={activeType}
          onChange={setActiveType}
          counts={{
            contract: documents.filter(d => d.document_type === 'contract').length,
            bidding_doc: documents.filter(d => d.document_type === 'bidding_doc').length,
            our_bid: documents.filter(d => d.document_type === 'our_bid').length,
            competitor_bid: documents.filter(d => d.document_type === 'competitor_bid').length,
            evaluation: documents.filter(d => d.document_type === 'evaluation').length,
            other: documents.filter(d => d.document_type === 'other').length,
          }}
        />

        {/* 文档列表 */}
        <DocumentList
          documents={documents}
          loading={false}
          onAIReview={handleAIReview}
          onDelete={handleDelete}
          onRefresh={loadDocuments}
        />
      </Card>

      {/* 上传对话框 */}
      <UploadDocumentModal
        visible={uploadModalVisible}
        projectId={projectId!}
        documentType={activeType}
        onCancel={() => setUploadModalVisible(false)}
        onSuccess={handleUploadSuccess}
      />
    </div>
  )
}

export default ProjectWorkspace
