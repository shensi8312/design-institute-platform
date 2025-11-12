import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, message, Spin } from 'antd';
import {
  HomeOutlined,
  BankOutlined,
  TeamOutlined,
  UserOutlined,
  AppstoreOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  SettingOutlined,
  SafetyOutlined,
  FileTextOutlined,
  ApiOutlined,
  DatabaseOutlined,
  CloudOutlined,
  MenuOutlined,
  EnvironmentOutlined,
  AlertOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import type { MenuProps } from 'antd';
import axios from '../utils/axios';

const { Header, Sider, Content } = Layout;

const Dashboard: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedKey, setSelectedKey] = useState('');
  // 初始化默认菜单，确保始终有菜单显示
  const [userMenus, setUserMenus] = useState<any[]>([
    { key: '', label: '首页', icon: <HomeOutlined /> },
    { key: 'organizations', label: '组织管理', icon: <BankOutlined /> },
    { key: 'departments', label: '部门管理', icon: <AppstoreOutlined /> },
    { key: 'users', label: '用户管理', icon: <UserOutlined /> },
    { key: 'roles', label: '角色管理', icon: <TeamOutlined /> },
    { key: 'permissions', label: '权限管理', icon: <SafetyOutlined /> },
    { key: 'menus', label: '菜单管理', icon: <MenuOutlined /> },
    { key: 'digital-site', label: '数字工地', icon: <EnvironmentOutlined /> },
  ]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // 图标映射
  const iconMap: { [key: string]: React.ReactNode } = {
    'HomeOutlined': <HomeOutlined />,
    'BankOutlined': <BankOutlined />,
    'TeamOutlined': <TeamOutlined />,
    'UserOutlined': <UserOutlined />,
    'AppstoreOutlined': <AppstoreOutlined />,
    'SafetyOutlined': <SafetyOutlined />,
    'MenuOutlined': <MenuOutlined />,
    'FileTextOutlined': <FileTextOutlined />,
    'SettingOutlined': <SettingOutlined />,
    'ApiOutlined': <ApiOutlined />,
    'DatabaseOutlined': <DatabaseOutlined />,
    'CloudOutlined': <CloudOutlined />,
    'EnvironmentOutlined': <EnvironmentOutlined />,
    'AlertOutlined': <AlertOutlined />,
    'DashboardOutlined': <DashboardOutlined />,
  };
  
  // 根据菜单名称自动分配图标
  const getIconByName = (name: string, icon?: string): React.ReactNode => {
    if (icon && iconMap[icon]) {
      return iconMap[icon];
    }
    
    // 根据菜单名称自动分配图标
    const nameIconMap: { [key: string]: React.ReactNode } = {
      '知识管理': <DatabaseOutlined />,
      '项目管理': <AppstoreOutlined />,
      'AI工具': <ApiOutlined />,
      '业务管理': <BankOutlined />,
      '监控中心': <CloudOutlined />,
      '系统管理': <SettingOutlined />,
      '用户管理': <UserOutlined />,
      '角色管理': <TeamOutlined />,
      '菜单管理': <MenuOutlined />,
      '权限管理': <SafetyOutlined />,
      '部门管理': <AppstoreOutlined />,
      '组织管理': <BankOutlined />,
      '数字工地': <EnvironmentOutlined />,
      '数字工地总览': <DashboardOutlined />,
      '数字工地告警': <AlertOutlined />,
    };
    
    return nameIconMap[name] || <MenuOutlined />;
  };

  // 构建树形结构
  const buildMenuTree = (menus: any[]): any[] => {
    // 先创建一个映射
    const menuMap: { [key: string]: any } = {};
    const rootMenus: any[] = [];
    
    // 第一遍：创建所有菜单的映射
    menus.forEach(menu => {
      menuMap[menu.id] = { ...menu, children: [] };
    });
    
    // 第二遍：构建树形结构
    menus.forEach(menu => {
      if (menu.parent_id && menuMap[menu.parent_id]) {
        // 有父级，添加到父级的children
        menuMap[menu.parent_id].children.push(menuMap[menu.id]);
      } else {
        // 没有父级，是根菜单
        rootMenus.push(menuMap[menu.id]);
      }
    });
    
    return rootMenus;
  };

  // 转换菜单数据格式
  const formatMenus = (menus: any[]): any[] => {
    console.log('开始格式化菜单:', menus);
    return menus.map(menu => {
      console.log('处理菜单项:', menu.name, '路径:', menu.path, '子菜单数量:', menu.children?.length || 0);
      
      // 直接使用数据库中的 path 字段作为 key
      let key = menu.path || '';
      
      // 如果是父菜单（有子菜单），使用特殊的key避免导航
      const hasChildren = menu.children && menu.children.length > 0;
      
      // 构建菜单项
      const formattedMenu: any = {
        key: hasChildren ? `menu_${menu.id}` : key, // 父菜单用特殊key，子菜单用path
        label: menu.name,
        icon: getIconByName(menu.name, menu.icon),
      };

      // 如果有子菜单，递归处理
      if (hasChildren) {
        console.log(`${menu.name} 有 ${menu.children.length} 个子菜单，正在递归处理...`);
        formattedMenu.children = formatMenus(menu.children);
      }

      return formattedMenu;
    });
  };

  // 加载用户菜单
  const loadUserMenus = async () => {
    setLoading(true); // 开始加载
    try {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      
      if (userStr) {
        const userData = JSON.parse(userStr);
        setUser(userData);

        // 先尝试从API获取菜单
        try {
          // 所有用户（包括admin）都使用 /api/menus/user 接口
          // 后端会根据权限（包括 '*' 通配符）自动过滤
          const response = await axios.get('/api/menus/user', {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (response.data.success && response.data.data && response.data.data.length > 0) {
            const userMenuData = response.data.data;
            console.log('从API获取到的菜单数据:', userMenuData);

            // 后端已经返回了树形结构，直接格式化
            const formattedMenus = formatMenus(userMenuData);

            // 确保首页只添加一次（检查是否已存在）
            if (!formattedMenus.some(menu => menu.key === '' || menu.label === '首页')) {
              formattedMenus.unshift({
                key: '',
                label: '首页',
                icon: <HomeOutlined />
              });
            }

            console.log('最终格式化的菜单数据:', formattedMenus.map(m => ({
              key: m.key,
              label: m.label,
              children: m.children?.map((c: any) => ({ key: c.key, label: c.label }))
            })));

            setUserMenus(formattedMenus);
            // 只存储必要的数据，避免循环引用
            const menuData = formattedMenus.map((m: any) => ({
              key: m.key,
              label: m.label,
              children: m.children?.map((c: any) => ({
                key: c.key,
                label: c.label
              }))
            }));
            localStorage.setItem('menus', JSON.stringify(menuData));
            setLoading(false); // 设置加载完成
            return; // 成功获取菜单，直接返回
          }
        } catch (apiError) {
          console.error('API获取菜单失败，使用默认菜单', apiError);
        }
      }

      // 使用默认菜单（API失败或没有数据时）
      console.log('使用默认菜单');
      const defaultMenus = [
        { key: '', label: '首页', icon: <HomeOutlined /> },
        { key: 'organizations', label: '组织管理', icon: <BankOutlined /> },
        { key: 'departments', label: '部门管理', icon: <AppstoreOutlined /> },
        { key: 'users', label: '用户管理', icon: <UserOutlined /> },
        { key: 'roles', label: '角色管理', icon: <TeamOutlined /> },
        { key: 'permissions', label: '权限管理', icon: <SafetyOutlined /> },
        { key: 'menus', label: '菜单管理', icon: <MenuOutlined /> },
      ];
      console.log('设置默认菜单:', defaultMenus);
      setUserMenus(defaultMenus);
      
    } catch (error) {
      console.error('加载菜单出错', error);
      // 最终兜底：使用默认菜单
      const defaultMenus = [
        { key: '', label: '首页', icon: <HomeOutlined /> },
        { key: 'organizations', label: '组织管理', icon: <BankOutlined /> },
        { key: 'departments', label: '部门管理', icon: <AppstoreOutlined /> },
        { key: 'users', label: '用户管理', icon: <UserOutlined /> },
        { key: 'roles', label: '角色管理', icon: <TeamOutlined /> },
        { key: 'permissions', label: '权限管理', icon: <SafetyOutlined /> },
        { key: 'menus', label: '菜单管理', icon: <MenuOutlined /> },
      ];
      setUserMenus(defaultMenus);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('Dashboard mounted, loading menus...');
    loadUserMenus();
  }, []);

  useEffect(() => {
    // 设置当前选中的菜单
    // 菜单的 key 是完整路径，直接使用 location.pathname
    const currentKey = location.pathname === '/' ? '' : location.pathname;
    setSelectedKey(currentKey);
  }, [location]);

  const handleMenuClick = (e: any) => {
    console.log('Menu clicked:', e.key, e.item);

    // 如果是父菜单（以menu_开头），不进行导航
    if (e.key.startsWith('menu_')) {
      console.log('点击了父菜单，不进行导航');
      return;
    }

    setSelectedKey(e.key);
    if (e.key === '') {
      navigate('/');
    } else {
      // key 已经包含了 / 前缀，直接使用
      navigate(e.key);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    message.success('退出成功');
    navigate('/login');
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  console.log('渲染Dashboard, userMenus:', userMenus);
  console.log('loading状态:', loading);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0
        }}
      >
        <div style={{
          height: 32,
          margin: 16,
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: collapsed ? 12 : 14,
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}>
          {collapsed ? 'MST' : 'MST-设计平台'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={userMenus}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 200 }}>
        <Header style={{
          padding: 0,
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,21,41,.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{
                fontSize: '16px',
                width: 64,
                height: 64,
              }}
            />
            <span style={{ fontSize: 18, fontWeight: 500 }}>
              MST-设计平台AI辅助设计
            </span>
          </div>
          <div style={{ paddingRight: 24 }}>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar icon={<UserOutlined />} />
                <span>{user?.name || user?.username || '用户'}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{
          margin: 0,
          background: '#f0f2f5',
          overflow: 'auto',
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default Dashboard;
