import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  
  message,
  Tabs,
  Badge
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  SafetyOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axios from '../utils/axios';

const { TextArea } = Input;

interface ReviewItem {
  id: string;
  document_id: string;
  document_title: string;
  document_type: string;
  upload_user: string;
  upload_time: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewer?: string;
  review_time?: string;
  review_comment?: string;
}

const ContentReview: React.FC = () => {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState<ReviewItem | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [form] = Form.useForm();

  const token = localStorage.getItem('token');
  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  // 获取待审核列表
  const fetchReviewItems = async (page = 1, pageSize = 10, status = activeTab) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/knowledge/review', {
        ...config,
        params: { page, pageSize, status }
      });

      if (response.data.success) {
        setItems(response.data.data.list || []);
        setPagination({
          page: response.data.data.pagination?.page || 1,
          pageSize: response.data.data.pagination?.pageSize || 10,
          total: response.data.data.pagination?.total || 0
        });
      }
    } catch (error: any) {
      message.error('获取审核列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviewItems(1, pagination.pageSize, activeTab);
  }, [activeTab]);

  // 显示审核弹窗
  const showReviewModal = (item: ReviewItem) => {
    setCurrentItem(item);
    form.resetFields();
    setReviewModalVisible(true);
  };

  // 提交审核
  const handleReview = async (approved: boolean) => {
    try {
      const values = await form.validateFields();

      const response = await axios.post(
        `/api/knowledge/review/${currentItem?.id}`,
        {
          approved,
          comment: values.comment
        },
        config
      );

      if (response.data.success) {
        message.success(approved ? '审核通过' : '审核拒绝');
        setReviewModalVisible(false);
        form.resetFields();
        fetchReviewItems(pagination.page, pagination.pageSize, activeTab);
      }
    } catch (error: any) {
      if (error.response) {
        message.error(error.response.data.message || '审核失败');
      }
    }
  };

  // 表格列定义
  const columns: ColumnsType<ReviewItem> = [
    {
      title: '文档标题',
      dataIndex: 'document_title',
      key: 'document_title',
      width: 200
    },
    {
      title: '文档类型',
      dataIndex: 'document_type',
      key: 'document_type',
      width: 100,
      render: (type) => <Tag color="blue">{type?.toUpperCase()}</Tag>
    },
    {
      title: '上传者',
      dataIndex: 'upload_user',
      key: 'upload_user',
      width: 120
    },
    {
      title: '上传时间',
      dataIndex: 'upload_time',
      key: 'upload_time',
      width: 180,
      render: (date) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const statusMap = {
          pending: { color: 'orange', text: '待审核' },
          approved: { color: 'green', text: '已通过' },
          rejected: { color: 'red', text: '已拒绝' }
        };
        const config = statusMap[status as keyof typeof statusMap];
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '审核人',
      dataIndex: 'reviewer',
      key: 'reviewer',
      width: 120,
      render: (reviewer) => reviewer || '-'
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
            icon={<EyeOutlined />}
            onClick={() => showReviewModal(record)}
          >
            查看
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                style={{ color: '#52c41a' }}
                onClick={() => {
                  setCurrentItem(record);
                  form.setFieldsValue({ comment: '' });
                  Modal.confirm({
                    title: '确认通过审核？',
                    content: '确认后该文档将发布到企业知识库',
                    onOk: async () => {
                      try {
                        const response = await axios.post(
                          `/api/knowledge/review/${record.id}`,
                          { approved: true, comment: '' },
                          config
                        );
                        if (response.data.success) {
                          message.success('审核通过');
                          fetchReviewItems(pagination.page, pagination.pageSize, activeTab);
                        }
                      } catch (error) {
                        message.error('操作失败');
                      }
                    }
                  });
                }}
              >
                通过
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => showReviewModal(record)}
              >
                拒绝
              </Button>
            </>
          )}
        </Space>
      )
    }
  ];

  const tabItems = [
    {
      key: 'pending',
      label: <Badge count={activeTab === 'pending' ? pagination.total : 0} offset={[10, 0]}>待审核</Badge>,
      children: (
        <Table
          columns={columns}
          dataSource={items}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => fetchReviewItems(page, pageSize, activeTab)
          }}
        />
      )
    },
    {
      key: 'approved',
      label: '已通过',
      children: (
        <Table
          columns={columns}
          dataSource={items}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => fetchReviewItems(page, pageSize, activeTab)
          }}
        />
      )
    },
    {
      key: 'rejected',
      label: '已拒绝',
      children: (
        <Table
          columns={columns}
          dataSource={items}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => fetchReviewItems(page, pageSize, activeTab)
          }}
        />
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <SafetyOutlined />
            <span>内容审核</span>
          </Space>
        }
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => fetchReviewItems(pagination.page, pagination.pageSize, activeTab)}
          >
            刷新
          </Button>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as any)}
          items={tabItems}
        />
      </Card>

      {/* 审核弹窗 */}
      <Modal
        title="文档审核"
        open={reviewModalVisible}
        onCancel={() => {
          setReviewModalVisible(false);
          form.resetFields();
        }}
        footer={
          currentItem?.status === 'pending' ? (
            <Space>
              <Button onClick={() => {
                setReviewModalVisible(false);
                form.resetFields();
              }}>
                取消
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() => handleReview(false)}
              >
                拒绝
              </Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => handleReview(true)}
              >
                通过
              </Button>
            </Space>
          ) : null
        }
        width={700}
      >
        <div style={{ marginBottom: 16 }}>
          <div><strong>文档标题：</strong>{currentItem?.document_title}</div>
          <div><strong>文档类型：</strong>{currentItem?.document_type}</div>
          <div><strong>上传者：</strong>{currentItem?.upload_user}</div>
          <div><strong>上传时间：</strong>{currentItem?.upload_time ? new Date(currentItem.upload_time).toLocaleString('zh-CN') : '-'}</div>
          {currentItem?.reviewer && (
            <>
              <div><strong>审核人：</strong>{currentItem.reviewer}</div>
              <div><strong>审核时间：</strong>{currentItem.review_time ? new Date(currentItem.review_time).toLocaleString('zh-CN') : '-'}</div>
              {currentItem.review_comment && (
                <div><strong>审核意见：</strong>{currentItem.review_comment}</div>
              )}
            </>
          )}
        </div>

        {currentItem?.status === 'pending' && (
          <Form form={form} layout="vertical">
            <Form.Item
              name="comment"
              label="审核意见"
            >
              <TextArea
                rows={4}
                placeholder="请输入审核意见（选填）"
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default ContentReview;
