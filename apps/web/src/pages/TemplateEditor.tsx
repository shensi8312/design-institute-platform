/**
 * Word模板在线编辑器（增强版）
 * 左侧：文档目录树
 * 右侧：OnlyOffice完整编辑器
 */

import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Card, Button, Space, Tag, Tooltip, message } from 'antd';
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  DownloadOutlined,
  SaveOutlined,
  ExpandOutlined,
  CompressOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import DocxEditor from '../components/DocxEditor';
import TemplateOutlineTree from '../components/TemplateOutlineTree';

const { Sider, Content } = Layout;

const TemplateEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const editorRef = useRef<any>(null);

  if (!id) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>模板ID缺失</p>
      </div>
    );
  }

  // 处理目录节点选择 - 跳转到对应章节
  const handleNodeSelect = (node: any) => {
    console.log('选中目录节点:', node);
    // TODO: 实现跳转到Word文档对应位置
    // 需要通过OnlyOffice API实现
    message.info(`跳转到: ${node.title}`);

    // 未来实现：
    // if (editorRef.current && editorRef.current.jumpToHeading) {
    //   editorRef.current.jumpToHeading(node.title);
    // }
  };

  // 保存文档
  const handleSave = () => {
    // OnlyOffice会自动保存
    message.success('文档已自动保存');
  };

  // 导出Word文档
  const handleExport = () => {
    // TODO: 调用OnlyOffice API导出文档
    message.info('正在导出Word文档...');

    // 未来实现：
    // if (editorRef.current && editorRef.current.downloadDocument) {
    //   editorRef.current.downloadDocument();
    // }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部工具栏 */}
      <Card
        style={{ borderRadius: 0, borderBottom: '1px solid #f0f0f0' }}
        bodyStyle={{ padding: '12px 24px' }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Space size="large">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/templates')}
            >
              返回列表
            </Button>
            <div>
              <Space>
                <FileTextOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                <span style={{ fontSize: 16, fontWeight: 500 }}>
                  Word模板编辑器
                </span>
                <Tag color="green">完整格式</Tag>
                <Tag color="blue">自动保存</Tag>
              </Space>
              <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c' }}>
                <InfoCircleOutlined /> 修改会自动保存到服务器
              </div>
            </div>
          </Space>

          <Space>
            <Tooltip title={collapsed ? "显示目录" : "隐藏目录"}>
              <Button
                icon={collapsed ? <ExpandOutlined /> : <CompressOutlined />}
                onClick={() => setCollapsed(!collapsed)}
              >
                {collapsed ? '显示' : '隐藏'}目录
              </Button>
            </Tooltip>
            <Button icon={<SaveOutlined />} onClick={handleSave}>
              保存
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
            >
              导出Word
            </Button>
          </Space>
        </div>
      </Card>

      {/* 主体区域 - 左右分栏 */}
      <Layout style={{ flex: 1, background: '#f0f2f5' }}>
        {/* 左侧目录树 */}
        <Sider
          width={320}
          collapsed={collapsed}
          collapsedWidth={0}
          trigger={null}
          style={{
            background: '#fff',
            borderRight: '1px solid #f0f0f0',
            overflow: 'hidden',
            transition: 'all 0.2s'
          }}
        >
          {!collapsed && (
            <div style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* 目录标题 */}
              <div style={{
                padding: '16px',
                borderBottom: '1px solid #f0f0f0',
                background: '#fafafa',
                fontWeight: 500,
                fontSize: 14
              }}>
                📖 文档目录
              </div>

              {/* 目录树 */}
              <div style={{ flex: 1, overflow: 'auto' }}>
                <TemplateOutlineTree
                  templateId={id}
                  onSelectNode={handleNodeSelect}
                />
              </div>
            </div>
          )}
        </Sider>

        {/* 右侧编辑器 */}
        <Content style={{
          padding: 16,
          overflow: 'hidden',
          transition: 'all 0.2s'
        }}>
          <div style={{
            height: '100%',
            background: '#fff',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            <DocxEditor
              ref={editorRef}
              documentId={id}
              height="100%"
            />
          </div>
        </Content>
      </Layout>
    </div>
  );
};

export default TemplateEditor;
