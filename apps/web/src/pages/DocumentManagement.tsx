/**
 * 统一文档管理主页面
 * 支持SPEC、合同、招投标三种文档类型
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  Tooltip,
  Tree,
  Empty,
  Spin
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
  CloudDownloadOutlined
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
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

interface TemplateSectionNode {
  code: string;
  title: string;
  children?: TemplateSectionNode[];
}

const convertToTreeData = (nodes: TemplateSectionNode[]): DataNode[] =>
  nodes.map((node) => ({
    key: node.code,
    title: (
      <span>
        <span style={{ color: '#1890ff', fontFamily: 'monospace', marginRight: 8 }}>
          {node.code}
        </span>
        {node.title}
      </span>
    ),
    children: node.children && node.children.length > 0 ? convertToTreeData(node.children) : undefined,
  }));

const flattenCodes = (nodes: TemplateSectionNode[]): string[] => {
  let result: string[] = [];
  nodes.forEach((node) => {
    result.push(node.code);
    if (node.children && node.children.length > 0) {
      result = result.concat(flattenCodes(node.children));
    }
  });
  return result;
};

const DocumentManagement: React.FC = () => {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<string>('spec');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [sectionTreeData, setSectionTreeData] = useState<DataNode[]>([]);
  const [sectionCodes, setSectionCodes] = useState<string[]>([]);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
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

  const loadTemplateSectionTree = useCallback(async (templateId: string) => {
    setSectionLoading(true);
    try {
      const response = await axios.get(`/api/unified-document/templates/${templateId}/sections-tree`, {
        params: { editableOnly: true }
      });

      if (response.data.success) {
        const treeNodes: TemplateSectionNode[] = response.data.data || [];
        setSectionTreeData(convertToTreeData(treeNodes));
        const defaultCodes = flattenCodes(treeNodes);
        setSectionCodes(defaultCodes);
        form.setFieldsValue({ sectionCodes: defaultCodes });
        if (defaultCodes.length === 0) {
          message.warning('该模板暂无可导入的章节');
        }
      }
    } catch (error: any) {
      console.error('加载模板章节失败', error);
      message.error(error.response?.data?.message || '加载模板章节失败');
      setSectionTreeData([]);
      setSectionCodes([]);
      form.setFieldsValue({ sectionCodes: [] });
    } finally {
      setSectionLoading(false);
    }
  }, [form]);

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

  const handleTemplateChange = (value?: string) => {
    const templateId = value || null;
    setSectionTreeData([]);
    setSectionCodes([]);
    form.setFieldsValue({ sectionCodes: [] });
    if (templateId) {
      loadTemplateSectionTree(templateId);
    }
  };

  const handleSectionCheck = (keys: any) => {
    const checked = Array.isArray(keys) ? keys : (keys.checked || []);
    const normalized = (checked as React.Key[]).map(String);
    setSectionCodes(normalized);
    form.setFieldsValue({ sectionCodes: normalized });
  };

  useEffect(() => {
    loadDocuments(selectedType);
    loadTemplates(selectedType);
    loadProjects();
  }, [selectedType]);

  // 创建文档
  const handleCreateDocument = async (values: any) => {
    try {
      if (values.templateId && (!values.sectionCodes || values.sectionCodes.length === 0)) {
        message.error('请选择至少一个要导入的章节');
        return;
      }

      setCreating(true);

      const payload: any = {
        title: values.title,
        projectId: values.projectId,
        templateId: values.templateId,
        documentType: selectedType,
      };

      if (!payload.templateId) {
        delete payload.templateId;
      }

      if (values.templateId && values.sectionCodes && values.sectionCodes.length > 0) {
        payload.sectionCodes = values.sectionCodes;
      }

      const response = await axios.post('/api/unified-document/documents', payload);

      if (response.data.success) {
        message.success('文档创建成功');
        setCreateModalVisible(false);
        form.resetFields();
        setSectionTreeData([]);
        setSectionCodes([]);
        loadDocuments(selectedType);

        // 跳转到编辑页面
        navigate(`/documents/${response.data.data.id}/edit`);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建文档失败');
    } finally {
      setCreating(false);
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

  const handleExportEditedSections = async (doc: Document) => {
    try {
      setExportingId(doc.id);
      const response = await axios.get(`/api/unified-document/documents/${doc.id}/export-edited`, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/zip' });
      const disposition = response.headers['content-disposition'];
      let filename = `${doc.title}-edited-sections.zip`;

      if (disposition) {
        const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
        if (match) {
          filename = decodeURIComponent(match[1] || match[2]);
        }
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('已导出编辑过的章节');
    } catch (error: any) {
      let errMsg = error.response?.data?.message || '导出失败';
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const parsed = JSON.parse(text);
          errMsg = parsed.message || errMsg;
        } catch (e) {
          // ignore parse error
        }
      }
      message.error(errMsg);
    } finally {
      setExportingId(null);
    }
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
          <Tooltip title="导出已编辑章节">
            <Button
              type="link"
              size="small"
              icon={<CloudDownloadOutlined />}
              loading={exportingId === record.id}
              onClick={() => handleExportEditedSections(record)}
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
                onClick={() => {
                  form.resetFields();
                  setSectionTreeData([]);
                  setSectionCodes([]);
                  setCreateModalVisible(true);
                }}
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
          setSectionTreeData([]);
          setSectionCodes([]);
        }}
        onOk={() => form.submit()}
        confirmLoading={creating}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateDocument}
          initialValues={{ sectionCodes: [] }}
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
            <Select
              placeholder="选择模板或从空白开始"
              allowClear
              onChange={(value) => handleTemplateChange(value)}
              onClear={() => handleTemplateChange(undefined)}
            >
              {templates.map((template) => (
                <Option key={template.id} value={template.id}>
                  {template.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.templateId !== cur.templateId}>
            {({ getFieldValue }) => {
              if (!getFieldValue('templateId')) {
                return null;
              }
              return (
                <Form.Item
                  name="sectionCodes"
                  label="选择要导入的章节"
                  rules={[{ required: true, message: '请选择至少一个章节' }]}
                >
                  <div style={{ border: '1px solid #f0f0f0', borderRadius: 4, padding: 12, maxHeight: 320, overflow: 'auto' }}>
                    {sectionLoading ? (
                      <div style={{ textAlign: 'center', padding: 24 }}>
                        <Spin size="small" />
                      </div>
                    ) : sectionTreeData.length > 0 ? (
                      <Tree
                        checkable
                        selectable={false}
                        checkedKeys={sectionCodes}
                        onCheck={handleSectionCheck}
                        treeData={sectionTreeData}
                        defaultExpandAll
                      />
                    ) : (
                      <Empty
                        description="当前模板无可导入章节"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    )}
                  </div>
                </Form.Item>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DocumentManagement;
