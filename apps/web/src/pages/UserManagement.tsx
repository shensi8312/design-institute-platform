import React, { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message
} from 'antd'
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table'
import { KeyOutlined, PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import userAPI, { type User, type CreateUserDTO, type UpdateUserDTO } from '../api/users'
import departmentAPI, { type Department } from '../api/departments'
import roleAPI, { type Role } from '../api/roles'
import { getOrganizations } from '../api/organizations'
import type { Organization } from '../types'

const { Title, Paragraph, Text } = Typography

interface UserRecord extends User {
  role_name?: string
  department_name?: string
  organization_name?: string
}

interface FiltersState {
  keyword?: string
  status?: 'active' | 'inactive'
  roleId?: string
  organizationId?: string
  departmentId?: string
}

const statusTag = (status?: string) => {
  if (status === 'inactive') {
    return <Tag color="red">停用</Tag>
  }
  if (status === 'deleted') {
    return <Tag color="default">已删除</Tag>
  }
  return <Tag color="green">启用</Tag>
}

const UserManagement: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<UserRecord[]>([])
  const [pagination, setPagination] = useState<TablePaginationConfig>({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState<FiltersState>({})
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [resetModalVisible, setResetModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [currentUserDetail, setCurrentUserDetail] = useState<User | null>(null)
  const [resetUser, setResetUser] = useState<UserRecord | null>(null)
  const [filterForm] = Form.useForm()
  const [form] = Form.useForm<CreateUserDTO & UpdateUserDTO & { departmentIds?: string[]; password?: string }>()
  const [resetForm] = Form.useForm<{ password: string; confirmPassword: string }>()

  const filterOrganizationId = Form.useWatch('organizationId', filterForm)

  const filterDepartmentOptions = useMemo(() => {
    if (!filterOrganizationId) {
      return departments
    }
    return departments.filter(dep => dep.organization_id === filterOrganizationId)
  }, [departments, filterOrganizationId])

  const formOrganizationId = Form.useWatch('organization_id', form)

  const formDepartmentOptions = useMemo(() => {
    if (!formOrganizationId) {
      return departments
    }
    return departments.filter(dep => dep.organization_id === formOrganizationId)
  }, [departments, formOrganizationId])

  const loadUsers = async (page = pagination.current || 1, pageSize = pagination.pageSize || 10, overrideFilters?: FiltersState) => {
    const params: Record<string, any> = {
      page,
      pageSize
    }
    const activeFilters = overrideFilters ?? filters
    if (activeFilters.keyword) params.search = activeFilters.keyword.trim()
    if (activeFilters.status) params.status = activeFilters.status
    if (activeFilters.organizationId) params.organizationId = activeFilters.organizationId
    if (activeFilters.departmentId) params.departmentId = activeFilters.departmentId
    if (activeFilters.roleId) params.roleId = activeFilters.roleId

    try {
      setLoading(true)
      const response = await userAPI.getList(params)
      const list = (response?.list ?? []) as UserRecord[]
      const paginationInfo = response?.pagination
      setUsers(list)
      setPagination({
        current: paginationInfo?.page ?? page,
        pageSize: paginationInfo?.pageSize ?? pageSize,
        total: paginationInfo?.total ?? list.length
      })
    } catch (error) {
      console.error(error)
      message.error('获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  const loadDependencies = async () => {
    try {
      const [{ list: roleList = [] } = {}, orgData, flatDepartments] = await Promise.all([
        roleAPI.getList({ pageSize: 100 }).catch(() => ({ list: [] })),
        getOrganizations().catch(() => ({ list: [] })),
        departmentAPI.getFlatList().catch(() => [])
      ])
      setRoles(roleList as Role[])
      setOrganizations((orgData.list ?? []) as Organization[])
      setDepartments((flatDepartments as Department[]) || [])
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    loadDependencies()
  }, [])

  useEffect(() => {
    loadUsers()
  }, [filters])

  const handleTableChange = (pageInfo: TablePaginationConfig) => {
    const current = pageInfo.current || 1
    const pageSize = pageInfo.pageSize || 10
    setPagination(prev => ({ ...prev, current, pageSize }))
    loadUsers(current, pageSize)
  }

  const openCreateModal = () => {
    setEditingUser(null)
    form.resetFields()
    form.setFieldsValue({ status: 'active', is_admin: false })
    setModalVisible(true)
  }

  const openEditModal = async (record: UserRecord) => {
    try {
      setEditingUser(record)
      form.resetFields()
      const detail = await userAPI.getById(record.id)
      setCurrentUserDetail(detail)
      form.setFieldsValue({
        username: detail.username,
        name: detail.name,
        email: detail.email,
        phone: detail.phone,
        role_id: detail.role_id,
        organization_id: detail.organization_id,
        department_id: detail.department_id,
        departmentIds: detail.departments?.map(dep => dep.id) ?? (detail.department_id ? [detail.department_id] : []),
        status: detail.status === 'inactive' ? 'inactive' : 'active',
        is_admin: detail.is_admin
      })
      setModalVisible(true)
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload: Partial<CreateUserDTO & UpdateUserDTO> = {
        username: values.username,
        name: values.name,
        email: values.email,
        phone: values.phone,
        role_id: values.role_id,
        organization_id: values.organization_id,
        department_id: values.department_id,
        departmentIds: values.departmentIds,
        status: values.status as 'active' | 'inactive',
        is_admin: values.is_admin
      }

      if (!editingUser) {
        if (!values.password || values.password.length < 6) {
          message.error('请设置至少6位数的登录密码')
          setSubmitting(false)
          return
        }
        await userAPI.create({
          ...(payload as CreateUserDTO),
          username: values.username!,
          password: values.password,
          organization_id: values.organization_id,
          status: (values.status as 'active' | 'inactive') || 'active',
          is_admin: values.is_admin || false
        })
        message.success('用户创建成功')
      } else {
        if (values.password) {
          payload.password = values.password
        }
        await userAPI.update(editingUser.id, payload as UpdateUserDTO)
        message.success('用户更新成功')
      }
      setModalVisible(false)
      await loadUsers(pagination.current || 1, pagination.pageSize || 10)
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDelete = (record: UserRecord) => {
    Modal.confirm({
      title: `确认删除用户「${record.username}」吗？`,
      content: '删除后将无法恢复，请谨慎操作。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await userAPI.delete(record.id)
          message.success('删除成功')
          await loadUsers(pagination.current || 1, pagination.pageSize || 10)
        } catch (error) {
          if (error instanceof Error) {
            message.error(error.message)
          }
        }
      }
    })
  }

  const openResetModal = (record: UserRecord) => {
    setResetUser(record)
    resetForm.resetFields()
    setResetModalVisible(true)
  }

  const handleResetPassword = async () => {
    try {
    const values = await resetForm.validateFields()
      if (!resetUser) return
      await userAPI.resetPassword(resetUser.id, values.password)
      message.success('密码重置成功')
      setResetModalVisible(false)
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    }
  }

  const openDetailDrawer = async (record: UserRecord) => {
    try {
      setDetailLoading(true)
      setDrawerVisible(true)
      const detail = await userAPI.getById(record.id)
      setCurrentUserDetail(detail)
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
      setDrawerVisible(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleFilterSubmit = (values: FiltersState) => {
    setFilters(values)
  }

  const handleFilterReset = () => {
    filterForm.resetFields()
    setFilters({})
  }

  const columns: ColumnsType<UserRecord> = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text, record) => (
        <Button type="link" size="small" onClick={() => openDetailDrawer(record)}>
          {text}
        </Button>
      )
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email'
    },
    {
      title: '角色',
      dataIndex: 'role_name',
      key: 'role_name',
      render: value => value || '-'
    },
    {
      title: '所属部门',
      dataIndex: 'department_name',
      key: 'department_name',
      render: value => value || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: value => statusTag(value)
    },
    {
      title: '管理员',
      dataIndex: 'is_admin',
      key: 'is_admin',
      width: 100,
      render: (value: boolean) => (value ? <Tag color="purple">管理员</Tag> : <Tag>普通</Tag>)
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-')
    },
    {
      title: '操作',
      key: 'actions',
      width: 260,
      render: (_, record) => (
        <Space>
          <Button icon={<EyeOutlined />} size="small" onClick={() => openDetailDrawer(record)}>
            查看
          </Button>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEditModal(record)}>
            编辑
          </Button>
          <Button icon={<KeyOutlined />} size="small" onClick={() => openResetModal(record)}>
            重置密码
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
      title={<Title level={4} style={{ margin: 0 }}>用户管理</Title>}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => loadUsers(pagination.current || 1, pagination.pageSize || 10)}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新增用户
          </Button>
        </Space>
      }
    >
      <Paragraph type="secondary">管理系统用户，支持搜索、创建、编辑、重置密码等操作。</Paragraph>

      <Form layout="inline" form={filterForm} onFinish={handleFilterSubmit} style={{ marginBottom: 16 }}>
        <Form.Item name="keyword">
          <Input.Search allowClear placeholder="用户名 / 姓名 / 邮箱" onSearch={() => filterForm.submit()} />
        </Form.Item>
        <Form.Item name="status">
          <Select
            allowClear
            placeholder="状态"
            options={[
              { value: 'active', label: '启用' },
              { value: 'inactive', label: '停用' }
            ]}
            style={{ width: 120 }}
          />
        </Form.Item>
        <Form.Item name="roleId">
          <Select
            allowClear
            placeholder="角色"
            style={{ width: 160 }}
            options={roles.map(role => ({ label: role.name, value: role.id }))}
          />
        </Form.Item>
        <Form.Item name="organizationId">
          <Select
            allowClear
            placeholder="组织"
            style={{ width: 180 }}
            options={organizations.map(org => ({ label: org.name, value: org.id }))}
          />
        </Form.Item>
        <Form.Item name="departmentId">
          <Select
            allowClear
            placeholder="部门"
            style={{ width: 180 }}
            options={filterDepartmentOptions.map(dep => ({ label: dep.name, value: dep.id }))}
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">搜索</Button>
            <Button onClick={handleFilterReset}>重置</Button>
          </Space>
        </Form.Item>
      </Form>

      <Table<UserRecord>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={users}
        pagination={{
          current: pagination.current || 1,
          pageSize: pagination.pageSize || 10,
          total: pagination.total,
          showSizeChanger: true
        }}
        onChange={handleTableChange}
        locale={{ emptyText: <Empty description="暂无用户数据" /> }}
      />

      <Modal
        open={modalVisible}
        title={editingUser ? '编辑用户' : '新增用户'}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" disabled={!!editingUser} />
          </Form.Item>

          {!editingUser && (
            <Form.Item
              label="登录密码"
              name="password"
              rules={[{ required: true, message: '请设置登录密码' }, { min: 6, message: '至少6位字符' }]}
            >
              <Input.Password placeholder="请设置登录密码" />
            </Form.Item>
          )}

          {editingUser && (
            <Form.Item label="重设密码" name="password" tooltip="如需修改密码，请输入新密码">
              <Input.Password placeholder="留空则保持原密码" />
            </Form.Item>
          )}

          <Form.Item label="姓名" name="name">
            <Input placeholder="请输入姓名" />
          </Form.Item>

          <Form.Item label="邮箱" name="email" rules={[{ type: 'email', message: '邮箱格式不正确' }]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>

          <Form.Item label="手机号" name="phone">
            <Input placeholder="请输入手机号" />
          </Form.Item>

          <Form.Item
            label="所属组织"
            name="organization_id"
            rules={[{ required: true, message: '请选择组织' }]}
          >
            <Select
              placeholder="选择组织"
              options={organizations.map(org => ({ label: org.name, value: org.id }))}
              onChange={value => setFilters(prev => ({ ...prev, organizationId: value }))}
            />
          </Form.Item>

          <Form.Item label="主部门" name="department_id">
            <Select
              allowClear
              placeholder="选择主部门"
            options={formDepartmentOptions.map(dep => ({ label: dep.name, value: dep.id }))}
          />
        </Form.Item>

        <Form.Item label="关联部门" name="departmentIds">
          <Select
            mode="multiple"
            allowClear
            placeholder="关联多个部门"
            options={formDepartmentOptions.map(dep => ({ label: dep.name, value: dep.id }))}
          />
        </Form.Item>

          <Form.Item label="角色" name="role_id">
            <Select
              allowClear
              placeholder="选择角色"
              options={roles.map(role => ({ label: role.name, value: role.id }))}
            />
          </Form.Item>

          <Form.Item label="状态" name="status" initialValue="active">
            <Select
              options={[
                { value: 'active', label: '启用' },
                { value: 'inactive', label: '停用' }
              ]}
            />
          </Form.Item>

          <Form.Item label="管理员" name="is_admin" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        open={drawerVisible}
        width={520}
        title="用户详情"
        onClose={() => setDrawerVisible(false)}
      >
        {detailLoading || !currentUserDetail ? (
          <Empty description="正在加载数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="用户名">{currentUserDetail.username}</Descriptions.Item>
              <Descriptions.Item label="姓名">{currentUserDetail.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{currentUserDetail.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="手机号">{currentUserDetail.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="角色">{currentUserDetail.role_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="组织">{currentUserDetail.organization_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="主部门">{currentUserDetail.department_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">{statusTag(currentUserDetail.status)}</Descriptions.Item>
              <Descriptions.Item label="管理员">{currentUserDetail.is_admin ? '是' : '否'}</Descriptions.Item>
              <Descriptions.Item label="最后登录时间">
                {currentUserDetail.last_login_at ? dayjs(currentUserDetail.last_login_at).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <Title level={5}>关联部门</Title>
              {currentUserDetail.departments && currentUserDetail.departments.length > 0 ? (
                <Space wrap>
                  {currentUserDetail.departments.map(dep => (
                    <Tag key={dep.id} color={dep.is_primary ? 'blue' : 'default'}>
                      {dep.name}{dep.is_primary ? <Text type="secondary">（主）</Text> : null}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Empty description="暂无关联部门" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          </Space>
        )}
      </Drawer>

      <Modal
        open={resetModalVisible}
        title={resetUser ? `重置用户「${resetUser.username}」密码` : '重置密码'}
        onCancel={() => setResetModalVisible(false)}
        onOk={handleResetPassword}
        destroyOnClose
      >
        <Form form={resetForm} layout="vertical">
          <Form.Item
            label="新密码"
            name="password"
            rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '至少6位字符' }]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            label="确认密码"
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'))
                }
              })
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

export default UserManagement
