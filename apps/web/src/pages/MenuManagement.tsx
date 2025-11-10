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
  Select,
  Switch,
  InputNumber
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  MenuOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axios from '../utils/axios';


interface Menu {
  id: string;
  name: string;
  code: string;
  path: string;
  component: string | null;
  icon: string | null;
  parent_id: string | null;
  type: string;
  sort_order: number;
  status: string;
  visible: boolean;
  permission_code: string | null;
  permissions: any[];
  created_at: string;
  updated_at: string;
  children?: Menu[];
}

const MenuManagement: React.FC = () => {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [flatMenus, setFlatMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [form] = Form.useForm();

  const token = localStorage.getItem('token');
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  // 将扁平列表转换为树形结构
  const buildTree = (flatList: Menu[]): Menu[] => {
    const map = new Map<string, Menu>();
    const roots: Menu[] = [];

    // 先创建所有节点的映射
    flatList.forEach(item => {
      map.set(item.id, { ...item, children: [] });
    });

    // 构建树形结构
    flatList.forEach(item => {
      const node = map.get(item.id)!;
      if (item.parent_id && map.has(item.parent_id)) {
        const parent = map.get(item.parent_id)!;
        if (!parent.children) parent.children = [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // 按 sort_order 排序
    const sortTree = (nodes: Menu[]) => {
      nodes.sort((a, b) => a.sort_order - b.sort_order);
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          sortTree(node.children);
        }
      });
    };

    sortTree(roots);
    return roots;
  };

  // 获取菜单列表
  const fetchMenus = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/menus', {
        ...config,
        params: { pageSize: 1000 }
      });

      if (response.data.success) {
        const flatList = response.data.data.list || [];
        setFlatMenus(flatList);
        const treeData = buildTree(flatList);
        setMenus(treeData);
      }
    } catch (error: any) {
      message.error('获取菜单列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenus();
  }, []);

  // 显示新增/编辑弹窗
  const showModal = (menu?: Menu) => {
    if (menu) {
      setEditingMenu(menu);
      form.setFieldsValue({
        name: menu.name,
        code: menu.code,
        path: menu.path,
        component: menu.component,
        icon: menu.icon,
        parent_id: menu.parent_id,
        type: menu.type,
        sort_order: menu.sort_order,
        visible: menu.visible,
        permission_code: menu.permission_code
      });
    } else {
      setEditingMenu(null);
      form.resetFields();
      form.setFieldsValue({
        visible: true,
        sort_order: 0,
        type: 'menu'
      });
    }
    setModalVisible(true);
  };

  // 处理提交
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingMenu) {
        // 更新
        const response = await axios.put(
          `/api/menus/${editingMenu.id}`,
          values,
          config
        );
        if (response.data.success) {
          message.success('菜单更新成功');
        }
      } else {
        // 新增
        const response = await axios.post(
          '/api/menus',
          values,
          config
        );
        if (response.data.success) {
          message.success('菜单创建成功');
        }
      }
      setModalVisible(false);
      form.resetFields();
      fetchMenus();
    } catch (error: any) {
      if (error.response) {
        message.error(error.response.data.message || '操作失败');
      }
    }
  };

  // 删除菜单
  const handleDelete = async (id: string) => {
    try {
      const response = await axios.delete(`/api/menus/${id}`, config);
      if (response.data.success) {
        message.success('菜单删除成功');
        fetchMenus();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  // 表格列定义
  const columns: ColumnsType<Menu> = [
    {
      title: '菜单名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '菜单代码',
      dataIndex: 'code',
      key: 'code',
      width: 150,
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      width: 150,
    },
    {
      title: '组件',
      dataIndex: 'component',
      key: 'component',
      width: 150,
      render: (component) => component || '-'
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type) => (
        <Tag color={type === 'menu' ? 'blue' : type === 'directory' ? 'cyan' : 'green'}>
          {type === 'menu' ? '菜单' : type === 'directory' ? '目录' : '按钮'}
        </Tag>
      )
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 80,
    },
    {
      title: '可见',
      dataIndex: 'visible',
      key: 'visible',
      width: 80,
      render: (visible) => (
        <Tag color={visible ? 'green' : 'red'}>
          {visible ? '是' : '否'}
        </Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '启用' : '禁用'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              form.setFieldsValue({
                parent_id: record.id,
                visible: true,
                sort_order: 0,
                type: 'menu'
              });
              setEditingMenu(null);
              setModalVisible(true);
            }}
          >
            添加
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除？"
            description="删除后不可恢复，子菜单也会被删除"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
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
            <MenuOutlined />
            <span>菜单管理</span>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchMenus}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => showModal()}
            >
              新增菜单
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={menus}
          rowKey="id"
          loading={loading}
          pagination={false}
          expandable={{
            defaultExpandAllRows: false
          }}
        />
      </Card>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingMenu ? '编辑菜单' : '新增菜单'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        width={700}
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
            label="菜单名称"
            rules={[{ required: true, message: '请输入菜单名称' }]}
          >
            <Input placeholder="如：用户管理" />
          </Form.Item>

          <Form.Item
            name="code"
            label="菜单代码"
            rules={[
              { required: true, message: '请输入菜单代码' },
              { pattern: /^[a-z_]+$/, message: '只能包含小写字母和下划线' }
            ]}
          >
            <Input placeholder="如：user_management" />
          </Form.Item>

          <Form.Item
            name="type"
            label="菜单类型"
            rules={[{ required: true, message: '请选择菜单类型' }]}
          >
            <Select placeholder="选择菜单类型">
              <Select.Option value="directory">目录</Select.Option>
              <Select.Option value="menu">菜单</Select.Option>
              <Select.Option value="button">按钮</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="parent_id"
            label="上级菜单"
          >
            <Select placeholder="选择上级菜单（留空为顶级菜单）" allowClear>
              {flatMenus.map(menu => (
                <Select.Option key={menu.id} value={menu.id}>
                  {menu.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="path"
            label="路由路径"
            rules={[{ required: true, message: '请输入路由路径' }]}
          >
            <Input placeholder="如：/user" />
          </Form.Item>

          <Form.Item
            name="component"
            label="组件路径"
          >
            <Input placeholder="如：UserManagement" />
          </Form.Item>

          <Form.Item
            name="icon"
            label="图标"
          >
            <Input placeholder="如：UserOutlined" />
          </Form.Item>

          <Form.Item
            name="sort_order"
            label="排序"
            rules={[{ required: true, message: '请输入排序号' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="数字越小越靠前" />
          </Form.Item>

          <Form.Item
            name="visible"
            label="是否可见"
            valuePropName="checked"
          >
            <Switch checkedChildren="显示" unCheckedChildren="隐藏" />
          </Form.Item>

          <Form.Item
            name="permission_code"
            label="权限代码"
          >
            <Input placeholder="如：user.read" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MenuManagement;
