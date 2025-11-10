/**
 * 归档管理页面
 * 知识管理员审批文档归档申请
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
  Descriptions,
  Radio,
  Checkbox
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import axios from '../utils/axios';

const { TextArea } = Input;
const { Option } = Select;

interface ArchiveRequest {
  id: string;
  document_id: string;
  requester_id: string;
  request_reason: string;
  suggested_category: string;
  suggested_tags: string[];
  status: string;
  created_at: string;
  document?: {
    title: string;
    document_type: string;
  };
}

const ArchiveManagement: React.FC = () => {
  const [requests, setRequests] = useState<ArchiveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<ArchiveRequest | null>(null);
  const [form] = Form.useForm();

  // 权限级别配置
  const permissionLevels = [
    { value: 'enterprise', label: '全企业' },
    { value: 'branch', label: '分院' },
    { value: 'department', label: '部门' },
    { value: 'project', label: '项目' },
    { value: 'discipline', label: '专业' },
  ];

  // 密级配置
  const securityLevels = [
    { value: 'public', label: '公开' },
    { value: 'internal', label: '内部' },
    { value: 'confidential', label: '机密' },
    { value: 'top_secret', label: '绝密' },
  ];

  // 加载归档申请列表
  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/unified-document/archive/requests/pending');

      if (response.data.success) {
        setRequests(response.data.data);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '加载归档申请失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  // 打开审批模态框
  const handleApprove = (request: ArchiveRequest) => {
    setCurrentRequest(request);
    setApprovalModalVisible(true);
    form.setFieldsValue({
      category: request.suggested_category || '',
      tags: request.suggested_tags || [],
      securityLevel: 'internal',
      permissions: ['department'],
    });
  };

  // 批准归档申请
  const handleSubmitApproval = async (values: any) => {
    if (!currentRequest) return;

    try {
      // 构建权限配置
      const permissions = values.permissions.map((level: string) => ({
        level,
        type: 'view',
        // TODO: 根据level类型添加对应的ID
      }));

      await axios.post(`/api/unified-document/archive/requests/${currentRequest.id}/approve`, {
        permissions,
        category: values.category,
        tags: values.tags,
        securityLevel: values.securityLevel,
        comment: values.comment,
      });

      message.success('归档申请已批准');
      setApprovalModalVisible(false);
      form.resetFields();
      loadRequests();
    } catch (error: any) {
      message.error(error.response?.data?.message || '审批失败');
    }
  };

  // 拒绝归档申请
  const handleReject = (request: ArchiveRequest) => {
    Modal.confirm({
      title: '拒绝归档申请',
      content: (
        <div>
          <p>确定要拒绝这个归档申请吗？</p>
          <TextArea
            rows={4}
            placeholder="请输入拒绝原因"
            id="reject-reason"
          />
        </div>
      ),
      onOk: async () => {
        const comment = (document.getElementById('reject-reason') as HTMLTextAreaElement)?.value;
        try {
          await axios.post(`/api/unified-document/archive/requests/${request.id}/reject`, {
            comment,
          });
          message.success('归档申请已拒绝');
          loadRequests();
        } catch (error: any) {
          message.error(error.response?.data?.message || '操作失败');
        }
      },
    });
  };

  // 表格列配置
  const columns: ColumnsType<ArchiveRequest> = [
    {
      title: '文档标题',
      dataIndex: ['document', 'title'],
      key: 'document_title',
      width: 250,
    },
    {
      title: '文档类型',
      dataIndex: ['document', 'document_type'],
      key: 'document_type',
      width: 120,
      render: (type) => {
        const typeMap: Record<string, { text: string; color: string }> = {
          spec: { text: 'SPEC', color: 'blue' },
          contract: { text: '合同', color: 'green' },
          bidding: { text: '招投标', color: 'orange' },
        };
        const config = typeMap[type] || { text: type, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '建议分类',
      dataIndex: 'suggested_category',
      key: 'suggested_category',
      width: 150,
    },
    {
      title: '申请原因',
      dataIndex: 'request_reason',
      key: 'request_reason',
      ellipsis: true,
    },
    {
      title: '申请时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => handleApprove(record)}
          >
            批准
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseOutlined />}
            onClick={() => handleReject(record)}
          >
            拒绝
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>归档管理</h2>
          <Button onClick={loadRequests}>刷新</Button>
        </div>

        <Table
          columns={columns}
          dataSource={requests}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条待审批`,
          }}
        />
      </Card>

      {/* 批准归档模态框 */}
      <Modal
        title="批准归档申请"
        open={approvalModalVisible}
        onCancel={() => {
          setApprovalModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={700}
      >
        {currentRequest && (
          <div>
            <Descriptions bordered column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="文档标题">
                {currentRequest.document?.title}
              </Descriptions.Item>
              <Descriptions.Item label="申请原因">
                {currentRequest.request_reason}
              </Descriptions.Item>
              <Descriptions.Item label="建议分类">
                {currentRequest.suggested_category}
              </Descriptions.Item>
            </Descriptions>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmitApproval}
            >
              <Form.Item
                name="category"
                label="文档分类"
                rules={[{ required: true, message: '请输入文档分类' }]}
              >
                <Input placeholder="例如：技术规范、合同文档等" />
              </Form.Item>

              <Form.Item
                name="tags"
                label="标签"
              >
                <Select
                  mode="tags"
                  placeholder="输入标签后按回车添加"
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Form.Item
                name="securityLevel"
                label={
                  <Space>
                    <SafetyOutlined />
                    密级设置
                  </Space>
                }
                rules={[{ required: true, message: '请选择密级' }]}
              >
                <Radio.Group>
                  {securityLevels.map(level => (
                    <Radio key={level.value} value={level.value}>
                      {level.label}
                    </Radio>
                  ))}
                </Radio.Group>
              </Form.Item>

              <Form.Item
                name="permissions"
                label="访问权限"
                rules={[{ required: true, message: '请至少选择一个权限级别' }]}
              >
                <Checkbox.Group>
                  {permissionLevels.map(level => (
                    <Checkbox key={level.value} value={level.value}>
                      {level.label}
                    </Checkbox>
                  ))}
                </Checkbox.Group>
              </Form.Item>

              <Form.Item
                name="comment"
                label="审批意见"
              >
                <TextArea
                  rows={3}
                  placeholder="请输入审批意见（可选）"
                />
              </Form.Item>

              <div style={{ padding: 12, background: '#f0f0f0', borderRadius: 4 }}>
                <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
                  <strong>提示：</strong>归档后文档将进入知识库，根据设置的权限供相关人员查阅。密级越高，访问限制越严格。
                </p>
              </div>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ArchiveManagement;
