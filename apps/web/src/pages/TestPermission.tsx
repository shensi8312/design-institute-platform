import React, { useState } from 'react';
import { Card, Space, Alert, Button, Tag, message } from 'antd';
import { LockOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';

// 简化版权限设置组件（用于测试）
const TestPermission: React.FC = () => {
  const [permissionMode, setPermissionMode] = useState('inherit');
  const [permissionTags, setPermissionTags] = useState([
    { dimension: 'department', type: 'required', value: 'engineering' },
    { dimension: 'role', type: 'required', value: 'engineer' },
    { dimension: 'level', type: 'required', value: '3+' }
  ]);

  const handleTest = () => {
    message.success(`权限模式: ${permissionMode}, 标签数: ${permissionTags.length}`);
    console.log('Permission Mode:', permissionMode);
    console.log('Permission Tags:', permissionTags);
  };

  return (
    <div style={{ padding: 24 }}>
      <Alert
        message="权限系统测试页面"
        description="这是一个简化的权限设置测试页面，用于验证权限功能是否正常工作"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card title={<Space><LockOutlined />权限设置测试</Space>}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 权限模式 */}
          <div>
            <h4>权限模式</h4>
            <Space>
              <Button 
                type={permissionMode === 'inherit' ? 'primary' : 'default'}
                onClick={() => setPermissionMode('inherit')}
              >
                继承
              </Button>
              <Button 
                type={permissionMode === 'merge' ? 'primary' : 'default'}
                onClick={() => setPermissionMode('merge')}
              >
                合并
              </Button>
              <Button 
                type={permissionMode === 'override' ? 'primary' : 'default'}
                onClick={() => setPermissionMode('override')}
              >
                覆盖
              </Button>
              <Button 
                type={permissionMode === 'restrict' ? 'primary' : 'default'}
                onClick={() => setPermissionMode('restrict')}
              >
                限制
              </Button>
            </Space>
          </div>

          {/* 权限标签 */}
          <div>
            <h4>权限标签</h4>
            <Space wrap>
              {permissionTags.map((tag, index) => (
                <Tag 
                  key={index}
                  color={tag.type === 'required' ? 'blue' : tag.type === 'forbidden' ? 'red' : 'orange'}
                  icon={tag.dimension === 'department' ? <TeamOutlined /> : <UserOutlined />}
                  closable
                  onClose={() => {
                    setPermissionTags(permissionTags.filter((_, i) => i !== index));
                  }}
                >
                  {tag.dimension}:{tag.value} ({tag.type})
                </Tag>
              ))}
            </Space>
          </div>

          {/* 添加标签 */}
          <div>
            <Button 
              type="dashed" 
              onClick={() => {
                const newTag = {
                  dimension: 'project',
                  type: 'optional' as const,
                  value: 'project_123'
                };
                setPermissionTags([...permissionTags, newTag]);
                message.success('添加了新标签');
              }}
            >
              + 添加测试标签
            </Button>
          </div>

          {/* 测试按钮 */}
          <div>
            <Button type="primary" size="large" onClick={handleTest}>
              测试权限设置
            </Button>
          </div>

          {/* 当前状态 */}
          <Alert
            message="当前权限状态"
            description={
              <div>
                <div>模式: {permissionMode}</div>
                <div>标签数: {permissionTags.length}</div>
                <div>必须标签: {permissionTags.filter(t => t.type === 'required').length}</div>
                <div>禁止标签: {permissionTags.filter(t => t.type === 'forbidden').length}</div>
              </div>
            }
            type="success"
          />
        </Space>
      </Card>
    </div>
  );
};

export default TestPermission;