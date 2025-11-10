import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Alert, Tag, Space, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import { FRONTEND_URL } from '../config/api';

const DebugMenu: React.FC = () => {
  const [menus, setMenus] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const navigate = useNavigate();

  // 加载菜单数据
  const loadMenus = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/menus');
      const menuData = response.data.data?.list || response.data.data || [];
      console.log('原始菜单数据:', menuData);
      
      // 筛选系统设置相关的菜单
      const systemMenus = menuData.filter((menu: any) => 
        menu.name === '系统设置' || 
        menu.parent_id === 'b9b24903-eb23-43c2-9f02-6b80e29ae679'
      );
      
      setMenus(systemMenus);
      message.success('菜单数据加载成功');
    } catch (error) {
      console.error('加载菜单失败:', error);
      message.error('加载菜单失败');
    }
    setLoading(false);
  };

  // 测试单个菜单
  const testMenu = (menu: any) => {
    console.log('测试菜单:', menu);
    const path = menu.path;
    
    if (!path) {
      message.warning(`菜单 ${menu.name} 没有路径`);
      return;
    }

    // 尝试导航
    console.log(`导航到: /${path}`);
    try {
      navigate(`/${path}`);
      
      setTestResults(prev => [...prev, {
        name: menu.name,
        path: path,
        status: 'success',
        message: '导航成功'
      }]);
      
      message.success(`导航到 ${menu.name} 成功`);
    } catch (error: any) {
      console.error(`导航失败:`, error);
      
      setTestResults(prev => [...prev, {
        name: menu.name,
        path: path,
        status: 'error',
        message: error.message
      }]);
      
      message.error(`导航到 ${menu.name} 失败: ${error.message}`);
    }
  };

  // 测试所有菜单
  const testAllMenus = async () => {
    setTestResults([]);
    
    for (const menu of menus) {
      if (menu.path) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        testMenu(menu);
      }
    }
  };

  useEffect(() => {
    loadMenus();
  }, []);

  const columns = [
    {
      title: '菜单名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      render: (path: string) => <code>{path || '无'}</code>
    },
    {
      title: '父级ID',
      dataIndex: 'parent_id',
      key: 'parent_id',
      render: (id: string) => id ? <Tag>{id.substring(0, 8)}...</Tag> : <Tag>顶级菜单</Tag>
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button 
            type="primary" 
            size="small"
            onClick={() => testMenu(record)}
            disabled={!record.path}
          >
            测试导航
          </Button>
          <Button
            size="small"
            onClick={() => {
              const fullPath = `${FRONTEND_URL}/${record.path}`;
              window.open(fullPath, '_blank');
            }}
            disabled={!record.path}
          >
            新窗口打开
          </Button>
        </Space>
      )
    }
  ];

  const resultColumns = [
    {
      title: '菜单名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'success' ? 'green' : 'red'}>
          {status === 'success' ? '成功' : '失败'}
        </Tag>
      )
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card title="菜单调试工具" extra={
        <Space>
          <Button onClick={loadMenus} loading={loading}>刷新菜单</Button>
          <Button type="primary" onClick={testAllMenus}>测试所有菜单</Button>
        </Space>
      }>
        <Alert 
          message="调试信息" 
          description="这个页面用于调试菜单导航问题。点击测试按钮查看是否能正常导航。" 
          type="info" 
          showIcon 
          style={{ marginBottom: 16 }}
        />
        
        <h3>系统菜单列表</h3>
        <Table 
          dataSource={menus} 
          columns={columns} 
          rowKey="id"
          loading={loading}
          pagination={false}
        />
        
        {testResults.length > 0 && (
          <>
            <h3 style={{ marginTop: 24 }}>测试结果</h3>
            <Table 
              dataSource={testResults} 
              columns={resultColumns} 
              rowKey={(record, index) => `${record.name}-${index}`}
              pagination={false}
            />
          </>
        )}
      </Card>
    </div>
  );
};

export default DebugMenu;