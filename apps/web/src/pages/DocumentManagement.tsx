/**
 * 统一文档管理主页面
 * 支持SPEC、合同、招投标三种文档类型
 */

import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Card,
  Menu,
  Row,
  Col,
  Tooltip
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  InboxOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';

const { Option } = Select;

interface Document {
  id: string;
  title: string;
  document_type: 'spec' | 'contract' | 'bidding';
  status: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

const DocumentManagement: React.FC = () => {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<string>('spec');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [form] = Form.useForm();

  // 文档类型配置
  const documentTypes = {
    spec: {
      label: '技术规范文档',
      icon: <FileTextOutlined />,
      color: '#1890ff'
    },
    contract: {
      label: '合同文档',
      icon: <FileProtectOutlined />,
      color: '#52c41a'
    },
    bidding: {
      label: '招投标文档',
      icon: <FileSearchOutlined />,
      color: '#faad14'
    }
  };

  // 状态标签配置
  const statusConfig: Record<string, { color: string; text: string }> = {
    draft: { color: 'default', text: '草稿' },
    in_review: { color: 'processing', text: '审批中' },
    completed: { color: 'success', text: '已完成' },
    archive_pending: { color: 'warning', text: '待归档' },
    archived: { color: 'purple', text: '已归档' },
  };

  // 加载文档列表
  const loadDocuments = async (documentType: string) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/unified-document/documents', {
        params: { documentType }
      });

      if (response.data.success) {
        const docs = response.data.data?.list || response.data.data || [];
        setDocuments(Array.isArray(docs) ? docs : []);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '加载文档列表失败');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  // 加载模板列表
  const loadTemplates = async (documentType: string) => {
    try {
      const response = await axios.get('/api/unified-document/templates', {
        params: { templateType: documentType, status: 'published' }
      });

      if (response.data.success) {
        setTemplates(response.data.data);
      }
    } catch (error) {
      console.error('加载模板列表失败', error);
    }
  };

  // 加载项目列表
  const loadProjects = async () => {
    try {
      const response = await axios.get('/api/projects');
      if (response.data.success) {
        // 处理分页格式的响应
        const projectData = response.data.data?.list || response.data.data || [];
        setProjects(Array.isArray(projectData) ? projectData : []);
      }
    } catch (error) {
      console.error('加载项目列表失败', error);
      setProjects([]); // 出错时设置为空数组
    }
  };

  useEffect(() => {
    loadDocuments(selectedType);
    loadTemplates(selectedType);
    loadProjects();
  }, [selectedType]);

  // 创建文档
  const handleCreateDocument = async (values: any) => {
    try {
      const response = await axios.post('/api/unified-document/documents', {
        ...values,
        documentType: selectedType,
      });

      if (response.data.success) {
        message.success('文档创建成功');
        setCreateModalVisible(false);
        form.resetFields();
        loadDocuments(selectedType);

        // 跳转到编辑页面
        navigate(`/documents/${response.data.data.id}/edit`);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建文档失败');
    }
  };

  // 删除文档
  const handleDeleteDocument = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个文档吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await axios.delete(`/api/unified-document/documents/${id}`);
          message.success('文档删除成功');
          loadDocuments(selectedType);
        } catch (error: any) {
          message.error(error.response?.data?.message || '删除文档失败');
        }
      },
    });
  };

  // 打开编辑器
  const handleEditDocument = (id: string) => {
    navigate(`/documents/${id}/edit`);
  };

  // 查看文档
  const handleViewDocument = (id: string) => {
    navigate(`/documents/${id}/view`);
  };

  // 表格列配置
  const columns: ColumnsType<Document> = [
    {
      title: '文档标题',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      render: (text, record) => (
        <Space>
          {documentTypes[record.document_type].icon}
          <a onClick={() => handleViewDocument(record.id)}>{text}</a>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <Tag color={statusConfig[status]?.color}>
          {statusConfig[status]?.text || status}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (text) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDocument(record.id)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditDocument(record.id)}
              disabled={record.status === 'archived'}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteDocument(record.id)}
              disabled={record.status === 'archived'}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 左侧菜单项
  const menuItems = Object.entries(documentTypes).map(([key, config]) => ({
    key,
    icon: config.icon,
    label: config.label,
  }));

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <h2>统一文档管理</h2>
        </div>

        <Row gutter={16}>
          {/* 左侧菜单 */}
          <Col span={4}>
            <Menu
              mode="inline"
              selectedKeys={[selectedType]}
              items={menuItems}
              onClick={({ key }) => setSelectedType(key)}
              style={{ borderRight: 0 }}
            />
          </Col>

          {/* 右侧内容 */}
          <Col span={20}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>
                {documentTypes[selectedType as keyof typeof documentTypes].label}
              </h3>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                创建文档
              </Button>
            </div>

            <Table
              columns={columns}
              dataSource={documents}
              rowKey="id"
              loading={loading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`,
              }}
            />
          </Col>
        </Row>
      </Card>

      {/* 创建文档模态框 */}
      <Modal
        title={`创建${documentTypes[selectedType as keyof typeof documentTypes].label}`}
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateDocument}
        >
          <Form.Item
            name="title"
            label="文档标题"
            rules={[{ required: true, message: '请输入文档标题' }]}
          >
            <Input placeholder="请输入文档标题" />
          </Form.Item>

          <Form.Item
            name="projectId"
            label="所属项目"
            rules={[{ required: true, message: '请选择所属项目' }]}
          >
            <Select placeholder="请选择项目">
              {projects.map((project) => (
                <Option key={project.id} value={project.id}>
                  {project.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="templateId"
            label="使用模板（可选）"
          >
            <Select placeholder="选择模板或从空白开始" allowClear>
              {templates.map((template) => (
                <Option key={template.id} value={template.id}>
                  {template.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DocumentManagement;
