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
  Checkbox,
  Row,
  Col,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UserOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axios from '../utils/axios';
import type { Role } from '../types';

const { TextArea } = Input;

interface Permission {
  id: string;
  code: string;
  name: string;
  type?: string;
  resource?: string;
  action?: string;
  description?: string;
}

interface PermissionGroup {
  [module: string]: Permission[];
}

const RoleManagement: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup>({});
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form] = Form.useForm();

  const token = localStorage.getItem('token');
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  // 获取模块中文名称
  const getModuleName = (module: string): string => {
    const moduleNames: { [key: string]: string } = {
      'system': '系统管理',
      'user': '用户管理',
      'role': '角色管理',
      'permission': '权限管理',
      'menu': '菜单管理',
      'organization': '组织管理',
      'department': '部门管理',
      'knowledge': '知识中心',
      'project': '项目管理',
      'mechanical': '机械设计',
      'rules': '规则管理',
      'digital_site': '数字工地',
      'workflow': '工作流',
      'document': '文档管理',
      'ai': 'AI工具',
      'engine': '引擎管理',
      'debug': '调试工具',
      'langextract': 'LangExtract'
    };
    return moduleNames[module] || module;
  };

  // 获取菜单列表（改为基于菜单的权限管理）
  const fetchPermissions = async () => {
    setLoadingPermissions(true);
    try {
      const response = await axios.get('/api/menus', config);
      if (response.data.success) {
        const menus = response.data.data || [];

        // 只保留有permission_code的菜单
        const menusWithPerms = menus.filter((m: any) => m.permission_code);

        // 转换为Permission格式
        const permissions = menusWithPerms.map((m: any) => ({
          id: m.id,
          code: m.permission_code,
          name: m.name,
          type: m.type,
          resource: m.path,
          description: m.name
        }));

        setAllPermissions(permissions);

        // 按父级菜单分组
        const grouped: PermissionGroup = {};
        menusWithPerms.forEach((menu: any) => {
          // 获取父级菜单名称
          const parentMenu = menus.find((m: any) => m.id === menu.parent_id);
          const groupName = parentMenu ? parentMenu.name : '顶级菜单';

          if (!grouped[groupName]) {
            grouped[groupName] = [];
          }

          grouped[groupName].push({
            id: menu.id,
            code: menu.permission_code,
            name: menu.name,
            type: menu.type,
            resource: menu.path,
            description: menu.name
          });
        });

        setPermissionGroups(grouped);
      }
    } catch (error: any) {
      console.error('获取菜单列表失败:', error);
    } finally {
      setLoadingPermissions(false);
    }
  };

  // 获取角色列表
  const fetchRoles = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/roles', {
        ...config,
        params: { page: 1, pageSize: 100 }
      });

      if (response.data.success) {
        setRoles(response.data.data.list || []);
      }
    } catch (error: any) {
      message.error('获取角色列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
    fetchRoles();
  }, []);

  // 显示新增/编辑弹窗
  const showModal = (role?: Role) => {
    if (role) {
      setEditingRole(role);

      console.log('🔍 打开编辑对话框 - 角色数据:', role);
      console.log('🔍 role.permissions 类型:', typeof role.permissions);
      console.log('🔍 role.permissions 值:', role.permissions);

      // 解析 permissions: 可能是字符串或数组
      let permissions = [];
      if (role.permissions) {
        if (typeof role.permissions === 'string') {
          try {
            permissions = JSON.parse(role.permissions);
            console.log('🔍 解析字符串后:', permissions);
          } catch (e) {
            console.error('🔍 解析失败:', e);
            permissions = [];
          }
        } else if (Array.isArray(role.permissions)) {
          permissions = role.permissions;
          console.log('🔍 直接使用数组:', permissions);
        }
      }

      console.log('🔍 最终设置的 permissions:', permissions);

      // 如果是 ['*']，展开为所有权限
      if (permissions.length === 1 && permissions[0] === '*') {
        permissions = allPermissions.map(p => p.code);
      }

      form.setFieldsValue({
        name: role.code,        // 角色标识对应code字段
        display_name: role.name, // 角色名称对应name字段
        description: role.description,
        permissions: permissions
      });
    } else {
      setEditingRole(null);
      form.resetFields();
      form.setFieldsValue({
        permissions: []
      });
    }
    setModalVisible(true);
  };

  // 处理提交
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 将表单字段映射为后端字段
      const data = {
        code: values.name,              // 表单的name对应数据库的code
        name: values.display_name,       // 表单的display_name对应数据库的name
        description: values.description,
        // 确保 permissions 始终是数组
        permissions: Array.isArray(values.permissions)
          ? values.permissions
          : (values.permissions ? [values.permissions] : [])
      };

      if (editingRole) {
        // 更新
        const response = await axios.put(
          `/api/roles/${editingRole.id}`,
          data,
          config
        );
        if (response.data.success) {
          message.success('角色更新成功');
        }
      } else {
        // 新增
        const response = await axios.post(
          '/api/roles',
          data,
          config
        );
        if (response.data.success) {
          message.success('角色创建成功');
        }
      }
      setModalVisible(false);
      form.resetFields();
      fetchRoles();
    } catch (error: any) {
      if (error.response) {
        message.error(error.response.data.message || '操作失败');
      }
    }
  };

  // 删除角色
  const handleDelete = async (id: number) => {
    try {
      const response = await axios.delete(`/api/roles/${id}`, config);
      if (response.data.success) {
        message.success('角色删除成功');
        fetchRoles();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  // 计算权限数量
  const getPermissionCount = (permissions: any): number => {
    if (!permissions) return 0;

    let perms = permissions;
    if (typeof permissions === 'string') {
      try {
        perms = JSON.parse(permissions);
      } catch (e) {
        return 0;
      }
    }

    if (Array.isArray(perms)) {
      // 如果是 ['*']，返回所有权限数量
      if (perms.length === 1 && perms[0] === '*') {
        return allPermissions.length;
      }
      return perms.length;
    }

    return 0;
  };

  // 表格列定义
  const columns: ColumnsType<Role> = [
    {
      title: '角色名称',
      dataIndex: 'display_name',
      key: 'display_name',
      width: 150,
      render: (text, record) => (
        <Space>
          <UserOutlined />
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            <div style={{ fontSize: 12, color: '#999' }}>{record.name}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '权限数量',
      dataIndex: 'permissions',
      key: 'permissions',
      width: 120,
      render: (permissions: string[]) => (
        <Tag color="blue">{getPermissionCount(permissions)} 个</Tag>
      ),
    },
    {
      title: '用户数',
      dataIndex: 'userCount',
      key: 'userCount',
      width: 100,
      render: (count: number) => (
        <Tag color="green">{count || 0} 人</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => showModal(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除？"
            description="删除后不可恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button type="link" danger icon={<DeleteOutlined />} />
            </Tooltip>
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
            <span>角色管理</span>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchRoles}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => showModal()}
            >
              新增角色
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={roles}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`
          }}
        />
      </Card>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingRole ? '编辑角色' : '新增角色'}
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
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="角色标识"
                rules={[
                  { required: true, message: '请输入角色标识' },
                  { pattern: /^[a-z_]+$/, message: '只能包含小写字母和下划线' }
                ]}
                tooltip="英文标识，用于系统内部"
              >
                <Input placeholder="如：project_manager" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="display_name"
                label="角色名称"
                rules={[{ required: true, message: '请输入角色名称' }]}
                tooltip="中文显示名称"
              >
                <Input placeholder="如：项目经理" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="角色描述"
          >
            <TextArea 
              rows={3} 
              placeholder="描述该角色的职责和权限范围" 
            />
          </Form.Item>

          <Form.Item
            name="permissions"
            label="选择权限"
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <div style={{
                border: '1px solid #d9d9d9',
                borderRadius: 4,
                padding: 16,
                maxHeight: 300,
                overflowY: 'auto'
              }}>
                {Object.entries(permissionGroups).map(([group, perms]) => (
                  <div key={group} style={{ marginBottom: 16 }}>
                    <h4 style={{ color: '#1890ff', marginBottom: 8 }}>
                      {group}
                    </h4>
                    <Row gutter={[8, 8]}>
                      {perms.map(perm => (
                        <Col span={12} key={perm.code}>
                          <Checkbox value={perm.code}>
                            {perm.name}
                          </Checkbox>
                        </Col>
                      ))}
                    </Row>
                  </div>
                ))}
              </div>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RoleManagement;