/**
 * 文档模板编辑器
 * 左侧：文档目录树
 * 右侧：ReactQuill富文本编辑器
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Card, Button, Space, Tag, Tooltip, message, Spin, Modal } from 'antd';
import {
  ArrowLeftOutlined,
  FileTextOutlined,
  DownloadOutlined,
  SaveOutlined,
  ExpandOutlined,
  CompressOutlined,
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
  title: string;
  content: string;
  level: number;
  children?: TemplateSection[];
}

const TemplateEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [template, setTemplate] = useState<Template | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const quillRef = useRef<ReactQuill>(null);

  // Quill编辑器配置
  const modules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'font': [] }, { 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['blockquote', 'code-block'],
      ['link', 'image', 'video'],
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
    'script',
    'list', 'bullet', 'indent',
    'align',
    'blockquote', 'code-block',
    'link', 'image', 'video'
  ];

  useEffect(() => {
    if (id) {
      loadTemplate();
      loadTemplateSections();
    }
  }, [id]);

  // 加载模板信息
  const loadTemplate = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/unified-document/templates/${id}`);
      if (response.data.success) {
        setTemplate(response.data.data);
        // 如果模板有content字段，加载它
        setContent(response.data.data.content || '');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '加载模板失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载模板章节列表
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

  // 处理目录节点选择 - 插入章节内容
  const handleNodeSelect = (node: any) => {
    Modal.confirm({
      title: '插入章节内容',
      content: `确定要插入"${node.title}"的内容到编辑器中吗？`,
      onOk: () => {
        insertSectionContent(node);
      }
    });
  };

  // 插入章节内容到编辑器
  const insertSectionContent = async (node: any) => {
    try {
      // 从sections中找到对应的章节内容
      const findSection = (sections: TemplateSection[], nodeId: string): TemplateSection | null => {
        for (const section of sections) {
          if (section.id === nodeId) return section;
          if (section.children) {
            const found = findSection(section.children, nodeId);
            if (found) return found;
          }
        }
        return null;
      };

      const section = findSection(sections, node.id);

      if (!section || !section.content) {
        message.warning('该章节暂无内容');
        return;
      }

      const quill = quillRef.current?.getEditor();
      if (!quill) return;

      // 获取当前光标位置
      const selection = quill.getSelection();
      const position = selection ? selection.index : quill.getLength();

      // 插入章节标题（作为标题格式）
      quill.insertText(position, `\n${node.title}\n`, { header: section.level });

      // 插入章节内容
      const delta = quill.clipboard.convert(section.content);
      quill.setContents(quill.getContents().concat(delta), 'user');

      message.success(`已插入章节：${node.title}`);
    } catch (error: any) {
      message.error('插入章节内容失败');
      console.error(error);
    }
  };

  // 保存文档
  const handleSave = async () => {
    if (!id) return;

    setSaving(true);
    try {
      await axios.put(`/api/unified-document/templates/${id}`, {
        content
      });
      message.success('保存成功');
    } catch (error: any) {
      message.error(error.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 导出Word文档
  const handleExport = () => {
    message.info('导出功能开发中...');
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
                <Tag color="green">富文本编辑</Tag>
                {sections.length > 0 && <Tag color="blue">支持模板插入</Tag>}
              </Space>
              <div style={{ marginTop: 4, fontSize: 12, color: '#8c8c8c' }}>
                <InfoCircleOutlined /> 点击左侧目录可插入章节内容
              </div>
            </div>
          </Space>

          <Space>
            {sections.length > 0 && (
              <Tooltip title={collapsed ? "显示目录" : "隐藏目录"}>
                <Button
                  icon={collapsed ? <ExpandOutlined /> : <CompressOutlined />}
                  onClick={() => setCollapsed(!collapsed)}
                >
                  {collapsed ? '显示' : '隐藏'}目录
                </Button>
              </Tooltip>
            )}
            <Button
              icon={<SaveOutlined />}
              onClick={handleSave}
              loading={saving}
            >
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
        {/* 左侧目录树 - 只在有章节时显示 */}
        {sections.length > 0 && (
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
                  <div style={{ fontSize: 12, color: '#999', marginTop: 4, fontWeight: 'normal' }}>
                    点击章节可插入内容
                  </div>
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
        )}

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
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              flex: 1,
              padding: 24,
              overflow: 'auto'
            }}>
              <ReactQuill
                ref={quillRef}
                theme="snow"
                value={content}
                onChange={setContent}
                modules={modules}
                formats={formats}
                placeholder="请输入内容，或从左侧目录插入章节模板..."
                style={{
                  height: 'calc(100vh - 200px)',
                }}
              />
            </div>
          </div>
        </Content>
      </Layout>
    </div>
  );
};

export default TemplateEditor;
