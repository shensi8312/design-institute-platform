import React from 'react';
import { Card, Button, Space, Row, Col, Statistic, Table, Tag, Progress, message } from 'antd';
import { TagsOutlined, PlusOutlined, RobotOutlined, SaveOutlined } from '@ant-design/icons';

const DataAnnotationSimple: React.FC = () => {
  const handleAIAnnotate = () => {
    message.info('AI标注功能开发中...');
  };

  const handleSave = () => {
    message.success('标注已保存');
  };

  const dataSource = [
    { id: 1, name: '建筑平面图.pdf', status: '进行中', progress: 60 },
    { id: 2, name: '结构图纸.dwg', status: '已完成', progress: 100 },
    { id: 3, name: '效果图.jpg', status: '待处理', progress: 0 }
  ];

  const columns = [
    { title: '文件名', dataIndex: 'name', key: 'name' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const color = status === '已完成' ? 'green' : status === '进行中' ? 'blue' : 'default';
        return <Tag color={color}>{status}</Tag>;
      }
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number) => <Progress percent={progress} size="small" />
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2>数据标注</h2>
      
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="总标注数" value={1234} prefix={<TagsOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="今日标注" value={56} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="准确率" value={98.5} suffix="%" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="平均用时" value="2.3" suffix="分钟" />
          </Card>
        </Col>
      </Row>

      <Card 
        title="标注工作台"
        extra={
          <Space>
            <Button icon={<PlusOutlined />}>新建标注</Button>
            <Button icon={<RobotOutlined />} onClick={handleAIAnnotate}>AI标注</Button>
            <Button icon={<SaveOutlined />} onClick={handleSave}>保存</Button>
          </Space>
        }
      >
        <Table dataSource={dataSource} columns={columns} rowKey="id" />
      </Card>
    </div>
  );
};

export default DataAnnotationSimple;