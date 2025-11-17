/**
 * 模板查看页面 - 左侧目录树，右侧章节内容（可编辑）
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layout,
  Tree,
  Card,
  Button,
  Space,
  message,
  Spin,
  Typography,
  Tag,
  Breadcrumb,
  Empty
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  ArrowLeftOutlined,
  FileAddOutlined,
  FolderOutlined,
  FileTextOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  HomeOutlined,
  FileWordOutlined
} from '@ant-design/icons';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import axios from '../utils/axios';

const { Sider, Content } = Layout;
const { Title, Paragraph } = Typography;

// 注册自定义的margin-left格式以保留Word导入的缩进
const Parchment = Quill.import('parchment');
const MarginLeftAttributor = new Parchment.Attributor.Style('marginLeft', 'margin-left', {
  scope: Parchment.Scope.BLOCK,
  whitelist: null  // 允许任意margin-left值
});
Quill.register(MarginLeftAttributor, true);

// 富文本编辑器配置
const applyMarginLeftToDelta = (delta: any, marginLeft: string) => {
  if (!delta?.ops) return delta;

  return {
    ...delta,
    ops: delta.ops.map((op: any) => {
      const insert = op.insert;
      const hasNewline =
        typeof insert === 'string' && insert.includes('\n');

      if (insert === '\n' || hasNewline) {
        return {
          ...op,
          attributes: {
            ...(op.attributes || {}),
            marginLeft
          }
        };
      }
      return op;
    })
  };
};

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    [{ font: [] }],
    [{ size: ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    [{ align: [] }],
    ['link', 'image'],
    ['clean']
  ],
  clipboard: {
    matchers: [
      [
        'p',
        (node: HTMLElement, delta: any) => {
          const marginLeft = node?.style?.marginLeft;
          if (!marginLeft) return delta;

          return applyMarginLeftToDelta(delta, marginLeft);
        }
      ]
    ]
  }
};

const quillFormats = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'list', 'bullet',
  'indent',
  'align',
  'link', 'image',
  'marginLeft'  // 添加自定义格式以保留margin-left
];

interface TemplateSection {
  id: string;
  code: string;
  title: string;
  level: number;
  description?: string;
  template_content?: string;  // Word导入的HTML内容
  parent_code: string | null;
  sort_order: number;
  children?: TemplateSection[];
}

interface Template {
  id: string;
  code: string;
  name: string;
  template_type: string;
  description: string;
  version: string;
  status: string;
}

const TemplateViewer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const quillRef = useRef<ReactQuill | null>(null);

  const [template, setTemplate] = useState<Template | null>(null);
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<TemplateSection | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  // 加载模板信息
  useEffect(() => {
    loadTemplate();
  }, [id]);

  const loadTemplate = async () => {
    setLoading(true);
    try {
      // 加载模板基本信息
      const templateRes = await axios.get(`/api/unified-document/templates/${id}`);
      if (templateRes.data.success) {
        setTemplate(templateRes.data.data);
      }

      // 加载模板章节结构
      const sectionsRes = await axios.get(`/api/unified-document/templates/${id}/sections`);
      if (sectionsRes.data.success) {
        const sectionsData = sectionsRes.data.data;
        setSections(sectionsData);

        // 默认展开前3个一级章节
        const topLevelKeys = sectionsData.slice(0, 3).map((s: TemplateSection) => s.code);
        setExpandedKeys(topLevelKeys);

        // 默认选中第一个章节
        if (sectionsData.length > 0) {
          setSelectedSection(sectionsData[0]);
        }
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '加载模板失败');
    } finally {
      setLoading(false);
    }
  };

  // 转换章节数据为Tree组件格式
  const convertToTreeData = (sections: TemplateSection[]): DataNode[] => {
    return sections.map(section => ({
      key: section.code,
      title: (
        <div style={{
          padding: '4px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          {section.children && section.children.length > 0 ? (
            <FolderOutlined style={{ color: '#faad14', fontSize: 14 }} />
          ) : (
            <FileTextOutlined style={{ color: '#1890ff', fontSize: 14 }} />
          )}
          <span style={{
            fontWeight: section.level === 1 ? 600 : section.level === 2 ? 500 : 400,
            fontSize: section.level === 1 ? 14 : 13,
            color: section.level === 1 ? '#262626' : '#595959'
          }}>
            <span style={{
              color: '#1890ff',
              fontFamily: 'monospace',
              marginRight: 8
            }}>
              {section.code}
            </span>
            {section.title}
          </span>
        </div>
      ),
      children: section.children ? convertToTreeData(section.children) : undefined,
    }));
  };

  // 从扁平列表中查找章节
  const findSectionByCode = (sections: TemplateSection[], code: string): TemplateSection | null => {
    for (const section of sections) {
      if (section.code === code) {
        return section;
      }
      if (section.children) {
        const found = findSectionByCode(section.children, code);
        if (found) return found;
      }
    }
    return null;
  };

  // 处理章节选择
  const handleSelectSection = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length > 0) {
      const code = selectedKeys[0] as string;
      const section = findSectionByCode(sections, code);
      if (section) {
        setSelectedSection(section);
        setIsEditing(false); // 切换章节时退出编辑模式
      }
    }
  };

  // 进入编辑模式
  const handleEdit = () => {
    if (!selectedSection) return;
    // 优先使用template_content（Word导入的HTML），如果没有则使用description
    setEditContent(selectedSection.template_content || selectedSection.description || '');
    setIsEditing(true);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
  };

  const applyStoredMargins = useCallback((html: string) => {
    if (typeof window === 'undefined' || !quillRef.current || !html) return;

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const margins = Array.from(doc.querySelectorAll('p')).map(p => p.style.marginLeft || '');
    const editor = quillRef.current.getEditor();
    const blocks = editor.root.querySelectorAll('p');
    blocks.forEach((block, index) => {
      const margin = margins[index];
      if (margin) {
        (block as HTMLElement).style.marginLeft = margin;
      } else {
        (block as HTMLElement).style.marginLeft = '';
      }
    });
  }, []);

  useEffect(() => {
    if (isEditing && editContent) {
      setTimeout(() => applyStoredMargins(editContent), 0);
    }
  }, [isEditing, editContent, applyStoredMargins]);

  // 保存编辑
  const handleSave = async () => {
    if (!selectedSection) return;

    setSaving(true);
    try {
      const response = await axios.put(
        `/api/unified-document/templates/${id}/sections/${selectedSection.id}`,
        {
          description: editContent
        }
      );

      if (response.data.success) {
        message.success('保存成功');

        // 更新本地数据
        const updateSectionInTree = (sections: TemplateSection[]): TemplateSection[] => {
          return sections.map(s => {
            if (s.id === selectedSection.id) {
              return { ...s, description: editContent };
            }
            if (s.children) {
              return { ...s, children: updateSectionInTree(s.children) };
            }
            return s;
          });
        };

        setSections(updateSectionInTree(sections));
        setSelectedSection({ ...selectedSection, description: editContent });
        setIsEditing(false);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 基于此模板创建文档
  const handleCreateDocument = () => {
    if (!template) return;
    navigate('/templates', {
      state: {
        createFromTemplate: template.id
      }
    });
  };

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
    <Layout style={{ height: '100vh' }}>
      {/* 顶部工具栏 */}
      <div style={{
        background: '#fff',
        padding: '16px 24px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Space size="large">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/templates')}
          >
            返回
          </Button>
          <div>
            <Breadcrumb
              items={[
                {
                  title: <><HomeOutlined /> 模板管理</>,
                },
                {
                  title: template?.name,
                }
              ]}
            />
            <Title level={4} style={{ margin: '8px 0 0 0' }}>
              {template?.name}
              <Tag color="blue" style={{ marginLeft: 12 }}>
                {template?.version}
              </Tag>
              <Tag color={template?.status === 'published' ? 'success' : 'default'}>
                {template?.status === 'published' ? '已发布' : '草稿'}
              </Tag>
            </Title>
          </div>
        </Space>
        <Space size="middle">
          <Button
            icon={<FileWordOutlined />}
            onClick={() => navigate(`/templates/${id}/edit`)}
          >
            Word模式
          </Button>
          <Button
            type="primary"
            icon={<FileAddOutlined />}
            onClick={handleCreateDocument}
          >
            基于此模板创建文档
          </Button>
        </Space>
      </div>

      <Layout>
        {/* 左侧目录树 */}
        <Sider
          width={340}
          style={{
            background: '#fafafa',
            borderRight: '1px solid #e8e8e8',
            overflow: 'auto',
            height: 'calc(100vh - 81px)'
          }}
        >
          <div style={{ padding: '16px' }}>
            <div style={{
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: '2px solid #1890ff'
            }}>
              <Title level={5} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FolderOutlined style={{ color: '#1890ff' }} />
                章节目录
              </Title>
              <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
                共 {sections.length} 个章节
              </div>
            </div>
            <Tree
              showLine={{ showLeafIcon: false }}
              defaultExpandedKeys={expandedKeys}
              selectedKeys={selectedSection ? [selectedSection.code] : []}
              onSelect={handleSelectSection}
              onExpand={(keys) => setExpandedKeys(keys as string[])}
              treeData={convertToTreeData(sections)}
              style={{
                background: 'transparent',
                fontSize: 13
              }}
            />
          </div>
        </Sider>

        {/* 右侧内容区 */}
        <Content style={{
          padding: 24,
          overflow: 'auto',
          height: 'calc(100vh - 81px)',
          background: '#f5f5f5'
        }}>
          {selectedSection ? (
            <Card>
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* 章节标题和操作按钮 */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  borderBottom: '2px solid #f0f0f0',
                  paddingBottom: 16
                }}>
                  <div>
                    <Tag color="blue">Level {selectedSection.level}</Tag>
                    <Title level={3} style={{ marginTop: 8 }}>
                      {selectedSection.code} - {selectedSection.title}
                    </Title>
                  </div>
                  <Space size="middle">
                    {!isEditing ? (
                      <Button
                        type="primary"
                        size="large"
                        icon={<EditOutlined />}
                        onClick={handleEdit}
                      >
                        编辑模板内容
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="large"
                          icon={<CloseOutlined />}
                          onClick={handleCancelEdit}
                        >
                          取消
                        </Button>
                        <Button
                          type="primary"
                          size="large"
                          icon={<SaveOutlined />}
                          loading={saving}
                          onClick={handleSave}
                        >
                          保存
                        </Button>
                      </>
                    )}
                  </Space>
                </div>

                {/* 内容显示/编辑区 */}
                {isEditing ? (
                  <div>
                    <div style={{
                      marginBottom: 12,
                      padding: 12,
                      background: '#e6f7ff',
                      border: '1px solid #91d5ff',
                      borderRadius: 4
                    }}>
                      <Space>
                        <EditOutlined style={{ color: '#1890ff' }} />
                        <span style={{ color: '#1890ff', fontWeight: 500 }}>
                          正在编辑模板内容 - 支持富文本格式（字体、颜色、加粗等）
                        </span>
                      </Space>
                    </div>
                    <ReactQuill
                      ref={quillRef}
                      theme="snow"
                      value={editContent}
                      onChange={(value) => {
                        setEditContent(value);
                        applyStoredMargins(value);
                      }}
                      modules={quillModules}
                      formats={quillFormats}
                      style={{
                        height: '500px',
                        marginBottom: '50px'
                      }}
                    />
                  </div>
                ) : (
                  (selectedSection.template_content || selectedSection.description) ? (
                    <div>
                      <div style={{ marginBottom: 12, color: '#8c8c8c', fontSize: 12 }}>
                        点击右上角"编辑模板内容"按钮可以修改此章节
                      </div>
                      <div
                        style={{
                          background: '#fff',
                          padding: 20,
                          borderRadius: 4,
                          minHeight: 400,
                          fontSize: 14,
                          lineHeight: '1.8',
                          border: '1px solid #f0f0f0'
                        }}
                        dangerouslySetInnerHTML={{ __html: selectedSection.template_content || selectedSection.description || '' }}
                      />
                    </div>
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <Space direction="vertical" size="small">
                          <span style={{ color: '#8c8c8c' }}>该章节暂无内容</span>
                          <span style={{ fontSize: 12, color: '#bfbfbf' }}>
                            点击右上角"编辑模板内容"按钮开始编写
                          </span>
                        </Space>
                      }
                      style={{ padding: '60px 0' }}
                    >
                      <Button type="primary" icon={<EditOutlined />} onClick={handleEdit}>
                        开始编辑
                      </Button>
                    </Empty>
                  )
                )}

                {/* 子章节列表 */}
                {!isEditing && selectedSection.children && selectedSection.children.length > 0 && (
                  <div style={{ marginTop: 32 }}>
                    <Title level={5}>子章节 ({selectedSection.children.length})</Title>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {selectedSection.children.map(child => (
                        <Card
                          key={child.code}
                          size="small"
                          hoverable
                          onClick={() => setSelectedSection(child)}
                          style={{ cursor: 'pointer' }}
                        >
                          <Space>
                            <FileTextOutlined />
                            <span style={{ fontWeight: 500 }}>
                              {child.code} - {child.title}
                            </span>
                            <Tag color="blue">Level {child.level}</Tag>
                            {child.description && (
                              <Tag color="green">已有内容</Tag>
                            )}
                          </Space>
                        </Card>
                      ))}
                    </Space>
                  </div>
                )}
              </Space>
            </Card>
          ) : (
            <Card>
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <FileTextOutlined style={{ fontSize: 48, color: '#ccc' }} />
                <Paragraph type="secondary" style={{ marginTop: 16 }}>
                  请从左侧目录选择要查看的章节
                </Paragraph>
              </div>
            </Card>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

export default TemplateViewer;
