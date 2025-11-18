import React from 'react'
import { Card, Alert, Button, Space, Empty, Spin, Tag, Divider, Collapse } from 'antd'
import {
  WarningOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  CloseCircleOutlined,
  EditOutlined
} from '@ant-design/icons'

const { Panel } = Collapse

interface AIReviewPanelProps {
  reviewResult: any
  selectedClauseId: string | null
  loading: boolean
  onAcceptModification: (clauseId: string, newText: string) => void
  onRejectModification: (clauseId: string) => void
}

const AIReviewPanel: React.FC<AIReviewPanelProps> = ({
  reviewResult,
  selectedClauseId,
  loading,
  onAcceptModification,
  onRejectModification
}) => {
  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin tip="AI审查中..." />
        <div style={{ marginTop: 16, color: '#8c8c8c' }}>
          正在分析合同条款，请稍候...
        </div>
      </div>
    )
  }

  if (!reviewResult) {
    return (
      <div style={{ padding: 24 }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无审查结果"
        >
          <p style={{ color: '#8c8c8c', marginTop: 16 }}>
            点击顶部"开始AI审查"按钮启动智能审查
          </p>
        </Empty>
      </div>
    )
  }

  const { summary, risks, clauses, completeness } = reviewResult

  const getRiskLevelConfig = (level: string) => {
    switch (level) {
      case 'high':
        return { color: 'red', icon: <CloseCircleOutlined />, text: '高风险' }
      case 'medium':
        return { color: 'orange', icon: <WarningOutlined />, text: '中等风险' }
      case 'low':
        return { color: 'green', icon: <CheckCircleOutlined />, text: '低风险' }
      default:
        return { color: 'default', icon: <InfoCircleOutlined />, text: '未知' }
    }
  }

  const riskConfig = getRiskLevelConfig(summary?.risk_level)

  return (
    <div style={{ padding: 24 }}>
      {/* 审查摘要 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
            风险评估
          </div>
          <Tag color={riskConfig.color} icon={riskConfig.icon} style={{ fontSize: 14, padding: '4px 12px' }}>
            {riskConfig.text}
          </Tag>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        <div style={{ fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>高风险条款:</span>
            <Tag color="red">{summary?.risk_count?.high || 0}</Tag>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>中等风险:</span>
            <Tag color="orange">{summary?.risk_count?.medium || 0}</Tag>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>低风险:</span>
            <Tag color="green">{summary?.risk_count?.low || 0}</Tag>
          </div>
        </div>
      </Card>

      {/* 关键发现 */}
      {summary?.key_findings && summary.key_findings.length > 0 && (
        <Alert
          message="关键发现"
          description={
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              {summary.key_findings.map((finding: string, index: number) => (
                <li key={index} style={{ marginBottom: 4 }}>
                  {finding}
                </li>
              ))}
            </ul>
          }
          type="info"
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 高风险条款 */}
      {risks?.high_risks && risks.high_risks.length > 0 && (
        <Card
          size="small"
          title={<span><WarningOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />高风险条款</span>}
          style={{ marginBottom: 16 }}
        >
          <Collapse accordion>
            {risks.high_risks.map((risk: any, index: number) => (
              <Panel
                header={
                  <div>
                    <Tag color="red">高风险</Tag>
                    {risk.clause_title || `条款 ${index + 1}`}
                  </div>
                }
                key={index}
              >
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>风险描述:</div>
                  <div style={{ color: '#8c8c8c' }}>{risk.risk}</div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>修改建议:</div>
                  <div style={{ color: '#52c41a' }}>{risk.suggestion}</div>
                </div>
                {risk.modified_text && (
                  <Space>
                    <Button
                      type="primary"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => onAcceptModification(risk.clause_id || '', risk.modified_text)}
                    >
                      接受修改
                    </Button>
                    <Button
                      size="small"
                      onClick={() => onRejectModification(risk.clause_id || '')}
                    >
                      拒绝
                    </Button>
                  </Space>
                )}
              </Panel>
            ))}
          </Collapse>
        </Card>
      )}

      {/* 中等风险条款 */}
      {risks?.medium_risks && risks.medium_risks.length > 0 && (
        <Card
          size="small"
          title={<span><WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />中等风险条款</span>}
          style={{ marginBottom: 16 }}
        >
          <Collapse accordion>
            {risks.medium_risks.slice(0, 5).map((risk: any, index: number) => (
              <Panel
                header={
                  <div>
                    <Tag color="orange">中风险</Tag>
                    {risk.clause_title || `条款 ${index + 1}`}
                  </div>
                }
                key={index}
              >
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>风险描述:</div>
                  <div style={{ color: '#8c8c8c' }}>{risk.risk}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>建议:</div>
                  <div style={{ color: '#52c41a' }}>{risk.suggestion}</div>
                </div>
              </Panel>
            ))}
          </Collapse>
        </Card>
      )}

      {/* 完整性检查 */}
      {completeness && (
        <Card
          size="small"
          title="完整性检查"
          style={{ marginBottom: 16 }}
        >
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>完整性评分:</span>
              <Tag color={completeness.completeness_score >= 80 ? 'green' : 'orange'}>
                {completeness.completeness_score || 0}分
              </Tag>
            </div>
          </div>

          {completeness.missing_elements && completeness.missing_elements.length > 0 && (
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: 8, color: '#ff4d4f' }}>
                缺失元素:
              </div>
              <ul style={{ paddingLeft: 20, margin: 0 }}>
                {completeness.missing_elements.map((element: string, index: number) => (
                  <li key={index} style={{ color: '#8c8c8c', marginBottom: 4 }}>
                    {element}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* 关键条款信息 */}
      {clauses && (
        <Card size="small" title="关键条款">
          <div style={{ fontSize: 12, lineHeight: 2 }}>
            {clauses.parties && (
              <div>
                <span style={{ fontWeight: 'bold' }}>合同双方: </span>
                <span style={{ color: '#8c8c8c' }}>
                  {clauses.parties.party_a || '未识别'} / {clauses.parties.party_b || '未识别'}
                </span>
              </div>
            )}
            {clauses.subject && (
              <div>
                <span style={{ fontWeight: 'bold' }}>合同标的: </span>
                <span style={{ color: '#8c8c8c' }}>{clauses.subject}</span>
              </div>
            )}
            {clauses.amount && (
              <div>
                <span style={{ fontWeight: 'bold' }}>合同金额: </span>
                <span style={{ color: '#8c8c8c' }}>{clauses.amount}</span>
              </div>
            )}
            {clauses.payment_terms && (
              <div>
                <span style={{ fontWeight: 'bold' }}>付款方式: </span>
                <span style={{ color: '#8c8c8c' }}>{clauses.payment_terms}</span>
              </div>
            )}
            {clauses.duration && (
              <div>
                <span style={{ fontWeight: 'bold' }}>履行期限: </span>
                <span style={{ color: '#8c8c8c' }}>{clauses.duration}</span>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

export default AIReviewPanel
