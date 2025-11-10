import React, { useState } from 'react'
import { Layout, Card, List, Button, Upload, message, Tag } from 'antd'
import { UploadOutlined, FileTextOutlined } from '@ant-design/icons'
import axios from 'axios'
import GraphVisualization from './GraphVisualization'

const { Sider, Content } = Layout

interface Document {
  id: string
  name: string
  file_type: string
  status: string
  graph_status: string
  vectorization_status: string
  graph_extraction_status: string
  vectorization_error?: string
  graph_extraction_error?: string
  created_at: string
}

const GraphAnnotation: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const API_BASE = '/api'
  const token = localStorage.getItem('token')

  // 加载文档列表
  const loadDocuments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/knowledge/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setDocuments(res.data.data.list || [])
    } catch (error) {
      message.error('加载文档列表失败')
    }
  }

  // 上传文档
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

  React.useEffect(() => {
    loadDocuments()
  }, [])

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider width={300} theme="light" style={{ padding: 16, borderRight: '1px solid #f0f0f0' }}>
        <Card
          title="文档列表"
          extra={
            <Upload
              beforeUpload={handleUpload}
              showUploadList={false}
              accept=".pdf,.docx,.txt"
            >
              <Button
                type="primary"
                icon={<UploadOutlined />}
                loading={uploading}
                size="small"
              >
                上传
              </Button>
            </Upload>
          }
          bodyStyle={{ padding: 0 }}
        >
          <List
            dataSource={documents}
            renderItem={(doc) => (
              <List.Item
                style={{
                  cursor: 'pointer',
                  backgroundColor: selectedDocId === doc.id ? '#e6f7ff' : 'transparent',
                  padding: '12px 16px'
                }}
                onClick={() => setSelectedDocId(doc.id)}
              >
                <List.Item.Meta
                  avatar={<FileTextOutlined />}
                  title={doc.name}
                  description={
                    <div>
                      <div>状态: {doc.status}</div>
                      <div>
                        向量化:
                        <Tag
                          color={
                            doc.vectorization_status === 'completed' ? 'green' :
                            doc.vectorization_status === 'failed' ? 'red' :
                            doc.vectorization_status === 'processing' ? 'blue' : 'default'
                          }
                          style={{ marginLeft: 4 }}
                        >
                          {doc.vectorization_status || 'pending'}
                        </Tag>
                      </div>
                      <div>
                        图谱:
                        <Tag
                          color={
                            doc.graph_extraction_status === 'completed' ? 'green' :
                            doc.graph_extraction_status === 'failed' ? 'red' :
                            doc.graph_extraction_status === 'processing' ? 'blue' : 'default'
                          }
                          style={{ marginLeft: 4 }}
                        >
                          {doc.graph_extraction_status || 'pending'}
                        </Tag>
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      </Sider>

      <Content style={{ padding: 16 }}>
        {selectedDocId ? (
          <GraphVisualization documentId={selectedDocId} />
        ) : (
          <Card>
            <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
              请从左侧选择一个文档查看其知识图谱
            </div>
          </Card>
        )}
      </Content>
    </Layout>
  )
}

export default GraphAnnotation
