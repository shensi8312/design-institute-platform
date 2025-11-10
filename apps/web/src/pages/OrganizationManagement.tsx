import React, { useEffect, useState } from 'react'
import {
  Button,
  Card,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ApartmentOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Organization, OrganizationFormData } from '../types'
import {
  getOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization
} from '../api/organizations'

const { Title, Paragraph } = Typography

interface OrganizationWithStats extends Organization {
  department_count?: number
  user_count?: number
  created_at?: string
}

interface OrganizationDetail extends OrganizationWithStats {
  departments?: Array<{ id: string; name: string; code?: string; status?: string }>
  users?: Array<{ id: string; username: string; name?: string; email?: string; status?: string }>
}

const statusTag = (status?: string) => {
  if (status === 'inactive') {
    return <Tag color="red">已停用</Tag>
  }
  return <Tag color="green">启用</Tag>
}

const OrganizationManagement: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [organizations, setOrganizations] = useState<OrganizationWithStats[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editingOrg, setEditingOrg] = useState<OrganizationWithStats | null>(null)
  const [orgDetail, setOrgDetail] = useState<OrganizationDetail | null>(null)
  const [form] = Form.useForm<OrganizationFormData>()

  const loadOrganizations = async () => {
    try {
      setLoading(true)
      const data = await getOrganizations()
      setOrganizations((data.list ?? []) as OrganizationWithStats[])
    } catch (error) {
      console.error(error)
      message.error('加载组织列表失败')
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditingOrg(null)
    form.resetFields()
    setModalVisible(true)
  }

  const openEditModal = (record: OrganizationWithStats) => {
    setEditingOrg(record)
    form.setFieldsValue({
      name: record.name,
      code: record.code,
      description: record.description ?? '',
      status: record.status ?? 'active'
    })
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      if (editingOrg) {
        await updateOrganization(editingOrg.id, values)
        message.success('组织更新成功')
      } else {
        await createOrganization(values)
        message.success('组织创建成功')
      }
      setModalVisible(false)
      await loadOrganizations()
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDelete = (record: OrganizationWithStats) => {
    const hasDepartments = (record.department_count ?? 0) > 0
    const hasUsers = (record.user_count ?? 0) > 0

    let warningMessage = '确认要删除这个组织吗？此操作不可恢复。'
    if (hasDepartments && hasUsers) {
      warningMessage = `该组织下有 ${record.department_count} 个部门和 ${record.user_count} 个用户，请先删除或转移这些数据。`
    } else if (hasDepartments) {
      warningMessage = `该组织下有 ${record.department_count} 个部门，请先删除这些部门。`
    } else if (hasUsers) {
      warningMessage = `该组织下有 ${record.user_count} 个用户，请先删除或转移这些用户。`
    }

    Modal.confirm({
      title: `确认删除组织「${record.name}」吗？`,
      content: warningMessage,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        try {
          await deleteOrganization(record.id)
          message.success('删除成功')
          await loadOrganizations()
        } catch (error) {
          if (error instanceof Error) {
            message.error(error.message)
          }
          throw error
        }
      }
    })
  }

  const openDetailDrawer = async (record: OrganizationWithStats) => {
    try {
      setDetailLoading(true)
      setDrawerVisible(true)
      const detail = await getOrganization(record.id)
      setOrgDetail(detail as OrganizationDetail)
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
      setDrawerVisible(false)
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    loadOrganizations()
  }, [])

  const columns: ColumnsType<OrganizationWithStats> = [
    {
      title: '组织名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <ApartmentOutlined />
          <Button type="link" onClick={() => openDetailDrawer(record)}>
            {text}
          </Button>
        </Space>
      )
    },
    {
      title: '编码',
      dataIndex: 'code',
      key: 'code'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => statusTag(value)
    },
    {
      title: '部门数',
      dataIndex: 'department_count',
      key: 'department_count',
      width: 100,
      render: (value?: number) => value ?? 0
    },
    {
      title: '人员数',
      dataIndex: 'user_count',
      key: 'user_count',
      width: 100,
      render: (value?: number) => value ?? 0
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 200,
      render: (value?: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-')
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} size="small" onClick={() => openDetailDrawer(record)}>
            查看
          </Button>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEditModal(record)}>
            编辑
          </Button>
          <Button
            icon={<DeleteOutlined />}
            size="small"
            danger
            onClick={() => confirmDelete(record)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ]

  return (
    <Card
      title={
        <Space>
          <Title level={4} style={{ margin: 0 }}>
            组织管理
          </Title>
        </Space>
      }
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadOrganizations}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新建组织
          </Button>
        </Space>
      }
    >
      <Paragraph type="secondary">
        管理组织信息，支持查看统计、编辑基本资料和维护组织结构。
      </Paragraph>

      <Table<OrganizationWithStats>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={organizations}
        pagination={false}
        locale={{ emptyText: <Empty description="暂无组织数据" /> }}
      />

      <Modal
        open={modalVisible}
        title={editingOrg ? '编辑组织' : '新建组织'}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form<OrganizationFormData> form={form} layout="vertical">
          <Form.Item
            label="组织名称"
            name="name"
            rules={[{ required: true, message: '请输入组织名称' }]}
          >
            <Input placeholder="请输入组织名称" maxLength={100} />
          </Form.Item>

          <Form.Item
            label="组织编码"
            name="code"
            rules={[{ required: true, message: '请输入组织编码' }]}
          >
            <Input placeholder="请输入组织编码" maxLength={50} />
          </Form.Item>

          <Form.Item
            label="状态"
            name="status"
            initialValue="active"
          >
            <Select options={[{ value: 'active', label: '启用' }, { value: 'inactive', label: '停用' }]} />
          </Form.Item>

          <Form.Item label="组织描述" name="description">
            <Input.TextArea rows={3} placeholder="可填写组织说明" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        open={drawerVisible}
        width={520}
        title="组织详情"
        onClose={() => setDrawerVisible(false)}
      >
        {detailLoading || !orgDetail ? (
          <Empty description="正在加载数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="名称">{orgDetail.name}</Descriptions.Item>
              <Descriptions.Item label="编码">{orgDetail.code}</Descriptions.Item>
              <Descriptions.Item label="状态">{statusTag(orgDetail.status)}</Descriptions.Item>
              <Descriptions.Item label="描述">{orgDetail.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="部门数">{orgDetail.department_count ?? 0}</Descriptions.Item>
              <Descriptions.Item label="人员数">{orgDetail.user_count ?? 0}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {orgDetail.created_at ? dayjs(orgDetail.created_at).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <Title level={5}>关联部门</Title>
              <Divider style={{ margin: '8px 0' }} />
              {orgDetail.departments && orgDetail.departments.length > 0 ? (
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={orgDetail.departments}
                  columns={[
                    { title: '部门名称', dataIndex: 'name', key: 'name' },
                    { title: '编码', dataIndex: 'code', key: 'code' },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      key: 'status',
                      render: (status: string) => statusTag(status)
                    }
                  ]}
                />
              ) : (
                <Empty description="暂无部门" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>

            <div>
              <Title level={5}>关联人员</Title>
              <Divider style={{ margin: '8px 0' }} />
              {orgDetail.users && orgDetail.users.length > 0 ? (
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={orgDetail.users}
                  columns={[
                    { title: '用户名', dataIndex: 'username', key: 'username' },
                    { title: '姓名', dataIndex: 'name', key: 'name' },
                    { title: '邮箱', dataIndex: 'email', key: 'email' },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      key: 'status',
                      render: (status: string) => statusTag(status)
                    }
                  ]}
                />
              ) : (
                <Empty description="暂无人员" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          </Space>
        )}
      </Drawer>
    </Card>
  )
}

export default OrganizationManagement
