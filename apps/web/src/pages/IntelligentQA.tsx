import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Input,
  Button,
  Space,
  Select,
  List,
  Typography,
  Tag,
  Spin,
  message,
  Avatar,
  Divider,
  Upload,
  Tooltip,
  Collapse,
  Drawer,
  Empty,
  Popconfirm
} from 'antd';
import {
  SendOutlined,
  UserOutlined,
  RobotOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  PaperClipOutlined,
  DownloadOutlined,
  FileWordOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  HistoryOutlined,
  DeleteOutlined,
  PlusOutlined,
  MessageOutlined,
  FileSearchOutlined,
  EyeOutlined,
  BulbOutlined,
  RocketOutlined,
  TranslationOutlined,
  BarChartOutlined,
  CaretRightOutlined,
  CaretDownOutlined
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import type { UploadFile } from 'antd';
import axios from '../utils/axios';
import { useConversation } from '../hooks/useConversation';
import './IntelligentQA.css';

const { TextArea } = Input;
const { Text } = Typography;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  timestamp: Date;
  sources?: string[];
  attachments?: UploadFile[];
  outputFiles?: {
    name: string;
    url: string;
    type: string;
  }[];
}

const IntelligentQA: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [knowledgeScope, setKnowledgeScope] = useState<'all' | 'enterprise' | 'personal'>('all');
  const [attachments, setAttachments] = useState<UploadFile[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [sourceDrawerVisible, setSourceDrawerVisible] = useState(false);
  const [currentSources, setCurrentSources] = useState<any[]>([]);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false);

  const {
    currentConversationId,
    conversations,
    loading: conversationLoading,
    createConversation,
    fetchConversations,
    fetchMessages,
    addMessage,
    deleteConversation,
    switchConversation,
  } = useConversation();

  const token = localStorage.getItem('token');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (isSendingRef.current) return;
    if (currentConversationId) {
      loadConversationMessages(currentConversationId);
    } else {
      setMessages([]);
    }
  }, [currentConversationId]);

  const loadConversationMessages = async (conversationId: string) => {
    try {
      setLoading(true);
      const msgs = await fetchMessages(conversationId);
      setMessages(msgs || []);
    } catch (error) {
      message.error('加载历史消息失败');
    } finally {
      setLoading(false);
    }
  };

  const uploadProps = {
    beforeUpload: (file: File) => {
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('文件大小不能超过10MB');
        return false;
      }
      setAttachments(prev => [...prev, file as any]);
      return false;
    },
    onRemove: (file: UploadFile) => {
      setAttachments(prev => prev.filter(f => f.uid !== file.uid));
    },
    fileList: attachments,
    multiple: true
  };

  const handleViewSources = (sources: any[]) => {
    setCurrentSources(sources);
    setSourceDrawerVisible(true);
  };

  const handleViewDocument = async (source: any) => {
    try {
      if (!source.document_id) {
        message.error('文档ID不存在');
        return;
      }
      window.open(`/preview/${source.document_id}?page=${source.page || 1}`, '_blank');
    } catch (error) {
      message.error('打开文档失败');
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() && attachments.length === 0) {
      message.warning('请输入问题或上传文件');
      return;
    }

    isSendingRef.current = true;
    setIsThinkingExpanded(true); // 新消息默认展开思考

    let conversationId = currentConversationId;
    if (!conversationId) {
      try {
        const newConv = await createConversation(knowledgeScope, inputValue.substring(0, 30));
        conversationId = newConv.id;
        await fetchConversations();
      } catch (error) {
        message.error('创建会话失败');
        isSendingRef.current = false;
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue || '(上传了附件)',
      timestamp: new Date(),
      attachments: [...attachments]
    };

    setMessages(prev => [...prev, userMessage]);
    const questionText = inputValue;
    setInputValue('');
    const currentAttachments = [...attachments];
    setAttachments([]);
    setLoading(true);

    const assistantId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      await addMessage(conversationId!, 'user', userMessage.content, {
        attachments: userMessage.attachments?.map(f => ({
          name: f.name,
          size: f.size,
          type: f.type
        }))
      });

      const formData = new FormData();
      formData.append('question', questionText);
      formData.append('scope', knowledgeScope);
      formData.append('conversationId', conversationId!);
      formData.append('history', JSON.stringify(messages.slice(-5)));

      currentAttachments.forEach((file) => {
        formData.append('files', file as any);
      });

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/knowledge/chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        if (response.status === 401) {
          message.error('登录已过期，请重新登录');
          setTimeout(() => {
            window.location.href = '/login';
          }, 1500);
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let fullThinking = '';
      let isThinkingComplete = false;
      let sources: string[] = [];
      let outputFiles: any[] = [];

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'));

        for (const line of lines) {
          const data = line.replace('data: ', '').trim();
          if (!data) continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'chunk') {
              const prevThinking = fullThinking;
              fullContent += parsed.content || '';
              fullThinking += parsed.thinking || '';

              if (prevThinking.length > 0 && fullThinking === prevThinking && parsed.content) {
                isThinkingComplete = true;
              }

              if (!isThinkingComplete && fullThinking && !fullContent) {
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === assistantId
                      ? { ...msg, thinking: fullThinking, content: '' }
                      : msg
                  )
                );
              } else if (fullContent) {
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === assistantId
                      ? { ...msg, content: fullContent, thinking: fullThinking }
                      : msg
                  )
                );
              }
            } else if (parsed.type === 'file') {
              outputFiles.push(parsed.file);
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === assistantId
                    ? { ...msg, outputFiles: [...(msg.outputFiles || []), parsed.file] }
                    : msg
                )
              );
            } else if (parsed.type === 'done') {
              if (parsed.sources) {
                sources = parsed.sources;
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === assistantId
                      ? { ...msg, sources: parsed.sources }
                      : msg
                  )
                );
              }
            } else if (parsed.type === 'error') {
              throw new Error(parsed.message || '生成失败');
            }
          } catch (e) {
            console.warn('解析SSE数据失败:', e);
          }
        }
      }

      await addMessage(conversationId!, 'assistant', fullContent, {
        thinking: fullThinking,
        sources,
        outputFiles
      });

      await fetchConversations();

    } catch (error: any) {
      message.error('发送失败: ' + (error.message || '未知错误'));
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantId
            ? { ...msg, content: '抱歉，处理失败，请稍后重试。' }
            : msg
        )
      );
    } finally {
      setLoading(false);
      isSendingRef.current = false;
    }
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.setAttribute('download', fileName);
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('开始下载');
    } catch (error) {
      console.error('下载失败:', error);
      message.error('下载失败');
    }
  };

  const handleClear = () => {
    switchConversation(null);
    setMessages([]);
    setAttachments([]);
    message.success('已开始新对话');
  };

  const handleDeleteConversation = async (convId: string) => {
    try {
      await deleteConversation(convId);
      message.success('会话已删除');
    } catch (error) {
      message.error('删除会话失败');
    }
  };

  const handleSwitchConversation = (convId: string) => {
    switchConversation(convId);
    setDrawerVisible(false);
  };

  const getFileIcon = (type: string) => {
    if (type.includes('word')) return <FileWordOutlined style={{ color: '#1890ff', fontSize: 24 }} />;
    if (type.includes('pdf')) return <FilePdfOutlined style={{ color: '#f5222d', fontSize: 24 }} />;
    if (type.includes('excel') || type.includes('sheet')) return <FileExcelOutlined style={{ color: '#52c41a', fontSize: 24 }} />;
    return <PaperClipOutlined style={{ fontSize: 24 }} />;
  };

  const scopeOptions = [
    { value: 'all', label: '全部知识库' },
    { value: 'enterprise', label: '企业知识库' },
    { value: 'personal', label: '个人知识库' }
  ];

  const suggestions = [
    { title: '合同审查', desc: '帮我审查这份施工合同的风险点', icon: <FileSearchOutlined /> },
    { title: '规范查询', desc: '最新的建筑防火规范有哪些要求？', icon: <BulbOutlined /> },
    { title: '数据分析', desc: '分析上个月的项目进度数据', icon: <BarChartOutlined /> },
    { title: '文档翻译', desc: '将这份技术说明书翻译成英文', icon: <TranslationOutlined /> },
  ];

  return (
    <div className="qa-page-container">
      {/* 顶部导航 */}
      <div style={{
        padding: '16px 24px',
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10
      }}>
        <Space size="large">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 600, color: '#333' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
            }}>
              <RobotOutlined />
            </div>
            智能问答助手
          </div>
          <Select
            value={knowledgeScope}
            onChange={setKnowledgeScope}
            style={{ width: 160 }}
            options={scopeOptions}
            bordered={false}
            suffixIcon={<DatabaseOutlined style={{ color: '#667eea' }} />}
          />
        </Space>
        <Space>
          <Button type="text" icon={<HistoryOutlined />} onClick={() => setDrawerVisible(true)}>
            历史会话
          </Button>
          <Button type="primary" shape="round" icon={<PlusOutlined />} onClick={handleClear} 
            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none' }}>
            新对话
          </Button>
        </Space>
      </div>

      {/* 消息列表 */}
      <div className="chat-message-list">
        {messages.length === 0 ? (
          <div className="welcome-container">
            <div className="welcome-icon">
              <RocketOutlined />
            </div>
            <div className="welcome-title">有什么我可以帮你的吗？</div>
            <div className="welcome-subtitle">
              我可以协助你查询规范、审查图纸、分析数据，或者处理文档工作。
            </div>
            
            <div className="suggestion-grid">
              {suggestions.map((item, index) => (
                <div key={index} className="suggestion-card" onClick={() => setInputValue(item.desc)}>
                  <div className="suggestion-icon">{item.icon}</div>
                  <div className="suggestion-text">
                    <div className="suggestion-title">{item.title}</div>
                    <div className="suggestion-desc">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ paddingBottom: 20 }}>
            {messages.map((msg) => (
              <div key={msg.id} className={`message-row ${msg.role}`}>
                <div className={`message-avatar ${msg.role}`}>
                  {msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '100%' }}>
                  <div className="message-bubble">
                    {/* 思考过程 */}
                    {msg.thinking && msg.role === 'assistant' && (
                      <div className="thinking-process">
                        <div 
                          className="thinking-header"
                          onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                        >
                          {isThinkingExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
                          <span>{msg.content ? '深度思考过程' : '正在思考...'}</span>
                        </div>
                        {isThinkingExpanded && (
                          <div className="thinking-content">
                            {msg.thinking}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 消息内容 */}
                    <div className="markdown-content">
                      {msg.role === 'assistant' ? (
                         <ReactMarkdown
                           components={{
                             a: ({node, ...props}) => <a style={{color: '#1890ff'}} {...props} target="_blank" rel="noopener noreferrer" />
                           }}
                         >
                           {msg.content || (msg.thinking ? '' : '...')}
                         </ReactMarkdown>
                      ) : (
                        msg.content
                      )}
                    </div>

                    {/* 附件显示 */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {msg.attachments.map((file, idx) => (
                          <Tag key={idx} className="attachment-tag">
                            <PaperClipOutlined /> {file.name}
                          </Tag>
                        ))}
                      </div>
                    )}

                    {/* 生成的文件 */}
                    {msg.outputFiles && msg.outputFiles.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        {msg.outputFiles.map((file, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '12px',
                              backgroundColor: '#f8faff',
                              borderRadius: '12px',
                              border: '1px solid #e6ebf1',
                              marginBottom: 8,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}
                          >
                            <Space>
                              {getFileIcon(file.type)}
                              <div>
                                <div style={{ fontWeight: 500, color: '#333' }}>{file.name}</div>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {file.type}
                                </Text>
                              </div>
                            </Space>
                            <Button
                              type="link"
                              icon={<DownloadOutlined />}
                              onClick={() => handleDownload(file.url, file.name)}
                            >
                              下载
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 引用来源按钮 */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                        <Button
                          size="small"
                          type="dashed"
                          icon={<FileSearchOutlined />}
                          onClick={() => handleViewSources(msg.sources!)}
                          style={{ borderRadius: 12, fontSize: 12 }}
                        >
                          查看引用来源 ({msg.sources.length})
                        </Button>
                      </div>
                    )}
                  </div>
                  <div style={{ 
                    fontSize: 12, 
                    color: '#999', 
                    marginTop: 4, 
                    textAlign: msg.role === 'user' ? 'right' : 'left',
                    padding: '0 4px'
                  }}>
                    {msg.timestamp.toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </div>
              </div>
            ))}
            {loading && !messages.some(m => m.role === 'assistant' && !m.content && !m.thinking) && (
              <div style={{ display: 'flex', gap: 12, paddingLeft: 12 }}>
                 <div className="message-avatar assistant">
                   <RobotOutlined />
                 </div>
                 <div className="message-bubble" style={{ background: '#fff', color: '#999' }}>
                   <Spin size="small" /> 正在分析...
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 底部输入框 */}
      <div className="input-container">
        <div className="input-box-wrapper">
          {attachments.length > 0 && (
            <div className="input-files-preview">
              {attachments.map(file => (
                <Tag
                  key={file.uid}
                  closable
                  onClose={() => uploadProps.onRemove(file)}
                  style={{ borderRadius: 4, background: '#f5f5f5', border: '1px solid #e0e0e0' }}
                >
                  <PaperClipOutlined /> {file.name}
                </Tag>
              ))}
            </div>
          )}
          
          <div className="main-input-area">
            <Upload {...uploadProps} showUploadList={false}>
              <Tooltip title="上传文件">
                <Button 
                  type="text" 
                  shape="circle" 
                  icon={<PaperClipOutlined style={{ fontSize: 18, color: '#666' }} />} 
                />
              </Tooltip>
            </Upload>
            
            <TextArea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="问点什么... (Enter 发送)"
              autoSize={{ minRows: 1, maxRows: 6 }}
              className="custom-textarea"
              onPressEnter={(e) => {
                if (e.shiftKey) return;
                e.preventDefault();
                handleSend();
              }}
              style={{ flex: 1 }}
            />
            
            <Button
              className="send-btn"
              type="primary"
              onClick={handleSend}
              loading={loading}
              disabled={!inputValue.trim() && attachments.length === 0}
            >
              {!loading && <SendOutlined style={{ fontSize: 18 }} />}
            </Button>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: '#aaa' }}>
          AI生成内容可能包含错误，请仔细核查重要的事实和数据
        </div>
      </div>

      {/* 历史会话侧边栏 - 保持不变 */}
      <Drawer
        title="历史会话"
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={360}
      >
        {conversationLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin />
          </div>
        ) : conversations.length === 0 ? (
          <Empty description="暂无历史会话" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            dataSource={conversations}
            renderItem={(conv) => (
              <div
                key={conv.id}
                style={{
                  cursor: 'pointer',
                  backgroundColor: conv.id === currentConversationId ? '#f0f4ff' : 'transparent',
                  padding: '16px',
                  borderRadius: '12px',
                  marginBottom: '8px',
                  border: conv.id === currentConversationId ? '1px solid #dbe4ff' : '1px solid transparent',
                  transition: 'all 0.2s'
                }}
                className="history-item"
                onClick={() => handleSwitchConversation(conv.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <Text strong ellipsis style={{ width: 240, color: '#333' }}>{conv.title}</Text>
                  <Popconfirm
                    title="确定删除？"
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      handleDeleteConversation(conv.id);
                    }}
                    okText="是"
                    cancelText="否"
                  >
                    <DeleteOutlined 
                      style={{ color: '#ccc', cursor: 'pointer' }} 
                      onClick={e => e.stopPropagation()}
                      className="delete-icon"
                    />
                  </Popconfirm>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#999' }}>
                   <span><MessageOutlined /> {conv.messageCount}</span>
                   <span>{new Date(conv.lastActivityAt).toLocaleDateString()}</span>
                </div>
              </div>
            )}
          />
        )}
      </Drawer>

      {/* 引用来源Drawer - 保持不变 */}
      <Drawer
        title={
          <Space>
            <FileSearchOutlined />
            <span>引用来源</span>
            {currentSources.length > 0 && (
              <Tag color="blue">{currentSources.length} 个来源</Tag>
            )}
          </Space>
        }
        placement="right"
        width={500}
        onClose={() => setSourceDrawerVisible(false)}
        open={sourceDrawerVisible}
      >
        <List
          dataSource={currentSources}
          renderItem={(source: any, index: number) => (
            <Card
              key={index}
              style={{ marginBottom: 16, borderRadius: 12, border: '1px solid #f0f0f0' }}
              size="small"
              title={
                <Space>
                  <FileWordOutlined style={{ color: '#1890ff' }} />
                  <Text strong style={{ fontSize: 13 }}>{source.citation || `[${source.id}] ${source.document_name}`}</Text>
                </Space>
              }
              extra={
                <Tooltip title="查看原文">
                  <Button
                    type="link"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => handleViewDocument(source)}
                  />
                </Tooltip>
              }
            >
              {/* 文档信息 */}
              <div style={{ marginBottom: 12 }}>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  {source.section && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      📖 章节: {source.section}
                    </Text>
                  )}
                  {source.article && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      📄 条款: {source.article}
                    </Text>
                  )}
                  {source.page && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      📃 页码: 第{source.page}页
                    </Text>
                  )}
                </Space>
              </div>

              <Divider style={{ margin: '12px 0' }} />

              {/* 内容预览 */}
              <div
                style={{
                  padding: 12,
                  background: '#f8f9fa',
                  borderRadius: 8,
                  fontSize: 12,
                  lineHeight: '1.6',
                  maxHeight: 200,
                  overflow: 'auto',
                  border: '1px solid #eee'
                }}
              >
                {source.preview || source.full_content}
              </div>

              {/* 相似度 */}
              <div style={{ marginTop: 12, textAlign: 'right' }}>
                <Tag color={source.score > 10 ? 'green' : source.score > 5 ? 'blue' : 'orange'}>
                  相似度: {source.score.toFixed(2)}
                </Tag>
              </div>
            </Card>
          )}
        />
        {currentSources.length === 0 && (
          <Empty description="暂无引用来源" />
        )}
      </Drawer>
    </div>
  );
};

export default IntelligentQA;
