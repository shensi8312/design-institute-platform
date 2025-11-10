import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
  Tag,
  Select
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axios from '../utils/axios';

const { TextArea } = Input;

interface Permission {
  id: string;
  name: string;
  code: string;
  type: string;
  resource: string;
  action: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

const PermissionManagement: React.FC = () => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [form] = Form.useForm();

  const token = localStorage.getItem('token');
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  // 获取权限列表
  const fetchPermissions = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/permissions', {
        ...config,
        params: { page, pageSize }
      });

      if (response.data.success) {
        setPermissions(response.data.data.list || []);
        setPagination({
          page: parseInt(response.data.data.pagination.page),
          pageSize: parseInt(response.data.data.pagination.pageSize),
          total: response.data.data.pagination.total
        });
      }
    } catch (error: any) {
      message.error('获取权限列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  // 显示新增/编辑弹窗
  const showModal = (permission?: Permission) => {
    if (permission) {
      setEditingPermission(permission);
      form.setFieldsValue({
        name: permission.name,
        code: permission.code,
        type: permission.type,
        resource: permission.resource,
        action: permission.action,
        description: permission.description
      });
    } else {
      setEditingPermission(null);
      form.resetFields();
    }
    setModalVisible(true);
  };

  // 处理提交
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingPermission) {
        // 更新
        const response = await axios.put(
          `/api/permissions/${editingPermission.id}`,
          values,
          config
        );
        if (response.data.success) {
          message.success('权限更新成功');
        }
      } else {
        // 新增
        const response = await axios.post(
          '/api/permissions',
          values,
          config
        );
        if (response.data.success) {
          message.success('权限创建成功');
        }
      }
      setModalVisible(false);
      form.resetFields();
      fetchPermissions(pagination.page, pagination.pageSize);
    } catch (error: any) {
      if (error.response) {
        message.error(error.response.data.message || '操作失败');
      }
    }
  };

  // 删除权限
  const handleDelete = async (id: string) => {
    try {
      const response = await axios.delete(`/api/permissions/${id}`, config);
      if (response.data.success) {
        message.success('权限删除成功');
        fetchPermissions(pagination.page, pagination.pageSize);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  // 表格列定义
  const columns: ColumnsType<Permission> = [
    {
      title: '权限名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '权限代码',
      dataIndex: 'code',
      key: 'code',
      width: 200,
      render: (code) => <Tag color="blue">{code}</Tag>
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type) => <Tag color="cyan">{type}</Tag>
    },
    {
      title: '资源',
      dataIndex: 'resource',
      key: 'resource',
      width: 120,
    },
    {
      title: '动作',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (action) => action ? <Tag color="green">{action}</Tag> : '-'
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除？"
            description="删除后不可恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <SafetyOutlined />
            <span>权限管理</span>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => fetchPermissions(pagination.page, pagination.pageSize)}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => showModal()}
            >
              新增权限
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={permissions}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => fetchPermissions(page, pageSize)
          }}
        />
      </Card>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingPermission ? '编辑权限' : '新增权限'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 20 }}
        >
          <Form.Item
            name="name"
            label="权限名称"
            rules={[{ required: true, message: '请输入权限名称' }]}
          >
            <Input placeholder="如：查看用户" />
          </Form.Item>

          <Form.Item
            name="code"
            label="权限代码"
            rules={[
              { required: true, message: '请输入权限代码' },
              { pattern: /^[a-z._]+$/, message: '只能包含小写字母、点和下划线' }
            ]}
            tooltip="英文标识，用于系统内部"
          >
            <Input placeholder="如：user.read" />
          </Form.Item>

          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true, message: '请选择类型' }]}
          >
            <Select placeholder="选择权限类型">
              <Select.Option value="系统管理">系统管理</Select.Option>
              <Select.Option value="用户管理">用户管理</Select.Option>
              <Select.Option value="项目管理">项目管理</Select.Option>
              <Select.Option value="知识库">知识库</Select.Option>
              <Select.Option value="数字工地">数字工地</Select.Option>
              <Select.Option value="自定义">自定义</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="resource"
            label="资源"
            rules={[{ required: true, message: '请输入资源' }]}
          >
            <Input placeholder="如：user" />
          </Form.Item>

          <Form.Item
            name="action"
            label="动作"
          >
            <Select placeholder="选择动作" allowClear>
              <Select.Option value="create">create</Select.Option>
              <Select.Option value="read">read</Select.Option>
              <Select.Option value="update">update</Select.Option>
              <Select.Option value="delete">delete</Select.Option>
              <Select.Option value="list">list</Select.Option>
              <Select.Option value="view">view</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea
              rows={3}
              placeholder="描述该权限的用途"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PermissionManagement;
