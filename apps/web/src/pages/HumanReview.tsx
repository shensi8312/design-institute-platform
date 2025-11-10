import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Input, Tag, Space, message, Divider, Typography, Alert, Progress, Badge, Spin } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EditOutlined, ReloadOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import axios from 'axios';
import { REVIEW_SERVICE_URL } from '../config/api';

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

interface ReviewTask {
  task_id: string;
  query: string;
  answer: string;
  confidence: number;
  reasons: string[];
  timestamp: string;
  status?: 'pending' | 'approved' | 'rejected' | 'edited';
}

const HumanReview: React.FC = () => {
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [currentTask, setCurrentTask] = useState<ReviewTask | null>(null);
  const [editedAnswer, setEditedAnswer] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });

  // 获取审核队列
  const fetchReviewQueue = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${REVIEW_SERVICE_URL}/api/review_queue`);
      if (response.data.success) {
        const tasksData = response.data.tasks.map((t: ReviewTask) => ({
          ...t,
          status: 'pending'
        }));
        setTasks(tasksData);
        setStats({
          total: response.data.total || tasksData.length,
          pending: tasksData.length,
          approved: 0,
          rejected: 0
        });
      }
    } catch (error) {
      message.error('获取审核队列失败');
    } finally {
      setLoading(false);
    }
  };

  // 批准答案
  const approveAnswer = async (task: ReviewTask, editedAnswer?: string) => {
    try {
      const response = await axios.post(`${REVIEW_SERVICE_URL}/api/approve_answer`, {
        task_id: task.task_id,
        answer: editedAnswer || task.answer
      });
      
      if (response.data.success) {
        message.success('答案已批准');
        
        // 更新任务状态
        setTasks(prev => prev.map(t => 
          t.task_id === task.task_id 
            ? { ...t, status: editedAnswer ? 'edited' : 'approved', answer: editedAnswer || t.answer }
            : t
        ));
        
        // 更新统计
        setStats(prev => ({
          ...prev,
          pending: prev.pending - 1,
          approved: prev.approved + 1
        }));
      }
    } catch (error) {
      message.error('批准失败');
    }
  };

  // 拒绝答案
  const rejectAnswer = async (task: ReviewTask) => {
    try {
      // 这里可以调用拒绝API（如果有的话）
      message.info('答案已拒绝，需要重新生成');
      
      setTasks(prev => prev.map(t => 
        t.task_id === task.task_id ? { ...t, status: 'rejected' } : t
      ));
      
      setStats(prev => ({
        ...prev,
        pending: prev.pending - 1,
        rejected: prev.rejected + 1
      }));
    } catch (error) {
      message.error('拒绝失败');
    }
  };

  // 编辑答案
  const handleEdit = (task: ReviewTask) => {
    setCurrentTask(task);
    setEditedAnswer(task.answer);
    setEditModal(true);
  };

  // 保存编辑
  const handleSaveEdit = () => {
    if (currentTask) {
      approveAnswer(currentTask, editedAnswer);
      setEditModal(false);
    }
  };

  useEffect(() => {
    fetchReviewQueue();
  }, []);

  const columns = [
    {
      title: '查询问题',
      dataIndex: 'query',
      key: 'query',
      width: 200,
      render: (text: string) => (
        <Paragraph ellipsis={{ rows: 2, expandable: true }}>
          <RobotOutlined style={{ marginRight: 8, color: '#1890ff' }} />
          {text}
        </Paragraph>
      )
    },
    {
      title: 'AI答案',
      dataIndex: 'answer',
      key: 'answer',
      width: 300,
      render: (text: string) => (
        <Paragraph ellipsis={{ rows: 3, expandable: true }}>
          {text}
        </Paragraph>
      )
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 120,
      render: (confidence: number) => {
        const percent = Math.round(confidence * 100);
        let status: 'success' | 'normal' | 'exception' = 'normal';
        if (percent >= 80) status = 'success';
        else if (percent < 50) status = 'exception';
        
        return (
          <Progress 
            percent={percent} 
            size="small" 
            status={status}
            format={percent => `${percent}%`}
          />
        );
      }
    },
    {
      title: '审核原因',
      dataIndex: 'reasons',
      key: 'reasons',
      width: 200,
      render: (reasons: string[]) => (
        <Space direction="vertical" size="small">
          {reasons.map((reason, index) => (
            <Tag key={index} color="orange">
              {reason}
            </Tag>
          ))}
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusConfig = {
          pending: { color: 'processing', text: '待审核' },
          approved: { color: 'success', text: '已批准' },
          rejected: { color: 'error', text: '已拒绝' },
          edited: { color: 'cyan', text: '已编辑' }
        };
        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
        return <Badge status={config.color as any} text={config.text} />;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: ReviewTask) => {
        if (record.status !== 'pending') {
          return <Tag color="default">已处理</Tag>;
        }
        
        return (
          <Space>
            <Button 
              type="primary" 
              size="small" 
              icon={<CheckCircleOutlined />}
              onClick={() => approveAnswer(record)}
            >
              批准
            </Button>
            <Button 
              size="small" 
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            <Button 
              danger 
              size="small" 
              icon={<CloseCircleOutlined />}
              onClick={() => rejectAnswer(record)}
            >
              拒绝
            </Button>
          </Space>
        );
      }
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Title level={4}>
            <UserOutlined /> 人工审核队列
          </Title>
          <Paragraph type="secondary">
            审核AI生成的低置信度答案，确保答案质量和准确性
          </Paragraph>
        </div>

        <Alert
          message="审核说明"
          description={
            <div>
              <p>• <strong>批准</strong>：答案准确，可以直接使用</p>
              <p>• <strong>编辑</strong>：答案基本正确，但需要修改完善</p>
              <p>• <strong>拒绝</strong>：答案错误，需要重新生成</p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <div style={{ marginBottom: 24 }}>
          <Space size="large">
            <div>
              <Text type="secondary">总任务数</Text>
              <div style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.total}</div>
            </div>
            <Divider type="vertical" style={{ height: 50 }} />
            <div>
              <Text type="secondary">待审核</Text>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#faad14' }}>
                {stats.pending}
              </div>
            </div>
            <Divider type="vertical" style={{ height: 50 }} />
            <div>
              <Text type="secondary">已批准</Text>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                {stats.approved}
              </div>
            </div>
            <Divider type="vertical" style={{ height: 50 }} />
            <div>
              <Text type="secondary">已拒绝</Text>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#f5222d' }}>
                {stats.rejected}
              </div>
            </div>
            <Divider type="vertical" style={{ height: 50 }} />
            <Button 
              type="primary" 
              icon={<ReloadOutlined />} 
              onClick={fetchReviewQueue}
            >
              刷新队列
            </Button>
          </Space>
        </div>

        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={tasks}
            rowKey="task_id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`
            }}
          />
        </Spin>

        <Modal
          title="编辑答案"
          open={editModal}
          onOk={handleSaveEdit}
          onCancel={() => setEditModal(false)}
          width={800}
          okText="保存并批准"
          cancelText="取消"
        >
          {currentTask && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <Text strong>原始问题：</Text>
                <Paragraph>{currentTask.query}</Paragraph>
              </div>
              
              <div style={{ marginBottom: 16 }}>
                <Text strong>原始答案：</Text>
                <Paragraph type="secondary">{currentTask.answer}</Paragraph>
              </div>

              <div>
                <Text strong>编辑答案：</Text>
                <TextArea
                  value={editedAnswer}
                  onChange={(e) => setEditedAnswer(e.target.value)}
                  rows={10}
                  style={{ marginTop: 8 }}
                  placeholder="请输入修改后的答案..."
                />
              </div>
            </div>
          )}
        </Modal>
      </Card>
    </div>
  );
};

export default HumanReview;