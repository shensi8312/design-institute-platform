/**
 * 统一文档编辑器
 * 支持章节树、富文本编辑、修订追踪、审批等核心功能
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Layout,
  Tree,
  Button,
  Space,
  Dropdown,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tabs,
  Badge,
  Tooltip,
  Spin,
  Card,
  Switch,
  Drawer,
  List,
  Avatar,
  Divider,
  FloatButton,
  Empty
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  SendOutlined,
  EyeOutlined,
  LockOutlined,
  UnlockOutlined,
  CheckOutlined,
  CloseOutlined,
  RobotOutlined,
  FileTextOutlined,
  MoreOutlined,
  HistoryOutlined,
  CopyOutlined,
  ReloadOutlined,
  InsertRowBelowOutlined,
  SwapOutlined,
  PlusCircleOutlined,
  CommentOutlined,
  FileAddOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const { Sider, Content } = Layout;
const { TextArea } = Input;
const { Option } = Select;

interface Section {
  id: string;
  title: string;
  section_code?: string;
  content: string;
  level: number;
  parent_id: string | null;
  children?: Section[];
  approval_status: string;
  editable: boolean;
  deletable: boolean;
}

interface TemplateTreeNode {
  code: string;
  title: string;
  children?: TemplateTreeNode[];
}

interface Document {
  id: string;
  title: string;
  document_type: string;
  status: string;
  revisionSettings?: {
    track_changes_enabled: boolean;
  };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: {
    action: 'insert' | 'replace' | 'append';
    content: string;
  };
}

const convertTemplateTreeToData = (nodes: TemplateTreeNode[]): DataNode[] =>
  nodes.map((node) => ({
    key: node.code,
    title: (
      <span>
        <span style={{ color: '#1890ff', fontFamily: 'monospace', marginRight: 8 }}>
          {node.code}
        </span>
        {node.title}
      </span>
    ),
    children: node.children && node.children.length > 0 ? convertTemplateTreeToData(node.children) : undefined,
  }));

const flattenTemplateCodes = (nodes: TemplateTreeNode[]): string[] => {
  let result: string[] = [];
  nodes.forEach((node) => {
    result.push(node.code);
    if (node.children && node.children.length > 0) {
      result = result.concat(flattenTemplateCodes(node.children));
    }
  });
  return result;
};

const truncateTreeByCodes = (
  nodes: TemplateTreeNode[],
  allowed: Set<string>
): TemplateTreeNode[] => {
  return nodes
    .map((node) => {
      const children = node.children ? truncateTreeByCodes(node.children, allowed) : [];
      if (allowed.has(node.code) || children.length > 0) {
        return {
          ...node,
          children,
        };
      }
      return null;
    })
    .filter((node): node is TemplateTreeNode => Boolean(node));
};

const DocumentEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [document, setDocument] = useState<Document | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [addSectionModalVisible, setAddSectionModalVisible] = useState(false);
  const [addSectionForm] = Form.useForm();
  const [trackChanges, setTrackChanges] = useState(false);
  const quillRef = useRef<ReactQuill>(null);

  // AI助手相关state
  const [aiAssistantVisible, setAiAssistantVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [templateOptions, setTemplateOptions] = useState<any[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateTreeData, setTemplateTreeData] = useState<DataNode[]>([]);
  const [templateTreeLoading, setTemplateTreeLoading] = useState(false);
  const [templateSectionCodes, setTemplateSectionCodes] = useState<string[]>([]);
  const [importingTemplate, setImportingTemplate] = useState(false);

  // 加载文档
  const loadDocument = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/unified-document/documents/${id}`, {
        params: { includeSections: true }
      });

      if (response.data.success) {
        setDocument(response.data.data);
        setSections(response.data.data.sections || []);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '加载文档失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadTemplateSectionTree = useCallback(async (templateId: string) => {
    setTemplateTreeLoading(true);
    try {
      const response = await axios.get(`/api/unified-document/templates/${templateId}/sections-tree`, {
        params: { editableOnly: true }
      });
      if (response.data.success) {
        let nodes: TemplateTreeNode[] = response.data.data || [];
        let defaults = flattenTemplateCodes(nodes);
        if (defaults.length > 10) {
          defaults = defaults.slice(0, 10);
          const allowedSet = new Set(defaults);
          nodes = truncateTreeByCodes(nodes, allowedSet);
        }

        setTemplateTreeData(convertTemplateTreeToData(nodes));
        setTemplateSectionCodes(defaults);
      }
    } catch (error: any) {
      console.error('加载模板章节失败', error);
      message.error(error.response?.data?.message || '加载模板章节失败');
      setTemplateTreeData([]);
      setTemplateSectionCodes([]);
    } finally {
      setTemplateTreeLoading(false);
    }
  }, []);

  const handleTemplateSelect = useCallback((value?: string) => {
    let templateId = value || null;
    setTemplateTreeData([]);
    setTemplateSectionCodes([]);

    if (!templateId) {
      if (templateOptions.length === 0) {
        setSelectedTemplateId(null);
        return;
      }
      templateId = templateOptions[0].id;
    }

    setSelectedTemplateId(templateId);
    loadTemplateSectionTree(templateId);
  }, [templateOptions, loadTemplateSectionTree]);

  const loadImportTemplates = useCallback(async () => {
    if (!document?.document_type) return;
    setTemplateLoading(true);
    try {
      const response = await axios.get('/api/unified-document/templates', {
        params: {
          templateType: document.document_type,
          status: 'published'
        }
      });
      if (response.data.success) {
        const list = response.data.data || [];
        setTemplateOptions(list);
        if (!selectedTemplateId && list.length > 0) {
          handleTemplateSelect(list[0].id);
        }
      }
    } catch (error) {
      console.error('加载模板列表失败', error);
    } finally {
      setTemplateLoading(false);
    }
  }, [document?.document_type, selectedTemplateId, handleTemplateSelect]);

  const handleTemplateTreeCheck = useCallback((checkedKeys: any) => {
    const list = Array.isArray(checkedKeys)
      ? checkedKeys
      : checkedKeys.checked || [];
    setTemplateSectionCodes(list.map((key: React.Key) => String(key)));
  }, []);

  const handleCloseImportModal = useCallback(() => {
    setImportModalVisible(false);
    setSelectedTemplateId(null);
    setTemplateTreeData([]);
    setTemplateSectionCodes([]);
  }, []);

  const handleImportTemplateSubmit = useCallback(async () => {
    if (!selectedTemplateId) {
      message.error('请选择要导入的模板');
      return;
    }
    if (!templateSectionCodes.length) {
      message.error('请选择要导入的章节');
      return;
    }
    setImportingTemplate(true);
    try {
      await axios.post(`/api/unified-document/documents/${id}/import-template`, {
        templateId: selectedTemplateId,
        sectionCodes: templateSectionCodes,
      });
      message.success('模板章节导入成功');
      handleCloseImportModal();
      await loadDocument();
    } catch (error: any) {
      message.error(error.response?.data?.message || '导入失败');
    } finally {
      setImportingTemplate(false);
    }
  }, [selectedTemplateId, templateSectionCodes, id, handleCloseImportModal, loadDocument]);

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
    history: {
      delay: 2000,
      maxStack: 500,
      userOnly: true
    }
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
      loadDocument();
    }
  }, [id, loadDocument]);

  useEffect(() => {
    if (importModalVisible) {
      loadImportTemplates();
    }
  }, [importModalVisible, loadImportTemplates]);

  // 将章节数组转换为树形结构
  const convertToTreeData = (sections: Section[]): DataNode[] => {
    return sections.map((section) => ({
      key: section.id,
      title: (
        <Space>
          <span style={{ color: '#1890ff', fontFamily: 'monospace' }}>
            {section.section_code || '--'}
          </span>
          <span>{section.title}</span>
          {section.approval_status && section.approval_status !== 'draft' && (
            <Tag color={getApprovalStatusColor(section.approval_status)}>
              {getApprovalStatusText(section.approval_status)}
            </Tag>
          )}
        </Space>
      ),
      children: section.children ? convertToTreeData(section.children) : [],
    }));
  };

  // 获取审批状态颜色
  const getApprovalStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      draft: 'default',
      submitted: 'processing',
      in_review: 'processing',
      approved: 'success',
      rejected: 'error',
      revision_needed: 'warning',
    };
    return colors[status] || 'default';
  };

  // 获取审批状态文本
  const getApprovalStatusText = (status: string): string => {
    const texts: Record<string, string> = {
      draft: '草稿',
      submitted: '已提交',
      in_review: '审批中',
      approved: '已批准',
      rejected: '已拒绝',
      revision_needed: '需修改',
    };
    return texts[status] || status;
  };

  // 选择章节
  const handleSelectSection = async (selectedKeys: React.Key[]) => {
    if (selectedKeys.length === 0) return;

    const sectionId = selectedKeys[0] as string;
    const findSection = (sections: Section[]): Section | null => {
      for (const section of sections) {
        if (section.id === sectionId) return section;
        if (section.children) {
          const found = findSection(section.children);
          if (found) return found;
        }
      }
      return null;
    };

    const section = findSection(sections);
    if (section) {
      setSelectedSection(section);
      setContent(section.content || '');

      // 锁定章节
      try {
        await axios.post(`/api/unified-document/sections/${section.id}/lock`);
        setIsLocked(true);
      } catch (error: any) {
        message.warning(error.response?.data?.message || '无法锁定章节');
      }
    }
  };

  // 保存章节内容
  const handleSaveSection = async () => {
    if (!selectedSection) return;

    setSaving(true);
    try {
      await axios.put(`/api/unified-document/sections/${selectedSection.id}/content`, {
        content
      });
      message.success('保存成功');

      // 刷新文档
      await loadDocument();
    } catch (error: any) {
      message.error(error.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 提交审批
  const handleSubmitApproval = () => {
    Modal.confirm({
      title: '提交审批',
      content: '确定要提交这个章节进行审批吗？',
      onOk: async () => {
        try {
          // TODO: 实现提交审批逻辑
          message.success('已提交审批');
        } catch (error: any) {
          message.error(error.response?.data?.message || '提交审批失败');
        }
      },
    });
  };

  // AI辅助菜单
  const aiMenuItems = [
    {
      key: 'generate',
      label: '生成内容',
      icon: <RobotOutlined />,
    },
    {
      key: 'improve',
      label: '改进写作',
      icon: <RobotOutlined />,
    },
    {
      key: 'check',
      label: '一致性检查',
      icon: <RobotOutlined />,
    },
  ];

  // 调用AI能力
  const handleAIAction = async (key: string) => {
    if (!selectedSection || !document) return;

    try {
      const response = await axios.post('/api/unified-document/ai/invoke', {
        documentType: document.document_type,
        capabilityId: key === 'generate' ? 'generate_content' : key === 'improve' ? 'improve_writing' : 'check_consistency',
        inputData: {
          documentId: document.id,
          sectionId: selectedSection.id,
          content: content,
        },
      });

      if (response.data.success) {
        if (key === 'generate' || key === 'improve') {
          const result = response.data.data;
          setContent(result.improved_content || result.content || content);
          message.success('AI处理完成');
        } else {
          // 显示检查结果
          message.info('一致性检查完成');
        }
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || 'AI处理失败');
    }
  };

  // 新增章节
  const handleAddSection = async (values: any) => {
    if (!id) return;

    try {
      await axios.post('/api/unified-document/sections', {
        documentId: id,
        title: values.title,
        parentId: values.parent_id || null,
        level: values.parent_id ? 2 : 1, // 如果有父章节则为2级，否则为1级
      });

      message.success('章节创建成功');
      setAddSectionModalVisible(false);
      addSectionForm.resetFields();
      await loadDocument();
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建章节失败');
    }
  };

  // 自动滚动到最新消息
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // 发送消息给AI助手
  const handleSendMessage = async () => {
    if (!userInput.trim() || !selectedSection) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: userInput,
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setAiGenerating(true);
    setAiSuggestion('');

    try {
      const context = {
        sectionTitle: selectedSection.title,
        currentContent: content,
        documentType: document?.document_type,
        conversationHistory: chatMessages.slice(-4),
      };

      const response = await fetch('/api/unified-document/ai/chat-assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          documentId: document?.id,
          sectionId: selectedSection.id,
          userMessage: userInput,
          context,
        }),
      });

      if (!response.ok) throw new Error('AI请求失败');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let isThinking = false;

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                // 检测思考标记
                if (parsed.content === '__THINKING__') {
                  isThinking = true;
                  setAiSuggestion('🤔 正在思考...');
                } else if (parsed.content === '__THINKING_DONE__') {
                  isThinking = false;
                  setAiSuggestion('');
                } else if (!isThinking) {
                  accumulatedContent += parsed.content;
                  setAiSuggestion(accumulatedContent);
                }
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: accumulatedContent,
        timestamp: new Date(),
        suggestions: {
          action: 'replace',
          content: accumulatedContent,
        },
      };

      setChatMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      message.error(error.message || 'AI处理失败');
    } finally {
      setAiGenerating(false);
    }
  };

  // 应用AI建议
  const handleApplySuggestion = (msg: ChatMessage, action: 'insert' | 'replace' | 'append') => {
    if (!msg.suggestions?.content) return;

    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const suggestedContent = msg.suggestions.content;

    switch (action) {
      case 'replace':
        setContent(suggestedContent);
        message.success('已替换内容');
        break;

      case 'insert':
        const selection = quill.getSelection();
        if (selection) {
          quill.insertText(selection.index, suggestedContent);
        } else {
          quill.insertText(quill.getLength(), suggestedContent);
        }
        message.success('已插入内容');
        break;

      case 'append':
        const currentLength = quill.getLength();
        quill.insertText(currentLength, '\n\n' + suggestedContent);
        message.success('已追加内容');
        break;
    }
  };

  // 复制AI建议
  const handleCopySuggestion = (content: string) => {
    navigator.clipboard.writeText(content);
    message.success('已复制到剪贴板');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <Layout style={{ height: '100vh' }}>
      {/* 左侧章节树 */}
      <Sider width={300} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
          <h3>{document?.title}</h3>
          <Space>
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setAddSectionModalVisible(true)}
            >
              新增章节
            </Button>
          </Space>
        </div>

        <div style={{ padding: 16, height: 'calc(100% - 80px)', overflow: 'auto' }}>
          <Tree
            showLine
            defaultExpandAll
            treeData={convertToTreeData(sections)}
            onSelect={handleSelectSection}
          />
        </div>
      </Sider>

      {/* 主编辑区 */}
      <Content style={{ background: '#fff', display: 'flex', flexDirection: 'column' }}>
        {/* 工具栏 */}
        <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveSection}
              loading={saving}
              disabled={!selectedSection}
            >
              保存
            </Button>
            <Button
              icon={<SendOutlined />}
              onClick={handleSubmitApproval}
              disabled={!selectedSection}
            >
              提交审批
            </Button>
          </Space>

          <Space>
            <Button
              icon={<FileAddOutlined />}
              onClick={() => setImportModalVisible(true)}
            >
              导入模板
            </Button>
            <Tooltip title="AI写作助手">
              <Button
                icon={<RobotOutlined />}
                onClick={() => setAiAssistantVisible(true)}
                type={aiAssistantVisible ? 'primary' : 'default'}
              >
                AI助手
              </Button>
            </Tooltip>
            <Switch
              checked={trackChanges}
              onChange={setTrackChanges}
              checkedChildren="修订追踪"
              unCheckedChildren="修订追踪"
            />
            <Button onClick={() => navigate('/documents')}>
              返回列表
            </Button>
          </Space>
        </div>

        {/* 编辑区域 */}
        <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          {selectedSection ? (
            <div>
              <h2>
                <span style={{ color: '#1890ff', marginRight: 8 }}>
                  {selectedSection.section_code || '--'}
                </span>
                {selectedSection.title}
              </h2>
              <ReactQuill
                ref={quillRef}
                theme="snow"
                value={content}
                onChange={setContent}
                modules={modules}
                formats={formats}
                placeholder="请输入内容..."
                readOnly={!selectedSection.editable}
                style={{
                  height: 'calc(100vh - 280px)',
                  marginBottom: 16
                }}
              />
              {!selectedSection.editable && (
                <div style={{ marginTop: 60, color: '#999', textAlign: 'center' }}>
                  该章节不可编辑
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginTop: 100, color: '#999' }}>
              <FileTextOutlined style={{ fontSize: 64, marginBottom: 16 }} />
              <p>请从左侧选择要编辑的章节</p>
            </div>
          )}
        </div>
      </Content>

      {/* 模板导入 */}
      <Modal
        title="导入模板章节"
        open={importModalVisible}
        onCancel={handleCloseImportModal}
        onOk={handleImportTemplateSubmit}
        confirmLoading={importingTemplate}
        width={640}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>选择模板</div>
            <Select
              placeholder="请选择模板"
              allowClear
              loading={templateLoading}
              value={selectedTemplateId || undefined}
              onChange={(value) => handleTemplateSelect(value)}
              onClear={() => handleTemplateSelect(undefined)}
              style={{ width: '100%' }}
            >
              {templateOptions.map((template) => (
                <Option key={template.id} value={template.id}>
                  {template.name}
                </Option>
              ))}
            </Select>
          </div>

          <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>选择章节</div>
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 4, padding: 12, maxHeight: 320, overflow: 'auto' }}>
              {!selectedTemplateId ? (
                <Empty description="请选择模板以加载章节" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : templateTreeLoading ? (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <Spin />
                </div>
              ) : templateTreeData.length > 0 ? (
                <Tree
                  checkable
                  selectable={false}
                  checkedKeys={templateSectionCodes}
                  onCheck={handleTemplateTreeCheck}
                  treeData={templateTreeData}
                  defaultExpandAll
                />
              ) : (
                <Empty description="没有可导入的章节" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          </div>
        </Space>
      </Modal>

      {/* 新增章节模态框 */}
      <Modal
        title="新增章节"
        open={addSectionModalVisible}
        onCancel={() => {
          setAddSectionModalVisible(false);
          addSectionForm.resetFields();
        }}
        onOk={() => addSectionForm.submit()}
        width={500}
      >
        <Form
          form={addSectionForm}
          layout="vertical"
          onFinish={handleAddSection}
        >
          <Form.Item
            name="title"
            label="章节标题"
            rules={[{ required: true, message: '请输入章节标题' }]}
          >
            <Input placeholder="请输入章节标题" />
          </Form.Item>

          <Form.Item
            name="parent_id"
            label="父章节（可选）"
          >
            <Select placeholder="选择父章节，留空则为顶级章节" allowClear>
              {sections.map((section) => (
                <Option key={section.id} value={section.id}>
                  {section.title}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* AI助手抽屉 */}
      <Drawer
        title={
          <Space>
            <RobotOutlined />
            <span>AI写作助手</span>
            {selectedSection && (
              <Tag color="blue">{selectedSection.title}</Tag>
            )}
          </Space>
        }
        placement="right"
        width={480}
        open={aiAssistantVisible}
        onClose={() => setAiAssistantVisible(false)}
        bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}
      >
        {/* 对话历史 */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
          background: '#f5f5f5'
        }}>
          {chatMessages.length === 0 ? (
            <Card style={{ textAlign: 'center', marginTop: 40 }}>
              <RobotOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
              <h3>AI写作助手</h3>
              <p style={{ color: '#999' }}>
                告诉我你想写什么，我来帮你生成内容<br />
                或者描述你想如何修改现有内容
              </p>
              <Divider />
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button block onClick={() => setUserInput('帮我写一个项目概述')}>
                  帮我写项目概述
                </Button>
                <Button block onClick={() => setUserInput('优化这段文字，使其更专业')}>
                  优化文字表达
                </Button>
                <Button block onClick={() => setUserInput('扩展这段内容，增加更多细节')}>
                  扩展内容细节
                </Button>
              </Space>
            </Card>
          ) : (
            <List
              dataSource={chatMessages}
              renderItem={(msg) => (
                <div style={{
                  marginBottom: 16,
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}>
                  {msg.role === 'assistant' && (
                    <Avatar icon={<RobotOutlined />} style={{ background: '#1890ff', marginRight: 8 }} />
                  )}
                  <div style={{ maxWidth: '80%' }}>
                    <Card
                      size="small"
                      style={{
                        background: msg.role === 'user' ? '#1890ff' : '#fff',
                        color: msg.role === 'user' ? '#fff' : '#000',
                      }}
                    >
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>

                      {msg.role === 'assistant' && msg.suggestions && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                          <Space wrap>
                            <Tooltip title="替换当前内容">
                              <Button
                                size="small"
                                icon={<SwapOutlined />}
                                onClick={() => handleApplySuggestion(msg, 'replace')}
                              >
                                替换
                              </Button>
                            </Tooltip>
                            <Tooltip title="插入到光标位置">
                              <Button
                                size="small"
                                icon={<InsertRowBelowOutlined />}
                                onClick={() => handleApplySuggestion(msg, 'insert')}
                              >
                                插入
                              </Button>
                            </Tooltip>
                            <Tooltip title="追加到末尾">
                              <Button
                                size="small"
                                icon={<PlusCircleOutlined />}
                                onClick={() => handleApplySuggestion(msg, 'append')}
                              >
                                追加
                              </Button>
                            </Tooltip>
                            <Tooltip title="复制">
                              <Button
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={() => handleCopySuggestion(msg.content)}
                              />
                            </Tooltip>
                          </Space>
                        </div>
                      )}
                    </Card>
                    <div style={{
                      fontSize: 12,
                      color: '#999',
                      marginTop: 4,
                      textAlign: msg.role === 'user' ? 'right' : 'left'
                    }}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  {msg.role === 'user' && (
                    <Avatar style={{ background: '#87d068', marginLeft: 8 }}>我</Avatar>
                  )}
                </div>
              )}
            />
          )}

          {/* 实时生成显示 */}
          {aiGenerating && (
            <div style={{ display: 'flex', marginBottom: 16 }}>
              <Avatar icon={<RobotOutlined />} style={{ background: '#1890ff', marginRight: 8 }} />
              <Card size="small" style={{ flex: 1 }}>
                {aiSuggestion ? (
                  <>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{aiSuggestion}</div>
                    {aiSuggestion !== '🤔 正在思考...' && <Spin style={{ marginLeft: 8 }} />}
                  </>
                ) : (
                  <Spin />
                )}
              </Card>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* 输入框 */}
        <div style={{
          padding: 16,
          background: '#fff',
          borderTop: '1px solid #f0f0f0'
        }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input.TextArea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="描述你的需求，例如：帮我写一段项目背景介绍..."
              autoSize={{ minRows: 2, maxRows: 4 }}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={aiGenerating}
            />
          </Space.Compact>
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#999' }}>
              Shift + Enter 换行，Enter 发送
            </span>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSendMessage}
              loading={aiGenerating}
              disabled={!userInput.trim() || !selectedSection}
            >
              发送
            </Button>
          </div>
        </div>
      </Drawer>

      {/* 浮动按钮 - 快速打开AI助手 */}
      {!aiAssistantVisible && selectedSection && (
        <FloatButton
          icon={<CommentOutlined />}
          type="primary"
          style={{ right: 24, bottom: 24 }}
          onClick={() => setAiAssistantVisible(true)}
          tooltip="AI写作助手"
        />
      )}
    </Layout>
  );
};

export default DocumentEditor;
