import React from 'react'
import { Table, Button, Space, Tag, Popconfirm, Empty } from 'antd'
import {
  EyeOutlined,
  DownloadOutlined,
  DeleteOutlined,
  RobotOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

interface Document {
  id: string
  title: string
  document_type: string
  document_subtype?: string
  status: string
  file_name: string
  file_size: number
  created_at: string
  updated_at: string
}

interface DocumentListProps {
  documents: Document[]
  loading: boolean
  onAIReview: (document: Document) => void
  onDelete: (documentId: string) => void
  onRefresh: () => void
}

const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  loading,
  onAIReview,
  onDelete,
  onRefresh
}) => {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      draft: { color: 'default', text: '草稿' },
      reviewing: { color: 'processing', text: 'AI审查中' },
      reviewed: { color: 'success', text: '已审查' },
      approved: { color: 'green', text: '已批准' },
      rejected: { color: 'red', text: '已拒绝' }
    }
    const config = statusConfig[status] || { color: 'default', text: status }
    return <Tag color={config.color}>{config.text}</Tag>
  }

  const getSubtypeTag = (subtype?: string) => {
    if (!subtype) return null
    const subtypeConfig: Record<string, string> = {
      tech: '技术标',
      commercial: '商务标',
      draft: '初稿',
      final: '终稿',
      amendment: '补充协议'
    }
    return <Tag>{subtypeConfig[subtype] || subtype}</Tag>
  }

  const columns: ColumnsType<Document> = [
    {
      title: '文档标题',
      dataIndex: 'title',
      key: 'title',
      width: '25%',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>{text}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{record.file_name}</div>
        </div>
      )
    },
    {
      title: '类型',
      dataIndex: 'document_subtype',
      key: 'document_subtype',
      width: '12%',
      render: (subtype) => getSubtypeTag(subtype)
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: '12%',
      render: (status) => getStatusTag(status)
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: '10%',
      render: (size) => formatFileSize(size)
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: '15%',
      render: (date) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'actions',
      width: '26%',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            icon={<RobotOutlined />}
            size="small"
            onClick={() => onAIReview(record)}
          >
            AI审查
          </Button>
          <Button
            icon={<EyeOutlined />}
            size="small"
          >
            查看
          </Button>
          <Button
            icon={<DownloadOutlined />}
            size="small"
          >
            下载
          </Button>
          <Popconfirm
            title="确定删除此文档吗？"
            onConfirm={() => onDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              size="small"
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  if (documents.length === 0 && !loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Empty
          description="暂无文档"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={onRefresh}
          >
            刷新列表
          </Button>
        </Empty>
      </div>
    )
  }

  return (
    <Table
      columns={columns}
      dataSource={documents}
      loading={loading}
      rowKey="id"
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        showTotal: (total) => `共 ${total} 个文档`
      }}
    />
  )
}

export default DocumentList
