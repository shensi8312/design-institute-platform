import React, { useRef, useEffect } from 'react'
import { Card, Badge } from 'antd'
import './ClauseRenderer.css'

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

interface ClauseRendererProps {
  clauses: Clause[]
  selectedClauseId: string | null
  onClauseClick: (clauseId: string) => void
}

const ClauseRenderer: React.FC<ClauseRendererProps> = ({
  clauses,
  selectedClauseId,
  onClauseClick
}) => {
  const selectedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  }, [selectedClauseId])

  const renderClause = (clause: Clause) => {
    const isSelected = selectedClauseId === clause.id
    const hasChange = clause.text_current !== clause.text_original

    return (
      <div
        key={clause.id}
        ref={isSelected ? selectedRef : null}
        className={`clause-block level-${clause.level} ${isSelected ? 'selected' : ''}`}
        data-clause-id={clause.id}
        onClick={() => onClauseClick(clause.id)}
        style={{
          marginBottom: 16,
          cursor: 'pointer',
          transition: 'all 0.3s'
        }}
      >
        <Card
          size="small"
          hoverable
          style={{
            borderColor: isSelected ? '#1890ff' : hasChange ? '#52c41a' : '#d9d9d9',
            borderWidth: isSelected ? 2 : 1
          }}
          extra={
            hasChange && (
              <Badge status="success" text="已修改" />
            )
          }
        >
          <div className="clause-header">
            <span className="clause-numbering" style={{ fontWeight: 'bold', marginRight: 8 }}>
              {clause.numbering}
            </span>
            <span className="clause-title" style={{ fontWeight: 500 }}>
              {clause.title}
            </span>
          </div>
          <div
            className="clause-content"
            style={{
              marginTop: 12,
              paddingLeft: clause.level * 20,
              lineHeight: 1.8,
              whiteSpace: 'pre-wrap',
              color: hasChange ? '#52c41a' : 'inherit'
            }}
          >
            {clause.text_current}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="clause-renderer" style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>
          合同正文
        </h2>
        <div style={{ textAlign: 'center', color: '#8c8c8c', marginTop: 8 }}>
          点击条款查看AI审查建议
        </div>
      </div>

      {clauses.map(clause => renderClause(clause))}
    </div>
  )
}

export default ClauseRenderer
