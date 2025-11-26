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
  Descriptions,
  Upload,
  Alert
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  UploadOutlined,
  DownloadOutlined,
  FileExcelOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import axios from '../utils/axios';
import * as XLSX from 'xlsx';

const { TextArea } = Input;
const { Option } = Select;

interface UMConfig {
  id: string;
  config_type: string;
  config_key: string;
  config_name: string;
  value: number;
  unit: string;
  description: string;
  formula: string;
  source: string;
  standard: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface ConfigType {
  key: string;
  name: string;
  description: string;
}

const UMTableManagement: React.FC = () => {
  const [configs, setConfigs] = useState<UMConfig[]>([]);
  const [groupedConfigs, setGroupedConfigs] = useState<Record<string, UMConfig[]>>({});
  const [configTypes, setConfigTypes] = useState<ConfigType[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConfig, setEditingConfig] = useState<UMConfig | null>(null);
  const [activeTab, setActiveTab] = useState('tech_coefficient');
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [form] = Form.useForm();

  const token = localStorage.getItem('token');
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  // 获取配置类型列表
  const fetchConfigTypes = async () => {
    try {
      const response = await axios.get('/api/um-table/types', config);
      if (response.data.success) {
        setConfigTypes(response.data.data);
        if (response.data.data.length > 0) {
          setActiveTab(response.data.data[0].key);
        }
      }
    } catch (error: any) {
      console.error('获取配置类型失败:', error);
    }
  };

  // 获取配置列表
  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/um-table', config);
      if (response.data.success) {
        setConfigs(response.data.data.list || []);
        setGroupedConfigs(response.data.data.grouped || {});
      }
    } catch (error: any) {
      message.error('获取配置列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigTypes();
    fetchConfigs();
  }, []);

  // 显示新增/编辑弹窗
  const showModal = (record?: UMConfig) => {
    if (record) {
      setEditingConfig(record);
      form.setFieldsValue({
        config_type: record.config_type,
        config_key: record.config_key,
        config_name: record.config_name,
        value: record.value,
        unit: record.unit,
        description: record.description,
        formula: record.formula,
        source: record.source,
        standard: record.standard
      });
    } else {
      setEditingConfig(null);
      form.resetFields();
      form.setFieldsValue({
        config_type: activeTab
      });
    }
    setModalVisible(true);
  };

  // 处理提交
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingConfig) {
        const response = await axios.put(
          `/api/um-table/${editingConfig.id}`,
          values,
          config
        );
        if (response.data.success) {
          message.success('配置更新成功');
        }
      } else {
        const response = await axios.post('/api/um-table', values, config);
        if (response.data.success) {
          message.success('配置创建成功');
        }
      }
      setModalVisible(false);
      form.resetFields();
      fetchConfigs();
    } catch (error: any) {
      if (error.response) {
        message.error(error.response.data.error || '操作失败');
      }
    }
  };

  // 删除配置
  const handleDelete = async (id: string) => {
    try {
      const response = await axios.delete(`/api/um-table/${id}`, config);
      if (response.data.success) {
        message.success('配置删除成功');
        fetchConfigs();
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除失败');
    }
  };

  // 获取配置类型名称
  const getTypeName = (type: string) => {
    const found = configTypes.find(t => t.key === type);
    return found ? found.name : type;
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

        // 字段映射（支持中英文列名）
        const fieldMap: Record<string, string> = {
          '配置类型': 'config_type',
          '配置键': 'config_key',
          '配置名称': 'config_name',
          '数值': 'value',
          '单位': 'unit',
          '计算公式': 'formula',
          '说明': 'description',
          '数据来源': 'source',
          '参考标准': 'standard'
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
      const response = await axios.post('/api/um-table/import', { configs: importPreview }, config);
      if (response.data.success) {
        const { created, updated, errors } = response.data.data;
        message.success(`导入完成：新增 ${created} 条，更新 ${updated} 条${errors.length > 0 ? `，失败 ${errors.length} 条` : ''}`);
        setImportModalVisible(false);
        setImportPreview([]);
        fetchConfigs();
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  // 下载Excel模板
  const handleDownloadTemplate = async () => {
    try {
      const response = await axios.get('/api/um-table/template', config);
      if (response.data.success) {
        const template = response.data.data;

        // 创建工作簿
        const wb = XLSX.utils.book_new();

        // 创建示例数据sheet
        const headers = template.columns.map((col: any) => col.label);
        const sampleRows = template.sample_data.map((row: any) =>
          template.columns.map((col: any) => row[col.field] || '')
        );
        const wsData = [headers, ...sampleRows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'UM表配置');

        // 下载
        XLSX.writeFile(wb, 'UM表导入模板.xlsx');
        message.success('模板已下载');
      }
    } catch (error) {
      message.error('下载模板失败');
    }
  };

  // 导出当前配置
  const handleExport = async () => {
    try {
      const response = await axios.get('/api/um-table/export', config);
      if (response.data.success) {
        const data = response.data.data;

        // 创建工作簿
        const wb = XLSX.utils.book_new();
        const headers = ['配置类型', '配置键', '配置名称', '数值', '单位', '计算公式', '说明', '数据来源', '参考标准'];
        const rows = data.map((item: any) => [
          item.config_type,
          item.config_key,
          item.config_name,
          item.value,
          item.unit,
          item.formula,
          item.description,
          item.source,
          item.standard
        ]);

        const wsData = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'UM表配置');

        XLSX.writeFile(wb, `UM表配置_${new Date().toISOString().slice(0, 10)}.xlsx`);
        message.success('导出成功');
      }
    } catch (error) {
      message.error('导出失败');
    }
  };

  // 表格列定义
  const columns: ColumnsType<UMConfig> = [
    {
      title: '配置键',
      dataIndex: 'config_key',
      key: 'config_key',
      width: 120,
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '配置名称',
      dataIndex: 'config_name',
      key: 'config_name',
      width: 150
    },
    {
      title: '数值',
      dataIndex: 'value',
      key: 'value',
      width: 100,
      render: (value, record) => (
        <span style={{ fontWeight: 600, color: '#1890ff' }}>
          {value} {record.unit}
        </span>
      )
    },
    {
      title: '计算公式',
      dataIndex: 'formula',
      key: 'formula',
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <span style={{ color: '#666' }}>{text || '-'}</span>
        </Tooltip>
      )
    },
    {
      title: '数据来源',
      dataIndex: 'source',
      key: 'source',
      width: 120,
      render: (text) => <Tag>{text || '行业经验值'}</Tag>
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
      )
    }
  ];

  // 渲染配置类型说明
  const renderTypeDescription = (type: string) => {
    const found = configTypes.find(t => t.key === type);
    if (!found) return null;

    return (
      <Descriptions size="small" column={1} style={{ marginBottom: 16 }}>
        <Descriptions.Item label={<><InfoCircleOutlined /> 说明</>}>
          {found.description}
        </Descriptions.Item>
      </Descriptions>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>UM表配置管理</span>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchConfigs}>
              刷新
            </Button>
            <Upload
              accept=".xlsx,.xls"
              showUploadList={false}
              customRequest={handleExcelUpload}
            >
              <Button icon={<UploadOutlined />}>
                Excel导入
              </Button>
            </Upload>
            <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
              下载模板
            </Button>
            <Button icon={<FileExcelOutlined />} onClick={handleExport}>
              导出
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => showModal()}
            >
              新增配置
            </Button>
          </Space>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={configTypes.map(type => ({
            key: type.key,
            label: (
              <span>
                {type.name}
                <Tag style={{ marginLeft: 8 }} color="blue">
                  {(groupedConfigs[type.key] || []).length}
                </Tag>
              </span>
            ),
            children: (
              <>
                {renderTypeDescription(type.key)}
                <Table
                  columns={columns}
                  dataSource={groupedConfigs[type.key] || []}
                  rowKey="id"
                  loading={loading}
                  pagination={{
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `共 ${total} 条`
                  }}
                  size="middle"
                />
              </>
            )
          }))}
        />
      </Card>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingConfig ? '编辑配置' : '新增配置'}
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
            name="config_type"
            label="配置类型"
            rules={[{ required: true, message: '请选择配置类型' }]}
          >
            <Select placeholder="请选择配置类型">
              {configTypes.map(type => (
                <Option key={type.key} value={type.key}>
                  {type.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="config_key"
            label="配置键"
            rules={[{ required: true, message: '请输入配置键' }]}
            tooltip="唯一标识，如 28nm, logic, cub 等"
          >
            <Input placeholder="如：28nm" />
          </Form.Item>

          <Form.Item
            name="config_name"
            label="配置名称"
            tooltip="显示名称"
          >
            <Input placeholder="如：28纳米" />
          </Form.Item>

          <Form.Item
            name="value"
            label="数值"
            rules={[{ required: true, message: '请输入数值' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              step={0.01}
              precision={4}
              placeholder="如：2.5"
            />
          </Form.Item>

          <Form.Item
            name="unit"
            label="单位"
          >
            <Input placeholder="如：㎡/片" />
          </Form.Item>

          <Form.Item
            name="formula"
            label="计算公式"
          >
            <TextArea
              rows={2}
              placeholder="如：洁净室面积 = 月产能 × 系数 + 1000"
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="说明"
          >
            <TextArea rows={2} placeholder="配置项说明" />
          </Form.Item>

          <Form.Item
            name="source"
            label="数据来源"
          >
            <Input placeholder="如：行业经验值、国标GB/T xxx" />
          </Form.Item>

          <Form.Item
            name="standard"
            label="参考标准"
          >
            <Input placeholder="如：GB/T 25915.1-2021" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 导入预览弹窗 */}
      <Modal
        title="Excel导入预览"
        open={importModalVisible}
        onOk={handleImport}
        onCancel={() => {
          setImportModalVisible(false);
          setImportPreview([]);
        }}
        width={900}
        okText="确认导入"
        cancelText="取消"
        confirmLoading={importing}
      >
        <Alert
          message="数据预览"
          description={`共解析 ${importPreview.length} 条记录。已存在的配置将被更新，新配置将被创建。`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Table
          dataSource={importPreview}
          columns={[
            { title: '配置类型', dataIndex: 'config_type', width: 120, render: (v) => <Tag color="blue">{v}</Tag> },
            { title: '配置键', dataIndex: 'config_key', width: 100 },
            { title: '配置名称', dataIndex: 'config_name', width: 100 },
            { title: '数值', dataIndex: 'value', width: 80 },
            { title: '单位', dataIndex: 'unit', width: 60 },
            { title: '计算公式', dataIndex: 'formula', ellipsis: true },
            { title: '来源', dataIndex: 'source', width: 100 }
          ]}
          rowKey={(r, i) => `${r.config_type}-${r.config_key}-${i}`}
          size="small"
          pagination={{ pageSize: 10 }}
          scroll={{ y: 400 }}
        />
      </Modal>
    </div>
  );
};

export default UMTableManagement;
