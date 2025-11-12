/**
 * 文档模板编辑器
 * 左侧：目录结构管理（编辑章节标题、编号、层级）
 * 右侧：内容编辑器（编辑选中章节的正文内容）
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Card, Button, Space, Tag, message, Spin } from 'antd';
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  SaveOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import TemplateOutlineTree from '../components/TemplateOutlineTree';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import axios from '../utils/axios';

const { Sider, Content } = Layout;

interface Template {
  id: string;
  name: string;
  template_type: string;
  description: string;
}

interface TemplateSection {
  id: string;
  code: string;
  title: string;
  content: string;
  level: number;
  parent_code: string | null;
  sort_order: number;
}

const TemplateEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<Template | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<TemplateSection | null>(null);
  const quillRef = useRef<ReactQuill>(null);

  // Quill编辑器配置
  const modules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'font': [] }, { 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['blockquote', 'code-block'],
      ['link', 'image'],
      ['clean']
    ],
    clipboard: {
      matchVisual: false,
    },
  }), []);

  const formats = [
    'header', 'font', 'size',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'list', 'bullet', 'indent',
    'align',
    'blockquote', 'code-block',
    'link', 'image'
  ];

  useEffect(() => {
    if (id) {
      loadTemplate();
      loadTemplateSections();
    }
  }, [id]);

  const loadTemplate = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/unified-document/templates/${id}`);
      if (response.data.success) {
        setTemplate(response.data.data);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '加载模板失败');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateSections = async () => {
    try {
      const response = await axios.get(`/api/unified-document/templates/${id}/sections`);
      if (response.data.success) {
        setSections(response.data.data);
      }
    } catch (error: any) {
      console.error('加载章节列表失败:', error);
    }
  };

  // 点击左侧目录，右侧显示该章节内容
  const handleNodeSelect = (node: any) => {
    const section = sections.find(s => s.id === node.id);
    if (section) {
      setSelectedSection(section);
      setContent(section.content || '');
    }
  };

  // 保存内容
  const handleSave = async () => {
    if (!selectedSection) {
      message.warning('请先选择要编辑的章节');
      return;
    }

    setSaving(true);
    try {
      await axios.put(`/api/unified-document/templates/${id}/sections/${selectedSection.id}`, {
        content
      });
      message.success('保存成功');
      loadTemplateSections();
    } catch (error: any) {
      message.error(error.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (!id) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>模板ID缺失</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <Spin size="large" tip="加载中..." />
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
                  {template?.name || '文档模板编辑器'}
                </span>
                <Tag color="green">模板管理</Tag>
                {sections.length > 0 && <Tag color="blue">{sections.length}个章节</Tag>}
              </Space>
              <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c' }}>
                <InfoCircleOutlined /> 左侧管理目录结构，右侧编辑章节内容
              </div>
            </div>
          </Space>

          <Space>
            {selectedSection && (
              <span style={{ color: '#999', fontSize: 14 }}>
                当前编辑：<strong>{selectedSection.code} {selectedSection.title}</strong>
              </span>
            )}
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
              disabled={!selectedSection}
            >
              保存内容
            </Button>
          </Space>
        </div>
      </Card>

      {/* 主体区域 - 左右分栏 */}
      <Layout style={{ flex: 1, background: '#f0f2f5' }}>
        {/* 左侧目录树 */}
        {sections.length > 0 && (
          <Sider
            width={320}
            style={{
              background: '#fff',
              borderRight: '1px solid #f0f0f0',
              overflow: 'hidden'
            }}
          >
            <div style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{
                padding: '16px',
                borderBottom: '1px solid #f0f0f0',
                background: '#fafafa',
                fontWeight: 500,
                fontSize: 14
              }}>
                📖 模板目录
                <div style={{ fontSize: 12, color: '#999', marginTop: 4, fontWeight: 'normal' }}>
                  点击章节编辑内容
                </div>
              </div>

              <div style={{ flex: 1, overflow: 'auto' }}>
                <TemplateOutlineTree
                  templateId={id}
                  onSelectNode={handleNodeSelect}
                />
              </div>
            </div>
          </Sider>
        )}

        {/* 右侧内容编辑器 */}
        <Content style={{
          padding: 16,
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            background: '#fff',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {selectedSection ? (
              <>
                <div style={{
                  padding: '16px 24px',
                  borderBottom: '1px solid #f0f0f0',
                  background: '#fafafa'
                }}>
                  <h3 style={{ margin: 0 }}>
                    {selectedSection.code} {selectedSection.title}
                  </h3>
                  <p style={{ margin: '4px 0 0', color: '#999', fontSize: 12 }}>
                    编辑章节正文内容
                  </p>
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
                  <ReactQuill
                    ref={quillRef}
                    theme="snow"
                    value={content}
                    onChange={setContent}
                    modules={modules}
                    formats={formats}
                    placeholder="输入章节内容..."
                    style={{
                      height: 'calc(100vh - 280px)',
                    }}
                  />
                </div>
              </>
            ) : (
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                color: '#999'
              }}>
                <FileTextOutlined style={{ fontSize: 64, marginBottom: 16 }} />
                <p>请从左侧选择要编辑内容的章节</p>
              </div>
            )}
          </div>
        </Content>
      </Layout>
    </div>
  );
};

export default TemplateEditor;
