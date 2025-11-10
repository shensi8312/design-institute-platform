/**
 * Word模板在线编辑器
 * 使用OnlyOffice提供完整的Word编辑功能，保留所有格式
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Space, Tag, Tooltip } from 'antd';
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  BarsOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import DocxEditor from '../components/DocxEditor';

const TemplateEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>模板ID缺失</p>
      </div>
    );
  }

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
                <Tag color="green">保留完整格式</Tag>
              </Space>
              <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c' }}>
                <InfoCircleOutlined /> 修改会自动保存到服务器
              </div>
            </div>
          </Space>
          <Tooltip title="切换到章节目录编辑模式">
            <Button
              type="dashed"
              icon={<BarsOutlined />}
              onClick={() => navigate(`/templates/${id}/view`)}
            >
              章节模式
            </Button>
          </Tooltip>
        </div>
      </Card>

      {/* 编辑器区域 */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        background: '#f0f2f5',
        padding: 16
      }}>
        <div style={{
          height: '100%',
          background: '#fff',
          borderRadius: 4,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <DocxEditor
            documentId={id}
            height="100%"
          />
        </div>
      </div>
    </div>
  );
};

export default TemplateEditor;
