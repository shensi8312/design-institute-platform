import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Popconfirm,
  Tag,
  Tooltip,
  Tabs,
  Upload,
  Alert,
  ColorPicker,
  Row,
  Col
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SettingOutlined,
  UploadOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import type { Color } from 'antd/es/color-picker';
import axios from '../utils/axios';
import * as XLSX from 'xlsx';

const { TextArea } = Input;
const { Option } = Select;

interface FabZone {
  id: string;
  zone_type: string;
  name: string;
  name_en: string;
  category: string;
  priority: number;
  min_height: number;
  default_height: number;
  color: string;
  area_ratio: number;
  default_floors: number;
  width_depth_ratio: number;
  properties: Record<string, any>;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const categoryOptions = [
  { value: 'production', label: '生产区', color: 'blue' },
  { value: 'utility', label: '动力区', color: 'orange' },
  { value: 'logistics', label: '物流区', color: 'green' },
  { value: 'admin', label: '办公区', color: 'purple' },
  { value: 'safety', label: '安全区', color: 'red' },
  { value: 'site', label: '场地设施', color: 'cyan' }
];

const FabZoneManagement: React.FC = () => {
  const [zones, setZones] = useState<FabZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingZone, setEditingZone] = useState<FabZone | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [form] = Form.useForm();

  const token = localStorage.getItem('token');
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  // 获取功能区列表
  const fetchZones = async () => {
    setLoading(true);
    try {
      const params = activeTab !== 'all' ? { category: activeTab } : {};
      const response = await axios.get('/api/fab-zone', { ...config, params });
      if (response.data.success) {
        setZones(response.data.data || []);
      }
    } catch (error: any) {
      message.error('获取功能区列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZones();
  }, [activeTab]);

  // 显示新增/编辑弹窗
  const showModal = (record?: FabZone) => {
    if (record) {
      setEditingZone(record);
      form.setFieldsValue({
        ...record,
        properties: JSON.stringify(record.properties || {}, null, 2)
      });
    } else {
      setEditingZone(null);
      form.resetFields();
      form.setFieldsValue({
        category: 'production',
        is_active: true,
        default_floors: 1,
        area_ratio: 0.1,
        default_height: 6,
        color: '#4a90d9'
      });
    }
    setModalVisible(true);
  };

  // 处理提交
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 处理颜色值
      if (values.color && typeof values.color === 'object') {
        values.color = values.color.toHexString();
      }

      // 处理properties JSON
      if (values.properties) {
        try {
          values.properties = JSON.parse(values.properties);
        } catch {
          values.properties = {};
        }
      }

      if (editingZone) {
        const response = await axios.put(`/api/fab-zone/${editingZone.id}`, values, config);
        if (response.data.success) {
          message.success('功能区更新成功');
        }
      } else {
        const response = await axios.post('/api/fab-zone', values, config);
        if (response.data.success) {
          message.success('功能区创建成功');
        }
      }
      setModalVisible(false);
      form.resetFields();
      fetchZones();
    } catch (error: any) {
      if (error.response) {
        message.error(error.response.data.error || '操作失败');
      }
    }
  };

  // 删除功能区
  const handleDelete = async (id: string) => {
    try {
      const response = await axios.delete(`/api/fab-zone/${id}`, config);
      if (response.data.success) {
        message.success('功能区删除成功');
        fetchZones();
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除失败');
    }
  };

  // Excel导入处理
  const handleExcelUpload: UploadProps['customRequest'] = async (options) => {
    const { file } = options;
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const fieldMap: Record<string, string> = {
          '功能区类型': 'zone_type',
          '中文名称': 'name',
          '英文名称': 'name_en',
          '分类': 'category',
          '面积比例': 'area_ratio',
          '默认高度': 'default_height',
          '默认层数': 'default_floors',
          '宽深比': 'width_depth_ratio',
          '显示颜色': 'color'
        };

        const mappedData = jsonData.map((row: any) => {
          const mapped: any = {};
          Object.entries(row).forEach(([key, value]) => {
            const mappedKey = fieldMap[key] || key;
            mapped[mappedKey] = value;
          });
          return mapped;
        });

        setImportPreview(mappedData);
        setImportModalVisible(true);
        message.success(`已解析 ${mappedData.length} 条记录`);
      } catch (error) {
        message.error('Excel文件解析失败');
      }
    };

    reader.readAsBinaryString(file as Blob);
  };

  // 执行导入
  const handleImport = async () => {
    if (importPreview.length === 0) {
      message.warning('没有可导入的数据');
      return;
    }

    setImporting(true);
    try {
      const response = await axios.post('/api/fab-zone/import', { zones: importPreview }, config);
      if (response.data.success) {
        const { created, updated, errors } = response.data.data;
        message.success(`导入完成：新增 ${created} 条，更新 ${updated} 条${errors.length > 0 ? `，失败 ${errors.length} 条` : ''}`);
        setImportModalVisible(false);
        setImportPreview([]);
        fetchZones();
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  // 下载模板
  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get('/api/fab-zone/template', config);
      if (response.data.success) {
        const template = response.data.data;
        const wb = XLSX.utils.book_new();
        const headers = template.columns.map((col: any) => col.label);
        const sampleRows = template.sample_data.map((row: any) =>
          template.columns.map((col: any) => {
            const val = row[col.field];
            return typeof val === 'object' ? JSON.stringify(val) : val;
          })
        );
        const wsData = [headers, ...sampleRows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'FAB功能区配置');
        XLSX.writeFile(wb, 'FAB功能区导入模板.xlsx');
        message.success('模板已下载');
      }
    } catch (error) {
      message.error('下载模板失败');
    }
  };

  // 获取分类标签颜色
  const getCategoryTag = (category: string) => {
    const opt = categoryOptions.find(o => o.value === category);
    return opt ? <Tag color={opt.color}>{opt.label}</Tag> : <Tag>{category}</Tag>;
  };

  // 表格列定义
  const columns: ColumnsType<FabZone> = [
    {
      title: '功能区类型',
      dataIndex: 'zone_type',
      key: 'zone_type',
      width: 120,
      render: (text, record) => (
        <Space>
          <span style={{
            display: 'inline-block',
            width: 12,
            height: 12,
            backgroundColor: record.color,
            borderRadius: 2
          }} />
          <Tag color="blue">{text}</Tag>
        </Space>
      )
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (text, record) => (
        <Tooltip title={record.name_en}>
          {text}
        </Tooltip>
      )
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (text) => getCategoryTag(text)
    },
    {
      title: '面积比例',
      dataIndex: 'area_ratio',
      key: 'area_ratio',
      width: 100,
      render: (value) => <span style={{ color: '#1890ff' }}>{(Number(value) * 100).toFixed(0)}%</span>
    },
    {
      title: '默认高度',
      dataIndex: 'default_height',
      key: 'default_height',
      width: 100,
      render: (value) => `${value}m`
    },
    {
      title: '默认层数',
      dataIndex: 'default_floors',
      key: 'default_floors',
      width: 80
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (active) => (
        <Tag color={active ? 'green' : 'default'}>
          {active ? '启用' : '禁用'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="link" icon={<EditOutlined />} onClick={() => showModal(record)} />
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
      )
    }
  ];

  // 按分类统计
  const getStats = () => {
    const stats: Record<string, number> = { all: zones.length };
    zones.forEach(z => {
      stats[z.category] = (stats[z.category] || 0) + 1;
    });
    return stats;
  };

  const stats = getStats();

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <AppstoreOutlined />
            <span>FAB功能区配置</span>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchZones}>刷新</Button>
            <Upload accept=".xlsx,.xls" showUploadList={false} customRequest={handleExcelUpload}>
              <Button icon={<UploadOutlined />}>Excel导入</Button>
            </Upload>
            <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>下载模板</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>
              新增功能区
            </Button>
          </Space>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'all', label: <span>全部 <Tag>{stats.all || 0}</Tag></span> },
            ...categoryOptions.map(cat => ({
              key: cat.value,
              label: <span>{cat.label} <Tag color={cat.color}>{stats[cat.value] || 0}</Tag></span>
            }))
          ]}
        />
        <Table
          columns={columns}
          dataSource={zones}
          rowKey="id"
          loading={loading}
          pagination={{ showSizeChanger: true, showQuickJumper: true, showTotal: (total) => `共 ${total} 条` }}
          size="middle"
        />
      </Card>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingZone ? '编辑功能区' : '新增功能区'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => { setModalVisible(false); form.resetFields(); }}
        width={700}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="zone_type" label="功能区类型" rules={[{ required: true, message: '请输入功能区类型' }]}>
                <Input placeholder="如：cleanroom" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="分类" rules={[{ required: true }]}>
                <Select>
                  {categoryOptions.map(opt => (
                    <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="中文名称" rules={[{ required: true, message: '请输入中文名称' }]}>
                <Input placeholder="如：洁净室" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name_en" label="英文名称">
                <Input placeholder="如：Cleanroom" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="area_ratio" label="面积比例(相对洁净室)">
                <InputNumber min={0} max={10} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="default_height" label="默认高度(m)">
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="default_floors" label="默认层数">
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="width_depth_ratio" label="宽深比">
                <InputNumber min={0.1} max={10} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="color" label="显示颜色">
                <ColorPicker showText />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="sort_order" label="排序">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="properties" label="扩展属性(JSON)">
            <TextArea rows={3} placeholder='{"cleanroom_class": "ISO 5"}' />
          </Form.Item>
        </Form>
      </Modal>

      {/* 导入预览弹窗 */}
      <Modal
        title="Excel导入预览"
        open={importModalVisible}
        onOk={handleImport}
        onCancel={() => { setImportModalVisible(false); setImportPreview([]); }}
        width={900}
        okText="确认导入"
        cancelText="取消"
        confirmLoading={importing}
      >
        <Alert
          message="数据预览"
          description={`共解析 ${importPreview.length} 条记录。已存在的功能区将被更新，新功能区将被创建。`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Table
          dataSource={importPreview}
          columns={[
            { title: '功能区类型', dataIndex: 'zone_type', width: 100 },
            { title: '名称', dataIndex: 'name', width: 100 },
            { title: '分类', dataIndex: 'category', width: 80, render: (v) => getCategoryTag(v) },
            { title: '面积比例', dataIndex: 'area_ratio', width: 80 },
            { title: '默认高度', dataIndex: 'default_height', width: 80 },
            { title: '颜色', dataIndex: 'color', width: 80, render: (v) => <span style={{ display: 'inline-block', width: 20, height: 20, backgroundColor: v, borderRadius: 4 }} /> }
          ]}
          rowKey={(r, i) => `${r.zone_type}-${i}`}
          size="small"
          pagination={{ pageSize: 10 }}
          scroll={{ y: 400 }}
        />
      </Modal>
    </div>
  );
};

export default FabZoneManagement;
