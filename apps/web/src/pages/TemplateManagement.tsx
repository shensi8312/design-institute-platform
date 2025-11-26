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
  Col,
  Select,
  Alert
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
  source_type?: string;
  source_project?: string;
  csi_parsed?: boolean;
}

// CSI 来源类型
type CSISourceType = 'CSI_EN' | 'CSI_ZH' | 'COMPANY' | '';

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
  const [csiSourceType, setCsiSourceType] = useState<CSISourceType>('');
  const [batchUploadVisible, setBatchUploadVisible] = useState(false);
  const [batchFileList, setBatchFileList] = useState<any[]>([]);
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });

  // CSI 来源类型选项
  const csiSourceOptions = [
    { value: 'CSI_EN', label: 'CSI 英文原版', description: 'CSI MasterFormat 英文标准模板' },
    { value: 'CSI_ZH', label: 'CSI 中文翻译', description: 'CSI MasterFormat 中文翻译版' },
    { value: 'COMPANY', label: '公司项目 SPEC', description: '公司历史项目的技术规范文档' },
  ];

  // 项目类型选项
  const projectTypeOptions = [
    { value: 'semiconductor', label: '半导体厂房' },
    { value: 'datacenter', label: '数据中心' },
    { value: 'pharmaceutical', label: '制药厂房' },
    { value: 'cleanroom', label: '洁净厂房' },
    { value: 'hospital', label: '医院' },
    { value: 'laboratory', label: '实验室' },
    { value: 'office', label: '办公楼' },
    { value: 'commercial', label: '商业建筑' },
    { value: 'industrial', label: '工业厂房' },
    { value: 'other', label: '其他' },
  ];

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

    // 添加 CSI 相关参数（技术规范模板）
    if (selectedType === 'spec') {
      if (values.sourceType) {
        formData.append('sourceType', values.sourceType);
      }
      if (values.projectType) {
        formData.append('projectType', values.projectType);
      }
      if (values.sourceType === 'COMPANY' && values.sourceProject) {
        formData.append('sourceProject', values.sourceProject);
      }
    }

    try {
      const response = await axios.post('/api/unified-document/templates', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        const successMsg = values.sourceType
          ? '模板上传成功，AI正在解析 CSI 结构...'
          : '模板上传成功，AI正在解析中...';
        message.success(successMsg);
        setUploadModalVisible(false);
        form.resetFields();
        setFileList([]);
        setCsiSourceType('');
        loadTemplates(selectedType);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '上传模板失败');
    }
  };

  // 批量上传处理
  const handleBatchUpload = async (values: any) => {
    if (batchFileList.length === 0) {
      message.error('请选择要上传的文件');
      return;
    }

    setBatchUploading(true);
    setBatchProgress({ current: 0, total: batchFileList.length, success: 0, failed: 0 });

    try {
      const formData = new FormData();
      // 模板名取文件夹名（从第一个文件的相对路径推断）
      const first = batchFileList[0] as any;
      const relPath = first?.webkitRelativePath || first?.path || first?.name;
      const rootName = relPath.includes('/') ? relPath.split('/')[0] : relPath.replace(/\.[^/.]+$/, '');
      formData.append('templateName', rootName);
      formData.append('sourceType', values.sourceType);
      if (values.projectType) {
        formData.append('projectType', values.projectType);
      }
      batchFileList.forEach((file: any) => {
        formData.append('files', file as File);
        formData.append('relativePaths', file.webkitRelativePath || file.path || file.name);
      });

      await axios.post('/api/unified-document/templates/batch-folder', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setBatchProgress({ current: batchFileList.length, total: batchFileList.length, success: batchFileList.length, failed: 0 });
      message.success(`批量上传完成！生成模板：${rootName}`);
    } catch (error) {
      console.error('批量上传失败', error);
      message.error('批量上传失败，请检查日志');
    } finally {
      setBatchUploading(false);
      setBatchUploadVisible(false);
      setBatchFileList([]);
      loadTemplates(selectedType);
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
              <Space>
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  onClick={() => setUploadModalVisible(true)}
                >
                  上传模板
                </Button>
                {selectedType === 'spec' && (
                  <Button
                    icon={<PlusOutlined />}
                    onClick={() => setBatchUploadVisible(true)}
                  >
                    批量导入
                  </Button>
                )}
              </Space>
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
          setCsiSourceType('');
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

          {/* CSI 来源类型选择 - 仅技术规范模板显示 */}
          {selectedType === 'spec' && (
            <>
              <Form.Item
                name="sourceType"
                label="SPEC 来源类型"
                rules={[{ required: true, message: '请选择来源类型' }]}
                tooltip="选择模板的来源类型，系统将根据类型进行不同的解析处理"
              >
                <Select
                  placeholder="请选择来源类型"
                  value={csiSourceType || undefined}
                  onChange={(value) => setCsiSourceType(value)}
                >
                  {csiSourceOptions.map(opt => (
                    <Select.Option key={opt.value} value={opt.value}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{opt.label}</span>
                        <span style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>{opt.description}</span>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              {/* 项目类型选择 */}
              <Form.Item
                name="projectType"
                label="项目类型"
                tooltip="选择项目类型，同类型项目的 SPEC 内容会比较相似，便于后续智能推荐"
              >
                <Select
                  placeholder="请选择项目类型"
                  allowClear
                >
                  {projectTypeOptions.map(opt => (
                    <Select.Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              {/* 公司项目名称 - 仅公司SPEC显示 */}
              {csiSourceType === 'COMPANY' && (
                <Form.Item
                  name="sourceProject"
                  label="来源项目名称"
                  rules={[{ required: true, message: '请输入来源项目名称' }]}
                >
                  <Input placeholder="例如：康桥二期项目、华虹项目" />
                </Form.Item>
              )}

              {/* 提示信息 */}
              {csiSourceType && (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message={
                    csiSourceType === 'CSI_EN' || csiSourceType === 'CSI_ZH'
                      ? 'CSI 标准模板将自动解析层级结构（PART/Article/Paragraph），并导入到标准框架库'
                      : '公司 SPEC 将通过 AI 自动匹配到 CSI 标准框架，无法匹配的内容将自动创建新章节'
                  }
                />
              )}
            </>
          )}

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
              {selectedType === 'spec' && csiSourceType
                ? 'CSI 模板建议使用 .docx 格式以保留样式信息'
                : '上传后系统将自动使用AI解析模板结构'
              }
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

      {/* 批量导入模态框 */}
      <Modal
        title="批量导入 CSI SPEC"
        open={batchUploadVisible}
        onCancel={() => {
          if (!batchUploading) {
            setBatchUploadVisible(false);
            setBatchFileList([]);
          }
        }}
        footer={null}
        width={700}
        closable={!batchUploading}
        maskClosable={!batchUploading}
      >
        <Form
          layout="vertical"
          onFinish={handleBatchUpload}
          initialValues={{ sourceType: 'CSI_EN' }}
        >
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="支持选择文件夹或多个文件批量导入，系统将自动解析 CSI 层级结构"
          />

          <Form.Item
            name="sourceType"
            label="SPEC 来源类型"
            rules={[{ required: true, message: '请选择来源类型' }]}
          >
            <Select>
              {csiSourceOptions.map(opt => (
                <Select.Option key={opt.value} value={opt.value}>
                  {opt.label} - {opt.description}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="projectType"
            label="项目类型"
          >
            <Select placeholder="请选择项目类型" allowClear>
              {projectTypeOptions.map(opt => (
                <Select.Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="选择文件" required>
            <Upload.Dragger
              multiple
              directory
              accept=".docx"
              beforeUpload={(file, fileList) => {
                // 过滤掉非 .docx 文件和隐藏文件
                const validFiles = fileList.filter(f =>
                  f.name.endsWith('.docx') && !f.name.startsWith('.')
                );
                setBatchFileList(prev => {
                  const existingNames = new Set(prev.map(f => f.name));
                  const newFiles = validFiles.filter(f => !existingNames.has(f.name));
                  return [...prev, ...newFiles];
                });
                return false;
              }}
              showUploadList={false}
              disabled={batchUploading}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined style={{ fontSize: 48, color: '#1890ff' }} />
              </p>
              <p className="ant-upload-text">点击或拖拽文件夹/文件到此区域</p>
              <p className="ant-upload-hint">支持选择整个文件夹，自动过滤 .docx 文件</p>
            </Upload.Dragger>

            {batchFileList.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>已选择 <strong>{batchFileList.length}</strong> 个文件</span>
                  {!batchUploading && (
                    <Button size="small" danger onClick={() => setBatchFileList([])}>
                      清空
                    </Button>
                  )}
                </div>
                <div style={{ maxHeight: 150, overflow: 'auto', background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                  {batchFileList.slice(0, 10).map((f, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#666' }}>
                      {f.name}
                    </div>
                  ))}
                  {batchFileList.length > 10 && (
                    <div style={{ fontSize: 12, color: '#999' }}>
                      ... 还有 {batchFileList.length - 10} 个文件
                    </div>
                  )}
                </div>
              </div>
            )}
          </Form.Item>

          {batchUploading && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8 }}>
                正在上传: {batchProgress.current} / {batchProgress.total}
                <span style={{ marginLeft: 16, color: '#52c41a' }}>成功: {batchProgress.success}</span>
                <span style={{ marginLeft: 8, color: '#ff4d4f' }}>失败: {batchProgress.failed}</span>
              </div>
              <div style={{
                height: 8,
                background: '#f0f0f0',
                borderRadius: 4,
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${(batchProgress.current / batchProgress.total) * 100}%`,
                  height: '100%',
                  background: '#1890ff',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>
          )}

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={batchUploading}
                disabled={batchFileList.length === 0}
              >
                {batchUploading ? `上传中 (${batchProgress.current}/${batchProgress.total})` : '开始导入'}
              </Button>
              <Button
                onClick={() => {
                  setBatchUploadVisible(false);
                  setBatchFileList([]);
                }}
                disabled={batchUploading}
              >
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
