import React, { useState, useRef, useEffect } from 'react'
import {
  Card,
  Input,
  Button,
  Upload,
  message,
  Spin,
  Progress,
  Tag,
  Tooltip,
  Space
} from 'antd'
import {
  SendOutlined,
  PaperClipOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  DownloadOutlined,
  DeleteOutlined,
  RobotOutlined,
  UserOutlined
} from '@ant-design/icons'
import type { UploadFile } from 'antd'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import './KnowledgeChat.css'

const { TextArea } = Input

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  files?: UploadFile[]
  outputFiles?: Array<{ name: string; url: string; type: string }>
  metadata?: {
    chunked?: boolean
    chunkCount?: number
    provider?: string
  }
}

const KnowledgeChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<any>(null)

  const API_BASE = '/api'
  const token = localStorage.getItem('token')

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 自动聚焦输入框
  useEffect(() => {
    inputRef.current?.focus()
  }, [loading])

  const handleSend = async () => {
    if (!inputValue.trim() && fileList.length === 0) {
      message.warning('请输入消息或上传文件')
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date().toISOString(),
      files: fileList
    }

    // 保存当前历史（发送前的状态）
    const currentHistory = messages

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    const currentFiles = [...fileList]
    setFileList([])
    setLoading(true)
    setUploadProgress(0)

    // 创建助手消息占位
    const assistantId = (Date.now() + 1).toString()
    setMessages(prev => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString()
      }
    ])

    try {
      const formData = new FormData()
      formData.append('question', inputValue)
      formData.append('scope', 'all')

      // 添加对话历史（使用保存的历史 + 当前用户消息）
      const recentHistory = [...currentHistory, userMessage].slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }))
      formData.append('history', JSON.stringify(recentHistory))

      // 添加文件
      currentFiles.forEach(file => {
        if (file.originFileObj) {
          formData.append('files', file.originFileObj)
        }
      })

      setUploadProgress(50)

      // 使用fetch接收SSE流式响应
      const response = await fetch(`${API_BASE}/knowledge/chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      setUploadProgress(100)

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      if (!reader) {
        throw new Error('无法读取响应流')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'))

        for (const line of lines) {
          const data = line.replace('data: ', '').trim()
          if (!data) continue

          try {
            const parsed = JSON.parse(data)

            if (parsed.type === 'chunk') {
              // 逐字追加内容
              fullContent += parsed.content
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === assistantId
                    ? { ...msg, content: fullContent }
                    : msg
                )
              )
            } else if (parsed.type === 'done') {
              // 流式输出完成
              message.success('回答完成')
            } else if (parsed.type === 'error') {
              throw new Error(parsed.message || '生成失败')
            }
          } catch (e) {
            console.warn('解析SSE数据失败:', e)
          }
        }
      }
    } catch (error: any) {
      message.error('发送失败: ' + (error.message || '未知错误'))
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantId
            ? { ...msg, content: '抱歉，处理失败，请稍后重试。' }
            : msg
        )
      )
    } finally {
      setLoading(false)
      setUploadProgress(0)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'pdf':
        return <FilePdfOutlined style={{ color: '#ff4d4f' }} />
      case 'docx':
      case 'doc':
        return <FileWordOutlined style={{ color: '#1890ff' }} />
      default:
        return <FileTextOutlined style={{ color: '#52c41a' }} />
    }
  }

  return (
    <div className="knowledge-chat-container">
      {/* 消息列表区域 */}
      <div className="messages-container">
        {messages.length === 0 && (
          <div className="empty-state">
            <RobotOutlined style={{ fontSize: 64, color: '#d9d9d9', marginBottom: 16 }} />
            <h3>智能问答助手</h3>
            <p style={{ color: '#999' }}>
              支持上传文档进行问答、翻译、分析
              <br />
              <Tag color="blue">PDF</Tag>
              <Tag color="green">Word</Tag>
              <Tag color="orange">TXT</Tag>
            </p>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`message-item ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`}
          >
            <div className="message-avatar">
              {msg.role === 'user' ? (
                <UserOutlined style={{ fontSize: 20 }} />
              ) : (
                <RobotOutlined style={{ fontSize: 20 }} />
              )}
            </div>

            <div className="message-content">
              {/* 用户文件附件 */}
              {msg.files && msg.files.length > 0 && (
                <div className="message-files">
                  {msg.files.map((file, idx) => (
                    <div key={idx} className="file-attachment">
                      {getFileIcon(file.name)}
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">
                        {((file.size || 0) / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 消息文本 */}
              <div className="message-text">
                {msg.role === 'assistant' ? (
                  <div className="markdown-content">
                    <ReactMarkdown>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>

              {/* 助手元数据 */}
              {msg.metadata && (
                <div className="message-metadata">
                  {msg.metadata.chunked && (
                    <Tag color="processing" icon={<Spin size="small" />}>
                      分块处理 ({msg.metadata.chunkCount}块)
                    </Tag>
                  )}
                  {msg.metadata.provider && (
                    <Tag color="blue">{msg.metadata.provider}</Tag>
                  )}
                </div>
              )}

              {/* 输出文件下载 */}
              {msg.outputFiles && msg.outputFiles.length > 0 && (
                <div className="output-files">
                  {msg.outputFiles.map((file, idx) => (
                    <a
                      key={idx}
                      href={file.url}
                      download={file.name}
                      className="output-file-link"
                    >
                      <DownloadOutlined />
                      {file.name}
                    </a>
                  ))}
                </div>
              )}

              {/* 时间戳 */}
              <div className="message-time">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="message-item assistant-message">
            <div className="message-avatar">
              <RobotOutlined style={{ fontSize: 20 }} />
            </div>
            <div className="message-content">
              <Spin />
              {uploadProgress > 0 && uploadProgress < 100 && (
                <Progress
                  percent={uploadProgress}
                  size="small"
                  style={{ marginTop: 8 }}
                />
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="input-container">
        {/* 文件预览区 */}
        {fileList.length > 0 && (
          <div className="file-preview-area">
            {fileList.map(file => (
              <div key={file.uid} className="file-preview-item">
                {getFileIcon(file.name)}
                <span className="file-name">{file.name}</span>
                <span className="file-size">
                  {((file.size || 0) / 1024).toFixed(1)} KB
                </span>
                <DeleteOutlined
                  className="file-remove-btn"
                  onClick={() =>
                    setFileList(fileList.filter(f => f.uid !== file.uid))
                  }
                />
              </div>
            ))}
          </div>
        )}

        {/* 输入框 */}
        <div className="input-wrapper">
          <Upload
            beforeUpload={file => {
              setFileList([...fileList, file as any])
              return false
            }}
            fileList={[]}
            multiple
            accept=".pdf,.doc,.docx,.txt"
            showUploadList={false}
          >
            <Button
              icon={<PaperClipOutlined />}
              type="text"
              size="large"
              disabled={loading}
              className="attach-btn"
            />
          </Upload>

          <TextArea
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter发送，Shift+Enter换行)"
            autoSize={{ minRows: 1, maxRows: 6 }}
            disabled={loading}
            className="message-input"
          />

          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
            disabled={!inputValue.trim() && fileList.length === 0}
            size="large"
            className="send-btn"
          >
            发送
          </Button>
        </div>

        <div className="input-hint">
          <Space size={16}>
            <span>支持上传 PDF、Word、TXT 文件</span>
            <span>|</span>
            <span>智能分块处理长文档</span>
            <span>|</span>
            <span>自动导出 Word</span>
          </Space>
        </div>
      </div>
    </div>
  )
}

export default KnowledgeChat
