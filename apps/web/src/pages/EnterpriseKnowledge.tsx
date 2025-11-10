import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Upload,
  message,
  Input,
  Tag,
  Modal,
  Progress,
  List,
  Row,
  Col,
  Form,
  Empty,
  Dropdown,
  Select,
  Radio
} from 'antd';
import type { MenuProps } from 'antd';
import {
  UploadOutlined,
  SearchOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileTextOutlined,
  ReloadOutlined,
  InboxOutlined,
  TeamOutlined,
  PlusOutlined,
  FolderOutlined,
  EditOutlined,
  EllipsisOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  GlobalOutlined,
  BankOutlined,
  ProjectOutlined,
  UserOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axios from '../utils/axios';

const { Search } = Input;
const { Dragger } = Upload;

interface Document {
  id: string;
  title: string;
  name: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: string;
  vector_status: string;
  graph_status: string;
  minio_path: string;
  created_at: string;
  tags: string[];
}

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  permission_level: string;
  document_count: number;
  created_at: string;
  created_by: string;
  owner_department_id?: string;
  project_id?: string;
}

const EnterpriseKnowledge: React.FC = () => {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null);
  const [createKbModalVisible, setCreateKbModalVisible] = useState(false);
  const [editKbModalVisible, setEditKbModalVisible] = useState(false);
  const [editingKb, setEditingKb] = useState<KnowledgeBase | null>(null);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDomain, setUploadDomain] = useState<string>('architecture'); // 领域选择
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [permissionType, setPermissionType] = useState<string>('organization');
  const [departments, setDepartments] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  const token = localStorage.getItem('token');
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  // 获取部门列表
  const fetchDepartments = async () => {
    try {
      const response = await axios.get('/api/departments', config);
      if (response.data.success) {
        setDepartments(response.data.data.list || []);
      }
    } catch (error: any) {
      console.error('获取部门列表失败:', error);
    }
  };

  // 获取项目列表
  const fetchProjects = async () => {
    try {
      const response = await axios.get('/api/projects', config);
      if (response.data.success) {
        setProjects(response.data.data.list || []);
      }
    } catch (error: any) {
      console.error('获取项目列表失败:', error);
    }
  };

  // 获取知识库列表（排除个人知识库）
  const fetchKnowledgeBases = async () => {
    try {
      const response = await axios.get('/api/knowledge/bases', config);
      if (response.data.success) {
        // 只显示企业、部门、项目级别的知识库，排除个人知识库
        const bases = (response.data.data || []).filter(
          (kb: KnowledgeBase) => kb.permission_level !== 'personal'
        );
        setKnowledgeBases(bases);

        // 默认选中第一个知识库
        if (bases.length > 0 && !selectedKbId) {
          setSelectedKbId(bases[0].id);
        }
      }
    } catch (error: any) {
      message.error('获取知识库列表失败');
    }
  };

  // 获取文档列表
  const fetchDocuments = async (page = 1, pageSize = 10, search = '') => {
    if (!selectedKbId) {
      setDocuments([]);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get('/api/knowledge/documents', {
        ...config,
        params: {
          page,
          pageSize,
          search,
          kb_id: selectedKbId
        }
      });

      if (response.data.success) {
        setDocuments(response.data.data.list || []);
        setPagination({
          page: response.data.data.pagination?.page || 1,
          pageSize: response.data.data.pagination?.pageSize || 10,
          total: response.data.data.pagination?.total || 0
        });
      }
    } catch (error: any) {
      message.error('获取文档列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledgeBases();
    fetchDepartments();
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedKbId) {
      fetchDocuments();
      // 每5秒刷新一次文档列表,查看处理进度
      const interval = setInterval(() => {
        fetchDocuments(pagination.page, pagination.pageSize, searchText);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedKbId]);

  // 创建知识库
  const handleCreateKb = async (values: any) => {
    try {
      const response = await axios.post('/api/knowledge/bases', {
        ...values,
        enable_vector: true,
        enable_graph: true
      }, config);
      if (response.data.success) {
        message.success('创建知识库成功');
        setCreateKbModalVisible(false);
        form.resetFields();
        await fetchKnowledgeBases();

        // 自动选中新创建的知识库
        if (response.data.data.id) {
          setSelectedKbId(response.data.data.id);
        }
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建知识库失败');
    }
  };

  // 编辑知识库
  const openEditModal = (kb: KnowledgeBase) => {
    setEditingKb(kb);
    setPermissionType(kb.permission_level || 'organization');
    editForm.setFieldsValue({
      name: kb.name,
      description: kb.description,
      permission_level: kb.permission_level,
      department_id: kb.owner_department_id,
      project_id: kb.project_id
    });
    setEditKbModalVisible(true);
  };

  const handleEditKnowledgeBase = async (values: any) => {
    if (!editingKb) return;

    try {
      const response = await axios.put(`/api/knowledge/bases/${editingKb.id}`, values, config);

      if (response.data.success) {
        message.success('知识库更新成功');
        setEditKbModalVisible(false);
        setEditingKb(null);
        editForm.resetFields();
        await fetchKnowledgeBases();
      }
    } catch (error: any) {
      message.error('更新知识库失败');
    }
  };

  // 删除知识库
  const handleDeleteKnowledgeBase = async (id: string, name: string) => {
    Modal.confirm({
      title: '确定删除知识库？',
      content: `删除"${name}"后，其中的所有文档也将被删除，此操作不可恢复`,
      okText: '确定删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await axios.delete(`/api/knowledge/bases/${id}`, config);
          if (response.data.success) {
            message.success('知识库删除成功');
            if (selectedKbId === id) {
              setSelectedKbId(null);
            }
            await fetchKnowledgeBases();
          }
        } catch (error: any) {
          message.error('删除知识库失败');
        }
      }
    });
  };

  // 知识库菜单
  const getKnowledgeBaseMenu = (kb: KnowledgeBase): MenuProps => ({
    items: [
      {
        key: 'edit',
        icon: <EditOutlined />,
        label: '编辑知识库',
        onClick: () => openEditModal(kb)
      },
      {
        key: 'delete',
        danger: true,
        icon: <DeleteOutlined />,
        label: '删除知识库',
        onClick: () => handleDeleteKnowledgeBase(kb.id, kb.name)
      }
    ]
  });

  // 搜索文档
  const handleSearch = (value: string) => {
    setSearchText(value);
    fetchDocuments(1, pagination.pageSize, value);
  };

  // 删除文档
  const handleDelete = async (id: string) => {
    try {
      const response = await axios.delete(`/api/knowledge/documents/${id}`, config);
      if (response.data.success) {
        message.success('删除成功');
        fetchDocuments(pagination.page, pagination.pageSize, searchText);
        fetchKnowledgeBases();
      }
    } catch (error: any) {
      message.error('删除失败');
    }
  };

  // 预览文档
  const handlePreviewDocument = async (record: Document) => {
    try {
      const previewUrl = `/preview/${record.id}`;
      const previewWindow = window.open(previewUrl, '_blank', 'noopener,noreferrer');

      if (!previewWindow) {
        message.error('预览窗口被浏览器拦截,请允许弹出窗口');
      }
    } catch (error: any) {
      message.error('预览失败');
    }
  };

  // 下载文档
  const handleDownloadDocument = async (record: Document) => {
    try {
      const downloadUrl = `/api/knowledge/documents/${record.id}/download`;
      window.open(downloadUrl, '_blank');
    } catch (error: any) {
      message.error('下载失败');
    }
  };

  // 重新处理文档
  const handleReprocess = async (id: string) => {
    try {
      const response = await axios.post(`/api/knowledge/documents/${id}/reprocess`, {}, config);
      if (response.data.success) {
        message.success('已提交重新处理任务');
        setTimeout(() => {
          fetchDocuments(pagination.page, pagination.pageSize, searchText);
        }, 1000);
      }
    } catch (error: any) {
      message.error('提交失败');
    }
  };

  // 文档上传配置
  const uploadProps = {
    name: 'file',
    multiple: true,
    action: '/api/knowledge/documents/upload',
    headers: {
      Authorization: `Bearer ${token}`
    },
    data: {
      kb_id: selectedKbId,
      permission_level: 'organization',
      domain: uploadDomain // 添加领域参数
    },
    onChange(info: any) {
      const { status } = info.file;
      if (status === 'uploading') {
        setUploadProgress(Math.round((info.file.percent || 0)));
      }
      if (status === 'done') {
        message.success(`${info.file.name} 上传成功`);
        setUploadProgress(100);
        setTimeout(() => {
          setUploadModalVisible(false);
          setUploadProgress(0);
          fetchDocuments(pagination.page, pagination.pageSize, searchText);
          fetchKnowledgeBases();
        }, 1000);
      } else if (status === 'error') {
        message.error(`${info.file.name} 上传失败`);
        setUploadProgress(0);
      }
    }
  };

  const columns: ColumnsType<Document> = [
    {
      title: '文档名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      width: 250,
      render: (text, record) => (
        <Space>
          <FileTextOutlined />
          <a onClick={() => handlePreviewDocument(record)} style={{ color: '#1890ff' }}>
            {text || record.title || record.filename}
          </a>
        </Space>
      )
    },
    {
      title: '类型',
      dataIndex: 'file_type',
      key: 'file_type',
      width: 80,
      render: (type) => {
        const typeMap: Record<string, string> = {
          'application/pdf': 'PDF',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPT',
          'text/plain': 'TXT',
          'image/png': 'PNG',
          'image/jpeg': 'JPG',
          'image/jpg': 'JPG'
        };
        const displayType = typeMap[type] || type?.split('/')[1]?.toUpperCase() || 'File';
        return <Tag color="blue">{displayType}</Tag>;
      }
    },
    {
      title: '大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 100,
      render: (size) => `${((size || 0) / 1024).toFixed(2)} KB`
    },
    {
      title: 'MinIO',
      key: 'minio_status',
      width: 80,
      align: 'center',
      render: (_, record) => {
        if (record.minio_path) {
          return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />;
        }
        return <ClockCircleOutlined style={{ color: '#d9d9d9', fontSize: 18 }} />;
      }
    },
    {
      title: '向量化',
      dataIndex: 'vector_status',
      key: 'vector_status',
      width: 80,
      align: 'center',
      render: (status) => {
        if (status === 'completed') {
          return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />;
        } else if (status === 'processing') {
          return <SyncOutlined spin style={{ color: '#1890ff', fontSize: 18 }} />;
        } else if (status === 'failed') {
          return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />;
        }
        return <ClockCircleOutlined style={{ color: '#d9d9d9', fontSize: 18 }} />;
      }
    },
    {
      title: '知识图谱',
      dataIndex: 'graph_status',
      key: 'graph_status',
      width: 90,
      align: 'center',
      render: (status) => {
        if (status === 'completed') {
          return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />;
        } else if (status === 'processing') {
          return <SyncOutlined spin style={{ color: '#1890ff', fontSize: 18 }} />;
        } else if (status === 'failed') {
          return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />;
        }
        return <ClockCircleOutlined style={{ color: '#d9d9d9', fontSize: 18 }} />;
      }
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          {(record.vector_status === 'failed' || record.graph_status === 'failed') && (
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleReprocess(record.id)}
            >
              重试
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleDownloadDocument(record)}
          >
            下载
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确定删除？',
                content: '删除后不可恢复',
                onOk: () => handleDelete(record.id)
              });
            }}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  const selectedKb = knowledgeBases.find(kb => kb.id === selectedKbId);

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <TeamOutlined />
            <span>企业知识库</span>
          </Space>
        }
      >
        <Row gutter={16}>
          {/* 左侧：知识库列表 */}
          <Col span={6}>
            <Card
              title="企业知识库"
              size="small"
              extra={
                <Button
                  type="link"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateKbModalVisible(true)}
                >
                  新建
                </Button>
              }
              style={{ height: '100%' }}
            >
              {knowledgeBases.length === 0 ? (
                <Empty
                  description="暂无知识库"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => setCreateKbModalVisible(true)}
                  >
                    创建知识库
                  </Button>
                </Empty>
              ) : (
                <List
                  dataSource={knowledgeBases}
                  renderItem={(kb) => (
                    <List.Item
                      key={kb.id}
                      onClick={() => setSelectedKbId(kb.id)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: kb.id === selectedKbId ? '#e6f7ff' : 'transparent',
                        padding: '12px',
                        borderRadius: '4px',
                        marginBottom: '4px',
                        position: 'relative'
                      }}
                    >
                      <List.Item.Meta
                        avatar={<FolderOutlined style={{ fontSize: '24px', color: kb.id === selectedKbId ? '#1890ff' : '#8c8c8c' }} />}
                        title={
                          <Space>
                            <span style={{ fontWeight: kb.id === selectedKbId ? 600 : 400 }}>
                              {kb.name}
                            </span>
                            <Tag color="blue" style={{ fontSize: '12px' }}>
                              {kb.document_count || 0}
                            </Tag>
                            {kb.permission_level === 'organization' && <Tag color="green" icon={<GlobalOutlined />}>全企业</Tag>}
                            {kb.permission_level === 'department' && <Tag color="orange" icon={<BankOutlined />}>部门</Tag>}
                            {kb.permission_level === 'project' && <Tag color="cyan" icon={<ProjectOutlined />}>项目</Tag>}
                            {kb.permission_level === 'personal' && <Tag color="default" icon={<UserOutlined />}>私有</Tag>}
                          </Space>
                        }
                        description={
                          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                            {kb.description || '暂无描述'}
                          </div>
                        }
                      />
                      <Dropdown menu={getKnowledgeBaseMenu(kb)} trigger={['click']} placement="bottomRight">
                        <Button
                          type="text"
                          size="small"
                          icon={<EllipsisOutlined />}
                          onClick={(e) => e.stopPropagation()}
                          style={{ position: 'absolute', right: 8, top: 8 }}
                        />
                      </Dropdown>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>

          {/* 右侧：文档列表 */}
          <Col span={18}>
            <Card
              title={
                <Space>
                  <FolderOutlined />
                  <span>{selectedKb?.name || '请选择知识库'}</span>
                </Space>
              }
              size="small"
              extra={
                <Space>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => fetchDocuments(pagination.page, pagination.pageSize, searchText)}
                    disabled={!selectedKbId}
                  >
                    刷新
                  </Button>
                  <Button
                    type="primary"
                    icon={<UploadOutlined />}
                    onClick={() => {
                      if (!selectedKbId) {
                        message.warning('请先选择知识库');
                        return;
                      }
                      setUploadModalVisible(true);
                    }}
                    disabled={!selectedKbId}
                  >
                    上传文档
                  </Button>
                </Space>
              }
            >
              <div style={{ marginBottom: 16 }}>
                <Search
                  placeholder="搜索文档"
                  allowClear
                  enterButton={<SearchOutlined />}
                  onSearch={handleSearch}
                  disabled={!selectedKbId}
                  style={{ width: '100%' }}
                />
              </div>

              {!selectedKbId ? (
                <Empty
                  description="请从左侧选择或创建知识库"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  style={{ marginTop: 60 }}
                />
              ) : (
                <Table
                  columns={columns}
                  dataSource={documents}
                  rowKey="id"
                  loading={loading}
                  scroll={{ x: 1200 }}
                  pagination={{
                    current: pagination.page,
                    pageSize: pagination.pageSize,
                    total: pagination.total,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `共 ${total} 个文档`,
                    onChange: (page, pageSize) => fetchDocuments(page, pageSize, searchText)
                  }}
                />
              )}
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 创建知识库Modal */}
      <Modal
        title="创建企业知识库"
        open={createKbModalVisible}
        onCancel={() => {
          setCreateKbModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="创建"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateKb} initialValues={{ permission_level: 'organization' }}>
          <Form.Item
            label="知识库名称"
            name="name"
            rules={[{ required: true, message: '请输入知识库名称' }]}
          >
            <Input placeholder="例如：设计规范库、技术标准库" />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
          >
            <Input.TextArea rows={2} placeholder="简单描述这个知识库的用途" />
          </Form.Item>

          <Form.Item
            label="权限范围"
            name="permission_level"
            rules={[{ required: true, message: '请选择权限范围' }]}
          >
            <Radio.Group
              onChange={(e) => {
                setPermissionType(e.target.value);
                form.setFieldsValue({
                  permission_level: e.target.value,
                  department_id: undefined,
                  project_id: undefined
                });
              }}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Radio value="organization">
                  <Space>
                    <GlobalOutlined style={{ color: '#52c41a' }} />
                    <span style={{ fontWeight: 500 }}>全企业公开</span>
                    <span style={{ color: '#8c8c8c', fontSize: '12px' }}>所有员工可见</span>
                  </Space>
                </Radio>
                <Radio value="department">
                  <Space>
                    <BankOutlined style={{ color: '#fa8c16' }} />
                    <span style={{ fontWeight: 500 }}>部门可见</span>
                    <span style={{ color: '#8c8c8c', fontSize: '12px' }}>指定部门成员可见</span>
                  </Space>
                </Radio>
                <Radio value="project">
                  <Space>
                    <ProjectOutlined style={{ color: '#1890ff' }} />
                    <span style={{ fontWeight: 500 }}>项目可见</span>
                    <span style={{ color: '#8c8c8c', fontSize: '12px' }}>指定项目成员可见</span>
                  </Space>
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          {permissionType === 'department' && (
            <Form.Item
              label="选择部门"
              name="department_id"
              rules={[{ required: true, message: '请选择部门' }]}
            >
              <Select
                placeholder="请选择哪个部门可以访问"
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={departments.map(dept => ({
                  label: dept.name,
                  value: dept.id
                }))}
              />
            </Form.Item>
          )}

          {permissionType === 'project' && (
            <Form.Item
              label="选择项目"
              name="project_id"
              rules={[{ required: true, message: '请选择项目' }]}
            >
              <Select
                placeholder="请选择哪个项目可以访问"
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={projects.map(proj => ({
                  label: proj.name,
                  value: proj.id
                }))}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 编辑知识库Modal */}
      <Modal
        title="编辑知识库"
        open={editKbModalVisible}
        onCancel={() => {
          setEditKbModalVisible(false);
          setEditingKb(null);
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEditKnowledgeBase}
        >
          <Form.Item
            label="知识库名称"
            name="name"
            rules={[{ required: true, message: '请输入知识库名称' }]}
          >
            <Input placeholder="例如：设计规范库、技术标准库" />
          </Form.Item>
          <Form.Item
            label="描述"
            name="description"
          >
            <Input.TextArea
              rows={2}
              placeholder="简单描述这个知识库的用途"
            />
          </Form.Item>

          <Form.Item
            label="权限范围"
            name="permission_level"
            rules={[{ required: true, message: '请选择权限范围' }]}
          >
            <Radio.Group
              onChange={(e) => {
                setPermissionType(e.target.value);
                editForm.setFieldsValue({
                  permission_level: e.target.value,
                  department_id: undefined,
                  project_id: undefined
                });
              }}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Radio value="organization">
                  <Space>
                    <GlobalOutlined style={{ color: '#52c41a' }} />
                    <span style={{ fontWeight: 500 }}>全企业公开</span>
                    <span style={{ color: '#8c8c8c', fontSize: '12px' }}>所有员工可见</span>
                  </Space>
                </Radio>
                <Radio value="department">
                  <Space>
                    <BankOutlined style={{ color: '#fa8c16' }} />
                    <span style={{ fontWeight: 500 }}>部门可见</span>
                    <span style={{ color: '#8c8c8c', fontSize: '12px' }}>指定部门成员可见</span>
                  </Space>
                </Radio>
                <Radio value="project">
                  <Space>
                    <ProjectOutlined style={{ color: '#1890ff' }} />
                    <span style={{ fontWeight: 500 }}>项目可见</span>
                    <span style={{ color: '#8c8c8c', fontSize: '12px' }}>指定项目成员可见</span>
                  </Space>
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          {permissionType === 'department' && (
            <Form.Item
              label="选择部门"
              name="department_id"
              rules={[{ required: true, message: '请选择部门' }]}
            >
              <Select
                placeholder="请选择哪个部门可以访问"
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={departments.map(dept => ({
                  label: dept.name,
                  value: dept.id
                }))}
              />
            </Form.Item>
          )}

          {permissionType === 'project' && (
            <Form.Item
              label="选择项目"
              name="project_id"
              rules={[{ required: true, message: '请选择项目' }]}
            >
              <Select
                placeholder="请选择哪个项目可以访问"
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={projects.map(proj => ({
                  label: proj.name,
                  value: proj.id
                }))}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 上传文档Modal */}
      <Modal
        title={`上传文档到 ${selectedKb?.name || '知识库'}`}
        open={uploadModalVisible}
        onCancel={() => {
          setUploadModalVisible(false);
          setUploadProgress(0);
          setUploadDomain('architecture'); // 重置领域选择
        }}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>选择领域：</div>
          <Radio.Group
            value={uploadDomain}
            onChange={(e) => setUploadDomain(e.target.value)}
            style={{ width: '100%' }}
          >
            <Radio.Button value="architecture" style={{ width: '50%', textAlign: 'center' }}>
              🏗️ 建筑设计
            </Radio.Button>
            <Radio.Button value="mechanical" style={{ width: '50%', textAlign: 'center' }}>
              ⚙️ 机械设计
            </Radio.Button>
          </Radio.Group>
          <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
            {uploadDomain === 'architecture'
              ? '识别：墙体、柱、梁、楼板、门、窗等建筑构件'
              : '识别：轴、轴承、齿轮、螺栓、螺母、键等机械零件'
            }
          </div>
        </div>
        <Dragger {...uploadProps}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持单个或批量上传。支持PDF、Word、Excel、PPT等格式
          </p>
        </Dragger>
        {uploadProgress > 0 && (
          <div style={{ marginTop: 16 }}>
            <Progress percent={uploadProgress} status={uploadProgress === 100 ? 'success' : 'active'} />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EnterpriseKnowledge;
