import React, { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, message, Modal, Descriptions } from 'antd'
import { EyeOutlined, DownloadOutlined, FileTextOutlined, FilePdfOutlined, ThunderboltOutlined, AppstoreOutlined } from '@ant-design/icons'
import axios from '../utils/axios'
import { useNavigate } from 'react-router-dom'

interface AssemblyTask {
  id: number
  user_id: string
  bom_file_path: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  parts_count: number
  constraints_count: number
  solver_result: any
  created_at: string
  updated_at: string
}

const AssemblyTaskList: React.FC = () => {
  const [tasks, setTasks] = useState<AssemblyTask[]>([])
  const [loading, setLoading] = useState(false)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [currentTask, setCurrentTask] = useState<AssemblyTask | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadTasks()
  }, [])

  const loadTasks = async () => {
    setLoading(true)
    try {
      const response = await axios.get('/api/assembly/tasks')
      if (response.data.success) {
        setTasks(response.data.data)
      }
    } catch (error) {
      message.error('加载任务列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetail = (task: AssemblyTask) => {
    setCurrentTask(task)
    setDetailModalVisible(true)
  }

  const handleGeneratePDF = async (taskId: number) => {
    try {
      message.loading({ content: '正在生成装配指导书...', key: 'pdf' })

      const response = await axios.post(`/api/assembly/tasks/${taskId}/generate-guide`, {}, {
        responseType: 'blob'
      })

      // 下载PDF
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `装配指导书_${taskId}_${Date.now()}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)

      message.success({ content: '✅ 装配指导书生成成功！', key: 'pdf' })
    } catch (error) {
      message.error({ content: '生成装配指导书失败', key: 'pdf' })
    }
  }

  const handleDownloadJSON = async (taskId: number) => {
    try {
      const response = await axios.get(`/api/assembly/tasks/${taskId}/constraints`)

      if (response.data.success) {
        const blob = new Blob([JSON.stringify(response.data.data, null, 2)], {
          type: 'application/json'
        })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `assembly_constraints_${taskId}.json`
        a.click()
        window.URL.revokeObjectURL(url)

        message.success('约束数据已下载')
      }
    } catch (error) {
      message.error('下载失败')
    }
  }

  const handleGenerateDesign = async (taskId: number) => {
    try {
      message.loading({ content: '正在生成装配设计...', key: 'design' })
      const response = await axios.post('/api/assembly/designs/generate', { taskId })

      if (response.data.success) {
        message.success({
          content: `✅ 设计已生成！共 ${response.data.stepsCount} 个步骤`,
          key: 'design',
          duration: 3
        })
        navigate('/mechanical-design/assembly-designs')
      }
    } catch (error: any) {
      message.error({ content: error.response?.data?.message || '生成设计失败', key: 'design' })
    }
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80
    },
    {
      title: 'BOM文件',
      dataIndex: 'bom_file_path',
      width: 200,
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => {
        const statusConfig = {
          pending: { color: 'default', text: '待处理' },
          processing: { color: 'blue', text: '处理中' },
          completed: { color: 'green', text: '已完成' },
          failed: { color: 'red', text: '失败' }
        }
        const config = statusConfig[status as keyof typeof statusConfig]
        return <Tag color={config.color}>{config.text}</Tag>
      }
    },
    {
      title: '零件数',
      dataIndex: 'parts_count',
      width: 100,
      render: (count: number) => <Tag color="blue">{count}</Tag>
    },
    {
      title: '约束数',
      dataIndex: 'constraints_count',
      width: 100,
      render: (count: number) => <Tag color="green">{count}</Tag>
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      render: (time: string) => new Date(time).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      width: 360,
      fixed: 'right' as const,
      render: (record: AssemblyTask) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {record.status === 'completed' && (
            <>
              <Button
                type="primary"
                size="small"
                icon={<AppstoreOutlined />}
                onClick={() => navigate(`/mechanical-design/assembly-visualization/${record.id}`)}
              >
                查看3D
              </Button>
              <Button
                type="default"
                size="small"
                icon={<ThunderboltOutlined />}
                onClick={() => handleGenerateDesign(record.id)}
              >
                生成设计
              </Button>
              <Button
                type="link"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => handleDownloadJSON(record.id)}
              >
                下载数据
              </Button>
            </>
          )}
        </Space>
      )
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="装配任务管理"
        extra={
          <Button
            type="primary"
            icon={<FileTextOutlined />}
            onClick={() => navigate('/mechanical-design/assembly-constraint')}
          >
            新建推理任务
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条任务`
          }}
        />
      </Card>

      {/* 详情Modal */}
      <Modal
        title="任务详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {currentTask && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="任务ID">{currentTask.id}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={currentTask.status === 'completed' ? 'green' : 'blue'}>
                {currentTask.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="BOM文件">{currentTask.bom_file_path}</Descriptions.Item>
            <Descriptions.Item label="零件数量">{currentTask.parts_count}</Descriptions.Item>
            <Descriptions.Item label="识别约束">{currentTask.constraints_count}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {new Date(currentTask.created_at).toLocaleString('zh-CN')}
            </Descriptions.Item>
            <Descriptions.Item label="求解器结果" span={2}>
              {currentTask.solver_result ? (
                currentTask.solver_result.feasible ? (
                  <Tag color="green">✅ 约束验证通过</Tag>
                ) : (
                  <Tag color="red">❌ 检测到冲突</Tag>
                )
              ) : (
                <Tag color="orange">未验证</Tag>
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}

export default AssemblyTaskList
