/**
 * 模板管理页面
 * 上传、管理、发布文档模板
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
  Upload,
  message,
  Card,
  Menu,
  Row,
  Col
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import {
  PlusOutlined,
  UploadOutlined,
  EyeOutlined,
  DeleteOutlined,
  CheckOutlined,
  FileTextOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  FileAddOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';

const { TextArea } = Input;

interface Template {
  id: string;
  name: string;
  template_type: 'spec' | 'contract' | 'bidding';
  version: string;
  description: string;
  status: string;
  file_name: string;
  created_at: string;
  created_by: string;
}

const TemplateManagement: React.FC = () => {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<string>('spec');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [form] = Form.useForm();
  const [createForm] = Form.useForm();
  const [fileList, setFileList] = useState<any[]>([]);

  // 模板类型配置
  const templateTypes = {
    spec: {
      label: '技术规范模板',
      icon: <FileTextOutlined />,
      color: '#1890ff'
    },
    contract: {
      label: '合同模板',
      icon: <FileProtectOutlined />,
      color: '#52c41a'
    },
    bidding: {
      label: '招投标模板',
      icon: <FileSearchOutlined />,
      color: '#faad14'
    },
  };

  // 状态配置
  const statusConfig: Record<string, { color: string; text: string }> = {
    draft: { color: 'default', text: '草稿' },
    published: { color: 'success', text: '已发布' },
    archived: { color: 'default', text: '已归档' },
  };

  // 加载模板列表
  const loadTemplates = async (templateType: string) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/unified-document/templates', {
        params: { templateType }
      });

      if (response.data.success) {
        setTemplates(response.data.data);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '加载模板列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates(selectedType);
  }, [selectedType]);

  // 上传配置
  const uploadProps: UploadProps = {
    name: 'file',
    maxCount: 1,
    accept: '.docx,.pdf',
    beforeUpload: (file) => {
      const isValidType = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                          file.type === 'application/pdf';
      if (!isValidType) {
        message.error('只支持上传.docx或.pdf格式的文件！');
        return false;
      }
      const isLt50M = file.size / 1024 / 1024 < 50;
      if (!isLt50M) {
        message.error('文件大小不能超过50MB！');
        return false;
      }
      setFileList([file]);
      return false; // 阻止自动上传
    },
    onRemove: () => {
      setFileList([]);
    },
    fileList,
  };

  // 上传模板
  const handleUploadTemplate = async (values: any) => {
    if (fileList.length === 0) {
      message.error('请选择要上传的文件');
      return;
    }

    const formData = new FormData();
    formData.append('file', fileList[0]);
    formData.append('name', values.name);
    formData.append('templateType', selectedType);
    formData.append('description', values.description || '');

    try {
      const response = await axios.post('/api/unified-document/templates', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        message.success('模板上传成功，AI正在解析中...');
        setUploadModalVisible(false);
        form.resetFields();
        setFileList([]);
        loadTemplates(selectedType);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '上传模板失败');
    }
  };

  // 发布模板
  const handlePublishTemplate = (id: string) => {
    Modal.confirm({
      title: '确认发布',
      content: '发布后，该模板将可以被用户使用创建文档。确定要发布吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await axios.post(`/api/unified-document/templates/${id}/publish`);
          message.success('模板发布成功');
          loadTemplates(selectedType);
        } catch (error: any) {
          message.error(error.response?.data?.message || '发布模板失败');
        }
      },
    });
  };

  // 删除模板
  const handleDeleteTemplate = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个模板吗？此操作不可恢复。',
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await axios.delete(`/api/unified-document/templates/${id}`);
          message.success('模板删除成功');
          loadTemplates(selectedType);
        } catch (error: any) {
          message.error(error.response?.data?.message || '删除模板失败');
        }
      },
    });
  };

  // 查看模板详情和章节结构 - 跳转到Word编辑页面
  const handleViewTemplate = (template: Template) => {
    navigate(`/templates/${template.id}/edit`);
  };

  // 显示创建文档模态框
  const handleCreateFromTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setCreateModalVisible(true);
    createForm.resetFields();
  };

  // 创建文档实例
  const handleCreateDocument = async (values: any) => {
    if (!selectedTemplate) return;

    try {
      const response = await axios.post('/api/unified-document/documents/from-template', {
        templateId: selectedTemplate.id,
        title: values.title,
        projectId: null
      });

      if (response.data.success) {
        message.success('文档创建成功！');
        setCreateModalVisible(false);
        navigate(`/documents/${response.data.data.id}/edit`);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建文档失败');
    }
  };

  // 表格列配置
  const columns: ColumnsType<Template> = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      render: (text) => (
        <Space>
          <FileTextOutlined />
          {text}
        </Space>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={statusConfig[status]?.color}>
          {statusConfig[status]?.text || status}
        </Tag>
      ),
    },
    {
      title: '文件名',
      dataIndex: 'file_name',
      key: 'file_name',
      width: 200,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewTemplate(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<FileAddOutlined />}
            onClick={() => handleCreateFromTemplate(record)}
          >
            创建
          </Button>
          {record.status === 'draft' && (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handlePublishTemplate(record.id)}
            >
              发布
            </Button>
          )}
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteTemplate(record.id)}
          />
        </Space>
      ),
    },
  ];

  // 左侧菜单项
  const menuItems = Object.entries(templateTypes).map(([key, config]) => ({
    key,
    icon: config.icon,
    label: config.label,
  }));

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <h2>模板管理</h2>
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
                {templateTypes[selectedType as keyof typeof templateTypes].label}
              </h3>
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={() => setUploadModalVisible(true)}
              >
                上传模板
              </Button>
            </div>

            <Table
              columns={columns}
              dataSource={templates}
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

      {/* 上传模板模态框 */}
      <Modal
        title={`上传${templateTypes[selectedType as keyof typeof templateTypes].label}`}
        open={uploadModalVisible}
        onCancel={() => {
          setUploadModalVisible(false);
          form.resetFields();
          setFileList([]);
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUploadTemplate}
        >
          <Form.Item
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="请输入模板名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="模板描述"
          >
            <TextArea
              rows={3}
              placeholder="请输入模板描述信息"
            />
          </Form.Item>

          <Form.Item
            label="上传文件"
            required
          >
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
            <div style={{ marginTop: 8, color: '#999' }}>
              支持.docx和.pdf格式，文件大小不超过50MB
            </div>
            <div style={{ marginTop: 4, color: '#999' }}>
              上传后系统将自动使用AI解析模板结构
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* 创建文档模态框 */}
      <Modal
        title={`基于模板创建文档 - ${selectedTemplate?.name}`}
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateDocument}
        >
          <Form.Item
            label="文档标题"
            name="title"
            rules={[{ required: true, message: '请输入文档标题' }]}
          >
            <Input placeholder="例如：XX项目技术规范文档" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
              <Button onClick={() => setCreateModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TemplateManagement;
