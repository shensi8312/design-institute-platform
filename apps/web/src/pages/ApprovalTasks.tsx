/**
 * 审批任务页面
 * 显示待审批的章节，支持标注问题点
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
  List,
  Badge,
  Radio
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckOutlined,
  CloseOutlined,
  RollbackOutlined,
  EyeOutlined,
  WarningOutlined
} from '@ant-design/icons';
import axios from '../utils/axios';

const { TextArea } = Input;
const { Option } = Select;

interface ApprovalTask {
  id: string;
  section_id: string;
  document_id: string;
  submitted_by_name: string;
  submitted_at: string;
  reviewer_name: string;
  status: string;
  section_snapshot: any;
  issues?: any[];
}

const ApprovalTasks: React.FC = () => {
  const [tasks, setTasks] = useState<ApprovalTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [currentTask, setCurrentTask] = useState<ApprovalTask | null>(null);
  const [form] = Form.useForm();
  const [issues, setIssues] = useState<any[]>([]);

  // 加载待审批任务
  const loadTasks = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/unified-document/approval-tasks/pending');

      if (response.data.success) {
        setTasks(response.data.data);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '加载审批任务失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  // 打开审批模态框
  const handleReview = (task: ApprovalTask) => {
    setCurrentTask(task);
    setReviewModalVisible(true);
    setIssues([]);
    form.resetFields();
  };

  // 添加问题点
  const handleAddIssue = () => {
    const newIssue = {
      id: Date.now().toString(),
      issueType: 'error',
      severity: 'medium',
      issueTitle: '',
      issueDescription: '',
      suggestedFix: '',
    };
    setIssues([...issues, newIssue]);
  };

  // 移除问题点
  const handleRemoveIssue = (id: string) => {
    setIssues(issues.filter(issue => issue.id !== id));
  };

  // 更新问题点
  const handleUpdateIssue = (id: string, field: string, value: any) => {
    setIssues(issues.map(issue =>
      issue.id === id ? { ...issue, [field]: value } : issue
    ));
  };

  // 提交审批
  const handleSubmitReview = async (values: any) => {
    if (!currentTask) return;

    try {
      await axios.post(`/api/unified-document/approval-tasks/${currentTask.id}/review`, {
        decision: values.decision,
        comment: values.comment,
        issues: issues.filter(issue => issue.issueTitle && issue.issueDescription),
      });

      message.success('审批完成');
      setReviewModalVisible(false);
      form.resetFields();
      setIssues([]);
      loadTasks();
    } catch (error: any) {
      message.error(error.response?.data?.message || '审批提交失败');
    }
  };

  // 问题类型配置
  const issueTypes = [
    { value: 'technical_error', label: '技术错误', color: 'red' },
    { value: 'standard_violation', label: '标准不符', color: 'orange' },
    { value: 'inconsistency', label: '前后矛盾', color: 'gold' },
    { value: 'unclear_description', label: '描述不清', color: 'blue' },
    { value: 'suggestion', label: '优化建议', color: 'green' },
  ];

  // 严重程度配置
  const severityLevels = [
    { value: 'low', label: '低' },
    { value: 'medium', label: '中' },
    { value: 'high', label: '高' },
    { value: 'critical', label: '严重' },
  ];

  // 表格列配置
  const columns: ColumnsType<ApprovalTask> = [
    {
      title: '提交人',
      dataIndex: 'submitted_by_name',
      key: 'submitted_by_name',
      width: 120,
    },
    {
      title: '章节标题',
      dataIndex: ['section_snapshot', 'title'],
      key: 'section_title',
      width: 250,
    },
    {
      title: '提交时间',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      width: 180,
      render: (text) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={status === 'pending' ? 'processing' : 'default'}>
          {status === 'pending' ? '待审批' : '已处理'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => handleReview(record)}
          >
            审批
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>
            <Badge count={tasks.length} offset={[10, 0]}>
              审批任务
            </Badge>
          </h2>
          <Button onClick={loadTasks}>刷新</Button>
        </div>

        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      {/* 审批模态框 */}
      <Modal
        title="章节审批"
        open={reviewModalVisible}
        onCancel={() => {
          setReviewModalVisible(false);
          form.resetFields();
          setIssues([]);
        }}
        onOk={() => form.submit()}
        width={800}
      >
        {currentTask && (
          <div>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="章节标题" span={2}>
                {currentTask.section_snapshot?.title}
              </Descriptions.Item>
              <Descriptions.Item label="提交人">
                {currentTask.submitted_by_name}
              </Descriptions.Item>
              <Descriptions.Item label="提交时间">
                {new Date(currentTask.submitted_at).toLocaleString('zh-CN')}
              </Descriptions.Item>
            </Descriptions>

            <Card title="章节内容" size="small" style={{ marginBottom: 16 }}>
              <div
                style={{
                  maxHeight: 200,
                  overflow: 'auto',
                  padding: 8,
                  background: '#f5f5f5'
                }}
                dangerouslySetInnerHTML={{
                  __html: currentTask.section_snapshot?.content || '无内容'
                }}
              />
            </Card>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmitReview}
              initialValues={{ decision: 'approved' }}
            >
              <Form.Item
                name="decision"
                label="审批决定"
                rules={[{ required: true }]}
              >
                <Radio.Group>
                  <Radio.Button value="approved">
                    <CheckOutlined /> 批准
                  </Radio.Button>
                  <Radio.Button value="returned">
                    <RollbackOutlined /> 退回修改
                  </Radio.Button>
                  <Radio.Button value="rejected">
                    <CloseOutlined /> 拒绝
                  </Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                name="comment"
                label="审批意见"
              >
                <TextArea
                  rows={4}
                  placeholder="请输入审批意见"
                />
              </Form.Item>

              <Form.Item label="问题点标注">
                <Space direction="vertical" style={{ width: '100%' }}>
                  {issues.map((issue) => (
                    <Card
                      key={issue.id}
                      size="small"
                      extra={
                        <Button
                          type="link"
                          danger
                          size="small"
                          onClick={() => handleRemoveIssue(issue.id)}
                        >
                          删除
                        </Button>
                      }
                    >
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Space>
                          <Select
                            value={issue.issueType}
                            onChange={(value) => handleUpdateIssue(issue.id, 'issueType', value)}
                            style={{ width: 150 }}
                          >
                            {issueTypes.map(type => (
                              <Option key={type.value} value={type.value}>
                                {type.label}
                              </Option>
                            ))}
                          </Select>
                          <Select
                            value={issue.severity}
                            onChange={(value) => handleUpdateIssue(issue.id, 'severity', value)}
                            style={{ width: 100 }}
                          >
                            {severityLevels.map(level => (
                              <Option key={level.value} value={level.value}>
                                {level.label}
                              </Option>
                            ))}
                          </Select>
                        </Space>
                        <Input
                          placeholder="问题标题"
                          value={issue.issueTitle}
                          onChange={(e) => handleUpdateIssue(issue.id, 'issueTitle', e.target.value)}
                        />
                        <TextArea
                          placeholder="问题描述"
                          rows={2}
                          value={issue.issueDescription}
                          onChange={(e) => handleUpdateIssue(issue.id, 'issueDescription', e.target.value)}
                        />
                        <Input
                          placeholder="修改建议（可选）"
                          value={issue.suggestedFix}
                          onChange={(e) => handleUpdateIssue(issue.id, 'suggestedFix', e.target.value)}
                        />
                      </Space>
                    </Card>
                  ))}
                  <Button
                    type="dashed"
                    block
                    icon={<WarningOutlined />}
                    onClick={handleAddIssue}
                  >
                    添加问题点
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ApprovalTasks;
