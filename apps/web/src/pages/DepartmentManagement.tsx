import React, { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  TreeSelect,
  Typography
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { TreeSelectProps } from 'antd'
import {
  ApartmentOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Organization } from '../types'
import type { Department, CreateDepartmentDTO, UpdateDepartmentDTO } from '../api/departments'
import departmentAPI from '../api/departments'
import { getOrganizations } from '../api/organizations'

const { Title, Paragraph } = Typography

interface DepartmentDetail extends Department {
  organization_name?: string
}

const statusTag = (status?: string) => {
  if (status === 'inactive') {
    return <Tag color="red">停用</Tag>
  }
  return <Tag color="green">启用</Tag>
}

const DepartmentManagement: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>(undefined)
  const [departments, setDepartments] = useState<Department[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [deptDetail, setDeptDetail] = useState<DepartmentDetail | null>(null)
  const [form] = Form.useForm<CreateDepartmentDTO>()

  const loadOrganizations = async () => {
    try {
      const data = await getOrganizations()
      const list = data.list ?? []
      setOrgs(list)
      if (!selectedOrgId && list.length > 0) {
        setSelectedOrgId(list[0].id)
      }
    } catch (error) {
      console.error(error)
      message.error('加载组织列表失败')
    }
  }

  const loadDepartments = async (organizationId?: string) => {
    try {
      setLoading(true)
      const tree = await departmentAPI.getTree(organizationId)
      setDepartments(tree || [])
    } catch (error) {
      console.error(error)
      message.error('加载部门列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrganizations()
  }, [])

  useEffect(() => {
    loadDepartments(selectedOrgId)
  }, [selectedOrgId])

  const openCreateModal = () => {
    setEditingDept(null)
    form.resetFields()
    form.setFieldsValue({
      organization_id: selectedOrgId,
      status: 'active',
      sort_order: 0
    })
    setModalVisible(true)
  }

  const openEditModal = (record: Department) => {
    setEditingDept(record)
    form.setFieldsValue({
      organization_id: record.organization_id,
      parent_id: record.parent_id || undefined,
      name: record.name,
      code: record.code,
      description: record.description || '',
      sort_order: record.sort_order ?? 0,
      status: record.status || 'active'
    })
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload: CreateDepartmentDTO | UpdateDepartmentDTO = {
        ...values,
        organization_id: values.organization_id || selectedOrgId || '',
        status: (values.status as 'active' | 'inactive') || 'active'
      }

      if (!payload.organization_id) {
        message.error('请选择所属组织')
        return
      }

      if (editingDept) {
        await departmentAPI.update(editingDept.id, payload)
        message.success('部门更新成功')
      } else {
        await departmentAPI.create(payload as CreateDepartmentDTO)
        message.success('部门创建成功')
      }
      setModalVisible(false)
      await loadDepartments(selectedOrgId)
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDelete = (record: Department) => {
    Modal.confirm({
      title: `确认删除部门「${record.name}」吗？`,
      content: '删除前请确保该部门没有子部门或成员。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await departmentAPI.delete(record.id)
          message.success('删除成功')
          await loadDepartments(selectedOrgId)
        } catch (error) {
          if (error instanceof Error) {
            message.error(error.message)
          }
        }
      }
    })
  }

  const openDetailDrawer = async (record: Department) => {
    try {
      setDetailLoading(true)
      setDrawerVisible(true)
      const detail = await departmentAPI.getById(record.id)
      setDeptDetail(detail as DepartmentDetail)
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
      setDrawerVisible(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const treeData = useMemo<TreeSelectProps['treeData']>(() => {
    const buildNodes = (nodes: Department[], excludeId?: string): TreeSelectProps['treeData'] =>
      nodes
        .filter(node => node.id !== excludeId)
        .map(node => ({
          title: node.name,
          value: node.id,
          children: node.children ? buildNodes(node.children, excludeId) : undefined
        }))

    return buildNodes(departments, editingDept?.id)
  }, [departments, editingDept?.id])

  const columns: ColumnsType<Department> = [
    {
      title: '部门名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record) => (
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
      title: '所属组织',
      dataIndex: 'organization_name',
      key: 'organization_name'
    },
    {
      title: '成员数',
      dataIndex: 'member_count',
      key: 'member_count',
      width: 100,
      render: (value?: number) => value ?? 0
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value?: string) => statusTag(value)
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
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
          <Title level={4} style={{ margin: 0 }}>部门管理</Title>
        </Space>
      }
      extra={
        <Space>
          <Select
            style={{ width: 200 }}
            placeholder="选择组织"
            value={selectedOrgId}
            allowClear
            onChange={(value) => setSelectedOrgId(value || undefined)}
            options={orgs.map(org => ({ label: org.name, value: org.id }))}
          />
          <Button icon={<ReloadOutlined />} onClick={() => loadDepartments(selectedOrgId)}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新增部门
          </Button>
        </Space>
      }
    >
      <Paragraph type="secondary">
        管理组织下的部门结构，支持树形展示、编辑和删除操作。
      </Paragraph>

      <Table<Department>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={departments}
        pagination={false}
        expandable={{ defaultExpandAllRows: true }}
        locale={{ emptyText: <Empty description="暂无部门数据" /> }}
      />

      <Modal
        open={modalVisible}
        title={editingDept ? '编辑部门' : '新增部门'}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form<CreateDepartmentDTO> form={form} layout="vertical">
          <Form.Item
            label="所属组织"
            name="organization_id"
            rules={[{ required: true, message: '请选择所属组织' }]}
          >
            <Select
              placeholder="选择组织"
              options={orgs.map(org => ({ label: org.name, value: org.id }))}
            />
          </Form.Item>

          <Form.Item label="上级部门" name="parent_id">
            <TreeSelect
              allowClear
              treeDefaultExpandAll
              treeData={treeData}
              placeholder="选择上级部门"
              disabled={departments.length === 0}
              filterTreeNode={(input, node) =>
                (node.title as string).toLowerCase().includes(input.toLowerCase())
              }
              treeDataSimpleMode={false}
            />
          </Form.Item>

          <Form.Item
            label="部门名称"
            name="name"
            rules={[{ required: true, message: '请输入部门名称' }]}
          >
            <Input placeholder="请输入部门名称" maxLength={100} />
          </Form.Item>

          <Form.Item label="部门编码" name="code">
            <Input placeholder="请输入部门编码" maxLength={50} />
          </Form.Item>

          <Form.Item label="排序" name="sort_order">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="状态" name="status">
            <Select
              options={[
                { value: 'active', label: '启用' },
                { value: 'inactive', label: '停用' }
              ]}
            />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} placeholder="可填写部门描述" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        open={drawerVisible}
        width={520}
        title="部门详情"
        onClose={() => setDrawerVisible(false)}
      >
        {detailLoading || !deptDetail ? (
          <Empty description="正在加载数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="部门名称">{deptDetail.name}</Descriptions.Item>
              <Descriptions.Item label="部门编码">{deptDetail.code || '-'}</Descriptions.Item>
              <Descriptions.Item label="所属组织">{deptDetail.organization_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">{statusTag(deptDetail.status)}</Descriptions.Item>
              <Descriptions.Item label="成员数">{deptDetail.member_count ?? 0}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {deptDetail.created_at ? dayjs(deptDetail.created_at).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <Title level={5}>成员列表</Title>
              {deptDetail.members && deptDetail.members.length > 0 ? (
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={deptDetail.members}
                  columns={[
                    { title: '用户名', dataIndex: 'username', key: 'username' },
                    { title: '姓名', dataIndex: 'name', key: 'name' },
                    { title: '邮箱', dataIndex: 'email', key: 'email' },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      key: 'status',
                      render: (status?: string) => statusTag(status)
                    }
                  ]}
                />
              ) : (
                <Empty description="暂无成员" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>

            <div>
              <Title level={5}>子部门</Title>
              {deptDetail.children && deptDetail.children.length > 0 ? (
                <Space wrap>
                  {deptDetail.children.map(child => (
                    <Tag key={child.id}>{child.name}</Tag>
                  ))}
                </Space>
              ) : (
                <Empty description="暂无子部门" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          </Space>
        )}
      </Drawer>
    </Card>
  )
}

export default DepartmentManagement
