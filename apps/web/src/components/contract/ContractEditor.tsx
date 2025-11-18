import React, { useState, useEffect } from 'react'
import { Layout, Button, Space, message, Spin, Modal } from 'antd'
import {
  CloseOutlined,
  SaveOutlined,
  ExportOutlined,
  ReloadOutlined,
  RobotOutlined
} from '@ant-design/icons'
import axios from '../../utils/axios'
import ClauseRenderer from './ClauseRenderer'
import AIReviewPanel from './AIReviewPanel'

const { Header, Content, Sider } = Layout

interface Document {
  id: string
  title: string
  document_type: string
  file_path: string
}

interface ContractEditorProps {
  document: Document
  projectId: string
  onClose: () => void
}

interface Clause {
  id: string
  clause_code: string
  title: string
  text_original: string
  text_current: string
  level: number
  numbering: string
  has_modification: boolean
}

interface AIReviewResult {
  jobId?: string
  status?: string
  summary?: {
    risk_level: 'high' | 'medium' | 'low'
    risk_count: {
      high: number
      medium: number
      low: number
    }
    key_findings: string[]
  }
  risks?: {
    high_risks: any[]
    medium_risks: any[]
    low_risks: any[]
  }
  clauses?: any
  completeness?: any
}

const ContractEditor: React.FC<ContractEditorProps> = ({
  document,
  projectId,
  onClose
}) => {
  const [clauses, setClauses] = useState<Clause[]>([])
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiReviewResult, setAiReviewResult] = useState<AIReviewResult | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)

  useEffect(() => {
    loadDocumentClauses()
    loadAIReview()
  }, [document.id])

  const loadDocumentClauses = async () => {
    try {
      setLoading(true)
      // TODO: 调用Docling解析API获取结构化条款
      // 目前使用模拟数据
      const mockClauses: Clause[] = [
        {
          id: 'clause_1',
          clause_code: '1',
          title: '合同双方',
          text_original: '甲方：XXX公司\n乙方：YYY公司',
          text_current: '甲方：XXX公司\n乙方：YYY公司',
          level: 1,
          numbering: '第一条',
          has_modification: false
        },
        {
          id: 'clause_2',
          clause_code: '2',
          title: '合同标的',
          text_original: '本合同标的为XXX项目的设计服务。',
          text_current: '本合同标的为XXX项目的设计服务。',
          level: 1,
          numbering: '第二条',
          has_modification: false
        },
        {
          id: 'clause_3',
          clause_code: '3',
          title: '合同金额及支付方式',
          text_original: '合同总金额为人民币100万元整。',
          text_current: '合同总金额为人民币100万元整。',
          level: 1,
          numbering: '第三条',
          has_modification: false
        }
      ]
      setClauses(mockClauses)
    } catch (error) {
      console.error('加载文档条款失败:', error)
      message.error('加载文档失败')
    } finally {
      setLoading(false)
    }
  }

  const loadAIReview = async () => {
    try {
      setReviewLoading(true)
      // 检查是否已有审查结果
      const response = await axios.get(`/api/ai-review/jobs/latest`, {
        params: { documentId: document.id }
      })

      if (response.data.success && response.data.data) {
        setAiReviewResult(response.data.data)
      }
    } catch (error) {
      console.error('加载AI审查结果失败:', error)
    } finally {
      setReviewLoading(false)
    }
  }

  const handleStartAIReview = async () => {
    try {
      setReviewLoading(true)
      const response = await axios.post('/api/ai-review/start', {
        documentId: document.id,
        projectId: projectId
      })

      if (response.data.success) {
        message.success('AI审查已启动，请稍候...')
        const jobId = response.data.data.jobId

        // 轮询任务状态
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await axios.get(`/api/ai-review/jobs/${jobId}`)
            if (statusResponse.data.success) {
              const job = statusResponse.data.data

              if (job.status === 'completed') {
                clearInterval(pollInterval)
                setAiReviewResult(job.result)
                message.success('AI审查完成')
                setReviewLoading(false)
              } else if (job.status === 'failed') {
                clearInterval(pollInterval)
                message.error('AI审查失败: ' + (job.error || '未知错误'))
                setReviewLoading(false)
              }
            }
          } catch (error) {
            clearInterval(pollInterval)
            setReviewLoading(false)
          }
        }, 3000)
      }
    } catch (error: any) {
      console.error('启动AI审查失败:', error)
      message.error(error.response?.data?.message || '启动AI审查失败')
      setReviewLoading(false)
    }
  }

  const handleAcceptModification = (clauseId: string, newText: string) => {
    setClauses(prev =>
      prev.map(clause =>
        clause.id === clauseId
          ? { ...clause, text_current: newText, has_modification: true }
          : clause
      )
    )
    message.success('已接受修改建议')
  }

  const handleRejectModification = (clauseId: string) => {
    message.info('已拒绝修改建议')
  }

  const handleSave = async () => {
    try {
      // TODO: 保存修改后的条款
      message.success('保存成功')
    } catch (error) {
      message.error('保存失败')
    }
  }

  const handleExport = async () => {
    Modal.confirm({
      title: '导出合同',
      content: '是否将当前合同导出为Word文档？',
      onOk: async () => {
        try {
          // TODO: 调用导出API
          message.success('导出成功')
        } catch (error) {
          message.error('导出失败')
        }
      }
    })
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    )
  }

  return (
    <Layout style={{ height: '100vh' }}>
      {/* 顶部工具栏 */}
      <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0 }}>{document.title}</h3>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<RobotOutlined />}
              onClick={handleStartAIReview}
              loading={reviewLoading}
            >
              {aiReviewResult ? '重新审查' : '开始AI审查'}
            </Button>
            <Button icon={<SaveOutlined />} onClick={handleSave}>
              保存
            </Button>
            <Button icon={<ExportOutlined />} onClick={handleExport}>
              导出Word
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadDocumentClauses}>
              刷新
            </Button>
            <Button icon={<CloseOutlined />} onClick={onClose}>
              关闭
            </Button>
          </Space>
        </div>
      </Header>

      <Layout>
        {/* 左侧：条款内容 */}
        <Content style={{ padding: '24px', overflow: 'auto', background: '#fff' }}>
          <ClauseRenderer
            clauses={clauses}
            selectedClauseId={selectedClauseId}
            onClauseClick={setSelectedClauseId}
          />
        </Content>

        {/* 右侧：AI审查面板 */}
        <Sider
          width={450}
          style={{
            background: '#fafafa',
            borderLeft: '1px solid #f0f0f0',
            overflow: 'auto'
          }}
        >
          <AIReviewPanel
            reviewResult={aiReviewResult}
            selectedClauseId={selectedClauseId}
            loading={reviewLoading}
            onAcceptModification={handleAcceptModification}
            onRejectModification={handleRejectModification}
          />
        </Sider>
      </Layout>
    </Layout>
  )
}

export default ContractEditor
