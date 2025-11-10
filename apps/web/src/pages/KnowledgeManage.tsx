import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Upload, message, Tag, Tooltip, Badge, Modal } from 'antd'
import { UploadOutlined, ReloadOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import axios from 'axios'

const { confirm } = Modal

interface Document {
  id: string
  name: string
  file_type: string
  file_size: number
  vector_status: string
  graph_status: string
  vectorization_status: string
  vectorization_error?: string
  graph_extraction_status: string
  graph_extraction_error?: string
  created_at: string
  updated_at: string
}

const StatusBadge: React.FC<{ status: string; error?: string }> = ({ status, error }) => {
  const config: Record<string, { color: any; text: string }> = {
    pending: { color: 'default', text: '待处理' },
    processing: { color: 'processing', text: '处理中' },
    completed: { color: 'success', text: '已完成' },
    failed: { color: 'error', text: '失败' }
  }

  const { color, text } = config[status] || config.pending

  return (
    <Tooltip title={error || ''}>
      <Badge status={color} text={text} />
    </Tooltip>
  )
}

const KnowledgeManage: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [revectorizing, setRevectorizing] = useState<Record<string, boolean>>({})
  const [reextracting, setReextracting] = useState<Record<string, boolean>>({})

  const API_BASE = import.meta.env.VITE_API_URL || '/api'
  const token = localStorage.getItem('token')

  const loadDocuments = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${API_BASE}/knowledge/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setDocuments(res.data.data?.list || res.data.data || [])
    } catch (error) {
      message.error('加载文档列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (file: any) => {
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('kb_id', 'kb_default')

    try {
      await axios.post(`${API_BASE}/knowledge/documents/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      })
      message.success('上传成功，正在处理...')
      setTimeout(loadDocuments, 2000)
    } catch (error) {
      message.error('上传失败')
    } finally {
      setUploading(false)
    }
    return false
  }

  const handleRevectorize = async (docId: string) => {
    setRevectorizing(prev => ({ ...prev, [docId]: true }))
    try {
      const response = await axios.post(
        `${API_BASE}/knowledge/documents/${docId}/revectorize`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (response.data.success) {
        message.success('向量化任务已提交，请稍后刷新查看结果')
        setTimeout(() => loadDocuments(), 2000)
      }
    } catch (error) {
      message.error('提交失败')
    } finally {
      setRevectorizing(prev => ({ ...prev, [docId]: false }))
    }
  }

  const handleReextractGraph = async (docId: string) => {
    setReextracting(prev => ({ ...prev, [docId]: true }))
    try {
      const response = await axios.post(
        `${API_BASE}/knowledge/documents/${docId}/reextract-graph`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (response.data.success) {
        message.success('图谱提取任务已提交，请稍后刷新查看结果')
        setTimeout(() => loadDocuments(), 2000)
      }
    } catch (error) {
      message.error('提交失败')
    } finally {
      setReextracting(prev => ({ ...prev, [docId]: false }))
    }
  }

  const handleDelete = (docId: string) => {
    confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除这个文档吗？',
      onOk: async () => {
        try {
          await axios.delete(`${API_BASE}/knowledge/documents/${docId}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          message.success('删除成功')
          loadDocuments()
        } catch (error) {
          message.error('删除失败')
        }
      }
    })
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  const columns: ColumnsType<Document> = [
    {
      title: '文档名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true
    },
    {
      title: '类型',
      dataIndex: 'file_type',
      key: 'file_type',
      width: 120,
      render: (type: string) => {
        const typeMap: Record<string, string> = {
          'application/pdf': 'PDF',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
          'text/plain': 'TXT'
        }
        return typeMap[type] || type
      }
    },
    {
      title: '大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 100,
      render: (size: number) => {
        if (!size) return '-'
        if (size < 1024) return `${size}B`
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`
        return `${(size / 1024 / 1024).toFixed(1)}MB`
      }
    },
    {
      title: '向量化',
      dataIndex: 'vectorization_status',
      key: 'vectorization_status',
      width: 120,
      render: (status: string, record: Document) => (
        <StatusBadge status={status} error={record.vectorization_error} />
      )
    },
    {
      title: '图谱提取',
      dataIndex: 'graph_extraction_status',
      key: 'graph_extraction_status',
      width: 120,
      render: (status: string, record: Document) => (
        <StatusBadge status={status} error={record.graph_extraction_error} />
      )
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right',
      render: (_: any, record: Document) => (
        <Space size="small">
          {(record.vectorization_status === 'pending' || record.vectorization_status === 'failed') && (
            <Button
              size="small"
              type={record.vectorization_status === 'pending' ? 'primary' : 'default'}
              onClick={() => handleRevectorize(record.id)}
              loading={revectorizing[record.id]}
            >
              {record.vectorization_status === 'failed' ? '重新向量化' : '向量化'}
            </Button>
          )}
          {(record.graph_extraction_status === 'pending' || record.graph_extraction_status === 'failed') && (
            <Button
              size="small"
              type={record.graph_extraction_status === 'pending' ? 'primary' : 'default'}
              onClick={() => handleReextractGraph(record.id)}
              loading={reextracting[record.id]}
            >
              {record.graph_extraction_status === 'failed' ? '重新提取图谱' : '提取图谱'}
            </Button>
          )}
          <Button
            type="link"
            size="small"
            onClick={() => {
              const downloadUrl = `${API_BASE}/knowledge/documents/${record.id}/download`
              window.open(downloadUrl, '_blank')
            }}
          >
            下载
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ]

  return (
    <Card
      title="知识库文档管理"
      extra={
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadDocuments}
            loading={loading}
          >
            刷新
          </Button>
          <Upload
            beforeUpload={handleUpload}
            showUploadList={false}
            accept=".pdf,.docx,.txt"
          >
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={uploading}
            >
              上传文档
            </Button>
          </Upload>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={documents}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`
        }}
      />
    </Card>
  )
}

export default KnowledgeManage
