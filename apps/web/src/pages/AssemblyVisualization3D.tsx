import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Descriptions, Tag, message, Space } from 'antd'
import { ArrowLeftOutlined, InfoCircleOutlined } from '@ant-design/icons'
import AssemblyViewer3D from '../components/AssemblyViewer3D'
import axios from '../utils/axios'

const AssemblyVisualization3D: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [taskInfo, setTaskInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (taskId) {
      loadTaskInfo()
    }
  }, [taskId])

  const loadTaskInfo = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/assembly/tasks/${taskId}`)
      setTaskInfo(response.data.data)
    } catch (error: any) {
      message.error('加载任务信息失败')
    } finally {
      setLoading(false)
    }
  }

  const getStatusTag = (status: string) => {
    const statusMap: { [key: string]: { color: string; text: string } } = {
      pending: { color: 'default', text: '待处理' },
      processing: { color: 'processing', text: '处理中' },
      completed: { color: 'success', text: '已完成' },
      failed: { color: 'error', text: '失败' }
    }
    const s = statusMap[status] || { color: 'default', text: status }
    return <Tag color={s.color}>{s.text}</Tag>
  }

  return (
    <div style={{ padding: 24, height: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f2f5' }}>
      <Card
        title={
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/assembly/tasks')}
            >
              返回任务列表
            </Button>
            <span style={{ fontSize: 18, fontWeight: 600 }}>装配3D可视化</span>
          </Space>
        }
        extra={
          taskInfo && getStatusTag(taskInfo.status)
        }
        style={{ marginBottom: 16 }}
        loading={loading}
      >
        {taskInfo && (
          <Descriptions size="small" column={3}>
            <Descriptions.Item label="任务名称">
              <strong>{taskInfo.task_name}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="图纸名称">
              {taskInfo.drawing_name || '未指定'}
            </Descriptions.Item>
            <Descriptions.Item label="零件数量">
              <Tag color="blue">{taskInfo.parts_count || 0}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="推理约束数">
              <Tag color="green">{taskInfo.constraints_count || 0}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {taskInfo.created_at ? new Date(taskInfo.created_at).toLocaleString('zh-CN') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建人">
              {taskInfo.created_by || '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>

      <Card
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        bodyStyle={{ flex: 1, padding: 0, overflow: 'hidden' }}
      >
        {taskId ? (
          <AssemblyViewer3D taskId={taskId} />
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#999'
          }}>
            <Space direction="vertical" align="center">
              <InfoCircleOutlined style={{ fontSize: 48 }} />
              <span>无效的任务ID</span>
            </Space>
          </div>
        )}
      </Card>
    </div>
  )
}

export default AssemblyVisualization3D
