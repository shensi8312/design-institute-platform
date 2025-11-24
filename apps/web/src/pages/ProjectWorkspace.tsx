import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Space, message, Spin, Breadcrumb, Modal } from 'antd'
import { HomeOutlined, FolderOutlined, UploadOutlined, FileTextOutlined } from '@ant-design/icons'
import axios from '../utils/axios'
import DocumentTabs from '../components/project/DocumentTabs'
import DocumentList from '../components/project/DocumentList'
import UploadDocumentModal from '../components/project/UploadDocumentModal'
import ContractEditor from '../components/contract/ContractEditor'
import TiptapDocumentViewer from '../components/TiptapDocumentViewer'
import type { DocumentType, Document } from '../types/document'

/**
 * V3.0 项目工作台
 *
 * 功能:
 * - 项目文档管理 (合同、投标书等)
 * - 文档类型Tab切换
 * - 文档上传
 * - AI审查入口
 */

interface Project {
  id: string
  name: string
  code: string
  status: string
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
  const [previewVisible, setPreviewVisible] = useState(false)
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null)
  const [documentContent, setDocumentContent] = useState<string>('')
  const [contentLoading, setContentLoading] = useState(false)

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

  const handleView = async (document: Document) => {
    // 🔧 使用 Tiptap 查看器预览所有文档
    const fileExt = document.file_name.split('.').pop()?.toLowerCase()

    if (fileExt === 'pdf') {
      // PDF直接在新窗口打开（浏览器原生支持）
      const fileUrl = `${import.meta.env.VITE_API_BASE_URL}/${document.file_path}`
      window.open(fileUrl, '_blank')
      return
    }

    // Word/其他文档：调用后端解析为HTML，用Tiptap展示
    try {
      setCurrentDocument(document)
      setPreviewVisible(true)
      setContentLoading(true)
      setDocumentContent('')

      const response = await axios.get(
        `/api/projects/${projectId}/documents/${document.id}/clauses`
      )

      if (response.data.success && response.data.data) {
        // 将条款数组转换为HTML格式
        const clauses = response.data.data
        const html = clauses.map((clause: any) =>
          `<h${clause.level}>${clause.numbering} ${clause.title}</h${clause.level}>
           <p>${clause.text_current.replace(/\n/g, '<br/>')}</p>`
        ).join('')

        setDocumentContent(html)
      } else {
        message.error('文档解析失败')
        setPreviewVisible(false)
      }
    } catch (error: any) {
      console.error('加载文档失败:', error)
      message.error(error.response?.data?.message || '加载文档失败')
      setPreviewVisible(false)
    } finally {
      setContentLoading(false)
    }
  }

  const handleDownload = (document: Document) => {
    // 下载文档
    // 🔧 使用 file_path 获取文件，file_name 作为下载文件名
    const fileUrl = `${import.meta.env.VITE_API_BASE_URL}/${document.file_path}`
    const link = window.document.createElement('a')
    link.href = fileUrl
    link.download = document.file_name
    window.document.body.appendChild(link)
    link.click()
    window.document.body.removeChild(link)
    message.success('开始下载')
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
          onView={handleView}
          onDownload={handleDownload}
          onDelete={handleDelete}
          onRefresh={loadDocuments}
        />
      </Card>

      {/* 文档预览对话框 (Tiptap) */}
      <Modal
        title={currentDocument?.title || '文档预览'}
        open={previewVisible}
        onCancel={() => {
          setPreviewVisible(false)
          setCurrentDocument(null)
          setDocumentContent('')
        }}
        width="90%"
        style={{ top: 20 }}
        footer={null}
        destroyOnClose
      >
        <div style={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}>
          <TiptapDocumentViewer
            content={documentContent}
            loading={contentLoading}
            error={null}
          />
        </div>
      </Modal>

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
