import React from 'react';
import { Card, Row, Col, Statistic, List, Avatar, Tag, Progress, Timeline } from 'antd';
import { 
  ProjectOutlined, 
  UserOutlined, 
  TeamOutlined, 
  FileTextOutlined,
  RiseOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import './Home.css';

const Home: React.FC = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // 模拟统计数据
  const stats = {
    projects: 127,
    users: 486,
    departments: 18,
    documents: 2341
  };

  // 最近项目
  const recentProjects = [
    { id: 1, name: '上海中心大厦设计方案', status: '进行中', progress: 75, manager: '张建筑' },
    { id: 2, name: '北京CBD商业综合体', status: '设计中', progress: 45, manager: '李结构' },
    { id: 3, name: '深圳科技园办公楼', status: '审核中', progress: 90, manager: '王规划' },
    { id: 4, name: '广州地铁站设计', status: '进行中', progress: 60, manager: '赵景观' },
  ];

  // 最近活动
  const recentActivities = [
    { time: '09:30', content: '张建筑 上传了新的设计图纸', type: 'upload' },
    { time: '10:15', content: '系统完成了AI辅助分析', type: 'ai' },
    { time: '11:00', content: '李结构 批准了施工方案', type: 'approve' },
    { time: '14:30', content: '新项目"杭州西湖文化中心"创建成功', type: 'create' },
    { time: '15:45', content: '王规划 更新了项目进度', type: 'update' },
  ];

  return (
    <div className="home-container">
      {/* 欢迎栏 */}
      <div className="welcome-section">
        <h1>欢迎回来，{user.username || '用户'}</h1>
        <p>今天是 {new Date().toLocaleDateString('zh-CN', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          weekday: 'long'
        })}</p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} className="stats-section">
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="项目总数"
              value={stats.projects}
              prefix={<ProjectOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <div className="stat-footer">
              <span style={{ color: '#52c41a' }}>
                <RiseOutlined /> 12%
              </span>
              <span style={{ marginLeft: 8, fontSize: 12, color: '#999' }}>较上月</span>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="用户总数"
              value={stats.users}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <div className="stat-footer">
              <span style={{ color: '#52c41a' }}>
                <RiseOutlined /> 8%
              </span>
              <span style={{ marginLeft: 8, fontSize: 12, color: '#999' }}>较上月</span>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="部门数量"
              value={stats.departments}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <div className="stat-footer">
              <span style={{ color: '#999', fontSize: 12 }}>组织架构稳定</span>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable>
            <Statistic
              title="知识库文档"
              value={stats.documents}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
            <div className="stat-footer">
              <span style={{ color: '#52c41a' }}>
                <RiseOutlined /> 23%
              </span>
              <span style={{ marginLeft: 8, fontSize: 12, color: '#999' }}>较上月</span>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 项目和活动 */}
      <Row gutter={[16, 16]} className="content-section">
        <Col xs={24} lg={14}>
          <Card 
            title="最近项目" 
            extra={<a href="/dashboard/projects">查看全部</a>}
            className="recent-projects"
          >
            <List
              itemLayout="horizontal"
              dataSource={recentProjects}
              renderItem={item => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar style={{ backgroundColor: '#1890ff' }}>{item.name[0]}</Avatar>}
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{item.name}</span>
                        <Tag color={
                          item.status === '进行中' ? 'blue' : 
                          item.status === '设计中' ? 'green' : 
                          'orange'
                        }>
                          {item.status}
                        </Tag>
                      </div>
                    }
                    description={
                      <div>
                        <div style={{ marginBottom: 4 }}>负责人：{item.manager}</div>
                        <Progress 
                          percent={item.progress} 
                          size="small" 
                          strokeColor={{
                            '0%': '#108ee9',
                            '100%': '#87d068',
                          }}
                        />
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        
        <Col xs={24} lg={10}>
          <Card 
            title="最近活动" 
            extra={<a href="/dashboard/activities">查看全部</a>}
            className="recent-activities"
          >
            <Timeline
              items={recentActivities.map((activity, index) => ({
                key: index,
                color: 
                  activity.type === 'ai' ? 'green' :
                  activity.type === 'approve' ? 'blue' :
                  activity.type === 'create' ? 'purple' :
                  'gray',
                dot: <ClockCircleOutlined />,
                children: (
                  <div className="activity-item">
                    <div className="activity-time">{activity.time}</div>
                    <div className="activity-content">{activity.content}</div>
                  </div>
                )
              }))}
            />
          </Card>
        </Col>
      </Row>

      {/* AI 功能快捷入口 */}
      <Card title="AI 功能快捷入口" className="ai-shortcuts">
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} lg={6}>
            <Card 
              hoverable 
              className="shortcut-card"
              onClick={() => window.location.href = '/dashboard/ai-drawing'}
            >
              <div className="shortcut-icon">🎨</div>
              <div className="shortcut-title">AI 绘图</div>
              <div className="shortcut-desc">智能生成建筑设计图</div>
            </Card>
          </Col>
          <Col xs={12} sm={8} lg={6}>
            <Card 
              hoverable 
              className="shortcut-card"
              onClick={() => window.location.href = '/dashboard/knowledge'}
            >
              <div className="shortcut-icon">📚</div>
              <div className="shortcut-title">知识库</div>
              <div className="shortcut-desc">建筑设计知识检索</div>
            </Card>
          </Col>
          <Col xs={12} sm={8} lg={6}>
            <Card 
              hoverable 
              className="shortcut-card"
              onClick={() => window.location.href = '/dashboard/chat'}
            >
              <div className="shortcut-icon">💬</div>
              <div className="shortcut-title">AI 问答</div>
              <div className="shortcut-desc">智能设计助手</div>
            </Card>
          </Col>
          <Col xs={12} sm={8} lg={6}>
            <Card 
              hoverable 
              className="shortcut-card"
              onClick={() => window.location.href = '/dashboard/annotation'}
            >
              <div className="shortcut-icon">📝</div>
              <div className="shortcut-title">数据标注</div>
              <div className="shortcut-desc">图纸智能标注</div>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Home;