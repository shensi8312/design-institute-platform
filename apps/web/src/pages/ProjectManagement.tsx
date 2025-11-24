import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Card, Table, Button, Space, message, Tag, Modal, Form, Input, Select } from 'antd'
import { PlusOutlined, FolderOpenOutlined, DeleteOutlined } from '@ant-design/icons'
import axios from '../utils/axios'
import type { ColumnsType } from 'antd/es/table'

interface Project {
  id: string
  code: string
  name: string
  type: string
  status: string
  created_by: string
  created_at: string
  updated_at: string
}

const ProjectManagement: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [form] = Form.useForm()

  const isMyProjects = location.pathname === '/projects/my'

  useEffect(() => {
    loadProjects()
  }, [location.pathname])

  const loadProjects = async () => {
    setLoading(true)
    try {
      const endpoint = isMyProjects ? '/api/projects/my' : '/api/projects'
      const response = await axios.get(endpoint)
      if (response.data.success) {
        // 🔧 修复：后端返回 data.list，前端之前期望 data.items
        setProjects(response.data.data.list || response.data.data.items || [])
      }
    } catch (error) {
      console.error('加载项目列表失败:', error)
      message.error('加载项目列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (values: any) => {
    try {
      const response = await axios.post('/api/projects', values)
      if (response.data.success) {
        message.success('创建成功')
        setCreateModalVisible(false)
        form.resetFields()
        loadProjects()
      }
    } catch (error: any) {
      console.error('创建失败:', error)
      message.error(error.response?.data?.message || '创建项目失败')
    }
  }

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该项目吗？',
      onOk: async () => {
        try {
          const response = await axios.delete(`/api/projects/${id}`)
          if (response.data.success) {
            message.success('删除成功')
            loadProjects()
          }
        } catch (error: any) {
          console.error('删除失败:', error)
          message.error(error.response?.data?.message || '删除项目失败')
        }
      }
    })
  }

  const columns: ColumnsType<Project> = [
    {
      title: '项目编号',
      dataIndex: 'code',
      key: 'code',
      width: 150
    },
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '项目类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type) => {
        const typeMap: Record<string, { label: string; color: string }> = {
          construction: { label: '建筑工程', color: 'blue' },
          municipal: { label: '市政工程', color: 'green' },
          decoration: { label: '装饰装修', color: 'orange' },
          landscape: { label: '园林景观', color: 'cyan' },
          other: { label: '其他', color: 'default' }
        }
        const config = typeMap[type] || typeMap.other
        return <Tag color={config.color}>{config.label}</Tag>
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const statusMap: Record<string, { label: string; color: string }> = {
          planning: { label: '规划中', color: 'default' },
          active: { label: '进行中', color: 'processing' },
          completed: { label: '已完成', color: 'success' },
          archived: { label: '已归档', color: 'default' }
        }
        const config = statusMap[status] || statusMap.planning
        return <Tag color={config.color}>{config.label}</Tag>
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => new Date(text).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<FolderOpenOutlined />}
            onClick={() => navigate(`/projects/${record.id}`)}
          >
            进入项目
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
    <div style={{ padding: 24 }}>
      <Card
        title={isMyProjects ? '我的项目' : '所有项目'}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建项目
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={projects}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个项目`
          }}
        />
      </Card>

      <Modal
        title="创建项目"
        open={createModalVisible}
        onOk={() => form.submit()}
        onCancel={() => {
          setCreateModalVisible(false)
          form.resetFields()
        }}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            label="项目编号"
            name="code"
            rules={[{ required: true, message: '请输入项目编号' }]}
          >
            <Input placeholder="请输入项目编号" />
          </Form.Item>

          <Form.Item
            label="项目名称"
            name="name"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="请输入项目名称" />
          </Form.Item>

          <Form.Item
            label="项目类型"
            name="type"
            rules={[{ required: true, message: '请选择项目类型' }]}
          >
            <Select placeholder="请选择项目类型">
              <Select.Option value="construction">建筑工程</Select.Option>
              <Select.Option value="municipal">市政工程</Select.Option>
              <Select.Option value="decoration">装饰装修</Select.Option>
              <Select.Option value="landscape">园林景观</Select.Option>
              <Select.Option value="other">其他</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="项目描述"
            name="description"
          >
            <Input.TextArea rows={4} placeholder="请输入项目描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ProjectManagement
