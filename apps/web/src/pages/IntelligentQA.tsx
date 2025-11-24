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
  EyeOutlined
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false); // 标记是否正在发送消息，防止会话切换时覆盖

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

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 初始化：加载会话列表
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // 当切换会话时，加载历史消息（但发送消息过程中不要覆盖）
  useEffect(() => {
    if (isSendingRef.current) {
      // 发送消息过程中创建了新会话，不要覆盖当前消息
      return;
    }
    if (currentConversationId) {
      loadConversationMessages(currentConversationId);
    } else {
      setMessages([]);
    }
  }, [currentConversationId]);

  // 加载会话消息
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

  // 上传文件配置
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

  // 查看引用来源
  const handleViewSources = (sources: any[]) => {
    setCurrentSources(sources);
    setSourceDrawerVisible(true);
  };

  // 查看文档原文
  const handleViewDocument = async (source: any) => {
    try {
      if (!source.document_id) {
        message.error('文档ID不存在');
        return;
      }
      // 打开文档预览页面
      window.open(`/preview/${source.document_id}?page=${source.page || 1}`, '_blank');
    } catch (error) {
      message.error('打开文档失败');
    }
  };

  // 发送问题
  const handleSend = async () => {
    if (!inputValue.trim() && attachments.length === 0) {
      message.warning('请输入问题或上传文件');
      return;
    }

    // 标记开始发送，防止会话切换时覆盖消息
    isSendingRef.current = true;

    // 如果没有当前会话，创建新会话
    let conversationId = currentConversationId;
    if (!conversationId) {
      try {
        const newConv = await createConversation(knowledgeScope, inputValue.substring(0, 30));
        conversationId = newConv.id;
        await fetchConversations(); // 刷新会话列表
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

    // 创建助手消息占位符
    const assistantId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      // 保存用户消息到数据库
      await addMessage(conversationId!, 'user', userMessage.content, {
        attachments: userMessage.attachments?.map(f => ({
          name: f.name,
          size: f.size,
          type: f.type
        }))
      });

      // 创建 FormData 上传文件
      const formData = new FormData();
      formData.append('question', questionText);
      formData.append('scope', knowledgeScope);
      formData.append('conversationId', conversationId!);
      formData.append('history', JSON.stringify(messages.slice(-5)));

      currentAttachments.forEach((file) => {
        formData.append('files', file as any);
      });

      // 使用fetch接收SSE流式响应
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

      // 保存助手回复到数据库
      await addMessage(conversationId!, 'assistant', fullContent, {
        thinking: fullThinking,
        sources,
        outputFiles
      });

      // 刷新会话列表（更新最后活动时间）
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
      isSendingRef.current = false; // 发送完成，允许会话切换
    }
  };

  // 下载生成的文件
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

  // 清空对话（创建新会话）
  const handleClear = () => {
    switchConversation(null);
    setMessages([]);
    setAttachments([]);
    message.success('已开始新对话');
  };

  // 删除会话
  const handleDeleteConversation = async (convId: string) => {
    try {
      await deleteConversation(convId);
      message.success('会话已删除');
    } catch (error) {
      message.error('删除会话失败');
    }
  };

  // 切换会话
  const handleSwitchConversation = (convId: string) => {
    switchConversation(convId);
    setDrawerVisible(false);
  };

  // 获取文件图标
  const getFileIcon = (type: string) => {
    if (type.includes('word')) return <FileWordOutlined style={{ color: '#1890ff', fontSize: 24 }} />;
    if (type.includes('pdf')) return <FilePdfOutlined style={{ color: '#f5222d', fontSize: 24 }} />;
    if (type.includes('excel') || type.includes('sheet')) return <FileExcelOutlined style={{ color: '#52c41a', fontSize: 24 }} />;
    return <PaperClipOutlined style={{ fontSize: 24 }} />;
  };

  const scopeOptions = [
    { value: 'all', label: '全部知识库（企业+个人）' },
    { value: 'enterprise', label: '仅企业知识库' },
    { value: 'personal', label: '仅个人知识库' }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <RobotOutlined />
            <span>智能问答</span>
            {currentConversationId && (
              <Tag color="blue">
                <MessageOutlined /> 会话进行中
              </Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            <Select
              value={knowledgeScope}
              onChange={setKnowledgeScope}
              style={{ width: 220 }}
              options={scopeOptions}
              prefix={<DatabaseOutlined />}
            />
            <Button
              icon={<HistoryOutlined />}
              onClick={() => setDrawerVisible(true)}
            >
              历史会话 ({conversations.length})
            </Button>
            <Button
              icon={<PlusOutlined />}
              type="primary"
              onClick={handleClear}
            >
              新对话
            </Button>
          </Space>
        }
      >
        {/* 对话区域 */}
        <div
          style={{
            height: 'calc(100vh - 400px)',
            overflowY: 'auto',
            padding: '16px',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            marginBottom: '16px'
          }}
        >
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
              <RobotOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <div>欢迎使用智能问答助手</div>
              <div style={{ fontSize: 14, marginTop: 8 }}>
                支持文字提问、上传附件、生成文档等功能
              </div>
              <div style={{ fontSize: 12, marginTop: 8, color: '#bbb' }}>
                例如："翻译这个PDF文档" "根据这个Excel生成Word报告"
              </div>
            </div>
          ) : (
            <List
              dataSource={messages}
              renderItem={(msg) => (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    marginBottom: 16
                  }}
                >
                  <div
                    style={{
                      maxWidth: '70%',
                      display: 'flex',
                      flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                      alignItems: 'flex-start',
                      gap: 8
                    }}
                  >
                    <Avatar
                      icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                      style={{
                        backgroundColor: msg.role === 'user' ? '#1890ff' : '#52c41a'
                      }}
                    />
                    <div>
                      <div
                        style={{
                          padding: '12px 16px',
                          borderRadius: '8px',
                          backgroundColor: msg.role === 'user' ? '#1890ff' : '#fff',
                          color: msg.role === 'user' ? '#fff' : '#000',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}
                      >
                        {msg.thinking && msg.role === 'assistant' && (
                          <Collapse
                            size="small"
                            style={{ marginBottom: 12 }}
                            activeKey={msg.content ? undefined : ['1']}
                            defaultActiveKey={msg.content ? [] : ['1']}
                            items={[{
                              key: '1',
                              label: msg.content ? '💭 思考过程' : '💭 思考中...',
                              children: (
                                <div style={{
                                  whiteSpace: 'pre-wrap',
                                  color: '#666',
                                  fontSize: '13px',
                                  lineHeight: '1.6'
                                }}>
                                  {msg.thinking}
                                </div>
                              )
                            }]}
                          />
                        )}

                        {msg.role === 'assistant' ? (
                          <div className="assistant-message">
                            <ReactMarkdown
                              components={{
                                p: ({children}) => <>{children}</>,
                                li: ({children}) => <li>{children}</li>
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          msg.content
                        )}

                        {msg.attachments && msg.attachments.length > 0 && (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.3)' }}>
                            <Text style={{ color: msg.role === 'user' ? '#fff' : '#000', fontSize: 12 }}>
                              附件：
                            </Text>
                            {msg.attachments.map((file, idx) => (
                              <Tag key={idx} style={{ marginTop: 4 }}>
                                <PaperClipOutlined /> {file.name}
                              </Tag>
                            ))}
                          </div>
                        )}
                      </div>

                      {msg.outputFiles && msg.outputFiles.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          {msg.outputFiles.map((file, idx) => (
                            <div
                              key={idx}
                              style={{
                                padding: '12px',
                                backgroundColor: '#fff',
                                borderRadius: '8px',
                                border: '1px solid #d9d9d9',
                                marginBottom: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                              }}
                            >
                              <Space>
                                {getFileIcon(file.type)}
                                <div>
                                  <div style={{ fontWeight: 500 }}>{file.name}</div>
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    {file.type}
                                  </Text>
                                </div>
                              </Space>
                              <Button
                                type="primary"
                                icon={<DownloadOutlined />}
                                onClick={() => handleDownload(file.url, file.name)}
                              >
                                下载
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.sources && msg.sources.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <Button
                            size="small"
                            icon={<FileSearchOutlined />}
                            onClick={() => handleViewSources(msg.sources)}
                          >
                            查看引用来源 ({msg.sources.length})
                          </Button>
                        </div>
                      )}
                      <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                        {msg.timestamp.toLocaleTimeString('zh-CN')}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            />
          )}
          {loading && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Spin tip="正在思考..." />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
          {attachments.length > 0 && (
            <div style={{ padding: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
              <Space wrap>
                {attachments.map(file => (
                  <Tag
                    key={file.uid}
                    closable
                    onClose={() => uploadProps.onRemove(file)}
                  >
                    <PaperClipOutlined /> {file.name}
                  </Tag>
                ))}
              </Space>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <Upload {...uploadProps} showUploadList={false}>
              <Button
                icon={<PaperClipOutlined />}
                type="text"
                size="large"
                disabled={loading}
                style={{ fontSize: 20, color: '#999' }}
              />
            </Upload>

            <TextArea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="输入消息... (Enter发送，Shift+Enter换行)"
              autoSize={{ minRows: 1, maxRows: 6 }}
              onPressEnter={(e) => {
                if (e.shiftKey) {
                  return;
                }
                e.preventDefault();
                handleSend();
              }}
              disabled={loading}
              style={{ flex: 1, borderRadius: '12px', padding: '8px 16px' }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={loading}
              size="large"
              style={{ height: 'auto', borderRadius: '12px', padding: '8px 24px', fontWeight: 500 }}
            >
              发送
            </Button>
          </div>
        </div>

        <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
          <Space split={<Divider type="vertical" />}>
            <span>当前搜索范围：{scopeOptions.find(o => o.value === knowledgeScope)?.label}</span>
            <span>按 Enter 发送，Shift + Enter 换行</span>
            <span>支持上传文件并要求AI生成Word/Excel等格式输出</span>
          </Space>
        </div>
      </Card>

      {/* 历史会话侧边栏 */}
      <Drawer
        title="历史会话"
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={400}
      >
        {conversationLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin />
          </div>
        ) : conversations.length === 0 ? (
          <Empty description="暂无历史会话" />
        ) : (
          <List
            dataSource={conversations}
            renderItem={(conv) => (
              <List.Item
                style={{
                  cursor: 'pointer',
                  backgroundColor: conv.id === currentConversationId ? '#f0f0f0' : 'transparent',
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '8px'
                }}
                actions={[
                  <Popconfirm
                    title="确定删除这个会话吗？"
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      handleDeleteConversation(conv.id);
                    }}
                    okText="删除"
                    cancelText="取消"
                  >
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                ]}
                onClick={() => handleSwitchConversation(conv.id)}
              >
                <List.Item.Meta
                  avatar={<Avatar icon={<MessageOutlined />} />}
                  title={conv.title}
                  description={
                    <Space direction="vertical" size={0}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {conv.messageCount} 条消息
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(conv.lastActivityAt).toLocaleString('zh-CN')}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>

      {/* 引用来源Drawer */}
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
              style={{ marginBottom: 16 }}
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
                  background: '#f5f5f5',
                  borderRadius: 4,
                  fontSize: 12,
                  lineHeight: '1.6',
                  maxHeight: 200,
                  overflow: 'auto'
                }}
              >
                {source.preview || source.full_content}
              </div>

              {/* 相似度 */}
              <div style={{ marginTop: 12, textAlign: 'right' }}>
                <Tag color={source.score > 10 ? 'green' : source.score > 5 ? 'blue' : 'orange'}>
                  相似度分数: {source.score.toFixed(2)}
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
